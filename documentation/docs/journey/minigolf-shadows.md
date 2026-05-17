---
sidebar_position: 22
---

# Minigolf: Sharpening Three.js Shadows

## Why shadows look soft by default

`PCFSoftShadowMap` (common default) applies a multi-sample blur kernel to hide shadow map edges. The shadow map itself defaults to 512×512 — a small texture stretched over the entire light frustum — so detail is inherently limited before any filtering is applied.

## The three levers

| Lever                                          | Effect                                                         |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `renderer.shadowMap.type = THREE.PCFShadowMap` | Removes the soft filter; crisper edges than `PCFSoftShadowMap` |
| `light.shadow.mapSize.set(2048, 2048)`         | 4× pixels (doubles each axis); finer shadow detail             |
| `light.shadow.bias = -0.001`                   | Prevents shadow acne when the frustum is tightened             |

## Tight frustum — the single biggest win

The shadow camera frustum determines how much world space maps into those pixels. A frustum of `±100` units wastes most of the shadow map on empty space. Shrinking it to `±20` around the actual scene gives roughly **25× more detail** at the same map resolution — no extra memory or GPU cost.

## `radius` controls PCF kernel size

```ts
light.shadow.radius = 1 // 1 sample = no blur, sharpest result
// Increase to 3–8 for intentionally soft shadows
```

## Minigolf config

```ts
lights: {
  directional: {
    shadow: {
      mapSize: { width: 2048, height: 2048 },
      bias: -0.001,
      radius: 1,
      camera: { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 50 }
    }
  }
}
```

The tight `±20` frustum combined with `2048` map size and `radius: 1` produces sharp, acne-free shadows without touching shadow map type.
