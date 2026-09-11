import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'

const NONE = '__none__'
const CUSTOM = '__custom__'

/**
 * Preset list plus free text: "Custom…" reveals a text field, so values outside
 * the presets (like the reference scenario's) stay editable.
 * @param {{ id: string, label: string, presets: string[], value: string, onChange: (value: string) => void, customPlaceholder?: string }} props
 */
export function PresetSelect({ id, label, presets, value, onChange, customPlaceholder }) {
  const [customMode, setCustomMode] = useState(() => value !== '' && !presets.includes(value))
  const selected = customMode ? CUSTOM : presets.includes(value) ? value : NONE

  function handleSelect(next) {
    setCustomMode(next === CUSTOM)
    if (next === NONE) onChange('')
    else if (next === CUSTOM) onChange(presets.includes(value) ? '' : value)
    else onChange(next)
  }

  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={selected} onValueChange={handleSelect}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Not specified</SelectItem>
          {presets.map((preset) => (
            <SelectItem key={preset} value={preset}>
              {preset}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={CUSTOM}>Custom…</SelectItem>
        </SelectContent>
      </Select>
      {customMode && (
        <Input
          aria-label={`${label}, custom value`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={customPlaceholder}
        />
      )}
    </div>
  )
}
