import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StrudelFlowVisualPreview from './StrudelFlowVisualPreview.vue'

describe('StrudelFlowVisualPreview', () => {
  it.each([
    ['background', true, false],
    ['inline', false, true]
  ] as const)(
    'draws a %s visual as a backdrop: %s, with its hint: %s',
    (placement, isBackdrop, hasHint) => {
      // Arrange / Act
      const wrapper = mount(StrudelFlowVisualPreview, { props: { placement, widgetId: null } })

      // Assert
      expect(wrapper.classes('strudel-flow-visual-preview--backdrop')).toBe(isBackdrop)
      expect(wrapper.find('.strudel-flow-visualizer__hint').exists()).toBe(hasHint)
    }
  )
})
