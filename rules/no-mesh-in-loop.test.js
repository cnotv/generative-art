import { RuleTester } from 'eslint'
import rule from './no-mesh-in-loop.js'

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' }
})

ruleTester.run('no-mesh-in-loop', rule, {
  valid: [
    // Single mesh outside any loop — fine
    { code: 'const mesh = new THREE.Mesh(geo, mat)' },
    // Mesh inside a regular function — fine
    { code: 'function createMesh() { return new THREE.Mesh(geo, mat) }' },
    // InstancedMesh — preferred pattern, always fine
    { code: 'items.forEach((_, i) => mesh.setMatrixAt(i, matrix))' },
    // Mesh created once, then added in a loop — fine
    { code: 'const mesh = new THREE.Mesh(geo, mat); items.forEach(() => scene.add(mesh))' },
    // Directly imported Mesh used outside a loop
    { code: 'const m = new Mesh(geo, mat)' }
  ],

  invalid: [
    // for loop
    {
      code: 'for (let i = 0; i < 10; i++) { new THREE.Mesh(geo, mat) }',
      errors: [{ messageId: 'meshInLoop' }]
    },
    // for-of loop
    {
      code: 'for (const item of items) { scene.add(new THREE.Mesh(geo, mat)) }',
      errors: [{ messageId: 'meshInLoop' }]
    },
    // while loop
    {
      code: 'while (count--) { list.push(new THREE.Mesh(geo, mat)) }',
      errors: [{ messageId: 'meshInLoop' }]
    },
    // forEach callback
    {
      code: 'items.forEach(() => { scene.add(new THREE.Mesh(geo, mat)) })',
      errors: [{ messageId: 'meshInLoop' }]
    },
    // map callback
    {
      code: 'const meshes = items.map(() => new THREE.Mesh(geo, mat))',
      errors: [{ messageId: 'meshInLoop' }]
    },
    // flatMap callback
    {
      code: 'const meshes = items.flatMap((item) => [new THREE.Mesh(item.geo, mat)])',
      errors: [{ messageId: 'meshInLoop' }]
    },
    // Directly imported Mesh inside forEach
    {
      code: 'items.forEach(() => { new Mesh(geo, mat) })',
      errors: [{ messageId: 'meshInLoop' }]
    },
    // Nested: map inside forEach
    {
      code: 'items.forEach((group) => { group.map(() => new THREE.Mesh(geo, mat)) })',
      errors: [{ messageId: 'meshInLoop' }]
    }
  ]
})

process.stdout.write('no-mesh-in-loop: all tests passed\n')
