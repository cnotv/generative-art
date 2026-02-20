# Testing Conventions

## TDD Workflow — MANDATORY

1. Write test specifications FIRST describing expected behavior
2. Present tests to user for confirmation BEFORE implementation
3. Only after test approval, write implementation to make tests pass
4. Never skip this workflow — finishing without tests means the feature is incomplete

## Rules

- **Always add unit tests**: Create `.test.ts` files alongside implementation files
- **Test framework**: Use Vitest
- **Run tests**: Use `pnpm test:unit` (runs once and exits, watch mode disabled by default)
- **Watch mode**: Use `pnpm test:watch` only when explicitly needed for development
- **CRITICAL**: The `test:unit` script uses `vitest run` which exits after completion. Never use raw `vitest` command without `run` subcommand or `--run` flag
- **Test coverage**: Test core logic, edge cases, and public APIs
- **AAA pattern**: Structure tests with Arrange, Act, Assert sections
- **Parameterization — CRITICAL**: ALWAYS use `it.each()` for testing multiple similar cases. Never write multiple separate tests when they test the same logic with different inputs. Parameterized tests are more maintainable, easier to read, and prevent code duplication
- **Example pattern**: See `packages/controls/src/core.test.ts`
