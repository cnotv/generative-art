import { STRUDEL_FLOW_SAMPLE_FAMILIES } from './config'
import type { StrudelFlowSampleFamily } from './types'

/** The family a sample matches none of. */
export const STRUDEL_FLOW_OTHER_SAMPLE_FAMILY: StrudelFlowSampleFamily = {
  id: 'other',
  label: 'Other',
  match: ''
}

/**
 * The instrument family a sample belongs to, read from its name, for the picker's sections and
 * icons.
 * @param sampleName - the name code plays the sample by, such as `rolandtr909_bd` or `808oh`
 * @returns the first family whose names match, or Other
 */
export const findStrudelFlowSampleFamily = (sampleName: string): StrudelFlowSampleFamily =>
  STRUDEL_FLOW_SAMPLE_FAMILIES.find((family) =>
    new RegExp(family.match).test(sampleName.toLowerCase())
  ) ?? STRUDEL_FLOW_OTHER_SAMPLE_FAMILY
