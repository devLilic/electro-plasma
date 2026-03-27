import type { PlaylistImportInput } from '../../src/renderer/domain/playlist-import'

export function createTextOnlyHtmInput(): PlaylistImportInput {
  return {
    fileName: 'playlist.htm',
    mimeType: 'text/html',
    textContent: `
      <html>
        <head><title>Morning rundown</title></head>
        <body>
          <a name="OPENING_HEADLINES"></a>
          <div>OPENING HEADLINES</div>
          <div>Top lines for the show</div>
          <a name="WEATHER_BRIEF"></a>
          <div>WEATHER BRIEF</div>
          <div>Cold front over the north</div>
        </body>
      </html>
    `,
  }
}

export function createM3uInput(): PlaylistImportInput {
  return {
    fileName: 'playlist.m3u',
    mimeType: 'audio/x-mpegurl',
    textContent: `
      #EXTM3U
      #EXTINF:120,First Song
      first.mp3
      #EXTINF:130,Second Song
      second.mp3
    `,
  }
}

export function createGraphicalHtmInput(): PlaylistImportInput {
  return {
    fileName: 'graphic-playlist.htm',
    mimeType: 'text/html',
    textContent: `
      <html>
        <head><title>Graphic Rundown</title></head>
        <body>
          <div class="story-card" data-anchor="LOWER_THIRD_GRAPHIC">
            <img src="lower-third.png" alt="Lower Third Graphic" />
            <div>Anchor Intro</div>
          </div>
          <div class="story-card" data-anchor="CLOSING_CREDITS">
            <div>Closing Credits</div>
            <div>Roll closing names over skyline</div>
          </div>
        </body>
      </html>
    `,
  }
}
