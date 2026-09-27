# Εκτίμηση μισθού developer

React + Tailwind εφαρμογή που κάνει πρόβλεψη με το Elastic Net του `../salary_models.R`.
Η πρόβλεψη γίνεται στον browser· δεν χρειάζεται server ή R.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # στατικά αρχεία στο dist/
```

## Ενημέρωση μοντέλου

Μετά από νέα εκπαίδευση (`Rscript salary_models.R`), από τον φάκελο του project:

```bash
Rscript export_model.R        # γράφει src/model.json και src/model.test-cases.json
cd app && npm run check-model # ελέγχει ότι η TS υλοποίηση δίνει ίδιες προβλέψεις με το R
```

## Γλώσσες

- `/` αγγλικά, `/el` ελληνικά. Το build βγάζει `dist/index.html` και `dist/el/index.html`, το καθένα με δικό του `lang`, title, description και Open Graph (βλ. `localizedHtml` στο `vite.config.ts`).
- Τα `canonical`/`hreflang`/`og:url` χρησιμοποιούν το https://dev-wages.stesiam.com· για άλλο domain: `SITE_URL=https://... npm run build`.
