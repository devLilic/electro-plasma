import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseEnpsGraphicalHtm } from '../../src/renderer/infrastructure/import/enps-graphical-htm-parser'
import { createGraphicalHtmInput } from '../fixtures/playlist-import-fixture'

const fixturesDir = path.join(__dirname, '..', 'fixtures', 'enps')

describe('enps graphical htm parser', () => {
  test('extracts graphical items into the normalized output format', () => {
    const parsed = parseEnpsGraphicalHtm(createGraphicalHtmInput())

    expect(parsed).toEqual({
      sourceAdapterId: 'enps-graphical-htm',
      title: 'Graphic Rundown',
      items: [
        {
          externalId: 'LOWER_THIRD_GRAPHIC',
          anchor: 'LOWER_THIRD_GRAPHIC',
          slug: 'lower-third-graphic',
          title: 'Lower Third Graphic',
          intro: 'Anchor Intro',
          orderIndex: 0,
        },
        {
          externalId: 'CLOSING_CREDITS',
          anchor: 'CLOSING_CREDITS',
          slug: 'closing-credits',
          title: 'Closing Credits',
          intro: 'Roll closing names over skyline',
          orderIndex: 1,
        },
      ],
    })
  })

  test('filters noisy graphical sections and keeps relevant fallback items', async () => {
    const textContent = await readFile(path.join(fixturesDir, 'graphical-fallback.htm'), 'utf8')
    const parsed = parseEnpsGraphicalHtm({
      fileName: 'graphical-fallback.htm',
      mimeType: 'text/html',
      textContent,
    })

    expect(parsed.items).toEqual([
      {
        externalId: 'LOWER_THIRD_GRAPHIC',
        anchor: 'LOWER_THIRD_GRAPHIC',
        slug: 'lower-third-graphic',
        title: 'Lower Third Graphic',
        intro: 'Anchor Intro',
        orderIndex: 0,
      },
      {
        externalId: 'FULLSCREEN_MAP',
        anchor: 'FULLSCREEN_MAP',
        slug: 'fullscreen-map',
        title: 'Fullscreen Map',
        intro: 'Storm track visualization',
        orderIndex: 1,
      },
    ])
  })
})
