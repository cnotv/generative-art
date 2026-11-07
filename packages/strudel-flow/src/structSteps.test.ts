import { describe, expect, it } from 'vitest'
import { readStrudelFlowStructSteps, writeStrudelFlowStructSteps } from './structSteps'

describe('struct steps', () => {
  it('reads a run of hits and rests into switches', () => {
    expect(readStrudelFlowStructSteps('"x ~ x x ~ x x ~"')).toEqual([
      true,
      false,
      true,
      true,
      false,
      true,
      true,
      false
    ])
  })

  it.each(['"x(3,8)"', '"x*2 ~"', 'rhythm', '"x ~ x x ~ x x ~ x ~ x x ~ x x ~ x"'])(
    'leaves %s to the text field',
    (argument) => {
      expect(readStrudelFlowStructSteps(argument)).toBeNull()
    }
  )

  it('writes switches back as the same text', () => {
    expect(writeStrudelFlowStructSteps([true, false, true, true])).toBe('"x ~ x x"')
  })
})
