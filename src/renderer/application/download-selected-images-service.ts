import type { ImageAssetImporter } from '@domain/image-asset-importer'
import {
  MAX_IMAGE_SEARCH_SELECTION,
  type DownloadSelectedImagesInput,
  type DownloadSelectedImagesOutput,
  type RemoteImageDownloadClient,
} from '@domain/image-search'

export class DownloadSelectedImagesService {
  constructor(
    private readonly remoteImageDownloadClient: RemoteImageDownloadClient,
    private readonly imageAssetImporter: ImageAssetImporter,
  ) {}

  async download(input: DownloadSelectedImagesInput): Promise<DownloadSelectedImagesOutput> {
    if (input.selectedResults.length === 0 || input.selectedResults.length > MAX_IMAGE_SEARCH_SELECTION) {
      throw new Error(`Select between 1 and ${MAX_IMAGE_SEARCH_SELECTION} images before downloading.`)
    }

    const assets = []
    const failures = []

    for (const result of input.selectedResults) {
      let downloadedImage: Awaited<ReturnType<RemoteImageDownloadClient['downloadImage']>> | null = null

      try {
        downloadedImage = await this.remoteImageDownloadClient.downloadImage({
          url: result.downloadUrl,
          fileNameStem: createDownloadFileStem(result.title, result.id),
        })

        const asset = await this.imageAssetImporter.importImage({
          sourceFilePath: downloadedImage.filePath,
        })

        assets.push(asset)
      } catch (error) {
        failures.push({
          result,
          reason: error instanceof Error ? error.message : 'Unknown download failure.',
        })
      } finally {
        if (downloadedImage) {
          await downloadedImage.cleanup().catch(() => undefined)
        }
      }
    }

    return {
      assets,
      failures,
    }
  }
}

function createDownloadFileStem(title: string, id: string) {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${normalizedTitle || 'image'}-${id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`
}
