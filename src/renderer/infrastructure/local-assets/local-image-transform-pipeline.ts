import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  resolveBroadcastImagePreset,
  type ApplyImageTransformsInput,
  type BroadcastImagePreset,
  type ImageTransformOperation,
  type ImageTransformPipeline,
} from '@domain/image-transform'
import type { ImageAsset } from '@domain/media-library'

export class LocalImageTransformPipeline implements ImageTransformPipeline {
  async applyTransforms(input: ApplyImageTransformsInput): Promise<ImageAsset> {
    const preset = resolveBroadcastImagePreset(input.presetId)

    if (input.operations.length === 0) {
      return {
        ...input.asset,
        path: input.asset.processedPath,
      }
    }

    const extension = path.extname(input.asset.originalPath) || path.extname(input.asset.processedPath) || '.png'
    const operationDigest = createHash('sha1')
      .update(JSON.stringify(input.operations))
      .digest('hex')
      .slice(0, 12)
    const fileName = `${stripExtension(path.basename(input.asset.originalPath))}-${operationDigest}${extension}`
    const processedPath = path.join(path.dirname(input.asset.processedPath), fileName)
    const previewPath = path.join(path.dirname(input.asset.previewPath), fileName)

    await mkdir(path.dirname(processedPath), { recursive: true })
    await mkdir(path.dirname(previewPath), { recursive: true })

    const transformedSource = applyOperations(sharp(input.asset.originalPath), input.operations, preset)
    await transformedSource.toFile(processedPath)

    const processedImage = sharp(processedPath)
    const metadata = await processedImage.metadata()
    await processedImage
      .clone()
      .resize({
        width: preset.previewResolution.width,
        height: preset.previewResolution.height,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      })
      .toFile(previewPath)

    return {
      ...input.asset,
      path: processedPath,
      processedPath,
      previewPath,
      width: metadata.width,
      height: metadata.height,
    }
  }
}

function applyOperations(
  image: sharp.Sharp,
  operations: ImageTransformOperation[],
  preset: BroadcastImagePreset,
) {
  let pipeline = image

  for (const operation of operations) {
    switch (operation.type) {
      case 'crop-16:9':
        pipeline = pipeline.resize({
          width: preset.processedResolution.width,
          height: preset.processedResolution.height,
          fit: preset.cropFit,
          position: 'centre',
        })
        break
      case 'flip':
        pipeline = pipeline.flip()
        break
      case 'flop':
        pipeline = pipeline.flop()
        break
      case 'rotate':
        pipeline = pipeline.rotate(operation.degrees)
        break
    }
  }

  return pipeline
}

function stripExtension(fileName: string) {
  const extension = path.extname(fileName)
  return extension ? fileName.slice(0, -extension.length) : fileName
}
