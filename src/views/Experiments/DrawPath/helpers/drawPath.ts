// Re-export from shared utilities to keep DrawPath.vue imports stable.
// The canonical implementations live in src/utils/pathVisualization.ts.
export {
  pathInterpolateWaypoints as drawInterpolateWaypoints,
  pathCreateVisualization as drawCreatePathVisualization,
  pathRemoveVisualization as drawRemovePathVisualization,
  pathCreateWaypointNode as drawCreateWaypointNode,
  pathRemoveWaypointNodes as drawRemoveWaypointNodes,
  pathUpdateWaypointNodePosition as drawUpdateWaypointNodePosition
} from '@/utils/pathVisualization'
