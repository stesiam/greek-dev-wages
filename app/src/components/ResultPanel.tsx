import type { Prediction } from '../model'
import { formatChange, roundTo } from '../format'
import { useI18n } from '../i18n'
import { engine, nTrain } from '../model'

// Λογαριθμική κλίμακα για τη μπάρα εύρους
const SCALE_MIN = 8_000
const SCALE_MAX = 120_000
const pos = (x: number) => {
  const t = Math.log(x / SCALE_MIN) / Math.log(SCALE_MAX / SCALE_MIN)
  return `${Math.min(100, Math.max(0, t * 100))}%`
}

function RangeBar({ p }: { p: Prediction }) {
  const { formatEuro } = useI18n()
  return (
    <div>
      <div className="relative h-2.5 rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 rounded-full bg-indigo-400/40"
          style={{ left: pos(p.low), right: `calc(100% - ${pos(p.high)})` }}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-900 bg-white shadow transition-[left] duration-300"
          style={{ left: pos(p.salary) }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-zinc-400 tabular-nums">
        <span>{formatEuro(SCALE_MIN, 1000)}</span>
        <span>{formatEuro(30_000, 1000)}</span>
        <span>{formatEuro(SCALE_MAX, 1000)}</span>
      </div>
    </div>
  )
}

function Contributions({ p }: { p: Prediction }) {
  const { t } = useI18n()
  const shown = p.contributions.filter((c) => Math.abs(c.effect) >= 0.005).slice(0, 6)
  const maxAbs = Math.max(0.25, ...shown.map((c) => Math.abs(c.effect)))
  return (
    <ul className="space-y-2.5">
      {shown.map(({ group, effect }) => {
        const width = `${(Math.abs(effect) / maxAbs) * 50}%`
        const positive = effect > 0
        return (
          <li key={group} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3 text-sm">
            <span className="truncate text-zinc-600 dark:text-zinc-300">{t.groups[group]}</span>
            <span className="relative h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span className="absolute inset-y-0 left-1/2 w-px bg-zinc-300 dark:bg-zinc-600" />
              <span
                className={`absolute inset-y-0 transition-all duration-300 ${
                  positive ? 'left-1/2 rounded-r-full bg-emerald-500' : 'right-1/2 rounded-l-full bg-rose-500'
                }`}
                style={{ width }}
              />
            </span>
            <span className="text-right font-medium text-zinc-800 tabular-nums dark:text-zinc-200">{formatChange(effect)}</span>
          </li>
        )
      })}
      {shown.length === 0 && (
        <li className="text-sm text-zinc-500">{t.result.nearAverage}</li>
      )}
    </ul>
  )
}

function GenderGap({ p }: { p: Prediction }) {
  const { t, formatEuro } = useI18n()
  const { male, female } = p.byGender
  const rows = [
    { label: t.profile.male, value: male, color: 'bg-indigo-500' },
    { label: t.profile.female, value: female, color: 'bg-amber-500' },
  ]
  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold">{t.result.gapTitle}</h3>
      <p className="mt-1 mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        {t.result.gapSub}
      </p>
      <ul className="space-y-2.5">
        {rows.map(({ label, value, color }) => (
          <li key={label} className="grid grid-cols-[4.5rem_1fr_5.5rem] items-center gap-3 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">{label}</span>
            <span className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span
                className={`block h-full rounded-full transition-all duration-300 ${color}`}
                style={{ width: `${(value / male) * 100}%` }}
              />
            </span>
            <span className="text-right font-medium text-zinc-800 tabular-nums dark:text-zinc-200">{formatEuro(value)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:bg-white/5 dark:text-zinc-300">
        {/* Διαφορά των στρογγυλεμένων ποσών, ώστε να συμφωνεί με ό,τι βλέπει ο χρήστης */}
        {t.result.gapText(formatEuro(roundTo(male) - roundTo(female)))}
      </p>
    </div>
  )
}

export function ResultPanel({ p }: { p: Prediction }) {
  const { t, formatEuro } = useI18n()
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-zinc-900 p-6 text-white shadow-xl shadow-zinc-900/10 ring-1 ring-white/10 dark:bg-gradient-to-br dark:from-indigo-950 dark:to-zinc-900 dark:shadow-indigo-950/40 dark:ring-indigo-400/20">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-zinc-400">{t.result.heading}</p>
          <span
            title={t.result.dataYearHint}
            className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-zinc-300"
          >
            {t.result.dataYear}
          </span>
        </div>
        <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums" aria-live="polite">
          {formatEuro(p.salary)}
        </p>
        {/* 14 μισθοί στην Ελλάδα, 12 συνήθως στο εξωτερικό */}
        <div className="mt-3 grid grid-cols-2 divide-x divide-white/10 rounded-xl bg-white/5 py-2.5 text-center">
          {[14, 12].map((n) => (
            <div key={n}>
              <p className="font-semibold tabular-nums">
                {formatEuro(p.salary / n, 10)} <span className="text-xs font-normal text-zinc-400">{t.result.perMonth}</span>
              </p>
              <p className="text-xs text-zinc-400">{t.result.payments(n)}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <RangeBar p={p} />
          <p className="mt-4 text-xs text-zinc-400">{t.result.range}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatEuro(p.low)} – {formatEuro(p.high)}
          </p>
        </div>

        <div className="mt-5 rounded-xl bg-white/5 px-4 py-3 text-sm text-zinc-300">
          {t.result.percentile(p.percentile)}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">{t.result.driversTitle}</h3>
        <p className="mt-1 mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          {t.result.driversSub(formatEuro(p.average))}
        </p>
        <Contributions p={p} />
      </div>

      <GenderGap p={p} />

      <p className="px-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t.result.footnote(nTrain, t.result.modelName[engine])}
      </p>
    </div>
  )
}
