import type { InjectionKey, Ref } from 'vue'

/** The element a popover such as the sample picker draws into, outside the zoomed canvas. */
export const STRUDEL_FLOW_OVERLAY_TARGET: InjectionKey<Ref<HTMLElement | null>> = Symbol(
  'strudel-flow-overlay-target'
)
