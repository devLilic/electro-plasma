import { describe, expect, test } from 'vitest'
import {
  assertVisualSlots,
  createDefaultItemVisualSlot,
  reorderVisualSlots,
} from '../../src/renderer/domain/media-library'

function createImage(id: string) {
  return {
    id,
    path: `/library/originals/${id}.png`,
    originalPath: `/library/originals/${id}.png`,
    processedPath: `/library/processed/${id}.png`,
    previewPath: `/library/previews/${id}.png`,
    mimeType: 'image/png',
    createdAt: '2026-03-26T00:00:00.000Z',
  }
}

describe('item visuals domain rules', () => {
  test('rejects non-sequential slot indexes', () => {
    const image = createImage('image-a')
    const slots = [{ ...createDefaultItemVisualSlot(image, 0), slotIndex: 2 }]

    expect(() => assertVisualSlots(slots)).toThrow('stable, sequential order')
  })

  test('rejects duplicate image ids during reorder', () => {
    const slots = [
      createDefaultItemVisualSlot(createImage('image-a'), 0),
      createDefaultItemVisualSlot(createImage('image-b'), 1),
    ]

    expect(() => reorderVisualSlots(slots, ['image-a', 'image-a'])).toThrow('must not contain duplicates')
  })

  test('preserves slot settings while reordering', () => {
    const slots = [
      {
        ...createDefaultItemVisualSlot(createImage('image-a'), 0),
        isActive: false,
      },
      {
        ...createDefaultItemVisualSlot(createImage('image-b'), 1),
        slideshow: {
          enabled: true,
          intervalMs: 4000,
        },
      },
    ]

    const reordered = reorderVisualSlots(slots, ['image-b', 'image-a'])

    expect(reordered).toMatchObject([
      {
        slotIndex: 0,
        image: { id: 'image-b' },
        slideshow: { enabled: true, intervalMs: 4000 },
      },
      {
        slotIndex: 1,
        image: { id: 'image-a' },
        isActive: false,
      },
    ])
  })
})
