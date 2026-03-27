import { createHash } from 'node:crypto'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type {
  DownloadRemoteImageInput,
  DownloadedRemoteImage,
  RemoteImageDownloadClient,
} from '@domain/image-search'

interface FetchHeadersLike {
  get(name: string): string | null
}

interface FetchResponseLike {
  ok: boolean
  status: number
  headers: FetchHeadersLike
  arrayBuffer(): Promise<ArrayBuffer>
}

type FetchLike = (input: string) => Promise<FetchResponseLike>

export class HttpRemoteImageDownloadClient implements RemoteImageDownloadClient {
  constructor(
    private readonly downloadRoot: string = path.join(os.tmpdir(), 'electro-plasma-search-downloads'),
    private readonly fetchImpl: FetchLike = (input) => fetch(input),
  ) {}

  async downloadImage(input: DownloadRemoteImageInput): Promise<DownloadedRemoteImage> {
    const response = await this.fetchImpl(input.url)
    if (!response.ok) {
      throw new Error(`Image download failed with status ${String(response.status)}.`)
    }

    await mkdir(this.downloadRoot, { recursive: true })

    const extension = inferExtension(input.url, response.headers.get('content-type'))
    const digest = createHash('sha1').update(input.url).digest('hex')
    const filePath = path.join(this.downloadRoot, `${input.fileNameStem}-${digest}${extension}`)
    const fileBuffer = Buffer.from(await response.arrayBuffer())
    await writeFile(filePath, fileBuffer)

    return {
      filePath,
      cleanup: async () => {
        try {
          await stat(filePath)
          await rm(filePath, { force: true })
        } catch {
          return
        }
      },
    }
  }
}

function inferExtension(url: string, contentType: string | null) {
  const urlExtension = path.extname(new URL(url).pathname)
  if (urlExtension) {
    return urlExtension.toLowerCase()
  }

  switch ((contentType ?? '').toLowerCase()) {
    case 'image/png':
      return '.png'
    case 'image/jpeg':
      return '.jpg'
    case 'image/gif':
      return '.gif'
    case 'image/webp':
      return '.webp'
    default:
      return '.bin'
  }
}
