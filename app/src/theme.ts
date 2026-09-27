// Θέμα εμφάνισης: αρχικά ακολουθεί το σύστημα· μόλις ο χρήστης το αλλάξει, η επιλογή αποθηκεύεται.
// Το αρχικό θέμα εφαρμόζεται ήδη από ένα script στο index.html, πριν το πρώτο render.

import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

const systemTheme = (): Theme => (darkQuery.matches ? 'dark' : 'light')

export function useTheme() {
  const [chosen, setChosen] = useState<Theme | null>(readStored)
  const [system, setSystem] = useState<Theme>(systemTheme)
  const theme = chosen ?? system

  useEffect(() => {
    const onChange = () => setSystem(systemTheme())
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
  }, [theme])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setChosen(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // π.χ. ιδιωτική περιήγηση: το θέμα απλώς δεν θυμάται
    }
  }

  return [theme, toggle] as const
}
