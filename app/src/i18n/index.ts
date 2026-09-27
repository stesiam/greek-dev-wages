// Γλώσσα εφαρμογής: ορίζεται από το URL (/ = αγγλικά, /el = ελληνικά), ζει στο App και διανέμεται μέσω context.
// Κάθε URL έχει δικό του στατικό HTML με τα σωστά meta (βλ. localizedHtml στο vite.config.ts).

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { makeFormatEuro } from '../format'
import { STRINGS, type Lang } from './strings'

export type { Lang } from './strings'

export const pathFor = (lang: Lang) => (lang === 'el' ? '/el' : '/')

const langFromPath = (): Lang => (/^\/el(\/|$)/.test(location.pathname) ? 'el' : 'en')

function build(lang: Lang, setLang: (l: Lang) => void) {
  const t = STRINGS[lang]
  return { lang, setLang, t, formatEuro: makeFormatEuro(t.locale) }
}

export type I18n = ReturnType<typeof build>

export function useLangState(): I18n {
  const [lang, setLangState] = useState<Lang>(langFromPath)

  // Πίσω/μπροστά στον browser ανάμεσα σε / και /el
  useEffect(() => {
    const onPop = () => setLangState(langFromPath())
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = STRINGS[lang].appName
  }, [lang])

  return useMemo(() => {
    // Αλλαγή γλώσσας χωρίς reload, ώστε να μη χάνονται οι απαντήσεις της φόρμας
    const setLang = (l: Lang) => {
      if (l === lang) return
      history.pushState(null, '', pathFor(l) + location.search + location.hash)
      setLangState(l)
    }
    return build(lang, setLang)
  }, [lang])
}

export const I18nContext = createContext<I18n>(build('en', () => {}))

export const useI18n = () => useContext(I18nContext)
