import { BrowserWindow, app, ipcMain } from 'electron'
import path from 'node:path'
import type { ExternalPlayoutControlService } from './external-playout-control-service'
import type { ExternalPlayoutController } from './external-playout-controller'
import {
  assertSerializable,
  validateActivateItemPayload,
  validateApplyImageProcessingPayload,
  validateCreatePlaylistPayload,
  validateDownloadSearchSelectionPayload,
  validateImportLocalAssetsPayload,
  validateImportPlaylistFilePayload,
  validateSearchImagesPayload,
  type ApplyImageProcessingPayload,
  type CreatePlaylistPayload,
  type DownloadSearchSelectionPayload,
  type ExternalControlStatusDto,
  type ImageAssetDto,
  type ImageSearchResultDto,
  type ImportLocalAssetsPayload,
  type ImportPlaylistFilePayload,
  type PlaylistSummaryDto,
  type PlayoutStatusDto,
  type SearchImagesPayload,
} from '../../src/shared/plasma-api'

interface RegisterPlasmaIpcHandlersOptions {
  clock?: () => string
  externalPlayoutControlService?: Pick<ExternalPlayoutControlService, 'getExternalControlStatus' | 'getPlayoutStatus' | 'subscribe'>
  playoutController?: ExternalPlayoutController
}

export function registerPlasmaIpcHandlers(options: RegisterPlasmaIpcHandlersOptions = {}) {
  const clock = options.clock ?? (() => new Date().toISOString())
  const externalPlayoutControlService = options.externalPlayoutControlService
  const playoutController = options.playoutController

  playoutController?.subscribe((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('playout:statusChanged', status)
    }
  })
  externalPlayoutControlService?.subscribe?.((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send('externalControl:statusChanged', status)
    }
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('playlists:list', () => serializeResponse<PlaylistSummaryDto[]>([]))
  ipcMain.handle('playlists:create', (_event, payload: CreatePlaylistPayload) => {
    validateCreatePlaylistPayload(payload)
    return serializeResponse(createPlaylistSummary(payload, clock))
  })
  ipcMain.handle('playlists:importFile', (_event, payload: ImportPlaylistFilePayload) => {
    validateImportPlaylistFilePayload(payload)
    return serializeResponse(importPlaylistSummary(payload, clock))
  })
  ipcMain.handle('assets:importLocalImages', (_event, payload: ImportLocalAssetsPayload) => {
    validateImportLocalAssetsPayload(payload)
    return serializeResponse<ImageAssetDto[]>([])
  })
  ipcMain.handle('assets:searchImages', (_event, payload: SearchImagesPayload) => {
    validateSearchImagesPayload(payload)
    return serializeResponse<ImageSearchResultDto[]>([])
  })
  ipcMain.handle('assets:downloadSearchSelection', (_event, payload: DownloadSearchSelectionPayload) => {
    validateDownloadSearchSelectionPayload(payload)
    return serializeResponse<ImageAssetDto[]>([])
  })
  ipcMain.handle('imageProcessing:applyTransforms', (_event, payload: ApplyImageProcessingPayload) => {
    validateApplyImageProcessingPayload(payload)
    return serializeResponse(createProcessedAssetPlaceholder(payload, clock))
  })
  ipcMain.handle('playout:getStatus', () => serializeResponse<PlayoutStatusDto>(
    playoutController?.getStatus(Date.now()) ?? externalPlayoutControlService?.getPlayoutStatus() ?? {
      playlistId: null,
      itemId: null,
      state: 'idle',
      lastCommand: null,
      updatedAt: clock(),
    },
  ))
  ipcMain.handle('playout:play', () => serializeResponse<PlayoutStatusDto>(
    requirePlayoutController(playoutController).play(Date.now()),
  ))
  ipcMain.handle('playout:next', () => serializeResponse<PlayoutStatusDto>(
    requirePlayoutController(playoutController).next(Date.now()),
  ))
  ipcMain.handle('playout:stop', () => serializeResponse<PlayoutStatusDto>(
    requirePlayoutController(playoutController).stop(Date.now()),
  ))
  ipcMain.handle('playout:pause', () => serializeResponse<PlayoutStatusDto>(
    requirePlayoutController(playoutController).pause(Date.now()),
  ))
  ipcMain.handle('playout:resume', () => serializeResponse<PlayoutStatusDto>(
    requirePlayoutController(playoutController).resume(Date.now()),
  ))
  ipcMain.handle('playout:previous', () => serializeResponse<PlayoutStatusDto>(
    requirePlayoutController(playoutController).previous(Date.now()),
  ))
  ipcMain.handle('playout:activateItem', (_event, payload: { itemId: string }) => {
    validateActivateItemPayload(payload)
    return serializeResponse<PlayoutStatusDto>(
      requirePlayoutController(playoutController).activateItem(payload.itemId, Date.now()),
    )
  })
  ipcMain.handle('externalControl:getStatus', () => serializeResponse<ExternalControlStatusDto>(
    externalPlayoutControlService?.getExternalControlStatus() ?? {
      enabled: false,
      provider: 'none',
      activityState: 'disconnected',
      connectionState: 'disconnected',
      endpointUrl: null,
      port: null,
      allowedCommands: [],
      lastCommand: null,
      recentCommands: [],
      updatedAt: clock(),
    },
  ))
}

function createPlaylistSummary(payload: CreatePlaylistPayload, clock: () => string): PlaylistSummaryDto {
  return {
    id: payload.id,
    name: payload.name.trim(),
    itemCount: 0,
    updatedAt: clock(),
  }
}

function importPlaylistSummary(payload: ImportPlaylistFilePayload, clock: () => string): PlaylistSummaryDto {
  const fileName = path.basename(payload.filePath)

  return {
    id: `import:${fileName}`,
    name: fileName,
    itemCount: 0,
    updatedAt: clock(),
  }
}

function createProcessedAssetPlaceholder(
  payload: ApplyImageProcessingPayload,
  clock: () => string,
): ImageAssetDto {
  return {
    id: payload.assetId,
    path: '',
    originalPath: '',
    processedPath: '',
    previewPath: '',
    mimeType: 'image/png',
    createdAt: clock(),
  }
}

function serializeResponse<T>(response: T): T {
  assertSerializable(response)
  return response
}

function requirePlayoutController(playoutController?: ExternalPlayoutController) {
  if (!playoutController) {
    throw new Error('Playout controller is not configured.')
  }

  return playoutController
}
