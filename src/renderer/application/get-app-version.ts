import type { AppVersionPort } from '@domain/app-version-port'

export async function getAppVersion(appVersionPort: AppVersionPort) {
  return appVersionPort.getVersion()
}
