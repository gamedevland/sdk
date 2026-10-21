# Changelog

## 0.1.0

- Add the `gamedevland poki pack` and `gamedevland poki upload` CLI commands.
- Configure game ID, build directory, npm checks/build task and archive path in `poki.json`.
- Package deterministic ZIPs without platform-specific shell utilities or game-specific asset assumptions.
- Use the official pinned Poki CLI, per-game private credentials or `POKI_UPLOAD_TOKEN`, and verified upload receipts.
- Keep authentication out of check/build subprocesses and reject source maps, private files, symlinks and leaked upload tokens in build output.
- Preserve existing Vite configuration exports and browser SDK injection.
