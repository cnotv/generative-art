/**
 * analyze-assets.mjs
 *
 * Scans GLB files in public/ for triangle and vertex counts, reports
 * texture memory estimates, and checks source files for common patterns
 * that inflate draw calls or cause memory leaks.
 *
 * Usage:
 *   node scripts/analyze-assets.mjs
 *   node scripts/analyze-assets.mjs --glb-only
 *   node scripts/analyze-assets.mjs --code-only
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = resolve(ROOT, 'public')
const SRC_DIR = resolve(ROOT, 'src')

const args = process.argv.slice(2)
const glbOnly = args.includes('--glb-only')
const codeOnly = args.includes('--code-only')
// In check mode the script exits with code 1 if any hard budgets are exceeded,
// making it usable as a CI gate.
const checkMode = args.includes('--check')

const violationCount = { value: 0 }

// ── Colours ──────────────────────────────────────────────────────────────────
const ok = (s) => `\x1b[32m${s}\x1b[0m`
const warn = (s) => `\x1b[33m${s}\x1b[0m`
const bad = (s) => `\x1b[31m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`

const colorForValue = (value, okThreshold, warnThreshold) => {
  if (value <= okThreshold) return ok
  if (value <= warnThreshold) return warn
  return bad
}

// ── GLB parser ────────────────────────────────────────────────────────────────
// Reads the JSON chunk of a GLB to count vertices and triangles without
// loading a WebGL context.

const GLTF_COMPONENT_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 }
const GLTF_COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }

const parseGlb = (filePath) => {
  const buffer = readFileSync(filePath)

  const magic = buffer.readUInt32LE(0)
  if (magic !== 0x46546c67) return null // not a GLB

  const jsonLength = buffer.readUInt32LE(12)
  const jsonText = buffer.slice(20, 20 + jsonLength).toString('utf8')
  const gltf = JSON.parse(jsonText)

  const accessors = gltf.accessors ?? []
  const meshes = gltf.meshes ?? []
  const textures = gltf.textures ?? []
  const images = gltf.images ?? []
  const bufferViews = gltf.bufferViews ?? []

  let totalTriangles = 0
  let totalVertices = 0

  meshes.forEach((mesh) => {
    ;(mesh.primitives ?? []).forEach((primitive) => {
      const posAccessor = accessors[primitive.attributes?.POSITION]
      if (posAccessor) totalVertices += posAccessor.count

      const indexAccessor = accessors[primitive.indices]
      if (indexAccessor) {
        totalTriangles += Math.floor(indexAccessor.count / 3)
      } else if (posAccessor) {
        totalTriangles += Math.floor(posAccessor.count / 3)
      }
    })
  })

  // Estimate embedded texture memory (width × height × 4 bytes RGBA, uncompressed).
  // The GLB JSON stores mimeType but not dimensions; use buffer view sizes as a proxy.
  const textureBytes = images.reduce((sum, image) => {
    if (image.bufferView == null) return sum
    const view = bufferViews[image.bufferView]
    return sum + (view?.byteLength ?? 0)
  }, 0)

  return {
    triangles: totalTriangles,
    vertices: totalVertices,
    meshCount: meshes.length,
    textureCount: textures.length,
    embeddedTextureBytes: textureBytes
  }
}

const formatK = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : `${(n / 1_000).toFixed(1)}k`
const formatBytes = (n) =>
  n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${(n / 1_024).toFixed(0)} KB`

// ── GLB report ────────────────────────────────────────────────────────────────
const reportGlb = () => {
  const glbFiles = readdirSync(PUBLIC_DIR)
    .filter((f) => f.endsWith('.glb'))
    .sort()

  const TRIANGLE_HARD_LIMIT = 200_000
  const SIZE_HARD_LIMIT = 2_000_000

  // Known exceptions — must match entries in src/tests/assetBudgets.test.ts
  const SIZE_ALLOWLIST = new Set(['round_table.glb'])
  const TRIANGLE_ALLOWLIST = new Set(['round_table.glb'])

  console.log(bold('\n── GLB asset analysis ───────────────────────────────────'))
  console.log(
    dim('  Thresholds: triangles warn >50k, bad >200k | file size warn >500 KB, bad >2 MB')
  )
  console.log()

  const rows = glbFiles.map((file) => {
    const filePath = resolve(PUBLIC_DIR, file)
    const { size } = statSync(filePath)
    const parsed = parseGlb(filePath)

    if (!parsed) return { file, error: 'not a GLB' }

    const triColor = colorForValue(parsed.triangles, 50_000, TRIANGLE_HARD_LIMIT)
    const vtxColor = colorForValue(parsed.vertices, 50_000, 200_000)
    const sizeColor = colorForValue(size, 500_000, SIZE_HARD_LIMIT)

    if (checkMode) {
      if (parsed.triangles > TRIANGLE_HARD_LIMIT && !TRIANGLE_ALLOWLIST.has(file))
        violationCount.value++
      if (size > SIZE_HARD_LIMIT && !SIZE_ALLOWLIST.has(file)) violationCount.value++
    }

    return {
      file,
      triangles: triColor(formatK(parsed.triangles)),
      vertices: vtxColor(formatK(parsed.vertices)),
      meshes: String(parsed.meshCount),
      textures: String(parsed.textureCount),
      fileSize: sizeColor(formatBytes(size)),
      embeddedTextures:
        parsed.embeddedTextureBytes > 0 ? formatBytes(parsed.embeddedTextureBytes) : dim('—'),
      rawTriangles: parsed.triangles
    }
  })

  const colWidths = { file: 34, triangles: 12, vertices: 12, meshes: 7, textures: 9, fileSize: 11 }
  const header = [
    'File'.padEnd(colWidths.file),
    'Triangles'.padEnd(colWidths.triangles),
    'Vertices'.padEnd(colWidths.vertices),
    'Meshes'.padEnd(colWidths.meshes),
    'Textures'.padEnd(colWidths.textures),
    'File size'
  ].join('  ')
  console.log(bold(header))
  console.log('─'.repeat(90))

  let totalTriangles = 0
  rows.forEach(({ file, triangles, vertices, meshes, textures, fileSize, error, rawTriangles }) => {
    if (error) {
      console.log(`${file.padEnd(colWidths.file)}  ${bad(error)}`)
      return
    }
    totalTriangles += rawTriangles
    console.log(
      `${file.padEnd(colWidths.file)}  ${String(triangles).padEnd(colWidths.triangles + 9)}  ${String(vertices).padEnd(colWidths.vertices + 9)}  ${String(meshes).padEnd(colWidths.meshes)}  ${String(textures).padEnd(colWidths.textures)}  ${fileSize}`
    )
  })

  console.log('─'.repeat(90))
  console.log(
    `${'Total triangles across all assets:'.padEnd(colWidths.file + 4)}${formatK(totalTriangles)}`
  )
}

// ── Source code analysis ──────────────────────────────────────────────────────
const walkDir = (dir, extensions) => {
  const results = []
  const walk = (currentDir) => {
    readdirSync(currentDir, { withFileTypes: true }).forEach((entry) => {
      const fullPath = resolve(currentDir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath)
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath)
      }
    })
  }
  walk(dir)
  return results
}

const findPatternInFiles = (files, pattern, description) => {
  const matches = []
  files.forEach((filePath) => {
    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push({
          file: relative(ROOT, filePath),
          line: index + 1,
          text: line.trim()
        })
      }
    })
  })
  return { description, matches }
}

const reportCode = () => {
  const files = walkDir(SRC_DIR, ['.ts', '.vue'])

  console.log(bold('\n── Source code analysis ─────────────────────────────────'))

  const checks = [
    findPatternInFiles(
      files,
      /new THREE\.Mesh\b/,
      'Individual Mesh instances (consider InstancedMesh for repeated geometry)'
    ),
    findPatternInFiles(
      files,
      /new THREE\.(TextureLoader|CubeTextureLoader|GLTFLoader|FBXLoader)\(\)/,
      'Loader instantiated inline (use shared singleton from @webgamekit/threejs)'
    ),
    findPatternInFiles(
      files,
      /\.(geometry|material|texture)\.dispose\(\)/,
      'Dispose calls found (good — tracks cleanup)'
    ),
    findPatternInFiles(
      files,
      /new THREE\.(Vector3|Matrix4|Quaternion|Euler)\(\)/,
      'Allocations possibly inside animation loop (verify these are outside rAF callbacks)'
    ),
    findPatternInFiles(files, /InstancedMesh/, 'InstancedMesh usage (good — batches draw calls)')
  ]

  checks.forEach(({ description, matches }) => {
    const countColor = matches.length === 0 ? ok : matches.length < 5 ? warn : bad
    console.log(`\n  ${countColor(`[${matches.length}]`)} ${description}`)
    if (matches.length > 0 && matches.length <= 10) {
      matches.forEach(({ file, line }) => {
        console.log(`       ${dim(`${file}:${line}`)}`)
      })
    } else if (matches.length > 10) {
      matches.slice(0, 5).forEach(({ file, line }) => {
        console.log(`       ${dim(`${file}:${line}`)}`)
      })
      console.log(`       ${dim(`… and ${matches.length - 5} more`)}`)
    }
  })

  // Check for missing dispose on unmount
  const unmountFiles = files.filter((f) => {
    const content = readFileSync(f, 'utf8')
    return (
      content.includes('onUnmounted') &&
      content.includes('WebGLRenderer') &&
      !content.includes('.dispose()')
    )
  })
  if (unmountFiles.length > 0) {
    console.log(
      `\n  ${bad(`[${unmountFiles.length}]`)} Views with WebGLRenderer but no dispose() on unmount`
    )
    unmountFiles.forEach((filePath) => {
      console.log(`       ${dim(relative(ROOT, filePath))}`)
    })
  } else {
    console.log(`\n  ${ok('[0]')} All views with WebGLRenderer call dispose() on unmount`)
  }
}

// ── Entry point ───────────────────────────────────────────────────────────────
if (!codeOnly) reportGlb()
if (!glbOnly) reportCode()

console.log()

if (checkMode) {
  if (violationCount.value > 0) {
    console.error(
      bad(`\n✖ ${violationCount.value} budget violation(s) found. Fix or add to the allowlist.\n`)
    )
    process.exit(1)
  } else {
    console.log(ok('\n✔ All asset budgets within limits.\n'))
  }
}
