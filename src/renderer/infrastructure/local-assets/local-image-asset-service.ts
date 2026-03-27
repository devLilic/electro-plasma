import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import type { ImageAsset } from '../../domain/media-library'

export interface ImportLocalImageInput {
  sourceFilePath: string
}

export class LocalImageAssetService {
  constructor(
    private readonly storageRoot: string,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async importImage(input: ImportLocalImageInput): Promise<ImageAsset> {
    const fileBuffer = await readFile(input.sourceFilePath)
    const sourceStats = await stat(input.sourceFilePath)
    const extension = path.extname(input.sourceFilePath).toLowerCase() || '.bin'
    const digest = createHash('sha1').update(fileBuffer).digest('hex')
    const originalsDir = path.join(this.storageRoot, 'originals')
    const processedDir = path.join(this.storageRoot, 'processed')
    const previewsDir = path.join(this.storageRoot, 'previews')
    const fileName = `${digest}${extension}`
    const originalPath = path.join(originalsDir, fileName)
    const processedPath = path.join(processedDir, fileName)
    const previewPath = path.join(previewsDir, fileName)

    await mkdir(originalsDir, { recursive: true })
    await mkdir(processedDir, { recursive: true })
    await mkdir(previewsDir, { recursive: true })
    await ensureCopied(input.sourceFilePath, originalPath)
    await ensureCopied(input.sourceFilePath, processedPath)
    await ensureCopied(input.sourceFilePath, previewPath)

    return {
      id: `image:${digest}`,
      path: originalPath,
      originalPath,
      processedPath,
      previewPath,
      mimeType: inferMimeType(extension),
      createdAt: sourceStats.mtime.toISOString() || this.clock(),
    }
  }
}

async function ensureCopied(sourceFilePath: string, destinationPath: string) {
  try {
    await stat(destinationPath)
  } catch {
    await copyFile(sourceFilePath, destinationPath)
  }
}

function inferMimeType(extension: string) {
  switch (extension) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}
