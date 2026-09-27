import type { ReactNode } from 'react'
import { pathFor, useI18n } from '../i18n'
import { useTheme } from '../theme'

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden>
    {path}
  </svg>
)

const sun = icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>)
const moon = icon(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />)

const buttonClass =
  'flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'

function ThemeToggle() {
  const { t } = useI18n()
  const [theme, toggle] = useTheme()
  // Δείχνει το θέμα στο οποίο θα μεταβεί
  const label = theme === 'dark' ? t.nav.toLight : t.nav.toDark
  return (
    <button type="button" onClick={toggle} title={label} aria-label={label} className={buttonClass}>
      {theme === 'dark' ? sun : moon}
    </button>
  )
}

function LanguageToggle() {
  const { t, lang, setLang } = useI18n()
  const other = lang === 'el' ? 'en' : 'el'
  // Πραγματικό link (για crawlers και «άνοιγμα σε νέα καρτέλα»)· με απλό κλικ αλλάζει χωρίς reload
  return (
    <a
      href={pathFor(other)}
      hrefLang={other}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        setLang(other)
      }}
      title={t.nav.switchTo}
      aria-label={`${t.nav.language}: ${lang.toUpperCase()}. ${t.nav.switchTo}`}
      className={buttonClass}
    >
      {icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>)}
      <span className="text-xs font-semibold uppercase">{lang}</span>
    </a>
  )
}

export function NavBar() {
  const { t } = useI18n()
  return (
    <nav className="sticky top-0 z-20 border-b border-zinc-200/80 bg-stone-100/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2.5 font-semibold tracking-tight">
          {/* Lucide "code-xml" (ISC) */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-6 text-indigo-600 dark:text-indigo-400" aria-hidden>
            <path d="m18 16 4-4-4-4" />
            <path d="m6 8-4 4 4 4" />
            <path d="m14.5 4-5 16" />
          </svg>
          {t.appName}
        </a>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
