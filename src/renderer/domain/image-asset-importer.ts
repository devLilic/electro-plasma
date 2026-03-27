import type { ImageAsset } from '@domain/media-library'

export interface ImageAssetImporter {
  importImage(input: {
    sourceFilePath: string
  }): Promise<ImageAsset>
}
