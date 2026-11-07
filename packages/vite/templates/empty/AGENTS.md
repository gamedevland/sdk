# Project instructions

- Use public `@gamedevland/engine` subsystem exports; do not deep-import internals.
- Keep flow in FSM → Command → Service. Components/actions own node visuals and input.
- Keep static hierarchies and authored visual values in JSON layouts/prefabs/configs.
- Keep every music/SFX channel and per-asset volume in the audio JSON config.
- Use SDK autoplay recovery and platform-owned data where available.
- Use strict TypeScript; avoid unsafe casts and non-null assertions.
- Run `npm run typecheck`, `npm run lint`, and `npm run build` after changes.
- Do not claim real-browser/device verification from simulated tests.
