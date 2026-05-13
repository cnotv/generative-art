/**
 * ESLint rule: no-alloc-in-animation-loop
 *
 * Prevents `new` instantiation and `.clone()` calls inside animation loop bodies.
 * Allocating Three.js objects (Vector3, Matrix4, Quaternion, etc.) every frame causes
 * garbage collection pressure and frame drops.
 *
 * Detects allocations in three contexts:
 *   1. Timeline action callbacks:
 *        addAction({ action: () => { ... } })
 *        addActions([{ action: () => { ... } }])
 *   2. Browser loop callbacks:
 *        requestAnimationFrame(() => { ... })
 *        setInterval(() => { ... }, 16)
 *   3. Named animation functions (configurable):
 *        function animate() { ... }
 *        const tick = () => { ... }
 *        update() { ... }  (method)
 */

const LOOP_FUNCTION_NAMES = new Set(['addAction', 'addActions'])
const ACTION_PROPERTY_NAME = 'action'
const BROWSER_LOOP_CALLS = new Set(['requestAnimationFrame', 'setInterval'])
const DEFAULT_ANIMATION_FUNCTION_NAMES = new Set(['animate', 'update', 'tick', 'onFrame'])

const THREE_CONSTRUCTORS = new Set([
  // Math / transform types
  'Vector2',
  'Vector3',
  'Vector4',
  'Matrix3',
  'Matrix4',
  'Quaternion',
  'Euler',
  'Box2',
  'Box3',
  'Sphere',
  'Ray',
  'Plane',
  'Color',
  // Geometry
  'BufferGeometry',
  // Materials — creating per-frame defeats sharing; prefer MeshBasicMaterial for static objects
  'MeshBasicMaterial',
  'MeshStandardMaterial',
  'MeshLambertMaterial',
  'MeshPhongMaterial',
  'MeshPhysicalMaterial',
  'MeshToonMaterial',
  'ShaderMaterial',
  'RawShaderMaterial',
  'SpriteMaterial',
  'LineBasicMaterial',
  // Scene objects
  'Mesh',
  'Group',
  'Object3D',
  'LineSegments',
  'Points',
  'Sprite',
  // Loaders — must be created once and reused; never inside a loop
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
 * Extracts the function name from a callee node.
 * @param {import('eslint').Rule.Node} callee
 * @returns {string | null}
 */
const getCalleeName = (callee) => {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression') return callee.property?.name ?? null
  return null
}

// ── Context 1: timeline action callbacks ────────────────────────────────────

// Sibling property keys that indicate an object is a Timeline entry even when
// not directly passed to addAction/addActions (intermediate variable pattern).
const TIMELINE_SIBLING_KEYS = new Set(['interval', 'start', 'delay', 'category', 'duration'])

const isActionProperty = (node) =>
  node?.type === 'Property' && node.key?.name === ACTION_PROPERTY_NAME

const isLoopCall = (node) =>
  node?.type === 'CallExpression' && LOOP_FUNCTION_NAMES.has(getCalleeName(node.callee) ?? '')

const isTimelineProperty = (property) =>
  property.type === 'Property' && TIMELINE_SIBLING_KEYS.has(property.key?.name ?? '')

const hasTimelineSiblings = (objectExpression) =>
  objectExpression.properties.some(isTimelineProperty)

const isDirectLoopArgument = (objectExpression) => isLoopCall(objectExpression.parent)

const isArrayLoopArgument = (objectExpression) =>
  objectExpression.parent?.type === 'ArrayExpression' && isLoopCall(objectExpression.parent.parent)

const isTimelineArrayEntry = (objectExpression) =>
  objectExpression.parent?.type === 'ArrayExpression' && hasTimelineSiblings(objectExpression)

const isInsideActionCallback = (functionNode) => {
  const propertyNode = functionNode.parent
  if (!isActionProperty(propertyNode)) return false
  const objectExpression = propertyNode.parent
  if (!objectExpression || objectExpression.type !== 'ObjectExpression') return false
  return (
    isDirectLoopArgument(objectExpression) ||
    isArrayLoopArgument(objectExpression) ||
    isTimelineArrayEntry(objectExpression) ||
    hasTimelineSiblings(objectExpression)
  )
}

// ── Context 2: browser loop callbacks ───────────────────────────────────────

const isInsideBrowserLoopCallback = (functionNode) => {
  const parent = functionNode.parent
  if (parent?.type !== 'CallExpression') return false
  const calleeName = getCalleeName(parent.callee)
  if (!calleeName || !BROWSER_LOOP_CALLS.has(calleeName)) return false
  // The function must be the first argument (the callback)
  return parent.arguments[0] === functionNode
}

// ── Context 3: named animation function ─────────────────────────────────────

/**
 * Returns the declared name of a FunctionDeclaration, FunctionExpression, or
 * ArrowFunctionExpression, or null when it cannot be determined statically.
 * @param {import('eslint').Rule.Node} functionNode
 * @returns {string | null}
 */
const getFunctionDeclaredName = (functionNode) => {
  if (functionNode.type === 'FunctionDeclaration') return functionNode.id?.name ?? null
  return getNameFromParent(functionNode.parent, functionNode)
}

const nameFromVariableDeclarator = (parent) =>
  parent.type === 'VariableDeclarator' && parent.id?.type === 'Identifier' ? parent.id.name : null

const nameFromProperty = (parent, functionNode) =>
  parent.type === 'Property' && parent.value === functionNode ? (parent.key?.name ?? null) : null

const nameFromMethod = (parent) =>
  parent.type === 'MethodDefinition' ? (parent.key?.name ?? null) : null

const getNameFromParent = (parent, functionNode) => {
  if (!parent) return null
  return (
    nameFromVariableDeclarator(parent) ??
    nameFromProperty(parent, functionNode) ??
    nameFromMethod(parent)
  )
}

const isNamedAnimationFunction = (functionNode, animationNames) => {
  const name = getFunctionDeclaredName(functionNode)
  return name !== null && animationNames.has(name)
}

// ── Shared traversal ─────────────────────────────────────────────────────────

/**
 * Walk up all ancestors from a node and return true if any enclosing function
 * is an animation-loop context. Continues past nested callbacks so allocations
 * inside forEach/map/etc. within an animation loop are also caught.
 * @param {import('eslint').Rule.Node} node
 * @param {Set<string>} animationNames
 * @returns {boolean}
 */
const isInsideAnimationLoop = (node, animationNames) => {
  const traverse = (current) => {
    if (!current) return false
    const isFunction =
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionExpression' ||
      current.type === 'FunctionDeclaration'
    if (
      isFunction &&
      (isInsideActionCallback(current) ||
        isInsideBrowserLoopCallback(current) ||
        isNamedAnimationFunction(current, animationNames))
    ) {
      return true
    }
    return traverse(current.parent)
  }
  return traverse(node.parent)
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow `new` Three.js object instantiation and `.clone()` calls inside animation loops to prevent per-frame memory allocation.',
      recommended: true
    },
    messages: {
      noNewInLoop:
        'Do not instantiate `new {{name}}()` inside an animation loop. Allocate once outside and reuse with `.set()` or `.copy()`.',
      noCloneInLoop:
        'Do not call `.clone()` inside an animation loop. Use `.copy()` on a pre-allocated instance instead.'
    },
    schema: [
      {
        type: 'object',
        properties: {
          animationFunctionNames: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ]
  },

  create(context) {
    const options = context.options[0] ?? {}
    const animationNames = options.animationFunctionNames
      ? new Set(options.animationFunctionNames)
      : DEFAULT_ANIMATION_FUNCTION_NAMES

    return {
      NewExpression(node) {
        if (!isInsideAnimationLoop(node, animationNames)) return
        const calleeName = getCalleeName(node.callee)
        if (!calleeName || !THREE_CONSTRUCTORS.has(calleeName)) return
        context.report({ node, messageId: 'noNewInLoop', data: { name: calleeName } })
      },

      CallExpression(node) {
        if (!isInsideAnimationLoop(node, animationNames)) return
        if (node.callee.type === 'MemberExpression' && node.callee.property?.name === 'clone') {
          context.report({ node, messageId: 'noCloneInLoop' })
        }
      }
    }
  }
}
