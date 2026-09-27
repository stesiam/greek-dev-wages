# Πρόβλεψη ετήσιου καθαρού μισθού προγραμματιστών
# Σύγκριση μοντέλων με tidymodels

suppressPackageStartupMessages({
  library(readxl)
  library(stringr)
  library(forcats)
  library(readr)
  library(tidymodels)
})
tidymodels_prefer()
set.seed(2024)
dir.create("output", showWarnings = FALSE)

# Παράλληλη εκτέλεση του tuning (αν υπάρχει το future)
if (requireNamespace("future", quietly = TRUE)) {
  future::plan(future::multisession, workers = max(1, parallel::detectCores() - 2))
}

# -----------------------------------------------------------------------------
# 1. Φόρτωση & καθαρισμός
# -----------------------------------------------------------------------------
raw <- read_excel("survey.xlsx", sheet = "Main")
greece_map <- read_excel("survey.xlsx", sheet = "GreeceMap", col_names = c("city", "country")) |>
  distinct(city, .keep_all = TRUE)

d <- raw |>
  transmute(
    salary      = `[Fixed] Ποιος είναι ο ΕΤΗΣΙΟΣ ΚΑΘΑΡΟΣ μισθός σου σε €;`,
    years       = `Πόσα χρόνια δουλεύεις επαγγελματικά ως προγραμματιστής;`,
    freelance   = `Έχεις προσωπικά projects ή κάνεις freelancing πέρα από την κύρια εργασία σου;`,
    gender      = `Φύλλο;`,
    work_mode   = `Ποιος είναι ο τρόπος εργασίας;`,
    live_city   = `Σε ποια πόλη μένεις;`,
    work_region = `[GROUP] Σε ποια πόλη δουλεύεις, Αττική ή Υπόλοιπη Ελλάδα`,
    company     = `Τι μέγεθος είναι η εταιρεία που δουλεύεις;`,
    manager     = `Έχεις άτομα υπό την επίβλεψη σου;`,
    education   = `Ποιό είναι το επίπεδο σπουδών σου;`,
    dev_types   = `[NORMALIZED] Με τι είδος development ασχολείσαι επαγγελματικά αυτή την περίοδο;`,
    languages   = `[NORMALIZED] Με ποιες γλώσσες προγραμματισμού δουλεύεις επαγγελματικά αυτή την περίοδο;`
  ) |>
  left_join(greece_map, by = c("live_city" = "city")) |>
  mutate(
    log_salary  = log(salary),
    freelance   = factor(freelance == "Ναι", labels = c("no", "yes")),
    manager     = factor(manager == "Ναι", labels = c("no", "yes")),
    female      = factor(coalesce(gender == "Γυναίκα", FALSE), labels = c("no", "yes")),
    work_mode   = factor(recode(work_mode, "Απομακρυσμένα" = "remote",
                                "Στον χώρο του εργοδότη" = "office", "Και τα δύο" = "hybrid")),
    work_region = factor(recode(work_region, "Αττική" = "attica",
                                "Υπόλοιπη Ελλάδα" = "rest_greece", "-" = "abroad")),
    lives_abroad = factor(coalesce(country == "Εξωτερικό", FALSE), labels = c("no", "yes")),
    company     = factor(company, levels = c("1 - 10", "11 - 50", "51 - 100",
                                             "101 - 200", "201 - 500", "501+")),
    company_rank = as.integer(company),
    education   = factor(recode(education,
                                "Χωρίς Δευτεροβάθμια Εκπαίδευση" = "secondary_or_less",
                                "Λύκειο" = "secondary_or_less", "ΙΕΚ" = "iek",
                                "Bachelor's" = "bachelor", "Master" = "master", "PhD" = "phd")),
    n_types     = str_count(dev_types, ",") + 1,
    n_langs     = str_count(languages, ",") + 1
  )

# Multi-select πεδία -> δίτιμες μεταβλητές για τις συχνές τιμές (>= 15 απαντήσεις)
multi_hot <- function(x, prefix, min_n = 15) {
  items <- str_split(x, ",\\s*")
  counts <- table(unlist(items))
  keep <- names(counts)[counts >= min_n & names(counts) != "-"]
  out <- map(keep, \(k) as.integer(map_lgl(items, \(v) k %in% v)))
  names(out) <- paste0(prefix, str_to_lower(keep) |> str_replace_all("#", "sharp") |>
    str_replace_all("\\+", "p") |> str_replace_all("[^a-z0-9]+", "_") |> str_remove_all("^_|_$"))
  as_tibble(out)
}

d <- d |>
  bind_cols(multi_hot(d$dev_types, "type_"), multi_hot(d$languages, "lang_")) |>
  select(-salary, -gender, -live_city, -country, -dev_types, -languages)

stopifnot(nrow(d) == nrow(raw))
cat("Διαστάσεις dataset μοντελοποίησης:", dim(d), "\n")
stopifnot(!anyNA(d))

# -----------------------------------------------------------------------------
# 2. Train / test split & resampling
# -----------------------------------------------------------------------------
split  <- initial_split(d, prop = 0.8, strata = log_salary)
train  <- training(split)
test   <- testing(split)
folds  <- vfold_cv(train, v = 5, repeats = 3, strata = log_salary)

# -----------------------------------------------------------------------------
# 3. Recipes
# -----------------------------------------------------------------------------
# Για γραμμικά / αποστασιακά μοντέλα: log-έτη, dummies, κανονικοποίηση
rec_linear <- recipe(log_salary ~ ., data = train) |>
  step_mutate(log_years = log1p(years)) |>
  step_rm(company) |>
  step_dummy(all_nominal_predictors()) |>
  step_zv(all_predictors()) |>
  step_normalize(all_numeric_predictors())

# Για δέντρα: χωρίς κανονικοποίηση
rec_tree <- recipe(log_salary ~ ., data = train) |>
  step_rm(company) |>
  step_dummy(all_nominal_predictors()) |>
  step_zv(all_predictors())

# -----------------------------------------------------------------------------
# 4. Μοντέλα
# -----------------------------------------------------------------------------
m_null  <- null_model() |> set_engine("parsnip") |> set_mode("regression")
m_enet  <- linear_reg(penalty = tune(), mixture = tune()) |> set_engine("glmnet")
m_knn   <- nearest_neighbor(neighbors = tune(), weight_func = tune()) |>
  set_engine("kknn") |> set_mode("regression")
m_svm   <- svm_rbf(cost = tune(), rbf_sigma = tune()) |>
  set_engine("kernlab") |> set_mode("regression")
m_tree  <- decision_tree(cost_complexity = tune(), tree_depth = tune(), min_n = tune()) |>
  set_engine("rpart") |> set_mode("regression")
m_rf    <- rand_forest(mtry = tune(), min_n = tune(), trees = 1000) |>
  set_engine("ranger", importance = "permutation") |> set_mode("regression")
m_xgb   <- boost_tree(trees = tune(), tree_depth = tune(), learn_rate = tune(),
                      min_n = tune(), mtry = tune(), sample_size = tune(),
                      loss_reduction = tune()) |>
  set_engine("xgboost") |> set_mode("regression")

linear_models <- list(baseline = m_null, elastic_net = m_enet, svm_rbf = m_svm)

# Το kknn θέλει τη βιβλιοθήκη συστήματος libglpk (sudo apt install libglpk40)
if (!inherits(try(loadNamespace("kknn"), silent = TRUE), "try-error")) {
  linear_models$knn <- m_knn
} else {
  message("Το kknn δεν φορτώνει — παραλείπεται το KNN")
}

wf_set <- bind_rows(
  workflow_set(list(linear = rec_linear), linear_models, cross = TRUE),
  workflow_set(list(tree = rec_tree),
               list(cart = m_tree, random_forest = m_rf, xgboost = m_xgb), cross = TRUE)
)

# Εύρος mtry: με βάση τον αριθμό predictors μετά το recipe
n_pred <- ncol(bake(prep(rec_tree), new_data = NULL)) - 1
for (id in c("tree_random_forest", "tree_xgboost")) {
  wf_set <- option_add(wf_set, id = id,
    param_info = extract_parameter_set_dials(extract_workflow(wf_set, id)) |>
      update(mtry = mtry(c(2L, n_pred))))
}

# -----------------------------------------------------------------------------
# 5. Tuning με cross-validation
# -----------------------------------------------------------------------------
metrics <- metric_set(rmse, mae, rsq)
t0 <- Sys.time()
results <- workflow_map(
  wf_set, "tune_grid", resamples = folds, grid = 25, metrics = metrics,
  seed = 2024, verbose = TRUE,
  control = control_grid(save_pred = FALSE, parallel_over = "everything")
)
cat("Χρόνος tuning:", format(Sys.time() - t0), "\n")

cv_best <- rank_results(results, rank_metric = "rmse", select_best = TRUE) |>
  select(wflow_id, .metric, mean, std_err, rank) |>
  pivot_wider(names_from = .metric, values_from = c(mean, std_err)) |>
  arrange(mean_rmse)
print(cv_best)

# -----------------------------------------------------------------------------
# 6. Τελική αξιολόγηση στο test set (κάθε μοντέλο με τις καλύτερες παραμέτρους)
# -----------------------------------------------------------------------------
fit_final <- function(id) {
  res  <- extract_workflow_set_result(results, id)
  best <- if (nrow(collect_metrics(res)) > 3) select_best(res, metric = "rmse") else tibble()
  wf   <- extract_workflow(results, id)
  if (nrow(best) > 0) wf <- finalize_workflow(wf, best)
  last_fit(wf, split, metrics = metrics)
}
final_fits <- set_names(results$wflow_id) |> map(fit_final)

euro_metrics <- function(lf) {
  p <- collect_predictions(lf)
  tibble(
    rmse_log  = rmse_vec(p$log_salary, p$.pred),
    r2_log    = rsq_vec(p$log_salary, p$.pred),
    mae_eur   = mean(abs(exp(p$log_salary) - exp(p$.pred))),
    medae_eur = median(abs(exp(p$log_salary) - exp(p$.pred))),
    mape_pct  = 100 * mean(abs(exp(p$log_salary) - exp(p$.pred)) / exp(p$log_salary))
  )
}
test_results <- imap(final_fits, \(lf, id) euro_metrics(lf) |> mutate(model = id, .before = 1)) |>
  list_rbind() |>
  arrange(rmse_log)
print(test_results, width = Inf)
write_csv(test_results, "output/test_results.csv")

# One-SE rule: από τα μοντέλα με CV RMSE εντός 1 SE του καλύτερου,
# διαλέγουμε το απλούστερο. Το Elastic Net είναι πρώτο: είναι γραμμικό σε log(μισθό)
# (εξίσωση Mincer) και η ποινή σταθεροποιεί τους συσχετισμένους συντελεστές
# των τεχνολογιών (Zou & Hastie, 2005).
simplicity <- c("linear_elastic_net", "tree_cart", "linear_knn",
                "linear_svm_rbf", "tree_random_forest", "tree_xgboost")
threshold <- cv_best$mean_rmse[1] + cv_best$std_err_rmse[1]
within_1se <- cv_best$wflow_id[cv_best$mean_rmse <= threshold]
best_id <- intersect(simplicity, within_1se)[1]
cat("\nΜοντέλα εντός 1 SE του καλύτερου:", paste(within_1se, collapse = ", "), "\n")
cat("Επιλεγμένο μοντέλο (one-SE rule):", best_id, "\n")
print(select_best(extract_workflow_set_result(results, best_id), metric = "rmse"))
saveRDS(extract_workflow(final_fits[[best_id]]), "output/best_model.rds")
saveRDS(results, "output/tuning_results.rds")

# -----------------------------------------------------------------------------
# 6b. Τελικό μοντέλο: ίδιες παράμετροι, εκπαίδευση σε ΟΛΑ τα δεδομένα
# -----------------------------------------------------------------------------
# Η απόδοση που αναφέρουμε είναι αυτή του test set (ενότητα 6)· εδώ απλώς
# αξιοποιούμε και το 20% του test για το μοντέλο που θα χρησιμοποιηθεί.
best_params <- select_best(extract_workflow_set_result(results, best_id), metric = "rmse")
production_model <- extract_workflow(results, best_id) |>
  finalize_workflow(best_params) |>
  fit(data = d)
saveRDS(production_model, "output/final_model.rds")

# Έλεγχος: οι προβλέψεις του τελικού μοντέλου στο test set πρέπει να είναι
# πολύ κοντά σε αυτές του μοντέλου που εκπαιδεύτηκε μόνο στο 80%
pred_full <- predict(production_model, test)$.pred
pred_80   <- collect_predictions(final_fits[[best_id]]) |> arrange(.row) |> pull(.pred)
cat(sprintf("Τελικό μοντέλο (n = %d) αποθηκεύτηκε στο output/final_model.rds\n", nrow(d)))
cat(sprintf("Συσχέτιση προβλέψεων 80%% vs 100%% μοντέλου στο test: %.3f\n",
            cor(pred_full, pred_80)))

# -----------------------------------------------------------------------------
# 7. Γραφήματα
# -----------------------------------------------------------------------------
ink <- "#0b0b0b"; ink2 <- "#52514e"; muted <- "#898781"; blue <- "#2a78d6"; grey <- "#b4b2ab"
theme_clean <- theme_minimal(base_size = 12) +
  theme(plot.background = element_rect(fill = "#fcfcfb", colour = NA),
        panel.grid.minor = element_blank(), panel.grid.major.y = element_blank(),
        panel.grid.major.x = element_line(colour = "#e6e5e0", linewidth = 0.4),
        axis.text = element_text(colour = ink2), axis.title = element_text(colour = ink2),
        plot.title = element_text(colour = ink, face = "bold"),
        plot.subtitle = element_text(colour = ink2), plot.title.position = "plot")

pretty_name <- function(x) str_remove(x, "^(linear|tree)_")

# 7a. Σύγκριση μοντέλων στο CV (± 1 SE)
p1 <- cv_best |>
  mutate(model = fct_reorder(pretty_name(wflow_id), -mean_rmse),
         best = wflow_id == best_id) |>
  ggplot(aes(x = mean_rmse, y = model, colour = best)) +
  geom_vline(xintercept = threshold, colour = muted, linetype = "dotted") +
  geom_errorbar(aes(xmin = mean_rmse - std_err_rmse, xmax = mean_rmse + std_err_rmse),
                width = 0, linewidth = 2, orientation = "y") +
  geom_point(size = 3.2) +
  scale_colour_manual(values = c(`FALSE` = grey, `TRUE` = blue), guide = "none") +
  labs(title = "Σύγκριση μοντέλων (5-fold CV × 3)",
       subtitle = "RMSE σε log(μισθό), μικρότερο = καλύτερο · γραμμή = ±1 SE ·\nδιακεκομμένη = όριο one-SE rule · μπλε = επιλεγμένο",
       x = "RMSE (log €)", y = NULL) +
  theme_clean
ggsave("output/model_comparison.png", p1, width = 7, height = 4.2, dpi = 150)

# 7b. Πρόβλεψη vs πραγματικός μισθός (test set, καλύτερο μοντέλο)
pred_best <- collect_predictions(final_fits[[best_id]])
p2 <- ggplot(pred_best, aes(exp(log_salary), exp(.pred))) +
  geom_abline(colour = muted, linetype = "dashed") +
  geom_point(colour = blue, alpha = 0.6, size = 2.2) +
  scale_x_log10(labels = label_currency(prefix = "€", big.mark = ",", accuracy = 1)) +
  scale_y_log10(labels = label_currency(prefix = "€", big.mark = ",", accuracy = 1)) +
  labs(title = paste("Πρόβλεψη vs πραγματικός μισθός —", pretty_name(best_id)),
       subtitle = sprintf("Test set (n = %d) · λογαριθμικοί άξονες", nrow(pred_best)),
       x = "Πραγματικός ετήσιος καθαρός", y = "Πρόβλεψη") +
  theme_clean + theme(panel.grid.major.y = element_line(colour = "#e6e5e0", linewidth = 0.4))
ggsave("output/pred_vs_actual.png", p2, width = 6.5, height = 5.5, dpi = 150)

# 7c. Σημαντικότητα μεταβλητών (permutation, random forest)
rf_fit <- extract_fit_engine(final_fits[["tree_random_forest"]])
imp <- tibble(variable = names(rf_fit$variable.importance),
              importance = rf_fit$variable.importance) |>
  slice_max(importance, n = 15)
write_csv(imp, "output/rf_importance.csv")
p3 <- ggplot(imp, aes(importance, fct_reorder(variable, importance))) +
  geom_col(fill = blue, width = 0.7) +
  labs(title = "Σημαντικότερες μεταβλητές (Random Forest)",
       subtitle = "Permutation importance — αύξηση MSE όταν ανακατεύεται η μεταβλητή",
       x = "Importance", y = NULL) +
  theme_clean
ggsave("output/rf_importance.png", p3, width = 7, height = 5, dpi = 150)

cat("\nΤα αποτελέσματα αποθηκεύτηκαν στο output/\n")
