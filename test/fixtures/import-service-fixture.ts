import type { PlaylistImportInput } from '../../src/renderer/domain/playlist-import'

export function createReimportedTextOnlyHtmInput(): PlaylistImportInput {
  return {
    fileName: 'playlist.htm',
    mimeType: 'text/html',
    textContent: `
      <html>
        <head><title>Morning rundown updated</title></head>
        <body>
          <a name="WEATHER_BRIEF"></a>
          <div>WEATHER BRIEF</div>
          <div>Updated weather intro</div>
          <a name="CLOSING_PANEL"></a>
          <div>CLOSING PANEL</div>
          <div>Wrap the show</div>
        </body>
      </html>
    `,
  }
}
