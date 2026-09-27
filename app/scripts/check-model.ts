// Ελέγχει ότι η υλοποίηση σε TS δίνει τις ίδιες προβλέψεις με το R.
// Τρέχει με: npm run check-model
import cases from '../src/model.test-cases.json' with { type: 'json' }
import { featuresFromRaw, predictLog } from '../src/model.ts'

let maxDiff = 0
for (const { expected, ...raw } of cases as Record<string, string | number>[]) {
  maxDiff = Math.max(maxDiff, Math.abs(predictLog(featuresFromRaw(raw)) - Number(expected)))
}
console.log(`${cases.length} περιπτώσεις, μέγιστη διαφορά log-πρόβλεψης: ${maxDiff.toExponential(2)}`)
if (maxDiff > 1e-9) process.exit(1)
