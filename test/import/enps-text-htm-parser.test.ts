import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { parseEnpsTextHtm } from '../../src/renderer/infrastructure/import/enps-text-htm-parser'
import { createTextOnlyHtmInput } from '../fixtures/playlist-import-fixture'

const fixturesDir = path.join(__dirname, '..', 'fixtures', 'enps')

describe('enps text htm parser', () => {
  test('extracts playlist title, items, anchors, slugs and intro in the right order', () => {
    const parsed = parseEnpsTextHtm(createTextOnlyHtmInput())

    expect(parsed).toEqual({
      sourceAdapterId: 'enps-text-htm',
      title: 'Morning rundown',
      items: [
        {
          externalId: 'OPENING_HEADLINES',
          anchor: 'OPENING_HEADLINES',
          slug: 'opening-headlines',
          title: 'OPENING HEADLINES',
          intro: 'Top lines for the show',
          orderIndex: 0,
        },
        {
          externalId: 'WEATHER_BRIEF',
          anchor: 'WEATHER_BRIEF',
          slug: 'weather-brief',
          title: 'WEATHER BRIEF',
          intro: 'Cold front over the north',
          orderIndex: 1,
        },
      ],
    })
  })

  test('filters irrelevant entries and newsroom markers', async () => {
    const textContent = await readFile(path.join(fixturesDir, 'newsroom-markers.htm'), 'utf8')
    const parsed = parseEnpsTextHtm({
      fileName: 'newsroom-markers.htm',
      mimeType: 'text/html',
      textContent,
    })

    expect(parsed.title).toBe('Evening lineup')
    expect(parsed.items).toEqual([
      {
        externalId: 'CITY_COUNCIL',
        anchor: 'CITY_COUNCIL',
        slug: 'city-council',
        title: 'CITY COUNCIL VOTE',
        intro: 'Budget decision expected tonight',
        orderIndex: 0,
      },
      {
        externalId: 'SPORTS_WRAP',
        anchor: 'SPORTS_WRAP',
        slug: 'sports-wrap',
        title: 'SPORTS WRAP',
        intro: 'Late goal sends match to overtime',
        orderIndex: 1,
      },
    ])
  })

  test('parses a small example fixture file end-to-end', async () => {
    const textContent = await readFile(path.join(fixturesDir, 'small-rundown.htm'), 'utf8')
    const parsed = parseEnpsTextHtm({
      fileName: 'small-rundown.htm',
      mimeType: 'text/html',
      textContent,
    })

    expect(parsed.title).toBe('Morning rundown')
    expect(parsed.items.map((item) => item.anchor)).toEqual([
      'OPENING_HEADLINES',
      'WEATHER_BRIEF',
    ])
  })

  test('parses ENPS anchors without closing tags and keeps anchors with spaces', () => {
    const parsed = parseEnpsTextHtm({
      fileName: 'xTELEJURNAL  1300.HTM',
      mimeType: 'text/html',
      textContent: `
        <html>
          <head><title>TELEJURNAL  1300</title></head>
          <body>
            <a name=StoryIndex>
            <ul>
              <li><a href=#GENERIC  IN>GENERIC  IN</a></li>
            </ul>
            <a name=GENERIC  IN>
            <h3>GENERIC  IN</h3>
            <p>Generic</p>
            <font size=-2><a href=#StoryIndex>Return to index of stories...</a></font>
            <hr />
            <a name=MD SITUATIE NISTRU LUNI-INTRO>
            <h3>MD SITUATIE NISTRU LUNI-INTRO</h3>
            <p>Situaţia pe Nistru rămâne alarmantă.</p>
          </body>
        </html>
      `,
    })

    expect(parsed.title).toBe('TELEJURNAL  1300')
    expect(parsed.items).toEqual([
      {
        externalId: 'GENERIC  IN',
        anchor: 'GENERIC  IN',
        slug: 'generic-in',
        title: 'GENERIC IN',
        intro: 'Generic',
        orderIndex: 0,
      },
      {
        externalId: 'MD SITUATIE NISTRU LUNI-INTRO',
        anchor: 'MD SITUATIE NISTRU LUNI-INTRO',
        slug: 'md-situatie-nistru-luni-intro',
        title: 'MD SITUATIE NISTRU LUNI-INTRO',
        intro: 'Situaţia pe Nistru rămâne alarmantă.',
        orderIndex: 1,
      },
    ])
  })
})
