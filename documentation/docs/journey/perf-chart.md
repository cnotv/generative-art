---
sidebar_position: 22
---

# Performance Chart in the Debug Panel

Design and implementation of the SVG sparkline charts added to the debug panel as part of [#136](https://github.com/cnotv/generative-art/issues/136).

## Goal

The live numeric stats (FPS, frame ms, draw calls, triangles, heap MB) give a point-in-time reading. A chart adds temporal context — a spike that lasted 200 ms looks very different from one that has been running for 10 minutes.

---

## Architecture

### Sampling rate

Charts could sample every rAF frame (~60/s), but that would require storing millions of points for longer time ranges. Instead, history is recorded at **1 sample per second**, matching the FPS counter which already resets once per second. `tick()` updates live display values per-frame; `recordSnapshot()` appends to the history buffer and is called only once per second.

### Pre-computed range buckets

The initial approach computed the downsampled view reactively from the full history on every render. This caused two problems:

1. **Resampling on every rAF tick** — wasteful and unnecessary since the underlying data only changes once per second.
2. **Left-anchored sampling grid** — as new samples shifted the window, every chart position jumped to a different source sample each second.

The final design pre-computes all five time range views (`1m`, `5m`, `15m`, `30m`, `1h`) inside `recordSnapshot()`, storing them in `chartSnapshots`. Switching the range selector is then a pure map lookup — zero computation.

```ts
// store — called once per second
const recordSnapshot = () => {
  const next = {
    /* append each metric to history */
  }
  history.value = next
  chartSnapshots.value = buildChartSnapshots(next) // all ranges, all metrics
}
```

```ts
// panel — zero computation, pure lookup
const chartData = computed(() => perfStore.chartSnapshots[timeRange.value])
```

### Right-anchored downsampling

Each range is downsampled to a fixed `BASE_POINTS = 60` entries. The critical detail is **anchoring from the right**:

```ts
// position i always represents the same time offset from now
const idx = values.length - (BASE_POINTS - i) * step
return idx >= 0 ? values[idx] : fill
```

Left-anchoring (`values[i * step]`) shifts every chart position each second as the window grows, making historical points appear to jump. Right-anchoring keeps each position pinned to a fixed time offset from the most recent sample — the chart scrolls smoothly rather than every point teleporting.

### Padding

When fewer samples exist than the selected range requires (e.g. viewing 5m after only 30 s of data), missing positions are filled with the earliest available value rather than 0, so the chart baseline matches the actual first reading instead of a misleading zero.

### SVG chart component

`PerfChart.vue` is a stateless component: it receives `values: number[]` and `color: string`, scales all values proportionally to the local maximum, and renders a `<polyline>` inside a `viewBox="0 0 100 28"` SVG with `preserveAspectRatio="none"`. No external library is involved.

---

## UX decisions

**Checkbox toggle, not a button** — charts add vertical height per stat; a checkbox with a "Chart" label makes the on/off state obvious and persistent.

**Time range hides when charts are off** — the selector is pointless without charts, so it is gated on `v-if="showCharts"`.

**History resets on route change** — a new scene starts from a clean baseline. Retaining history from a previous view would mix data from two different renderers.

**1h maximum range** — longer ranges (4h, 24h) would require more storage and are unlikely to be useful while actively debugging a scene. The 1h cap keeps `MAX_HISTORY_SIZE` at 3,600 entries per metric.

---

## Lessons

**Sample at the display rate, not the data rate.** Recording once per second instead of 60×/s reduces the working set by 60× and makes all range math trivial integer arithmetic.

**Pre-compute all views at write time.** If there are N display modes, build all N at write time rather than one at read time. Write happens once per second; reads happen 60× per second. The asymmetry makes write-time computation clearly cheaper.

**Anchor time series from the newest point.** Any chart that streams live data should index relative to the tail of the array, not the head. Left-anchored indexing is stable for static datasets but breaks as soon as the array grows.

**Fill with the first real value, not zero.** A flat line at the first reading communicates "no data yet for this range" without the visual distortion of a sudden jump from zero when the first sample arrives.
