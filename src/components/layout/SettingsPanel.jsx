import { KeyRound } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useAnalysisStore } from '@/store/useAnalysisStore'
import { useSettingsStore } from '@/store/useSettingsStore'

const EMBEDDING_MODES = [
  {
    value: 'mock',
    label: 'Demo',
    description: 'Sample data and offline mock vectors. Nothing leaves your browser.',
  },
  {
    value: 'transformers',
    label: 'Local AI (Transformers.js)',
    description: 'all-MiniLM-L6-v2 runs in your browser. The model downloads once, then stays cached. No API key.',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'text-embedding-3-small, called from this browser with your API key.',
  },
]

export function SettingsPanel() {
  const embeddingMode = useSettingsStore((state) => state.embeddingMode)
  const setEmbeddingMode = useSettingsStore((state) => state.setEmbeddingMode)
  const openaiApiKey = useSettingsStore((state) => state.openaiApiKey)
  const setOpenaiApiKey = useSettingsStore((state) => state.setOpenaiApiKey)
  const running = useAnalysisStore((state) => state.status === 'running')
  const activeMode = EMBEDDING_MODES.find((mode) => mode.value === embeddingMode)

  return (
    <div className="grid gap-4">
      <div className="grid gap-0.5">
        <h3 id="embedding-mode-label" className="text-sm font-semibold">
          Embedding mode
        </h3>
        <p className="text-xs text-muted-foreground">
          Active: <strong className="font-medium text-foreground">{activeMode.label}</strong>
        </p>
      </div>

      <RadioGroup
        value={embeddingMode}
        onValueChange={setEmbeddingMode}
        aria-labelledby="embedding-mode-label"
        disabled={running}
        className="gap-2"
      >
        {EMBEDDING_MODES.map((mode) => (
          <Label
            key={mode.value}
            htmlFor={`embedding-mode-${mode.value}`}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-slate-50 has-data-[state=checked]:border-violet-500 has-data-[state=checked]:bg-violet-50/70"
          >
            <RadioGroupItem id={`embedding-mode-${mode.value}`} value={mode.value} className="mt-0.5" />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{mode.label}</span>
              <span className="text-xs leading-snug text-muted-foreground">{mode.description}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>

      {embeddingMode === 'openai' && (
        <div className="grid gap-2">
          <Label htmlFor="openai-api-key">
            <KeyRound className="size-3.5" aria-hidden="true" />
            OpenAI API key
          </Label>
          <Input
            id="openai-api-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-…"
            value={openaiApiKey ?? ''}
            onChange={(event) => setOpenaiApiKey(event.target.value || null)}
            aria-describedby="openai-api-key-note"
          />
          <p id="openai-api-key-note" className="text-xs text-muted-foreground">
            Kept in memory for this session only — never saved to storage or the URL.
          </p>
        </div>
      )}
    </div>
  )
}
