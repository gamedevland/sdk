# __PROJECT_NAME__

A blank TypeScript/PixiJS game using the Gamedev Land SDK. No demo gameplay or media assets.

```sh
npm run dev
npm run typecheck
npm run lint
npm run build
```

The CLI installs dependencies by default. If created with `--no-install`, run `npm install` first.
Node.js 22.12+ is required.

Entry: `game/src/main.ts`. Configuration: `game/src/config/GameConfiguration.ts`.
The empty scene uses the SDK's FSM, scene DI, asset manifest and JSON layout.
Add gameplay through FSM → Command → Service; put visuals in components/actions.

All music/SFX channel and per-file levels belong in
`game/assets/json/configs/audio/sounds-volumes.json`.

`npm run dev:crazygames` enables the official CrazyGames v3 SDK on localhost.
`npm run build:crazygames` produces `dist/crazygames/` with relative asset paths.
Report gameplay start/stop when actual gameplay is added; a blank scene is not gameplay.
