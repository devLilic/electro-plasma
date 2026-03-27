# Preload test plan

Direct preload execution is awkward in plain Vitest because `contextBridge` only exists inside Electron.

For the next phase, keep preload verification in two layers:

1. Contract tests in Vitest
   - Import the shared contract from `shared/desktop-api.ts`.
   - Assert the namespace and exposed method names stay stable.
   - Typecheck `window.desktop` usage with `vitest --typecheck`.

2. Electron-integrated preload tests
   - Launch a minimal Electron window in a dedicated harness.
   - Evaluate `Object.keys(window.desktop)` in the renderer.
   - Confirm `window.ipcRenderer` is `undefined`.
   - Confirm unimplemented methods fail with the expected placeholder error until real handlers are wired.

This keeps phase 0 lightweight while still giving us a clear path to full preload coverage once the bridge starts doing real work.
