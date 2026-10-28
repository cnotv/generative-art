import type { ComputedRef, InjectionKey } from 'vue'

/** The canvas id each inline Visualizer node's visual draws on, keyed by node id. */
export const STRUDEL_FLOW_VISUALIZER_WIDGET_IDS: InjectionKey<ComputedRef<Record<string, string>>> =
  Symbol('strudelFlowVisualizerWidgetIds')
