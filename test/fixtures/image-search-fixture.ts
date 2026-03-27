import type { ImageSearchResult } from '@domain/image-search'

export function createImageSearchResult(overrides: Partial<ImageSearchResult> = {}): ImageSearchResult {
  return {
    id: 'image-1',
    provider: 'mock-provider',
    title: 'Studio skyline',
    previewUrl: 'https://images.example.com/preview/studio-skyline.jpg',
    downloadUrl: 'https://images.example.com/download/studio-skyline.jpg',
    sourceUrl: 'https://images.example.com/source/studio-skyline',
    width: 1920,
    height: 1080,
    ...overrides,
  }
}

export function createWikimediaPayload() {
  return {
    query: {
      pages: {
        '101': {
          pageid: 101,
          title: 'File:Morning skyline.jpg',
          imageinfo: [
            {
              url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/morning-skyline.jpg',
              thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/morning-skyline.jpg/640px-morning-skyline.jpg',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Morning_skyline.jpg',
              width: 1920,
              height: 1080,
            },
          ],
        },
        '102': {
          pageid: 102,
          title: 'File:Missing preview.jpg',
          imageinfo: [
            {
              url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/missing-preview.jpg',
              descriptionurl: 'https://commons.wikimedia.org/wiki/File:Missing_preview.jpg',
            },
          ],
        },
      },
    },
  }
}
