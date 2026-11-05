# Releasing the SDK

The maintainer authorized public source distribution and npm publication on 2026-11-04.
The SDK source and current package releases use MIT. The publish workflow accepts publication
only from `main` with a public source repository; validation-only runs remain available.

## Current release versions

- `@gamedevland/engine`: 0.0.9.
- `@gamedevland/vite`: 0.1.2, depending on engine 0.0.8.
- Vite 0.1.1 was unpublished and must not be reused. Engine 0.0.7 was superseded;
  its withdrawal was rejected by npm because the package has registry dependents.

## Release procedure

1. Review the source, licenses, and Git history. Update the package version and lockfile.
   Add a dated entry to the package changelog, a short entry to the root README changelog,
   and the latest summary to the package README for npm. Commit the release changes.
2. Run `npm ci`, `npm run build`, `npm run typecheck`,
   `npm run test:resource-cleanup --workspace @gamedevland/engine`,
   `npm run test:screen --workspace @gamedevland/engine`, and
   `npm test --workspace @gamedevland/vite`. There is no lint script in this workspace.
3. Run `Publish npm packages` on `main` with `publish=false` and select `engine`, `vite`,
   or `all` to match the release scope. Check that the validated commit is the release commit.
4. Verify anonymous source access and GitHub's MIT detection for `gamedevland/sdk`.
5. Run the same workflow with `publish=true` and the same package selection. If both packages
   are selected, engine publishes first. The workflow uses npm trusted publishing.
6. Verify the published versions, licenses, repository links, tarball contents, and provenance.
   Create a GitHub release tagged at the published commit and use the package changelog for its notes.

The release must include only reviewed, committed code. Local uncommitted patches are not
implicitly included in a GitHub Actions release. Earlier npm versions retain their archive licenses.
