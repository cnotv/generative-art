import * as THREE from 'three'
import { getAudioData } from '../audio'
import type { VisualizerSetup } from '../visualizer'

const config = {
  barCount: 30,
  width: 40,
  height: 5,
  lineWidth: 0.1 // Now controls tube radius instead
}

export const lineSpectrumVisualizer: VisualizerSetup = {
  name: 'Line Spectrum',
  song: 0,
  camera: {
    position: [0, 0, 25]
  },

  setup: (scene: THREE.Scene) => {
    // Create points for the spectrum line
    const points: THREE.Vector3[] = Array.from({ length: config.barCount }, (_, i) => {
      const x = (i / (config.barCount - 1)) * config.width - config.width / 2
      return new THREE.Vector3(x, 0, 0)
    })

    // Create curve from points
    const curve = new THREE.CatmullRomCurve3(points)

    // Create tube geometry for thick line
    const geometry = new THREE.TubeGeometry(curve, config.barCount - 1, config.lineWidth, 8, false)
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: false
    })

    const line = new THREE.Mesh(geometry, material)
    scene.add(line)

    return { line, points, curve }
  },

  getTimeline: (getObjects: () => Record<string, unknown>) => [
    {
      action: () => {
        const objects = getObjects()
        const { line, points, curve } = objects
        if (!line || !points || !curve) return

        const audioData = getAudioData()

        // Update line points based on audio data
        Array.from({ length: Math.min(config.barCount, audioData.length) }, (_, i) => {
          points[i].y = audioData[i] * config.height
        })

        // Update curve with new points
        curve.points = points

        // Recreate tube geometry with updated curve
        const newGeometry = new THREE.TubeGeometry(
          curve,
          config.barCount - 1,
          config.lineWidth,
          8,
          false
        )
        line.geometry.dispose() // Clean up old geometry
        line.geometry = newGeometry
      }
    }
  ]
}
