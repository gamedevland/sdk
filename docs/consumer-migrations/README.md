# Consumer migration evidence

Local source patches in `artifacts/validation/consumer-migrations/` record the public-API migration exercised in isolated copies
of Alex's actual working games. The source projects contained uncommitted work;
this is review evidence against the local snapshots, not a release migration that
can be blindly applied to an arbitrary game revision.

- `rings-3d.patch`: engine-owned storage and disposal-scope subscription ownership.
- `ai-defender.patch`: renderer imports/module/node contracts, narrow texture baking,
  public-entry lint rules and updated test fixtures for the new runtime graph.
- `cyber-ui-sdk.patch`: explicit Pixi node host for PanelReveal. Rebuild the adapter
  against the same engine version and update its engine peer version.
- `three-game.patch`: storage injection, shared presentation scheduling, strict model
  loads, diagnostic subscription instead of replacing runtime methods, test migration.

Game-specific source patches remain ignored local validation artifacts, outside the
public SDK history. Dependencies are intentionally not encoded as machine-specific tarball names in
these patches. For each copy, install the engine/tooling paths in
`artifacts/latest.json`; override tooling's engine dependency to the root engine
package. Remove the game-local engine from three-game's npm workspaces and build
scripts, retaining physics-cannon as its separate workspace. AI Defender uses a
rebuilt isolated Cyber UI SDK adapter with an engine peer of `0.0.13-refactor.1`.

Runtime assets, original repositories and original game lockfiles were not changed.
See `../RUNTIME_REFACTOR_REPORT_RU.md` for exact validation scope and limitations.
