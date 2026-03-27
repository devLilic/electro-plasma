import type {
  DownloadSearchSelectionPayload,
  ImportLocalAssetsPayload,
  SearchImagesPayload,
} from '@shared/plasma-api'

export const plasmaAssetsApi = {
  importLocalImages(payload: ImportLocalAssetsPayload) {
    return window.plasma.assets.importLocalImages(payload)
  },
  searchImages(payload: SearchImagesPayload) {
    return window.plasma.assets.searchImages(payload)
  },
  downloadSearchSelection(payload: DownloadSearchSelectionPayload) {
    return window.plasma.assets.downloadSearchSelection(payload)
  },
}
