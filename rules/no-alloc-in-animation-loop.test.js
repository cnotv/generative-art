import { RuleTester } from 'eslint'
import rule from './no-alloc-in-animation-loop.js'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: 'module' }
})

tester.run('no-alloc-in-animation-loop', rule, {
  valid: [
    // ── Context 1: timeline action callbacks ──────────────────────────────

    // new outside action callback is fine
    {
      code: `
        const direction = new Vector3(0, 1, 0)
        addAction({ name: 'move', action: () => { direction.copy(other) } })
      `
    },
    // clone outside action callback is fine
    {
      code: `
        const copy = original.clone()
        addAction({ name: 'spin', action: () => { mesh.rotation.y += 0.01 } })
      `
    },
    // new for non-Three.js types inside action is fine
    {
      code: `addAction({ action: () => { const map = new Map() } })`
    },
    // unrelated function named action is fine
    {
      code: `doSomething({ action: () => { const v = new Vector3() } })`
    },

    // ── Context 2: browser loop callbacks ─────────────────────────────────

    // new outside requestAnimationFrame callback
    {
      code: `
        const v = new Vector3()
        requestAnimationFrame(() => { v.set(1, 0, 0) })
      `
    },
    // non-Three.js allocation inside rAF is fine
    {
      code: `requestAnimationFrame(() => { const arr = new Array(10) })`
    },
    // new outside setInterval callback
    {
      code: `
        const color = new Color(0xff0000)
        setInterval(() => { mesh.material.color.copy(color) }, 16)
      `
    },

    // ── Context 3: named animation functions ──────────────────────────────

    // new inside a function with a non-animation name
    {
      code: `function setup() { const v = new Vector3() }`
    },
    // new inside an arrow function not assigned to an animation name
    {
      code: `const init = () => { const m = new Matrix4() }`
    },
    // custom animationFunctionNames option — default names no longer flagged
    {
      code: `function animate() { const v = new Vector3() }`,
      options: [{ animationFunctionNames: ['tick'] }]
    }
  ],

  invalid: [
    // ── Context 1: timeline action callbacks ──────────────────────────────

    {
      code: `addAction({ action: () => { const v = new Vector3(1, 0, 0) } })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Vector3' } }]
    },
    {
      code: `addAction({ action: () => { const m = new Matrix4() } })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Matrix4' } }]
    },
    {
      code: `addAction({ action: () => { const d = velocity.clone() } })`,
      errors: [{ messageId: 'noCloneInLoop' }]
    },
    {
      code: `addActions([{ action: () => { const v = new Vector3() } }])`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Vector3' } }]
    },
    {
      code: `timelineManager.addAction({ action: () => { const q = new Quaternion() } })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Quaternion' } }]
    },
    {
      code: `timelineManager.addAction({ action: () => { enemy.position.clone() } })`,
      errors: [{ messageId: 'noCloneInLoop' }]
    },

    // ── Context 2: requestAnimationFrame callback ─────────────────────────

    {
      code: `requestAnimationFrame(() => { const v = new Vector3() })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Vector3' } }]
    },
    {
      code: `requestAnimationFrame(() => { const e = new Euler() })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Euler' } }]
    },
    {
      code: `requestAnimationFrame(() => { const c = position.clone() })`,
      errors: [{ messageId: 'noCloneInLoop' }]
    },
    // nested arrow inside rAF still flagged
    {
      code: `requestAnimationFrame(() => { objects.forEach(() => { const m = new Matrix4() }) })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Matrix4' } }]
    },

    // ── Context 2: setInterval callback ──────────────────────────────────

    {
      code: `setInterval(() => { const q = new Quaternion() }, 16)`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Quaternion' } }]
    },
    {
      code: `setInterval(() => { const d = dir.clone() }, 100)`,
      errors: [{ messageId: 'noCloneInLoop' }]
    },

    // ── Context 3: named animation functions ──────────────────────────────

    // function declaration
    {
      code: `function animate() { const v = new Vector3() }`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Vector3' } }]
    },
    // arrow assigned to variable named tick
    {
      code: `const tick = () => { const m = new Matrix4() }`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Matrix4' } }]
    },
    // function expression assigned to variable named update
    {
      code: `const update = function() { position.clone() }`,
      errors: [{ messageId: 'noCloneInLoop' }]
    },
    // method shorthand named onFrame
    {
      code: `const obj = { onFrame() { const e = new Euler() } }`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Euler' } }]
    },
    // custom animationFunctionNames option
    {
      code: `function tick() { const v = new Vector3() }`,
      options: [{ animationFunctionNames: ['tick'] }],
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Vector3' } }]
    },

    // ── Loaders and materials inside loops ────────────────────────────────

    // TextureLoader inside rAF — loader must be created once and reused
    {
      code: `requestAnimationFrame(() => { const loader = new TextureLoader() })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'TextureLoader' } }]
    },
    // GLTFLoader inside animate — extremely expensive per frame
    {
      code: `function animate() { const loader = new GLTFLoader() }`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'GLTFLoader' } }]
    },
    // Material creation inside rAF — should be shared, not recreated
    {
      code: `requestAnimationFrame(() => { const mat = new MeshStandardMaterial({ color: 0xff0000 }) })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'MeshStandardMaterial' } }]
    },
    // SpriteMaterial inside addAction
    {
      code: `addAction({ action: () => { const m = new SpriteMaterial() } })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'SpriteMaterial' } }]
    }
  ]
})
