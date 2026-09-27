// Υλοποίηση του γραμμικού μοντέλου (lm ή Elastic Net, εξάγεται από το export_model.R).
// log(μισθός) = intercept + Σ coefficient_j * feature_j

import model from './model.json' with { type: 'json' }

export const coefficients: Record<string, number> = model.coefficients
export const means: Record<string, number> = model.means
export const factorLevels: Record<string, string[]> = model.factor_levels
export const testRmse = model.test_rmse
export const nTrain = model.n_train
export const engine = model.engine as 'lm' | 'glmnet'

export type RawRecord = Record<string, string | number>

/**
 * Μετατρέπει μια εγγραφή με τις στήλες του dataset (όπως τις βλέπει το recipe)
 * στα features του μοντέλου: log_years + dummy encoding με reference το πρώτο επίπεδο.
 */
export function featuresFromRaw(raw: RawRecord): Record<string, number> {
  const features: Record<string, number> = {}
  for (const name of Object.keys(coefficients)) features[name] = 0

  for (const [key, value] of Object.entries(raw)) {
    if (key in factorLevels) {
      const levels = factorLevels[key]
      if (!levels.includes(String(value))) throw new Error(`Άγνωστο επίπεδο ${key}=${value}`)
      for (const level of levels.slice(1)) {
        const dummy = `${key}_${level}`
        if (dummy in features) features[dummy] = value === level ? 1 : 0
      }
    } else if (key in features) {
      features[key] = Number(value)
    }
  }
  features.log_years = Math.log1p(Number(raw.years))
  return features
}

export function predictLog(features: Record<string, number>): number {
  let total = model.intercept
  for (const [name, coef] of Object.entries(coefficients)) total += coef * features[name]
  return total
}

// ---------------------------------------------------------------------------
// Προφίλ όπως το συμπληρώνει ο χρήστης
// ---------------------------------------------------------------------------

export type Gender = 'male' | 'female' | 'unspecified'

export interface Profile {
  years: number
  workRegion: 'attica' | 'rest_greece' | 'abroad'
  livesAbroad: 'no' | 'yes'
  workMode: 'remote' | 'hybrid' | 'office'
  companyRank: number // 1 = 1-10 ... 6 = 501+
  manager: 'no' | 'yes'
  freelance: 'no' | 'yes'
  education: 'secondary_or_less' | 'iek' | 'bachelor' | 'master' | 'phd'
  gender: Gender
  types: string[] // π.χ. "type_backend"
  otherTypes: boolean
  langs: string[] // π.χ. "lang_python"
  otherLangs: boolean
}

export const typeFeatures = Object.keys(coefficients).filter((k) => k.startsWith('type_'))
export const langFeatures = Object.keys(coefficients).filter((k) => k.startsWith('lang_'))

export function profileToFeatures(p: Profile): Record<string, number> {
  const raw: RawRecord = {
    years: p.years,
    work_region: p.workRegion,
    lives_abroad: p.livesAbroad,
    work_mode: p.workMode,
    company_rank: p.companyRank,
    manager: p.manager,
    freelance: p.freelance,
    education: p.education,
    female: p.gender === 'female' ? 'yes' : 'no',
    n_types: Math.max(1, p.types.length + (p.otherTypes ? 1 : 0)),
    n_langs: Math.max(1, p.langs.length + (p.otherLangs ? 1 : 0)),
  }
  for (const t of typeFeatures) raw[t] = p.types.includes(t) ? 1 : 0
  for (const l of langFeatures) raw[l] = p.langs.includes(l) ? 1 : 0

  const features = featuresFromRaw(raw)
  // Χωρίς απάντηση στο φύλο: χρησιμοποιούμε τη μέση τιμή του δείγματος
  if (p.gender === 'unspecified') features.female_yes = means.female_yes
  return features
}

// ---------------------------------------------------------------------------
// Πρόβλεψη, εύρος και ερμηνεία
// ---------------------------------------------------------------------------

const Z80 = 1.2816 // 80% διάστημα κανονικής

export type FactorGroup =
  | 'experience' | 'location' | 'company' | 'workMode' | 'manager'
  | 'freelance' | 'education' | 'gender' | 'tech'

function groupOf(feature: string): FactorGroup {
  if (feature === 'years' || feature === 'log_years') return 'experience'
  if (feature.startsWith('work_region_') || feature.startsWith('lives_abroad_')) return 'location'
  if (feature === 'company_rank') return 'company'
  if (feature.startsWith('work_mode_')) return 'workMode'
  if (feature.startsWith('manager_')) return 'manager'
  if (feature.startsWith('freelance_')) return 'freelance'
  if (feature.startsWith('education_')) return 'education'
  if (feature.startsWith('female_')) return 'gender'
  return 'tech'
}

export interface Prediction {
  salary: number
  low: number
  high: number
  average: number // πρόβλεψη για τον «μέσο» συμμετέχοντα
  percentile: number // % συμμετεχόντων με χαμηλότερο μισθό
  contributions: { group: FactorGroup; effect: number }[] // πολλαπλασιαστική επίδραση − 1
  byGender: { male: number; female: number } // ίδιο προφίλ, αλλάζει μόνο το φύλο
}

const averageLog = predictLog(means)

export function predict(p: Profile): Prediction {
  const features = profileToFeatures(p)
  const logSalary = predictLog(features)

  const byGroup = new Map<FactorGroup, number>()
  for (const [name, coef] of Object.entries(coefficients)) {
    const g = groupOf(name)
    byGroup.set(g, (byGroup.get(g) ?? 0) + coef * (features[name] - means[name]))
  }

  const salary = Math.exp(logSalary)
  const percentile = model.salary_percentiles.filter((q) => q < salary).length

  return {
    salary,
    low: Math.exp(logSalary - Z80 * testRmse),
    high: Math.exp(logSalary + Z80 * testRmse),
    average: Math.exp(averageLog),
    percentile,
    contributions: [...byGroup.entries()]
      .map(([group, c]) => ({ group, effect: Math.exp(c) - 1 }))
      .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect)),
    byGender: {
      male: Math.exp(predictLog(profileToFeatures({ ...p, gender: 'male' }))),
      female: Math.exp(predictLog(profileToFeatures({ ...p, gender: 'female' }))),
    },
  }
}
