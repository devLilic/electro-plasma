import {
  normalizeImageSearchResult,
  type ImageSearchInput,
  type ImageSearchProvider,
  type ImageSearchResult,
} from '@domain/image-search'

interface FetchHeadersLike {
  get(name: string): string | null
}

interface FetchResponseLike {
  ok: boolean
  status: number
  json(): Promise<unknown>
}

type FetchLike = (input: string) => Promise<FetchResponseLike>

interface WikimediaApiResponse {
  query?: {
    pages?: Record<string, WikimediaPage>
  }
}

interface WikimediaPage {
  pageid: number
  title: string
  imageinfo?: Array<{
    url?: string
    thumburl?: string
    descriptionurl?: string
    width?: number
    height?: number
  }>
}

export class WikimediaImageSearchProvider implements ImageSearchProvider {
  constructor(private readonly fetchImpl: FetchLike = (input) => fetch(input)) {}

  async searchImages(input: ImageSearchInput): Promise<ImageSearchResult[]> {
    const response = await this.fetchImpl(createSearchUrl(input))
    if (!response.ok) {
      throw new Error(`Image search failed with status ${String(response.status)}.`)
    }

    const payload = await response.json() as WikimediaApiResponse
    const pages = Object.values(payload.query?.pages ?? {})

    return pages.flatMap((page) => {
      const imageInfo = page.imageinfo?.[0]
      if (!imageInfo?.url || !imageInfo.thumburl || !imageInfo.descriptionurl) {
        return []
      }

      return [
        normalizeImageSearchResult({
          id: String(page.pageid),
          provider: 'wikimedia-commons',
          title: page.title.replace(/^File:/i, ''),
          previewUrl: imageInfo.thumburl,
          downloadUrl: imageInfo.url,
          sourceUrl: imageInfo.descriptionurl,
          width: imageInfo.width,
          height: imageInfo.height,
        }),
      ]
    })
  }
}

function createSearchUrl(input: ImageSearchInput) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: input.query,
    gsrnamespace: '6',
    gsrlimit: String(input.limit),
    prop: 'imageinfo',
    iiprop: 'url|size',
    iiurlwidth: '640',
    format: 'json',
    origin: '*',
  })

  return `https://commons.wikimedia.org/w/api.php?${params.toString()}`
}
