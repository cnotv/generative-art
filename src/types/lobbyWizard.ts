export type LobbyConfigSelectOption = { value: string | number; label: string }

export type LobbyConfigField =
  | {
      type: 'select'
      key: string
      label: string
      value: string | number
      options: LobbyConfigSelectOption[]
    }
  | {
      type: 'number'
      key: string
      label: string
      value: number
      min: number
      max: number
    }

export type LobbyPlayer = { id: string; name: string; color: string }
