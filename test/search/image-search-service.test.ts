import { describe, expect, test, vi } from 'vitest'
import { ImageSearchService } from '../../src/renderer/application/image-search-service'
import { createImageSearchResult } from '../fixtures/image-search-fixture'

describe('image search service', () => {
  test('delegates to the provider with a normalized query and limit', async () => {
    const provider = {
      searchImages: vi.fn().mockResolvedValue([
        createImageSearchResult(),
      ]),
    }

    const service = new ImageSearchService(provider)
    const results = await service.search({ query: '  skyline rundown  ', limit: 3.8 })

    expect(provider.searchImages).toHaveBeenCalledWith({
      query: 'skyline rundown',
      limit: 3,
    })
    expect(results).toHaveLength(1)
  })

  test('rejects empty queries', async () => {
    const service = new ImageSearchService({
      searchImages: vi.fn(),
    })

    await expect(service.search({ query: '   ' })).rejects.toThrow('Image search requires a non-empty query.')
  })
})
