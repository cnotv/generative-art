# Testing Conventions

## Git workflow

1. **Before branching**: Run `git fetch origin main && git rebase origin/main` to start from the latest main
2. **Before pushing**: Run `git fetch origin main && git rebase origin/main` to incorporate upstream changes
3. **Rebase, never merge**: Use `git rebase` instead of `git merge`. Never use `git pull` (which merges by default)
4. **Force push safely**: After a rebase, use `git push --force-with-lease` (never `--force`)

## TDD workflow

1. Write test specifications first describing expected behavior
2. Present tests to user for confirmation before implementation
3. Only after test approval, write implementation to make tests pass
4. Never skip this workflow — finishing without tests means the feature is incomplete

## Rules

- **Add unit tests**: Create `.test.ts` files alongside implementation files
- **Test framework**: Use Vitest
- **Run tests**: Use `pnpm test:unit` (runs once and exits, watch mode disabled by default)
- **Watch mode**: Use `pnpm test:watch` only when explicitly needed for development
- **Note**: The `test:unit` script uses `vitest run` which exits after completion. Never use raw `vitest` command without `run` subcommand or `--run` flag
- **Test coverage**: Test core logic, edge cases, and public APIs
- **AAA pattern**: Structure tests with Arrange, Act, Assert sections
- **Parameterization**: Use `it.each()` for testing multiple similar cases. Never write multiple separate tests when they test the same logic with different inputs. Parameterized tests are more maintainable, easier to read, and prevent code duplication
- **Example pattern**: See `packages/controls/src/core.test.ts`
