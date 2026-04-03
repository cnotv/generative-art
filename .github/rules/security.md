# Security Requirements

## Git Hooks

- **No `--no-verify`**: Do not use the `--no-verify` flag on `git commit` or `git push`. If hooks fail, fix the underlying issue instead of bypassing them

## Linting Enforcement

- **No eslint-disable**: Do not use `eslint-disable`, `eslint-disable-next-line`, or `eslint-disable-line` comments. Fix the code to comply with the rules instead

## Type Safety

- **Use TypeScript**: Never write plain JavaScript. All files must be `.ts` or `.vue` with `<script setup lang="ts">`
- **Avoid `any`**: Never use the `any` type. Use specific types, generics, or `unknown` with type narrowing
- **No unsafe type assertions**: Never use `as SomeType` on external or unvalidated data without explicit validation first
