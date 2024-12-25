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
    baseX: number;
    baseY: number;
    baseZ: number;
    midX: number;
    midY: number;
    midZ: number;
    tipX: number;
    tipY: number;
    tipZ: number;
  };
  sideCurve: {
    baseX: number;
    baseY: number;
    baseZ: number;
    midX: number;
    midY: number;
    midZ: number;
    tipX: number;
    tipY: number;
    tipZ: number;
  };
}

interface InstanceConfig {
  show: boolean;
  amount: number;
  size: number;
  sizeDelta: number;
  area: number;
  rotation?: number;
}
