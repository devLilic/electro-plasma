export const plasmaExternalControlApi = {
  getStatus() {
    return window.plasma.externalControl.getStatus()
  },
  subscribe(listener: (status: Awaited<ReturnType<typeof window.plasma.externalControl.getStatus>>) => void) {
    return window.plasma.externalControl.subscribe(listener)
  },
}
