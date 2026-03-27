# Architecture

## Layering

- `electron/main`: application bootstrap for Electron main, window creation and IPC registration.
- `electron/preload`: secure bridge between Electron and renderer. It may use `ipcRenderer`, but only to expose typed APIs.
- `src/shared`: contracts shared across Electron and renderer.
- `src/renderer/domain`: pure business rules, entities, value objects and ports. No React, no Electron, no browser APIs.
- `src/renderer/application`: use cases and orchestration. Depends on `domain`, never on `ui`.
- `src/renderer/infrastructure`: adapters for preload APIs, storage, HTTP, Electron-specific integrations and other external systems.
- `src/renderer/ui`: React components, routes and view state. UI calls application code and renders results.

## Import Rules

- Use aliases instead of deep relative imports.
- `@domain/*` can import only `@domain/*`.
- `@application/*` can import `@domain/*`.
- `@infrastructure/*` can import `@domain/*`, `@application/*` and `@shared/*` when adapting external systems.
- `@ui/*` can import `@application/*`, `@domain/*`, `@infrastructure/*` and `@shared/*`.
- `@shared/*` must stay platform-neutral.
- Renderer code must not import from `electron`.

## Team Conventions

- Put business decisions in `domain` or `application`, not in React components.
- Keep IPC channel names and preload contracts centralized in `src/shared`.
- Treat `window.plasma` as the only Electron entry point visible to renderer code.
- When adding a feature, create the smallest possible vertical slice across the layers instead of bypassing them.
