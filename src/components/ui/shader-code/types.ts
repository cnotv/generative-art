export type GlslTokenKind =
  | 'preprocessor'
  | 'comment'
  | 'keyword'
  | 'type'
  | 'builtin'
  | 'number'
  | 'uniform'
  | 'plain'

export interface GlslToken {
  text: string
  kind: GlslTokenKind
}

export interface ShaderLine {
  tokens: GlslToken[]
  /** The uniform this line declares, when it declares one. */
  declares?: string
  /** Every uniform this line reads, so a control can light up the lines it reaches. */
  uses: string[]
}

export interface ShaderReading {
  lines: ShaderLine[]
  /** Every uniform the source declares, in the order it declares them. */
  uniforms: string[]
}
