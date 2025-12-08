/* eslint-env node */
require('@rushstack/eslint-patch/modern-module-resolution')

module.exports = {
  root: true,
  'extends': [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
    '@vue/eslint-config-typescript',
    '@vue/eslint-config-prettier/skip-formatting'
  ],
  parserOptions: {
    ecmaVersion: 'latest'
  },
  rules: {
    // Disable multi-word component name requirement for specific cases
    'vue/multi-word-component-names': 'off',
    // Warn on unused vars instead of error (helps during development)
    '@typescript-eslint/no-unused-vars': 'warn',
    'no-unused-vars': 'warn'
  },
  overrides: [
    {
      // Node.js environment for netlify functions
      files: ['netlify/**/*.js'],
      env: {
        node: true,
        es6: true
      },
      rules: {
        'no-undef': 'off'
      }
    }
  ]
}
