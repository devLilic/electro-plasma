import type { AppVersionPort } from '@domain/app-version-port'

export const plasmaAppVersionPort: AppVersionPort = {
  getVersion() {
    return window.plasma.app.getVersion()
  },
}
