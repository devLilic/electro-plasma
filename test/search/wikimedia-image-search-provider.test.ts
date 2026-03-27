import { describe, expect, test } from 'vitest'
import { WikimediaImageSearchProvider } from '../../src/renderer/infrastructure/search/wikimedia-image-search-provider'
import { createWikimediaPayload } from '../fixtures/image-search-fixture'

describe('wikimedia image search provider', () => {
  test('normalizes the external API response into search results', async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      async json() {
        return createWikimediaPayload()
      },
    })

    const provider = new WikimediaImageSearchProvider(fetchImpl)
    const results = await provider.searchImages({ query: 'skyline', limit: 5 })

    expect(results).toEqual([
      {
        id: '101',
        provider: 'wikimedia-commons',
        title: 'Morning skyline.jpg',
        previewUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/morning-skyline.jpg/640px-morning-skyline.jpg',
        downloadUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/morning-skyline.jpg',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Morning_skyline.jpg',
        width: 1920,
        height: 1080,
      },
    ])
  })

  test('surfaces provider errors when the remote API fails', async () => {
    const provider = new WikimediaImageSearchProvider(async () => ({
      ok: false,
      status: 503,
      async json() {
        return {}
      },
    }))

    await expect(provider.searchImages({ query: 'rundown', limit: 3 })).rejects.toThrow(
      'Image search failed with status 503.',
    )
  })
})
