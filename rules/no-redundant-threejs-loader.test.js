import { RuleTester } from 'eslint'
import rule from './no-redundant-threejs-loader.js'

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2020, sourceType: 'module' }
})

tester.run('no-redundant-threejs-loader', rule, {
  valid: [
    // Single loader stored at module level — correct pattern
    {
      code: `const loader = new TextureLoader(); loader.load(url)`
    },
    // Single GLTFLoader used once — fine
    {
      code: `const gltfLoader = new GLTFLoader(); gltfLoader.load(url, onLoad)`
    },
    // Non-loader Three.js class — not flagged
    {
      code: `const mesh = new Mesh(geo, mat)`
    },
    // Two different loader types — each is unique, no duplicate
    {
      code: `const texLoader = new TextureLoader(); const gltfLoader = new GLTFLoader()`
    },
    // THREE namespace, single instance — fine
    {
      code: `const loader = new THREE.TextureLoader(); loader.load(url)`
    }
  ],

  invalid: [
    // ── Rule 1: inline (unchained) usage ──────────────────────────────────

    // Bare identifier
    {
      code: `new TextureLoader().load(url)`,
      errors: [{ messageId: 'inlineLoader', data: { name: 'TextureLoader' } }]
    },
    // THREE namespace
    {
      code: `new THREE.TextureLoader().load(url)`,
      errors: [{ messageId: 'inlineLoader', data: { name: 'TextureLoader' } }]
    },
    // Other loader types
    {
      code: `new GLTFLoader().load(modelUrl, onLoad)`,
      errors: [{ messageId: 'inlineLoader', data: { name: 'GLTFLoader' } }]
    },
    // Accessing a property without calling — still inline
    {
      code: `const manager = new TextureLoader().manager`,
      errors: [{ messageId: 'inlineLoader', data: { name: 'TextureLoader' } }]
    },

    // ── Rule 2: duplicate loader instances in same file ───────────────────

    {
      code: `
        const loaderA = new TextureLoader()
        const loaderB = new TextureLoader()
      `,
      errors: [
        { messageId: 'duplicateLoader', data: { name: 'TextureLoader', count: '2' } },
        { messageId: 'duplicateLoader', data: { name: 'TextureLoader', count: '2' } }
      ]
    },
    {
      code: `
        function loadScene() { const loader = new GLTFLoader() }
        function loadPlayer() { const loader = new GLTFLoader() }
      `,
      errors: [
        { messageId: 'duplicateLoader', data: { name: 'GLTFLoader', count: '2' } },
        { messageId: 'duplicateLoader', data: { name: 'GLTFLoader', count: '2' } }
      ]
    },
    // THREE namespace duplicates
    {
      code: `
        const t1 = new THREE.TextureLoader()
        const t2 = new THREE.TextureLoader()
      `,
      errors: [
        { messageId: 'duplicateLoader', data: { name: 'TextureLoader', count: '2' } },
        { messageId: 'duplicateLoader', data: { name: 'TextureLoader', count: '2' } }
      ]
    }
  ]
})
