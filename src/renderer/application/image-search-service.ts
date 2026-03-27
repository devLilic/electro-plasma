import type { ImageSearchProvider, ImageSearchResult } from '@domain/image-search'

interface SearchImagesInput {
  query: string
  limit?: number
}

export class ImageSearchService {
  constructor(private readonly provider: ImageSearchProvider) {}

  async search(input: SearchImagesInput): Promise<ImageSearchResult[]> {
    const query = input.query.trim()
    if (!query) {
      throw new Error('Image search requires a non-empty query.')
    }

    const limit = normalizeLimit(input.limit)
    return this.provider.searchImages({ query, limit })
  }
}

function normalizeLimit(limit?: number) {
  if (!limit) {
    return 10
  }

  return Math.max(1, Math.min(25, Math.floor(limit)))
}
