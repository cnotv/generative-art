---
sidebar_position: 8
---

# Three.js Linting

Observations from enforcing ESLint rules on a Three.js codebase, and how to write custom rules that catch Three.js-specific bugs.

## Why no off-the-shelf plugin exists

`@react-three/eslint-plugin` is the closest community option, but its rules target React Three Fiber's `useFrame` hook — not vanilla Three.js. Its AST selectors look for `CallExpression[callee.name=useFrame]`, which never matches in this project. The underlying performance concerns are identical; only the detection hook differs.

## The allocation-in-loop problem

Allocating Three.js objects inside a per-frame callback creates garbage every frame. At 60 FPS that's 60+ GC allocations per second per call site, causing frame drops and stutters.

```ts
// Bad — allocates a new Vector3 every frame
addAction({
  action: () => {
    const direction = new THREE.Vector3(1, 0, 0) // ❌
    const copy = velocity.clone() // ❌
  }
})

// Good — allocate once, reuse every frame
const direction = new THREE.Vector3(1, 0, 0)
const scratchCopy = new THREE.Vector3()
addAction({
  action: () => {
    scratchCopy.copy(velocity) // ✅ reuses existing object
  }
})
```

Use `.set()`, `.copy()`, `.multiplyScalars()` etc. to mutate pre-allocated instances instead of constructing new ones.

## Writing a custom ESLint rule

Custom rules live in `rules/` as plain ES modules and are loaded directly in `eslint.config.js` via a local plugin.

### Rule file structure

```js
// rules/my-rule.js
export default {
  meta: {
    type: 'suggestion',
    docs: { description: '...' },
    messages: { myError: 'Describe the problem: {{detail}}' },
    schema: []
  },
  create(context) {
    return {
      // AST visitor — called for every matching node
      CallExpression(node) {
        if (/* condition */) {
          context.report({ node, messageId: 'myError', data: { detail: '...' } })
        }
      }
    }
  }
}
```

Key points:

- Use `node.parent` to walk up the tree (ESLint 9 removed `context.getAncestors()`).
- `node.callee.type === 'MemberExpression'` for method calls (`obj.method()`); `node.callee.type === 'Identifier'` for direct calls (`method()`).
- Report with `messageId` + `data` for interpolated messages.

### Wiring into eslint.config.js

```js
import myRule from './rules/my-rule.js'

export default [
  {
    plugins: {
      local: { rules: { 'my-rule': myRule } }
    },
    rules: {
      'local/my-rule': 'error'
    }
  }
]
```

### Testing with RuleTester

Rules are tested with ESLint's built-in `RuleTester` — no Vitest needed. Run directly with Node:

```js
// rules/my-rule.test.js
import { RuleTester } from 'eslint'
import rule from './my-rule.js'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: 'module' }
})

tester.run('my-rule', rule, {
  valid: [{ code: `/* code that should NOT trigger the rule */` }],
  invalid: [
    {
      code: `/* code that SHOULD trigger the rule */`,
      errors: [{ messageId: 'myError', data: { detail: 'something' } }]
    }
  ]
})
```

Run with:

```sh
node rules/my-rule.test.js
```

Exclude the `rules/` directory from Vitest (it uses `RuleTester`, not `describe`/`it`):

```ts
// vitest.config.ts
exclude: [...configDefaults.exclude, 'rules/**']
```

## The `no-alloc-in-animation-loop` rule

This project ships `rules/no-alloc-in-animation-loop.js`, which detects `new <ThreeType>()` and `.clone()` calls inside `addAction` / `addActions` callbacks.

It works by walking up `node.parent` from the offending `NewExpression` or `CallExpression` to find the enclosing arrow/function expression, then verifying that function is assigned to an `action` property inside a call to `addAction` or `addActions`.

When it fires, the fix is always the same: move the allocation above the `addAction` call so it runs once at setup time, and use a mutating method inside the action to update it each frame.
