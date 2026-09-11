import { AlertCircle, BookOpen, Lightbulb, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * @typedef {import('../../types/models').DeepAnalysis} DeepAnalysis
 */

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function ExecutiveSummaryCard({ executiveSummary, toneAndReadability }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5 text-violet-600" aria-hidden="true" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-gray-700">{executiveSummary}</p>
        {toneAndReadability && (
          <div className="rounded-lg bg-violet-50 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-violet-700">Tone & Readability</p>
            <p className="text-sm text-gray-700">{toneAndReadability}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MissingEntitiesCard({ missingEntities }) {
  if (!missingEntities || missingEntities.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-5 text-violet-600" aria-hidden="true" />
          Missing Semantic Entities
        </CardTitle>
        <CardDescription>Key topics and entities absent from your content</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2" role="list" aria-label="Missing semantic entities">
          {missingEntities.map((entity, index) => (
            <Badge key={index} variant="outline" className="text-sm" role="listitem">
              {entity}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function SuggestionCard({ suggestion }) {
  const priorityConfig = {
    high: { label: 'High', variant: 'high', icon: AlertCircle },
    medium: { label: 'Medium', variant: 'medium', icon: Lightbulb },
    low: { label: 'Low', variant: 'low', icon: Lightbulb },
  }

  const config = priorityConfig[suggestion.priority] || priorityConfig.low
  const Icon = config.icon

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="font-semibold text-gray-900">{suggestion.title}</h4>
        <Badge variant={config.variant} className="shrink-0">
          {config.label}
        </Badge>
      </div>
      <p className="text-sm text-gray-600">{suggestion.description}</p>
    </div>
  )
}

function OptimizationSuggestionsCard({ suggestions }) {
  if (!suggestions || suggestions.length === 0) {
    return null
  }

  const sortedSuggestions = [...suggestions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-5 text-violet-600" aria-hidden="true" />
          Actionable Optimization Suggestions
        </CardTitle>
        <CardDescription>Prioritized recommendations to improve semantic relevance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedSuggestions.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * @param {{ deepAnalysis: DeepAnalysis|null }} props
 */
export function DeepAnalysisCards({ deepAnalysis }) {
  if (!deepAnalysis) {
    return (
      <section className="rounded-xl border bg-white p-10 text-center text-sm text-muted-foreground">
        No deep analysis available. Run an analysis to see AI-powered insights.
      </section>
    )
  }

  return (
    <section className="space-y-6" aria-label="Deep AI Semantic Analysis">
      <div className="flex items-center gap-2 border-b pb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-900">Deep AI Semantic Analysis</h2>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <ExecutiveSummaryCard
            executiveSummary={deepAnalysis.executiveSummary}
            toneAndReadability={deepAnalysis.toneAndReadability}
          />
          <MissingEntitiesCard missingEntities={deepAnalysis.missingEntities} />
        </div>
        <OptimizationSuggestionsCard suggestions={deepAnalysis.suggestions} />
      </div>
    </section>
  )
}
