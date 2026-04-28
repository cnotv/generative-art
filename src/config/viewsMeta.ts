import viewsMetaJson from './viewsMeta.json'

interface ViewMeta {
  description: string
  image?: string
}

export const VIEW_META: Record<string, ViewMeta> = viewsMetaJson
