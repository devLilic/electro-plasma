import path from 'node:path'
import {
  type ElectronApplication,
  type Page,
  type JSHandle,
  _electron as electron,
} from 'playwright'
import type { BrowserWindow } from 'electron'
import {
  beforeAll,
  afterAll,
  describe,
  expect,
  test,
} from 'vitest'

const root = path.join(__dirname, '..')
let electronApp: ElectronApplication
let page: Page

if (process.platform === 'linux') {
  // pass ubuntu
  test(() => expect(true).true)
} else {
  beforeAll(async () => {
    electronApp = await electron.launch({
      args: ['.', '--no-sandbox'],
      cwd: root,
      env: { ...process.env, NODE_ENV: 'test' },
    })
    page = await electronApp.firstWindow()

    const mainWin: JSHandle<BrowserWindow> = await electronApp.browserWindow(page)
    await mainWin.evaluate(async (win) => {
      win.webContents.executeJavaScript('console.log("Execute JavaScript with e2e testing.")')
    })
  })

  afterAll(async () => {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: 'test/screenshots/e2e.png' })
      await page.close()
    }
    if (electronApp) {
      await electronApp.close()
    }
  })

  describe('[electron-vite-react] e2e tests', async () => {
    test('startup', async () => {
      const title = await page.title()
      expect(title).eq('Plasma')
    })

    test('should be home page is load correctly', async () => {
      expect(await page.getByText('Plasma', { exact: true }).isVisible()).eq(true)
      expect(await page.getByText('Current Playlist').isVisible()).eq(true)
      expect(await page.getByRole('heading', { level: 2, name: 'PLAYLIST' }).isVisible()).eq(true)
      expect(await page.getByRole('heading', { level: 2, name: 'Item Editor + Slots' }).isVisible()).eq(true)
      expect(await page.getByRole('heading', { level: 2, name: 'LIVE PLAYOUT' }).isVisible()).eq(true)
    })

    test('should render preload-driven status and controls', async () => {
      const shellText = await page.locator('main').textContent()
      expect(shellText?.includes('save saved')).eq(true)
      expect(shellText?.includes('external')).eq(true)
      expect(shellText?.includes('mode')).eq(true)
      expect(shellText?.includes('import playlist')).eq(true)
      expect(await page.getByText('Playout transport').isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'import playlist', exact: true }).isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'settings', exact: true }).isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'help', exact: true }).isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'play', exact: true }).nth(1).isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'pause', exact: true }).isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'prev', exact: true }).isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'next', exact: true }).nth(1).isVisible()).eq(true)
      expect(await page.getByRole('button', { name: 'stop', exact: true }).nth(1).isVisible()).eq(true)
      expect(shellText?.includes('Progress')).eq(true)
      expect(shellText?.includes('Countdown')).eq(true)
      expect(shellText?.includes('External control')).eq(true)
      expect(shellText?.includes('Recent external commands')).eq(true)
    })
  })
}
