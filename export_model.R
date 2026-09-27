# =============================================================================
# Εξαγωγή του τελικού γραμμικού μοντέλου (lm ή Elastic Net) σε JSON για την εφαρμογή React
#
# Το μοντέλο είναι γραμμικό: log(μισθός) = b0 + Σ b_j * x_j
# Μετατρέπουμε τους συντελεστές από την κανονικοποιημένη κλίμακα
# (step_normalize) στην αρχική, ώστε ο browser να χρειάζεται μόνο
# το dummy encoding και ένα άθροισμα.
# =============================================================================

suppressPackageStartupMessages({
  library(tidymodels)
  library(jsonlite)
  library(readr)
  library(stringr)
})

model  <- readRDS("output/final_model.rds")
# Ποιο μοντέλο επέλεξε ο one-SE rule στο salary_models.R (lm ή glmnet)
engine   <- extract_spec_parsnip(model)$engine
model_id <- c(lm = "linear_lm", glmnet = "linear_elastic_net")[[engine]]
recipe <- extract_recipe(model)
ptype  <- extract_mold(model)$blueprint$ptypes$predictors

norm_step <- which(map_chr(recipe$steps, \(s) class(s)[1]) == "step_normalize")
norm <- tidy(recipe, number = norm_step) |>
  select(term = terms, statistic, value) |>
  pivot_wider(names_from = statistic, values_from = value)

coefs <- tidy(model) |>
  select(term, estimate) |>
  left_join(norm, by = "term")

b <- coefs |> filter(term != "(Intercept)")
raw_coefs <- setNames(b$estimate / b$sd, b$term)
intercept <- coefs$estimate[coefs$term == "(Intercept)"] - sum(b$estimate * b$mean / b$sd)

# Επίπεδα των κατηγορικών (το πρώτο είναι το reference του step_dummy)
factor_levels <- ptype |> select(where(is.factor)) |> map(levels)

# Μέσοι όροι (μετά το dummy encoding): για την ερμηνεία «σε σχέση με τον
# μέσο συμμετέχοντα» και για όποιον δεν θέλει να απαντήσει σε μια ερώτηση
feature_means <- setNames(b$mean, b$term)

# Κατανομή μισθών της έρευνας, για να δείξουμε σε ποιο εκατοστημόριο πέφτει η πρόβλεψη
salaries <- readxl::read_excel("survey.xlsx")[["[Fixed] Ποιος είναι ο ΕΤΗΣΙΟΣ ΚΑΘΑΡΟΣ μισθός σου σε €;"]]
salary_percentiles <- unname(quantile(salaries, probs = 1:99 / 100))

# RMSE στο test set, για το εύρος πρόβλεψης
test_rmse <- read_csv("output/test_results.csv", show_col_types = FALSE) |>
  filter(model == model_id) |> pull(rmse_log)

# -----------------------------------------------------------------------------
# Τυχαία προφίλ + προβλέψεις του R, για να ελέγξουμε την υλοποίηση σε JS
# -----------------------------------------------------------------------------
set.seed(1)
n <- 200
binary_cols <- names(ptype)[str_detect(names(ptype), "^(type|lang)_")]
cases <- tibble(years = sample(0:30, n, replace = TRUE))
for (f in names(factor_levels)) {
  cases[[f]] <- factor(sample(factor_levels[[f]], n, replace = TRUE), levels = factor_levels[[f]])
}
for (col in binary_cols) cases[[col]] <- rbinom(n, 1, 0.2)
cases <- cases |>
  mutate(company_rank = as.integer(company),
         n_types = pmax(1, rowSums(across(starts_with("type_"))) + rbinom(n, 1, 0.2)),
         n_langs = pmax(1, rowSums(across(starts_with("lang_"))) + rbinom(n, 1, 0.2)))
cases$expected <- predict(model, cases)$.pred

dir.create("app/src", recursive = TRUE, showWarnings = FALSE)
write_json(
  list(engine = engine, intercept = intercept, coefficients = as.list(raw_coefs),
       means = as.list(feature_means), salary_percentiles = salary_percentiles,
       factor_levels = factor_levels, test_rmse = test_rmse,
       n_train = nrow(extract_mold(model)$outcomes)),
  "app/src/model.json", auto_unbox = TRUE, digits = NA, pretty = TRUE
)
write_json(cases |> mutate(across(where(is.factor), as.character)),
           "app/src/model.test-cases.json", digits = NA)

cat("Εξήχθησαν", length(raw_coefs), "συντελεστές και", n, "test cases στο app/src/\n")
