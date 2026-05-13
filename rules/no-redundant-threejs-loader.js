/**
 * ESLint rule: no-redundant-threejs-loader
 *
 * Loaders (TextureLoader, GLTFLoader, etc.) are expensive to construct because
 * they set up internal caches, workers, and decoder state. Two problems are
 * flagged:
 *
 *   1. Inline (unchained) usage — the loader is constructed and immediately
 *      called without being stored, so it can never be reused:
 *
 *        new TextureLoader().load(url)        ← no caching possible
 *        new THREE.TextureLoader().load(url)  ← same
 *
 *   2. Duplicate declarations — more than one instance of the same loader
 *      type is constructed in the same file, indicating shared state is not
 *      being used:
 *
 *        const loaderA = new TextureLoader()
 *        const loaderB = new TextureLoader()  ← should reuse loaderA
 */

const LOADER_CLASSES = new Set([
  'TextureLoader',
  'CubeTextureLoader',
  'DataTextureLoader',
  'CompressedTextureLoader',
  'GLTFLoader',
  'FBXLoader',
  'OBJLoader',
  'STLLoader',
  'DRACOLoader',
  'KTX2Loader',
  'ImageLoader',
  'FileLoader',
  'AudioLoader'
])

/**
 * @param {import('eslint').Rule.Node} callee
 * @returns {string | null}
 */
const getConstructorName = (callee) => {
  // new TextureLoader()
  if (callee.type === 'Identifier') return callee.name
  // new THREE.TextureLoader()
  if (callee.type === 'MemberExpression' && callee.property?.type === 'Identifier') {
    return callee.property.name
  }
  return null
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow inline (unchained) Three.js loader usage and duplicate loader instances in the same file.',
      recommended: true
    },
    messages: {
      inlineLoader:
        '`new {{name}}()` is used inline and immediately discarded. Assign it to a module-level or component-level constant and reuse it across calls.',
      duplicateLoader:
        '`new {{name}}()` is constructed {{count}} times in this file. Create one shared instance instead.'
    },
    schema: []
  },

  create(context) {
    // Track all NewExpression nodes that construct a loader, keyed by loader class name.
    const loaderNodes = new Map()

    return {
      NewExpression(node) {
        const name = getConstructorName(node.callee)
        if (!name || !LOADER_CLASSES.has(name)) return

        // Rule 1: inline usage — the new expression is a callee itself
        // e.g. new TextureLoader().load(url)
        if (node.parent?.type === 'MemberExpression' && node.parent.object === node) {
          context.report({ node, messageId: 'inlineLoader', data: { name } })
          return
        }

        // Collect for duplicate analysis
        const existing = loaderNodes.get(name) ?? []
        loaderNodes.set(name, [...existing, node])
      },

      'Program:exit'() {
        // Rule 2: more than one instance of the same loader type in the file
        loaderNodes.forEach((nodes, name) => {
          if (nodes.length < 2) return
          nodes.forEach((node) => {
            context.report({
              node,
              messageId: 'duplicateLoader',
              data: { name, count: String(nodes.length) }
            })
          })
        })
      }
    }
  }
}
