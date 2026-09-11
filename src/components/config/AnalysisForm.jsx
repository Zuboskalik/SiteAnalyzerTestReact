import { useMemo, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Globe, Loader2, Plus, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { mockAnalysisFormDefaults } from '@/mocks/semanticData'
import { loadSourceText } from '@/services/analysisRunner'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { PresetSelect } from './PresetSelect'
import { buildAnalysisRequest, hasErrors, isHttpUrl, validateAnalysisForm } from './validateAnalysisForm'

const AUDIENCE_PRESETS = [
  'Students & career starters',
  'General consumers',
  'Small business owners',
  'B2B decision makers',
  'Industry professionals',
]
const PURPOSE_PRESETS = [
  'Informational',
  'Commercial investigation',
  'Transactional',
  'Navigational',
  'Informational & commercial',
]
const NICHE_PRESETS = [
  'Education & careers',
  'Finance & accounting',
  'Legal services',
  'Healthcare',
  'E-commerce & retail',
  'SaaS & technology',
  'Local services',
]

const CONTENT_SCOPES = [
  { value: 'complete_article', label: 'Complete article' },
  { value: 'specific_section', label: 'Specific section' },
]
const CHUNKING_STRATEGIES = [
  {
    value: 'layout',
    label: 'Layout-based (Fast Mapping)',
    hint: 'Chunks follow the page structure: each heading with its paragraphs.',
  },
  {
    value: 'semantic',
    label: 'Semantic AI Chunking',
    hint: 'Sentences are embedded and grouped where the topic shifts, regardless of layout.',
  },
]

const MAX_COMPETITORS = 10

const initialValues = () => ({ ...mockAnalysisFormDefaults, competitorUrls: [...mockAnalysisFormDefaults.competitorUrls] })

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  )
}

function FormAlert({ title, children }) {
  return (
    <div
      role="alert"
      className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="grid gap-0.5">
        {title && <p className="font-medium">{title}</p>}
        <p>{children}</p>
      </div>
    </div>
  )
}

function GroupTitle({ children, hint }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
      {hint && <span className="ml-1 font-normal normal-case tracking-normal">{hint}</span>}
    </h3>
  )
}

/** Props for a validated text control: invalid state plus its error message id. */
const errorProps = (id, message) => ({
  'aria-invalid': Boolean(message),
  'aria-describedby': message ? `${id}-error` : undefined,
})

export function AnalysisForm() {
  const embeddingMode = useSettingsStore((state) => state.embeddingMode)
  const openaiApiKey = useSettingsStore((state) => state.openaiApiKey)
  const status = useAnalysisStore((state) => state.status)
  const analysisError = useAnalysisStore((state) => state.error)
  const runAnalysis = useAnalysisStore((state) => state.runAnalysis)

  const [values, setValues] = useState(initialValues)
  const [showErrors, setShowErrors] = useState(false)
  const [fetchState, setFetchState] = useState({ status: 'idle', url: '', mode: '', text: '', message: '' })
  const [focusCompetitorIndex, setFocusCompetitorIndex] = useState(null)
  const formRef = useRef(null)

  const errors = useMemo(
    () => validateAnalysisForm(values, { embeddingMode, openaiApiKey }),
    [values, embeddingMode, openaiApiKey],
  )
  const visibleErrors = showErrors ? errors : {}
  const running = status === 'running'
  // A fetch only counts for the URL and embedding mode it was made with.
  const currentFetch = fetchState.url === values.url.trim() && fetchState.mode === embeddingMode ? fetchState : null
  const strategyHint = CHUNKING_STRATEGIES.find((strategy) => strategy.value === values.chunkingStrategy)?.hint

  const setField = (field) => (value) => setValues((previous) => ({ ...previous, [field]: value }))
  const onInput = (field) => (event) => setField(field)(event.target.value)

  const focusFirstInvalid = () =>
    requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())

  async function handleFetch() {
    const url = values.url.trim()
    if (!isHttpUrl(url)) {
      setShowErrors(true)
      focusFirstInvalid()
      return
    }
    setFetchState({ status: 'loading', url, mode: embeddingMode, text: '', message: '' })
    try {
      const text = await loadSourceText({ sourceType: 'url', url }, embeddingMode)
      const size = text.length.toLocaleString()
      setFetchState({
        status: 'ready',
        url,
        mode: embeddingMode,
        text,
        message: embeddingMode === 'mock' ? `Demo mode: sample article loaded (${size} chars)` : `Ready: ${size} chars indexed`,
      })
    } catch (error) {
      setFetchState({ status: 'error', url, mode: embeddingMode, text: '', message: error.message })
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    setShowErrors(true)
    if (hasErrors(errors)) {
      focusFirstInvalid()
      return
    }
    runAnalysis(buildAnalysisRequest(values, currentFetch?.status === 'ready' ? currentFetch.text : undefined))
  }

  const updateCompetitor = (index, url) =>
    setValues((previous) => ({
      ...previous,
      competitorUrls: previous.competitorUrls.map((current, i) => (i === index ? url : current)),
    }))
  const addCompetitor = () => {
    setFocusCompetitorIndex(values.competitorUrls.length)
    setValues((previous) => ({ ...previous, competitorUrls: [...previous.competitorUrls, ''] }))
  }
  const removeCompetitor = (index) => {
    setFocusCompetitorIndex(null)
    setValues((previous) => ({
      ...previous,
      competitorUrls: previous.competitorUrls.filter((_, i) => i !== index),
    }))
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate aria-busy={running} className="grid min-w-0 gap-6">
      <fieldset disabled={running} className="grid min-w-0 gap-6">
        <legend className="sr-only">Analysis configuration</legend>

        <div className="grid gap-2">
          <Label htmlFor="keyword">Target keyword / prompt</Label>
          <Input
            id="keyword"
            value={values.keyword}
            onChange={onInput('keyword')}
            placeholder="e.g. how to become an accountant in the uk"
            {...errorProps('keyword', visibleErrors.keyword)}
          />
          <FieldError id="keyword-error" message={visibleErrors.keyword} />
        </div>

        <Tabs value={values.sourceType} onValueChange={setField('sourceType')} className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span id="content-source-label" className="text-sm font-medium">
              Content source
            </span>
            <TabsList aria-labelledby="content-source-label">
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="text">Text</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="url" className="grid gap-2">
            <Label htmlFor="source-url" className="sr-only">
              Page URL
            </Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Globe
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="source-url"
                  type="url"
                  inputMode="url"
                  className="pl-8"
                  value={values.url}
                  onChange={onInput('url')}
                  placeholder="https://example.com/article"
                  {...errorProps('source-url', visibleErrors.url)}
                />
              </div>
              <Button type="button" variant="secondary" onClick={handleFetch} disabled={currentFetch?.status === 'loading'}>
                {currentFetch?.status === 'loading' && <Loader2 className="animate-spin" aria-hidden="true" />}
                Fetch
              </Button>
            </div>
            <FieldError id="source-url-error" message={visibleErrors.url} />
            <div aria-live="polite">
              {currentFetch?.status === 'ready' && (
                <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
                  {currentFetch.message}
                </p>
              )}
              {currentFetch?.status === 'error' && <FormAlert>{currentFetch.message}</FormAlert>}
            </div>
            <p className="text-xs text-muted-foreground">
              {embeddingMode === 'mock'
                ? 'Demo mode simulates fetching: any URL loads the sample article.'
                : 'The page is fetched from your browser. Sites that block cross-origin requests have to be pasted as text.'}
            </p>
          </TabsContent>

          <TabsContent value="text" className="grid gap-2">
            <Label htmlFor="source-text" className="sr-only">
              Content text
            </Label>
            <Textarea
              id="source-text"
              rows={8}
              value={values.text}
              onChange={onInput('text')}
              placeholder="Paste the content. Separate paragraphs with a blank line; start headings with # to keep their level."
              {...errorProps('source-text', visibleErrors.text)}
            />
            <div className="flex gap-3 text-xs">
              <FieldError id="source-text-error" message={visibleErrors.text} />
              <span className="ml-auto tabular-nums text-muted-foreground">
                {values.text.length.toLocaleString()} chars
              </span>
            </div>
          </TabsContent>
        </Tabs>

        <div className="grid gap-3">
          <GroupTitle hint="(optional)">Semantic context</GroupTitle>
          <div className="grid gap-4 sm:grid-cols-3">
            <PresetSelect
              id="target-audience"
              label="Target audience"
              presets={AUDIENCE_PRESETS}
              value={values.targetAudience}
              onChange={setField('targetAudience')}
              customPlaceholder="e.g. students looking to join a career in accountancy"
            />
            <PresetSelect
              id="content-purpose"
              label="Content purpose"
              presets={PURPOSE_PRESETS}
              value={values.contentPurpose}
              onChange={setField('contentPurpose')}
              customPlaceholder="e.g. informative and commercial"
            />
            <PresetSelect
              id="website-niche"
              label="Website niche"
              presets={NICHE_PRESETS}
              value={values.websiteNiche}
              onChange={setField('websiteNiche')}
              customPlaceholder="e.g. third-party education website"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="content-scope">Content scope</Label>
            <Select value={values.contentScope} onValueChange={setField('contentScope')}>
              <SelectTrigger id="content-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_SCOPES.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    {scope.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {values.contentScope === 'specific_section' && (
              <>
                <Label htmlFor="section-heading" className="mt-1">
                  Section heading
                </Label>
                <Input
                  id="section-heading"
                  value={values.sectionHeading}
                  onChange={onInput('sectionHeading')}
                  placeholder="e.g. Accountancy apprenticeships"
                  {...errorProps('section-heading', visibleErrors.sectionHeading)}
                />
                <FieldError id="section-heading-error" message={visibleErrors.sectionHeading} />
              </>
            )}
          </div>

          <div className="grid content-start gap-2">
            <Label htmlFor="chunking-strategy">Vector algorithm</Label>
            <Select value={values.chunkingStrategy} onValueChange={setField('chunkingStrategy')}>
              <SelectTrigger id="chunking-strategy" className="w-full" aria-describedby="chunking-strategy-hint">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHUNKING_STRATEGIES.map((strategy) => (
                  <SelectItem key={strategy.value} value={strategy.value}>
                    {strategy.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="chunking-strategy-hint" className="text-xs text-muted-foreground">
              {strategyHint}
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <GroupTitle hint="(optional)">Competitor pages</GroupTitle>
          {values.competitorUrls.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add competitor URLs to compare their pages with yours in the same vector space.
            </p>
          )}
          {values.competitorUrls.length > 0 && (
            <ul className="grid gap-2">
              {values.competitorUrls.map((url, index) => {
                const id = `competitor-${index}`
                const error = visibleErrors.competitorUrls?.[index]
                return (
                  <li key={index} className="grid gap-1">
                    <div className="flex gap-2">
                      <Label htmlFor={id} className="sr-only">
                        Competitor URL {index + 1}
                      </Label>
                      <Input
                        id={id}
                        type="url"
                        inputMode="url"
                        value={url}
                        autoFocus={index === focusCompetitorIndex}
                        onChange={(event) => updateCompetitor(index, event.target.value)}
                        placeholder="https://competitor.com/page"
                        {...errorProps(id, error)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCompetitor(index)}
                        aria-label={`Remove competitor URL ${index + 1}`}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </div>
                    <FieldError id={`${id}-error`} message={error} />
                  </li>
                )
              })}
            </ul>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={addCompetitor}
            disabled={values.competitorUrls.length >= MAX_COMPETITORS}
          >
            <Plus aria-hidden="true" />
            Add competitor URL
          </Button>
        </div>
      </fieldset>

      <div className="grid gap-3">
        {visibleErrors.apiKey && <FormAlert>{visibleErrors.apiKey}</FormAlert>}
        {status === 'error' && analysisError && <FormAlert title="Analysis failed">{analysisError.message}</FormAlert>}
        <Button
          type="submit"
          size="lg"
          disabled={running}
          className="h-11 bg-linear-to-r from-violet-600 to-fuchsia-500 px-6 text-white hover:opacity-90 sm:justify-self-end"
        >
          {running ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {running ? 'Analyzing content…' : 'Run Semantic Analysis'}
        </Button>
      </div>
    </form>
  )
}
