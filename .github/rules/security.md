# Security Requirements

## Git Hooks

- **Never use `--no-verify`**: NEVER use `--no-verify` flag on `git commit` or `git push`. If hooks fail, fix the underlying issue instead of bypassing them

## Linting Enforcement

- **Never disable ESLint rules**: NEVER use `eslint-disable`, `eslint-disable-next-line`, or `eslint-disable-line` comments. Fix the code to comply with the rules instead

## Type Safety

- **Always use TypeScript**: Never write plain JavaScript. All files must be `.ts` or `.vue` with `<script setup lang="ts">`
- **Avoid `any`**: Never use the `any` type. Use specific types, generics, or `unknown` with type narrowing
- **No unsafe type assertions**: Never use `as SomeType` on external or unvalidated data without explicit validation first
