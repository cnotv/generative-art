export type StrudelExample = {
  id: string
  label: string
  code: string
}

export type StrudelEditorStatus = 'idle' | 'playing' | 'error'

export type StrudelEvaluationResult = {
  success: boolean
  errorMessage?: string
}

export type StrudelExampleOption = {
  value: string
  label: string
}

export type StrudelPlayback = {
  evaluateCode: (patternCode: string) => Promise<StrudelEvaluationResult>
  stopPlayback: () => Promise<void>
}

export type StrudelTabId =
  | 'welcome'
  | 'patterns'
  | 'sounds'
  | 'reference'
  | 'export'
  | 'console'
  | 'settings'

export type StrudelSoundEntry = {
  name: string
  type: string
  sampleCount: number
}

export type StrudelLogEntry = {
  id: number
  message: string
  level: 'info' | 'warn' | 'error'
}
