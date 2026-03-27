# Structure Checklist

- [x] `electron/main` contains the Electron main-process entrypoint.
- [x] `electron/preload` owns the renderer bridge and isolates IPC usage.
- [x] `src/renderer` remains renderer-only and does not import `electron` or demo shims.
- [x] `src/shared` contains the typed contract used by preload, renderer and tests.
- [x] `src/renderer/domain`, `application`, `infrastructure` and `ui` are reserved for architectural layering.
- [x] Import aliases exist for each renderer layer and for `src/shared`.
- [x] `window.plasma` is declared globally for renderer TypeScript code.
- [x] The minimum IPC surface is reduced to `app.getVersion()`.
