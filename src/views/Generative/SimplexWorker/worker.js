import { createNoise4D } from '@/utils/simplex.js'

const state = { config: null }
const simplex = createNoise4D()

const draw = (canvas) => {
  postMessage({ begin: true })

  const ctx = canvas.getContext('2d')
  state.config.frameCount++
  canvas.width = state.config.width * state.config.windowSize
  canvas.height = state.config.height * state.config.windowSize

  ctx.fillStyle = '#b4e1e9'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const waveLength = (Math.PI * 2 * state.config.frameCount) / state.config.speed
  const z = state.config.fluidity * Math.cos(waveLength)
  const w = state.config.fluidity * Math.sin(waveLength)

  Array.from({ length: Math.floor(canvas.height / state.config.pixelSize) }, (_, y) => {
    Array.from({ length: Math.floor(canvas.width / state.config.pixelSize) }, (__, x) => {
      const lightness = Math.round(
        (simplex(x * state.config.noiseSize, y * state.config.noiseSize, z, w) + 1) /
          state.config.lightAmount
      )

      ctx.fillStyle = `rgba(212, 241, 249, ${lightness})`
      ctx.fillRect(
        x * state.config.pixelSize,
        y * state.config.pixelSize,
        state.config.pixelSize,
        state.config.pixelSize
      )
    })
  })

  postMessage({ frameCount: state.config.frameCount })
  postMessage({ end: true })
}

onmessage = (event) => {
  if (event.data) {
    const { canvas, workerConfig } = event.data

    if (workerConfig) {
      state.config = { ...workerConfig }
    }

    if (canvas) {
      postMessage({ message: 'Worker up!' })
      setInterval(draw, 1, canvas)
    }
  }
}
