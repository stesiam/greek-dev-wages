import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Κάθε γλώσσα έχει δικό της URL και δικό της στατικό HTML: / (αγγλικά) και /el (ελληνικά).
// Πρέπει να συμφωνεί με το langFromPath στο src/i18n/index.ts.
const PAGES = {
  en: {
    path: '/',
    ogLocale: 'en_US',
    title: 'Developer Salary',
    ogTitle: 'How much does a developer with your profile earn?',
    description:
      'Estimate how much a developer with your profile earns in Greece, based on 939 responses to the 2024 Greek developer salary survey.',
  },
  el: {
    path: '/el',
    ogLocale: 'el_GR',
    title: 'Μισθός Προγραμματιστή',
    ogTitle: 'Πόσο πληρώνεται ένας προγραμματιστής με το προφίλ σου;',
    description:
      'Υπολόγισε πόσο πληρώνεται ένας προγραμματιστής με το προφίλ σου στην Ελλάδα, με βάση 939 απαντήσεις της έρευνας μισθών προγραμματιστών 2024.',
  },
}
type Lang = keyof typeof PAGES

// Απόλυτα URLs (για canonical, hreflang, og:url). Αλλάζει με SITE_URL=https://... npm run build
const siteUrl = process.env.SITE_URL ?? 'https://dev-wages.stesiam.com'

function head(lang: Lang) {
  const p = PAGES[lang]
  const tags = [
    `<title>${p.title}</title>`,
    `<meta name="description" content="${p.description}" />`,
    // Προεπισκόπηση όταν κοινοποιείται το link (LinkedIn, Slack, Facebook κ.λπ.)
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="${p.ogLocale}" />`,
    `<meta property="og:title" content="${p.ogTitle}" />`,
    `<meta property="og:description" content="${p.description}" />`,
  ]
  if (siteUrl) {
    const url = (l: Lang) => siteUrl.replace(/\/$/, '') + PAGES[l].path
    tags.push(
      `<link rel="canonical" href="${url(lang)}" />`,
      `<meta property="og:url" content="${url(lang)}" />`,
      ...(Object.keys(PAGES) as Lang[]).map((l) => `<link rel="alternate" hreflang="${l}" href="${url(l)}" />`),
      `<link rel="alternate" hreflang="x-default" href="${url('en')}" />`,
    )
  }
  return tags.map((t) => `    ${t}`).join('\n')
}

const render = (html: string, lang: Lang) =>
  html.replace('%APP_LANG%', lang).replace('    <!--app-head-->', head(lang))

const langOf = (url = '/'): Lang => (/^\/el(\/|$|\?|#)/.test(url) ? 'el' : 'en')

function localizedHtml(): Plugin {
  let outDir = 'dist'
  return {
    name: 'localized-html',
    configResolved(config) {
      outDir = config.build.outDir
    },
    transformIndexHtml(html, ctx) {
      // Στο dev server το ίδιο index.html σερβίρεται και στο /el, οπότε η γλώσσα βγαίνει από το URL.
      // Στο build μένει ως πρότυπο και γίνεται δύο αρχεία στο writeBundle.
      return ctx.server ? render(html, langOf(ctx.originalUrl)) : html
    },
    configurePreviewServer(server) {
      // Όπως στο Vercel (vercel.json): το /el σερβίρει το el/index.html
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/el(\?|$)/.test(req.url)) req.url = req.url.replace(/^\/el/, '/el/')
        next()
      })
    },
    writeBundle() {
      const template = readFileSync(join(outDir, 'index.html'), 'utf-8')
      writeFileSync(join(outDir, 'index.html'), render(template, 'en'))
      mkdirSync(join(outDir, 'el'), { recursive: true })
      writeFileSync(join(outDir, 'el', 'index.html'), render(template, 'el'))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), localizedHtml()],
})
