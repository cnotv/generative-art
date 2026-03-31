import { RuleTester } from 'eslint'
import rule from './no-alloc-in-animation-loop.js'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: 'module' }
})

tester.run('no-alloc-in-animation-loop', rule, {
  valid: [
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
      code: `
        addAction({ action: () => { const map = new Map() } })
      `
    },
    // unrelated function named action is fine
    {
      code: `
        doSomething({ action: () => { const v = new Vector3() } })
      `
    }
  ],

  invalid: [
    // new Vector3 inside addAction
    {
      code: `addAction({ action: () => { const v = new Vector3(1, 0, 0) } })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Vector3' } }]
    },
    // new Matrix4 inside addAction
    {
      code: `addAction({ action: () => { const m = new Matrix4() } })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Matrix4' } }]
    },
    // .clone() inside addAction
    {
      code: `addAction({ action: () => { const d = velocity.clone() } })`,
      errors: [{ messageId: 'noCloneInLoop' }]
    },
    // new Vector3 inside addActions array element
    {
      code: `addActions([{ action: () => { const v = new Vector3() } }])`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Vector3' } }]
    },
    // method call form: timelineManager.addAction
    {
      code: `timelineManager.addAction({ action: () => { const q = new Quaternion() } })`,
      errors: [{ messageId: 'noNewInLoop', data: { name: 'Quaternion' } }]
    },
    // .clone() via method call form
    {
      code: `timelineManager.addAction({ action: () => { enemy.position.clone() } })`,
      errors: [{ messageId: 'noCloneInLoop' }]
    }
  ]
})
