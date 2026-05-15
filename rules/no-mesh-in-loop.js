/**
 * ESLint rule: no-mesh-in-loop
 *
 * Flags `new THREE.Mesh()` (or `new Mesh()`) instantiation inside loop bodies.
 * Creating a separate Mesh per iteration is a draw-call anti-pattern; the correct
 * approach is a single `THREE.InstancedMesh` with one draw call for all copies.
 *
 * Detects loops as:
 *   1. JS loop statements: for / for-of / for-in / while / do-while
 *   2. Array iteration methods: forEach / map / flatMap / filter / reduce /
 *      reduceRight / some / every / find / findIndex
 *
 * Correct alternative:
 *   const mesh = new THREE.InstancedMesh(geometry, material, count)
 *   items.forEach((item, index) => mesh.setMatrixAt(index, item.matrix))
 */

const LOOP_STATEMENT_TYPES = new Set([
  'ForStatement',
  'ForOfStatement',
  'ForInStatement',
  'WhileStatement',
  'DoWhileStatement'
])

const ARRAY_ITERATION_METHODS = new Set([
  'forEach',
  'map',
  'flatMap',
  'filter',
  'reduce',
  'reduceRight',
  'some',
  'every',
  'find',
  'findIndex',
  'findLast',
  'findLastIndex'
])

const isThreeMeshCall = (node) => {
  if (node.type !== 'NewExpression') return false
  const callee = node.callee
  // new THREE.Mesh(...)
  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'THREE' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'Mesh'
  )
    return true
  // new Mesh(...) — when imported directly
  if (callee.type === 'Identifier' && callee.name === 'Mesh') return true
  return false
}

const isLoopStatement = (node) => LOOP_STATEMENT_TYPES.has(node.type)

const isArrayIterationCallback = (node) => {
  const parent = node.parent
  if (!parent || parent.type !== 'CallExpression') return false
  const callee = parent.callee
  if (callee.type !== 'MemberExpression') return false
  const methodName = callee.property.name ?? callee.property.value
  return ARRAY_ITERATION_METHODS.has(methodName)
}

const isInsideLoop = (node) => {
  const checkAncestor = (current) => {
    if (!current) return false
    if (isLoopStatement(current)) return true
    if (
      (current.type === 'FunctionExpression' || current.type === 'ArrowFunctionExpression') &&
      isArrayIterationCallback(current)
    )
      return true
    return checkAncestor(current.parent)
  }
  return checkAncestor(node.parent)
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow new THREE.Mesh() inside loops — use InstancedMesh for repeated geometry',
      url: 'https://threejs.org/docs/#api/en/objects/InstancedMesh'
    },
    schema: [],
    messages: {
      meshInLoop:
        'Creating a new THREE.Mesh inside a loop adds one draw call per iteration. ' +
        'Use THREE.InstancedMesh instead: const mesh = new THREE.InstancedMesh(geo, mat, count).'
    }
  },

  create(context) {
    return {
      NewExpression(node) {
        if (isThreeMeshCall(node) && isInsideLoop(node)) {
          context.report({ node, messageId: 'meshInLoop' })
        }
      }
    }
  }
}
