interface GenerateConfig {
  density: number;
  scale: number;
  scaleMin: number;
  area: number;
  points: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  lengthCurve: {
    base: { x: number; y: number; z: number };
    mid: { x: number; y: number; z: number };
    tip: { x: number; y: number; z: number };
  };
  sideCurve: {
    base: { x: number; y: number; z: number };
    mid: { x: number; y: number; z: number };
    tip: { x: number; y: number; z: number };
  };
}
