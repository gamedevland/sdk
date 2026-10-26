# Contributing

Open an issue for a reproducible bug or a focused feature proposal. Describe the environment,
package versions, expected behavior, actual behavior and a minimal reproduction.
For larger API changes, discuss the boundary and intended consumer first.

## Development

Use Node.js 22.12+ or 24 and npm from the repository root:

```bash
npm ci
npm run build
npm run typecheck
npm test --workspace @gamedevland/vite
npm pack --dry-run --workspace @gamedevland/engine
npm pack --dry-run --workspace @gamedevland/vite
```

There is currently no lint script in this workspace. Type checks, builds and the tooling tests run in CI.
Add targeted regression coverage when changing behavior. Keep generated `dist/`, credentials,
local game data and dependency directories out of commits.

## Architecture and style

- Keep changes small and preserve public package boundaries.
- Keep game rules in consumer projects and reusable infrastructure in the SDK.
- Use strict TypeScript and explicit dependencies; decode unknown boundary data with shared schemas.
- Prefer classes for runtime state/lifecycle ownership and one runtime class per file.
- Keep lifecycle cleanup deterministic and idempotent.
- Write comments and API documentation in English.
- Follow the additional engine source instructions in `packages/engine/src/AGENTS.md`.

In a pull request, explain the problem, resulting behavior, compatibility impact and validation performed.
Do not submit secrets in issues, pull requests or test fixtures.

## Licensing

By submitting a contribution, you agree that it is licensed under this repository's MIT license.
Only contribute code and other material you have the right to license this way.
