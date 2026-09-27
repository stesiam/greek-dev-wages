/** Στρογγυλοποίηση στο πλησιέστερο `step` (όπως εμφανίζονται τα ποσά). */
export const roundTo = (x: number, step = 100) => Math.round(x / step) * step

/** Μορφοποιητής ποσών σε € για ένα locale· στρογγυλεύει στο πλησιέστερο `step`. */
export function makeFormatEuro(locale: string) {
  const euro = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  return (x: number, step = 100) => euro.format(roundTo(x, step))
}

/** Σχετική μεταβολή ως ποσοστό με πρόσημο, π.χ. +12% ή −5%. */
export const formatChange = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`
