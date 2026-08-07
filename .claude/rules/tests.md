---
paths:
  - '**/*.test.ts'
---

# Tests

- **Vitest**, in `.test.ts` files alongside the implementation. Repo-wide contract tests
  live in `src/tests/`.
- **Run with `pnpm test:unit`** — it uses `vitest run`, which exits when finished. Never the
  bare `vitest` command, which watches forever. Use `pnpm test:watch` only when actively
  iterating.
- **Arrange, Act, Assert** — structure every test in those three sections.
- **Parameterise with `it.each`.** When the same logic is exercised with different inputs,
  it is one table-driven test, never several near-identical copies. Reference:
  `packages/controls/src/core.test.ts`.
- Cover the core logic, the edge cases and the public API — not the getters.

## Writing tests first

For issue work, the specifications come before the implementation: write the tests
describing the expected behaviour, present them for confirmation, then write the code that
satisfies them. Exploratory prototypes are exempt from tests-first, but they owe tests
before their pull request is opened.

A feature with no tests is not finished.
