export const PLASMA_API_NAMESPACE = 'plasma' as const

export type Serializable =
  | null
  | string
  | number
  | boolean
  | Serializable[]
  | { [key: string]: Serializable }

export interface PlaylistSummaryDto {
  id: string
  name: string
  itemCount: number
  updatedAt: string
}

export interface ImageAssetDto {
  id: string
  path: string
  originalPath: string
  processedPath: string
  previewPath: string
  mimeType: string
  width?: number
  height?: number
  createdAt: string
}

export interface ImageSearchResultDto {
  id: string
  provider: string
  title: string
  previewUrl: string
  downloadUrl: string
  sourceUrl: string
  width?: number
  height?: number
}

export interface PlayoutStatusDto {
  playlistId: string | null
  itemId: string | null
  state: 'idle' | 'playing' | 'paused'
  lastCommand: ExternalControlCommand | null
  updatedAt: string
}

export type ExternalControlCommand =
  | 'play'
  | 'next'
  | 'stop'
  | 'pause'
  | 'resume'
  | 'prev'
  | 'activateItem'
  | 'getStatus'

export interface ExternalControlCommandLogEntryDto {
  command: ExternalControlCommand
  receivedAt: string
  source: 'local-http'
}

export interface ExternalControlStatusDto {
  enabled: boolean
  provider: 'none' | 'companion' | 'mos' | 'local-http'
  activityState: 'disconnected' | 'listening' | 'connected'
  connectionState: 'disconnected' | 'connecting' | 'connected'
  endpointUrl: string | null
  port: number | null
  allowedCommands: ExternalControlCommand[]
  lastCommand: ExternalControlCommand | null
  recentCommands: ExternalControlCommandLogEntryDto[]
  updatedAt: string
}

export interface ImportPlaylistFilePayload {
  filePath: string
}

export interface CreatePlaylistPayload {
  id: string
  name: string
}

export interface ImportLocalAssetsPayload {
  itemId: string
  sourceFilePaths: string[]
}

export interface SearchImagesPayload {
  query: string
  limit?: number
}

export interface DownloadSearchSelectionPayload {
  selectedResults: ImageSearchResultDto[]
}

export type ImageTransformOperationDto =
  | { type: 'crop-16:9' }
  | { type: 'flip' }
  | { type: 'flop' }
  | { type: 'rotate'; degrees: 90 | 180 | 270 }

export interface ApplyImageProcessingPayload {
  assetId: string
  operations: ImageTransformOperationDto[]
}

export const plasmaApiContract = {
  app: ['getVersion'],
  playlists: ['list', 'create', 'importFile'],
  assets: ['importLocalImages', 'searchImages', 'downloadSearchSelection'],
  imageProcessing: ['applyTransforms'],
  playout: ['getStatus', 'play', 'next', 'stop', 'pause', 'resume', 'previous', 'activateItem', 'subscribe'],
  externalControl: ['getStatus', 'subscribe'],
} as const satisfies Record<string, readonly string[]>

export interface PlasmaApi {
  app: {
    getVersion(): Promise<string>
  }
  playlists: {
    list(): Promise<PlaylistSummaryDto[]>
    create(payload: CreatePlaylistPayload): Promise<PlaylistSummaryDto>
    importFile(payload: ImportPlaylistFilePayload): Promise<PlaylistSummaryDto>
  }
  assets: {
    importLocalImages(payload: ImportLocalAssetsPayload): Promise<ImageAssetDto[]>
    searchImages(payload: SearchImagesPayload): Promise<ImageSearchResultDto[]>
    downloadSearchSelection(payload: DownloadSearchSelectionPayload): Promise<ImageAssetDto[]>
  }
  imageProcessing: {
    applyTransforms(payload: ApplyImageProcessingPayload): Promise<ImageAssetDto>
  }
  playout: {
    getStatus(): Promise<PlayoutStatusDto>
    play(): Promise<PlayoutStatusDto>
    next(): Promise<PlayoutStatusDto>
    stop(): Promise<PlayoutStatusDto>
    pause(): Promise<PlayoutStatusDto>
    resume(): Promise<PlayoutStatusDto>
    previous(): Promise<PlayoutStatusDto>
    activateItem(payload: { itemId: string }): Promise<PlayoutStatusDto>
    subscribe(listener: (status: PlayoutStatusDto) => void): () => void
  }
  externalControl: {
    getStatus(): Promise<ExternalControlStatusDto>
    subscribe(listener: (status: ExternalControlStatusDto) => void): () => void
  }
}

export function validateActivateItemPayload(payload: { itemId: string }) {
  if (!payload.itemId.trim()) {
    throw new Error('Playout activateItem requires an item id.')
  }
}

export function validateImportPlaylistFilePayload(payload: ImportPlaylistFilePayload) {
  if (!payload.filePath.trim()) {
    throw new Error('Playlist import requires a file path.')
  }
}

export function validateCreatePlaylistPayload(payload: CreatePlaylistPayload) {
  if (!payload.id.trim()) {
    throw new Error('Playlist creation requires an id.')
  }

  if (!payload.name.trim()) {
    throw new Error('Playlist creation requires a name.')
  }
}

export function validateImportLocalAssetsPayload(payload: ImportLocalAssetsPayload) {
  if (!payload.itemId.trim()) {
    throw new Error('Asset import requires an item id.')
  }

  if (payload.sourceFilePaths.length === 0) {
    throw new Error('Asset import requires at least one local file path.')
  }

  payload.sourceFilePaths.forEach((filePath) => {
    if (!filePath.trim()) {
      throw new Error('Asset import file paths must be non-empty.')
    }
  })
}

export function validateSearchImagesPayload(payload: SearchImagesPayload) {
  if (!payload.query.trim()) {
    throw new Error('Image search requires a query.')
  }

  if (payload.limit !== undefined && (!Number.isInteger(payload.limit) || payload.limit < 1 || payload.limit > 25)) {
    throw new Error('Image search limit must be an integer between 1 and 25.')
  }
}

export function validateDownloadSearchSelectionPayload(payload: DownloadSearchSelectionPayload) {
  if (payload.selectedResults.length === 0 || payload.selectedResults.length > 5) {
    throw new Error('Search selection must contain between 1 and 5 images.')
  }

  payload.selectedResults.forEach(assertSerializable)
}

export function validateApplyImageProcessingPayload(payload: ApplyImageProcessingPayload) {
  if (!payload.assetId.trim()) {
    throw new Error('Image processing requires an asset id.')
  }

  payload.operations.forEach((operation) => {
    if (operation.type === 'rotate' && ![90, 180, 270].includes(operation.degrees)) {
      throw new Error('Rotate operations support only 90, 180 or 270 degrees.')
    }
  })
}

export function assertSerializable(value: unknown): asserts value is Serializable {
  if (
    value === null
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return
  }

  if (Array.isArray(value)) {
    value.forEach(assertSerializable)
    return
  }

  if (isPlainObject(value)) {
    Object.values(value).forEach(assertSerializable)
    return
  }

  throw new Error('IPC payloads and DTOs must stay serializable.')
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}
