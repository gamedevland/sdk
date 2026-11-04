# Releasing the SDK

The maintainer authorized public source distribution and npm publication on 2026-11-04.
The SDK source and current package releases use MIT. The publish workflow accepts publication
only from `main` with a public source repository; validation-only runs remain available.

## Current release versions

- `@gamedevland/engine`: 0.0.8.
- `@gamedevland/vite`: 0.1.2, depending on engine 0.0.8.
- Vite 0.1.1 was unpublished and must not be reused. Engine 0.0.7 was superseded;
  its withdrawal was rejected by npm because the package has registry dependents.

## Release procedure

1. Review the final source, licenses and Git history. Commit the intended release changes.
2. Run `npm ci`, `npm run build`, `npm run typecheck`,
   `npm run test:resource-cleanup --workspace @gamedevland/engine` and
   `npm test --workspace @gamedevland/vite`. There is no lint script in this workspace.
3. Run the `Publish npm packages` workflow on `main` with `publish=false` and `package=all`.
4. Verify anonymous source access and GitHub's MIT detection for `gamedevland/sdk`.
5. Run the same workflow with `publish=true` and `package=all`. It publishes engine before Vite
   using the configured npm trusted publisher; no npm token belongs in the repository.
6. Wait for npm processing to finish, then verify both latest versions, licenses, repository links
   and provenance. Check the tarball contents as well as the workflow result.

The release must include only reviewed, committed code. Local uncommitted patches are not
implicitly included in a GitHub Actions release. Earlier npm versions retain their archive licenses.
