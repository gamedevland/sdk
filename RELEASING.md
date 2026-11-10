# Releasing the SDK

The maintainer authorized public source distribution and npm publication on 2026-11-04.
The SDK source and current package releases use MIT. The publish workflow accepts publication
only from `main` with a public source repository; validation-only runs remain available.

## Current release

Engine `0.0.13` and tooling `0.2.2` include renderer and runtime ownership changes.
Review both migration guides before upgrading existing games. The tooling declares
the engine as a peer so consumers use one runtime copy.

## Release procedure

1. Review the source, licenses, and Git history. Update the package version and lockfile.
   Add a dated entry to the package changelog, a short entry to the root README changelog,
   and the latest summary to the package README for npm. Commit the release changes.
2. Run `npm ci`, `npm run build`, `npm run typecheck`,
   `npm run test:resource-cleanup --workspace @gamedevland/engine`,
   `npm run test:screen --workspace @gamedevland/engine`,
   `npm run lint`, `npm test --workspace @gamedevland/engine`,
   `npm run test:renderers`, `npm run test:stability`, and
   `npm test --workspace @gamedevland/vite`. The lint script checks architecture and TypeScript runtime style; typecheck is separate.
3. Run `Publish npm packages` on `main` with `publish=false` and select `engine`, `vite`,
   or `all` to match the release scope. Check that the validated commit is the release commit.
4. Verify anonymous source access and GitHub's MIT detection for `gamedevland/sdk`.
5. Run the same workflow with `publish=true` and the same package selection. If both packages
   are selected, engine publishes first. The workflow uses npm trusted publishing.
6. Verify the published versions, licenses, repository links, tarball contents, and provenance.
   Create a GitHub release tagged at the published commit and use the package changelog for its notes.

The release must include only reviewed, committed code. Local uncommitted patches are not
implicitly included in a GitHub Actions release. Earlier npm versions retain their archive licenses.
