/**
 * ESLint rule: no-alloc-in-animation-loop
 *
 * Prevents `new` instantiation and `.clone()` calls inside timeline action callbacks.
 * Allocating Three.js objects (Vector3, Matrix4, Quaternion, etc.) every frame causes
 * garbage collection pressure and frame drops.
 *
 * Targets the project's animation loop API:
 *   addAction({ action: () => { ... } })
 *   addActions([{ action: () => { ... } }])
 *
 * Adapted from @react-three/eslint-plugin `no-new-in-loop` and `no-clone-in-loop`.
 */

const LOOP_FUNCTION_NAMES = new Set(['addAction', 'addActions'])
const ACTION_PROPERTY_NAME = 'action'

const THREE_CONSTRUCTORS = new Set([
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
  'BufferGeometry',
  'MeshBasicMaterial',
  'MeshStandardMaterial',
  'MeshLambertMaterial',
  'ShaderMaterial',
  'Mesh',
  'Group',
  'Object3D',
  'LineSegments',
  'Points'
])

/**
 * Extracts the function name from a callee node.
 * Handles both direct calls (`addAction(...)`) and method calls (`manager.addAction(...)`).
 * @param {import('eslint').Rule.Node} callee - The callee node of a CallExpression
 * @returns {string | null} The function name, or null if it cannot be determined
 */
const getCalleeName = (callee) => {
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression') return callee.property?.name ?? null
  return null
}

/**
 * Walk up the parent chain from a function node to determine if it is assigned
 * to an `action` property inside an addAction / addActions call argument.
 *
 * Expected shapes:
 *   addAction({ action: <fn> })
 *   addActions([{ action: <fn> }])
 *   timelineManager.addAction({ action: <fn> })
 */
const isActionProperty = (node) =>
  node?.type === 'Property' && node.key?.name === ACTION_PROPERTY_NAME

const isLoopCall = (node) =>
  node?.type === 'CallExpression' && LOOP_FUNCTION_NAMES.has(getCalleeName(node.callee) ?? '')

const isDirectLoopArgument = (objectExpression) => isLoopCall(objectExpression.parent)

const isArrayLoopArgument = (objectExpression) =>
  objectExpression.parent?.type === 'ArrayExpression' && isLoopCall(objectExpression.parent.parent)

const isInsideActionCallback = (functionNode) => {
  const propertyNode = functionNode.parent
  if (!isActionProperty(propertyNode)) return false

  const objectExpression = propertyNode.parent
  if (!objectExpression || objectExpression.type !== 'ObjectExpression') return false

  return isDirectLoopArgument(objectExpression) || isArrayLoopArgument(objectExpression)
}

/**
 * Walk up the ancestor chain to find the innermost enclosing function and
 * check whether that function is an action callback in a timeline call.
 */
const isNodeInsideActionCallback = (node) => {
  const traverse = (current) => {
    if (!current) return false
    if (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression') {
      return isInsideActionCallback(current)
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
        'Disallow `new` Three.js object instantiation and `.clone()` calls inside timeline action callbacks to prevent per-frame memory allocation.',
      recommended: true
    },
    messages: {
      noNewInLoop:
        'Do not instantiate `new {{name}}()` inside a timeline action callback. Allocate once outside and reuse with `.set()` or `.copy()`.',
      noCloneInLoop:
        'Do not call `.clone()` inside a timeline action callback. Use `.copy()` on a pre-allocated instance instead.'
    },
    schema: []
  },

  create(context) {
    return {
      NewExpression(node) {
        if (!isNodeInsideActionCallback(node)) return

        const calleeName = getCalleeName(node.callee)
        if (!calleeName || !THREE_CONSTRUCTORS.has(calleeName)) return

        context.report({
          node,
          messageId: 'noNewInLoop',
          data: { name: calleeName }
        })
      },

      CallExpression(node) {
        if (!isNodeInsideActionCallback(node)) return

        if (node.callee.type === 'MemberExpression' && node.callee.property?.name === 'clone') {
          context.report({ node, messageId: 'noCloneInLoop' })
        }
      }
    }
  }
}
