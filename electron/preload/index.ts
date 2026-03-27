import { contextBridge, ipcRenderer } from 'electron'
import {
  PLASMA_API_NAMESPACE,
  validateActivateItemPayload,
  validateApplyImageProcessingPayload,
  validateCreatePlaylistPayload,
  validateDownloadSearchSelectionPayload,
  validateImportLocalAssetsPayload,
  validateImportPlaylistFilePayload,
  validateSearchImagesPayload,
  type PlasmaApi,
} from '../../src/shared/plasma-api'

const PLAYOUT_STATUS_EVENT = 'playout:statusChanged'
const EXTERNAL_CONTROL_STATUS_EVENT = 'externalControl:statusChanged'

function invoke<Result>(channel: string, payload?: unknown) {
  if (payload === undefined) {
    return ipcRenderer.invoke(channel) as Promise<Result>
  }

  return ipcRenderer.invoke(channel, payload) as Promise<Result>
}

function subscribeToEvent<Payload>(channel: string, listener: (payload: Payload) => void) {
  const subscription = (_event: unknown, payload: Payload) => listener(payload)
  ipcRenderer.on(channel, subscription)

  return () => {
    ipcRenderer.off(channel, subscription)
  }
}

const plasmaApi: PlasmaApi = {
  app: {
    getVersion() {
      return invoke('app:getVersion')
    },
  },
  playlists: {
    list() {
      return invoke('playlists:list')
    },
    create(payload) {
      validateCreatePlaylistPayload(payload)
      return invoke('playlists:create', payload)
    },
    importFile(payload) {
      validateImportPlaylistFilePayload(payload)
      return invoke('playlists:importFile', payload)
    },
  },
  assets: {
    importLocalImages(payload) {
      validateImportLocalAssetsPayload(payload)
      return invoke('assets:importLocalImages', payload)
    },
    searchImages(payload) {
      validateSearchImagesPayload(payload)
      return invoke('assets:searchImages', payload)
    },
    downloadSearchSelection(payload) {
      validateDownloadSearchSelectionPayload(payload)
      return invoke('assets:downloadSearchSelection', payload)
    },
  },
  imageProcessing: {
    applyTransforms(payload) {
      validateApplyImageProcessingPayload(payload)
      return invoke('imageProcessing:applyTransforms', payload)
    },
  },
  playout: {
    getStatus() {
      return invoke('playout:getStatus')
    },
    play() {
      return invoke('playout:play')
    },
    next() {
      return invoke('playout:next')
    },
    stop() {
      return invoke('playout:stop')
    },
    pause() {
      return invoke('playout:pause')
    },
    resume() {
      return invoke('playout:resume')
    },
    previous() {
      return invoke('playout:previous')
    },
    activateItem(payload) {
      validateActivateItemPayload(payload)
      return invoke('playout:activateItem', payload)
    },
    subscribe(listener) {
      return subscribeToEvent(PLAYOUT_STATUS_EVENT, listener)
    },
  },
  externalControl: {
    getStatus() {
      return invoke('externalControl:getStatus')
    },
    subscribe(listener) {
      return subscribeToEvent(EXTERNAL_CONTROL_STATUS_EVENT, listener)
    },
  },
}

contextBridge.exposeInMainWorld(PLASMA_API_NAMESPACE, plasmaApi)
