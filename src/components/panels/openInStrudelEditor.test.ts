import { describe, it, expect, vi, beforeEach } from 'vitest'

const writeStorage = vi.hoisted(() => vi.fn())
vi.mock('@/utils/storage', () => ({ writeStorage }))

import { openInStrudelEditor } from './openInStrudelEditor'

const open = vi.fn()

beforeEach(() => {
  writeStorage.mockClear()
  open.mockClear()
  vi.stubGlobal('open', open)
})

describe('openInStrudelEditor', () => {
  it('saves the code where the editor reads it, then opens the editor in a new tab', () => {
    openInStrudelEditor('s("bd")', '/tools/StrudelEditor')

    expect(writeStorage).toHaveBeenCalledWith('strudel-editor-code', 's("bd")')
    expect(open).toHaveBeenCalledWith('/tools/StrudelEditor', '_blank')
    expect(writeStorage.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0])
  })
})
