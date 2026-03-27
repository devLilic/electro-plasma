export const plasmaPlayoutApi = {
  getStatus() {
    return window.plasma.playout.getStatus()
  },
  play() {
    return window.plasma.playout.play()
  },
  next() {
    return window.plasma.playout.next()
  },
  stop() {
    return window.plasma.playout.stop()
  },
  pause() {
    return window.plasma.playout.pause()
  },
  resume() {
    return window.plasma.playout.resume()
  },
  previous() {
    return window.plasma.playout.previous()
  },
  activateItem(payload: { itemId: string }) {
    return window.plasma.playout.activateItem(payload)
  },
  subscribe(listener: (status: Awaited<ReturnType<typeof window.plasma.playout.getStatus>>) => void) {
    return window.plasma.playout.subscribe(listener)
  },
}
