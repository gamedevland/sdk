# Releasing the SDK

The repository is intentionally private. Do not change its visibility or publish npm packages
until the maintainer explicitly authorizes reopening it. No automatic reopening is scheduled.
The publish workflow rejects publication from a private repository and from refs other than `main`.
Validation-only workflow runs remain available.

## Prepared versions

- `@gamedevland/engine`: 0.0.8 (unreleased).
- `@gamedevland/vite`: 0.1.2 (unreleased), depending on engine 0.0.8.
- Vite 0.1.1 was unpublished. Engine 0.0.7 withdrawal was rejected by npm because the package has registry dependents; that version remains public pending support resolution. Do not reuse either version number.

The release must include only reviewed, committed code. Local uncommitted engine patches are
not implicitly included in a GitHub Actions release.

## Once reopening is explicitly authorized

1. Review the final source, licenses and Git history. Commit the intended release changes.
2. Run `npm ci`, `npm run build`, `npm run typecheck` and
   `npm test --workspace @gamedevland/vite`. There is no lint script in this workspace.
3. Run the `Publish npm packages` workflow on `main` with `publish=false` and `package=all`.
4. Make `gamedevland/sdk` public and verify anonymous source access and GitHub's MIT detection.
5. Run the same workflow with `publish=true` and `package=all`. It publishes engine before Vite
   using the configured npm trusted publisher; no npm token belongs in the repository.
6. Wait for npm processing to finish, then verify both latest versions, licenses, repository links
   and provenance. Check the tarball contents as well as the workflow result.

Earlier published versions retain their archive licenses. The MIT LICENSE files and public metadata
are prepared here for the future releases.
