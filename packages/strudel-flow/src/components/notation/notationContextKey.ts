import type { ComputedRef, InjectionKey } from 'vue'
import type { StrudelFlowNotationContext } from '../../types'

/** The note reader, cycle length and sound lookup the editor hands its Notes nodes. */
export const STRUDEL_FLOW_NOTATION_CONTEXT: InjectionKey<ComputedRef<StrudelFlowNotationContext>> =
  Symbol('strudelFlowNotationContext')
