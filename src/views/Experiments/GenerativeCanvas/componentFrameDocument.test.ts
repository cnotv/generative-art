import { describe, it, expect } from 'vitest'
import { createFrameDocument } from './componentFrameDocument'

const readImportMap = (frameDocument: string): { imports: Record<string, string> } => {
  const importMapText = new DOMParser()
    .parseFromString(frameDocument, 'text/html')
    .querySelector('script[type="importmap"]')?.textContent
  return JSON.parse(importMapText ?? '{}')
}

describe('createFrameDocument', () => {
  it('maps vue to a data URL holding the given runtime source', () => {
    // Arrange
    const vueRuntimeSource = 'export const createApp = () => {}'

    // Act
    const vueUrl = readImportMap(createFrameDocument(vueRuntimeSource)).imports.vue

    // Assert
    expect(vueUrl.startsWith('data:text/javascript,')).toBe(true)
    expect(decodeURIComponent(vueUrl.slice('data:text/javascript,'.length))).toBe(vueRuntimeSource)
  })

  it('keeps a closing script tag inside the runtime source from ending the import map', () => {
    // Arrange
    const vueRuntimeSource = 'const tag = "</script><script>alert(1)</script>"'

    // Act
    const frameDocument = createFrameDocument(vueRuntimeSource)

    // Assert
    const parsedDocument = new DOMParser().parseFromString(frameDocument, 'text/html')
    expect(parsedDocument.querySelectorAll('script')).toHaveLength(2)
    expect(readImportMap(frameDocument).imports.vue).toContain(encodeURIComponent('</script>'))
  })

  it('has a mount point and a style element for the component', () => {
    // Act
    const parsedDocument = new DOMParser().parseFromString(createFrameDocument(''), 'text/html')

    // Assert
    expect(parsedDocument.querySelector('#root')).not.toBeNull()
    expect(parsedDocument.querySelector('style#component-style')).not.toBeNull()
  })
})
