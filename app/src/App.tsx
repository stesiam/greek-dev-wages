import { useMemo, useState } from 'react'
import { Chip, Question, Section, Segmented } from './components/controls'
import { NavBar } from './components/NavBar'
import { ResultPanel } from './components/ResultPanel'
import { I18nContext, useLangState } from './i18n'
import { predict, type Profile } from './model'

const TYPES: [string, string][] = [
  ['type_backend', 'Backend'],
  ['type_frontend', 'Frontend'],
  ['type_mobile_apps', 'Mobile Apps'],
  ['type_sre_devops', 'SRE / DevOps'],
  ['type_ai_ml', 'AI / ML'],
  ['type_desktop_apps', 'Desktop Apps'],
  ['type_fpga_asic_embedded', 'Embedded / FPGA'],
  ['type_bi_data_analysis', 'BI / Data Analysis'],
  ['type_cybersecurity', 'Cybersecurity'],
  ['type_qa_engineer_qa_automation_engineer', 'QA / Automation'],
]

const LANGS: [string, string][] = [
  ['lang_javascript', 'JavaScript'],
  ['lang_python', 'Python'],
  ['lang_java', 'Java'],
  ['lang_csharp', 'C#'],
  ['lang_php', 'PHP'],
  ['lang_typescript', 'TypeScript'],
  ['lang_bash', 'Bash'],
  ['lang_kotlin', 'Kotlin'],
  ['lang_go', 'Go'],
  ['lang_cpp', 'C++'],
  ['lang_sql', 'SQL'],
  ['lang_c', 'C'],
  ['lang_swift', 'Swift'],
  ['lang_dart', 'Dart'],
  ['lang_ruby', 'Ruby'],
]

const COMPANY_SIZES = ['1–10', '11–50', '51–100', '101–200', '201–500', '501+']

const DEFAULT_PROFILE: Profile = {
  years: 5,
  workRegion: 'attica',
  livesAbroad: 'no',
  workMode: 'hybrid',
  companyRank: 6,
  manager: 'no',
  freelance: 'no',
  education: 'bachelor',
  gender: 'unspecified',
  types: ['type_backend'],
  otherTypes: false,
  langs: ['lang_javascript'],
  otherLangs: false,
}

export default function App() {
  const i18n = useLangState()
  const { t, formatEuro } = i18n
  const yesNo = [
    { value: 'no' as const, label: t.no },
    { value: 'yes' as const, label: t.yes },
  ]
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
  const prediction = useMemo(() => predict(profile), [profile])

  const set = <K extends keyof Profile>(key: K) => (value: Profile[K]) =>
    setProfile((p) => ({ ...p, [key]: value }))
  const toggle = (key: 'types' | 'langs', item: string) =>
    setProfile((p) => ({
      ...p,
      [key]: p[key].includes(item) ? p[key].filter((x) => x !== item) : [...p[key], item],
    }))

  const noTech = profile.langs.length === 0 && !profile.otherLangs

  return (
    <I18nContext value={i18n}>
      <div className="min-h-screen pb-24 lg:pb-0">
        <NavBar />
        <header className="mx-auto max-w-6xl px-4 pt-8 pb-8 sm:px-6 sm:pt-12">
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{t.hero.eyebrow}</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t.hero.title}
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
            {t.hero.lead}
          </p>
        </header>

        <main className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
          <div className="space-y-5">
            <Section step={1} title={t.experience.title}>
              <Question label={t.experience.years}>
                <div className="flex items-center gap-5">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={profile.years}
                    onChange={(e) => set('years')(Number(e.target.value))}
                    aria-label={t.experience.yearsAria}
                    className="h-2 w-full cursor-pointer accent-indigo-600"
                  />
                  <span className="w-20 shrink-0 text-right text-2xl font-semibold tabular-nums">
                    {profile.years}
                    <span className="ml-1 text-sm font-normal text-zinc-500">{t.experience.yearUnit(profile.years)}</span>
                  </span>
                </div>
              </Question>
              <Question label={t.experience.manager}>
                <Segmented label={t.experience.managerAria} options={yesNo} value={profile.manager} onChange={set('manager')} />
              </Question>
            </Section>

            <Section step={2} title={t.work.title}>
              <Question label={t.work.region}>
                <Segmented
                  label={t.work.regionAria}
                  value={profile.workRegion}
                  onChange={set('workRegion')}
                  options={[
                    { value: 'attica', label: t.work.attica },
                    { value: 'rest_greece', label: t.work.restGreece },
                    { value: 'abroad', label: t.work.abroad },
                  ]}
                />
              </Question>
              <Question label={t.work.livesIn}>
                <Segmented
                  label={t.work.livesInAria}
                  value={profile.livesAbroad}
                  onChange={set('livesAbroad')}
                  options={[
                    { value: 'no', label: t.work.greece },
                    { value: 'yes', label: t.work.abroad },
                  ]}
                />
              </Question>
              <Question label={t.work.mode}>
                <Segmented
                  label={t.work.modeAria}
                  value={profile.workMode}
                  onChange={set('workMode')}
                  options={[
                    { value: 'remote', label: 'Remote' },
                    { value: 'hybrid', label: 'Hybrid' },
                    { value: 'office', label: t.work.office },
                  ]}
                />
              </Question>
              <Question label={t.work.size}>
                <Segmented
                  label={t.work.sizeAria}
                  value={profile.companyRank}
                  onChange={set('companyRank')}
                  options={COMPANY_SIZES.map((label, i) => ({ value: i + 1, label }))}
                />
              </Question>
              <Question label={t.work.freelance}>
                <Segmented label={t.work.freelanceAria} options={yesNo} value={profile.freelance} onChange={set('freelance')} />
              </Question>
            </Section>

            <Section step={3} title={t.tech.title}>
              <Question label={t.tech.types} hint={t.pickAll}>
                <div className="flex flex-wrap gap-2">
                  {TYPES.map(([key, label]) => (
                    <Chip key={key} selected={profile.types.includes(key)} onClick={() => toggle('types', key)}>
                      {label}
                    </Chip>
                  ))}
                  <Chip selected={profile.otherTypes} onClick={() => set('otherTypes')(!profile.otherTypes)}>
                    {t.other}
                  </Chip>
                </div>
              </Question>
              <Question label={t.tech.langs} hint={t.pickAllLangs}>
                <div className="flex flex-wrap gap-2">
                  {LANGS.map(([key, label]) => (
                    <Chip key={key} selected={profile.langs.includes(key)} onClick={() => toggle('langs', key)}>
                      {label}
                    </Chip>
                  ))}
                  <Chip selected={profile.otherLangs} onClick={() => set('otherLangs')(!profile.otherLangs)}>
                    {t.otherLang}
                  </Chip>
                </div>
                {noTech && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                    {t.tech.noLang}
                  </p>
                )}
              </Question>
            </Section>

            <Section step={4} title={t.profile.title}>
              <Question label={t.profile.education}>
                <Segmented
                  label={t.profile.educationAria}
                  value={profile.education}
                  onChange={set('education')}
                  options={[
                    { value: 'secondary_or_less', label: t.profile.secondary },
                    { value: 'iek', label: t.profile.iek },
                    { value: 'bachelor', label: t.profile.bachelor },
                    { value: 'master', label: 'Master' },
                    { value: 'phd', label: 'PhD' },
                  ]}
                />
              </Question>
              <Question label={t.profile.gender} hint={t.profile.genderHint}>
                <Segmented
                  label={t.profile.gender}
                  value={profile.gender}
                  onChange={set('gender')}
                  options={[
                    { value: 'male', label: t.profile.male },
                    { value: 'female', label: t.profile.female },
                    { value: 'unspecified', label: t.profile.noAnswer },
                  ]}
                />
              </Question>
            </Section>

            <button
              type="button"
              onClick={() => setProfile(DEFAULT_PROFILE)}
              className="cursor-pointer text-sm font-medium text-zinc-500 underline-offset-4 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200"
            >
              {t.reset}
            </button>
          </div>

          <aside id="result" className="scroll-mt-20 lg:sticky lg:top-20 lg:self-start">
            <ResultPanel p={prediction} />
          </aside>
        </main>

        {/* Σε κινητό: η εκτίμηση μένει πάντα ορατή στο κάτω μέρος */}
        <a
          href="#result"
          className="fixed inset-x-3 bottom-3 flex items-center justify-between rounded-2xl bg-zinc-900 px-5 py-3.5 text-white shadow-2xl ring-1 ring-white/10 lg:hidden"
        >
          <span className="text-sm text-zinc-400">{t.estimate}</span>
          <span className="text-xl font-bold tabular-nums">{formatEuro(prediction.salary)}</span>
        </a>
      </div>
    </I18nContext>
  )
}
