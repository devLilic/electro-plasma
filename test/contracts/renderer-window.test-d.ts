import { expectTypeOf, test } from 'vitest'
import type { PlasmaApi } from '../../src/shared/plasma-api'

test('renderer window exposes the typed plasma api', () => {
  expectTypeOf(window.plasma).toEqualTypeOf<PlasmaApi>()
  expectTypeOf(window.plasma.app.getVersion).returns.toEqualTypeOf<Promise<string>>()
  expectTypeOf(window.plasma.playlists.list).returns.toEqualTypeOf<Promise<Array<{
    id: string
    name: string
    itemCount: number
    updatedAt: string
  }>>>()
  expectTypeOf(window.plasma.assets.importLocalImages).returns.toEqualTypeOf<Promise<Array<{
    id: string
    path: string
    originalPath: string
    processedPath: string
    previewPath: string
    mimeType: string
    width?: number
    height?: number
    createdAt: string
  }>>>()
  expectTypeOf(window.plasma.imageProcessing.applyTransforms).returns.toEqualTypeOf<Promise<{
    id: string
    path: string
    originalPath: string
    processedPath: string
    previewPath: string
    mimeType: string
    width?: number
    height?: number
    createdAt: string
  }>>()
  expectTypeOf(window.plasma.playout.getStatus).returns.toEqualTypeOf<Promise<{
    playlistId: string | null
    itemId: string | null
    state: 'idle' | 'playing' | 'paused'
    lastCommand: 'play' | 'next' | 'stop' | 'pause' | 'resume' | 'prev' | 'activateItem' | 'getStatus' | null
    updatedAt: string
  }>>()
  expectTypeOf(window.plasma.playout.play).returns.toEqualTypeOf<Promise<{
    playlistId: string | null
    itemId: string | null
    state: 'idle' | 'playing' | 'paused'
    lastCommand: 'play' | 'next' | 'stop' | 'pause' | 'resume' | 'prev' | 'activateItem' | 'getStatus' | null
    updatedAt: string
  }>>()
  expectTypeOf(window.plasma.playout.subscribe).returns.toEqualTypeOf<() => void>()
  expectTypeOf(window.plasma.externalControl.getStatus).returns.toEqualTypeOf<Promise<{
    enabled: boolean
    provider: 'none' | 'companion' | 'mos' | 'local-http'
    activityState: 'disconnected' | 'listening' | 'connected'
    connectionState: 'disconnected' | 'connecting' | 'connected'
    endpointUrl: string | null
    port: number | null
    allowedCommands: Array<'play' | 'next' | 'stop' | 'pause' | 'resume' | 'prev' | 'activateItem' | 'getStatus'>
    lastCommand: 'play' | 'next' | 'stop' | 'pause' | 'resume' | 'prev' | 'activateItem' | 'getStatus' | null
    recentCommands: Array<{
      command: 'play' | 'next' | 'stop' | 'pause' | 'resume' | 'prev' | 'activateItem' | 'getStatus'
      receivedAt: string
      source: 'local-http'
    }>
    updatedAt: string
  }>>()
  expectTypeOf(window.plasma.externalControl.subscribe).returns.toEqualTypeOf<() => void>()
})

test('renderer window does not expose ipcRenderer', () => {
  // @ts-expect-error ipcRenderer must stay behind preload
  window.ipcRenderer
})
