import type { ImageAsset } from '@domain/media-library'

export const MAX_IMAGE_SEARCH_SELECTION = 5 as const

export interface ImageSearchInput {
  query: string
  limit: number
}

export interface ImageSearchResult {
  id: string
  provider: string
  title: string
  previewUrl: string
  downloadUrl: string
  sourceUrl: string
  width?: number
  height?: number
}

export interface ImageSearchProvider {
  searchImages(input: ImageSearchInput): Promise<ImageSearchResult[]>
}

export interface DownloadRemoteImageInput {
  url: string
  fileNameStem: string
}

export interface DownloadedRemoteImage {
  filePath: string
  cleanup(): Promise<void>
}

export interface RemoteImageDownloadClient {
  downloadImage(input: DownloadRemoteImageInput): Promise<DownloadedRemoteImage>
}

export interface DownloadSelectedImagesInput {
  selectedResults: ImageSearchResult[]
}

export interface DownloadSelectedImagesFailure {
  result: ImageSearchResult
  reason: string
}

export interface DownloadSelectedImagesOutput {
  assets: ImageAsset[]
  failures: DownloadSelectedImagesFailure[]
}

export function normalizeImageSearchResult(
  result: Omit<ImageSearchResult, 'title'> & { title?: string | null },
): ImageSearchResult {
  const title = result.title?.trim() || 'Untitled image'

  if (!result.id.trim()) {
    throw new Error('Image search results require a stable id.')
  }

  if (!result.provider.trim()) {
    throw new Error('Image search results require a provider id.')
  }

  if (!result.previewUrl.trim() || !result.downloadUrl.trim() || !result.sourceUrl.trim()) {
    throw new Error('Image search results require preview, download and source URLs.')
  }

  return {
    ...result,
    title,
  }
}
