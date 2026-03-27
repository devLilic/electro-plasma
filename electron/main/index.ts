import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { ExternalPlayoutControlService } from './external-playout-control-service'
import { MainPlayoutCoordinator } from './external-playout-controller'
import { registerPlasmaIpcHandlers } from './plasma-ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

if (process.platform === 'win32') app.setAppUserModelId(app.getName())

const shouldEnforceSingleInstanceLock = process.env.NODE_ENV !== 'test' && !VITE_DEV_SERVER_URL

if (shouldEnforceSingleInstanceLock && !app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null
const playoutCoordinator = new MainPlayoutCoordinator()
const externalPlayoutControlService = new ExternalPlayoutControlService({
  controller: playoutCoordinator,
})

const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createMainWindow() {
  const window = new BrowserWindow({
    title: 'Plasma',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    show: false,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow = window

  const revealWindow = () => {
    if (window.isDestroyed()) {
      return
    }

    window.maximize()
    window.show()
  }

  window.once('ready-to-show', revealWindow)

  if (VITE_DEV_SERVER_URL) {
    await window.loadURL(VITE_DEV_SERVER_URL)
  } else {
    await window.loadFile(indexHtml)
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  revealWindow()
}

app.whenReady().then(() => {
  registerPlasmaIpcHandlers({
    externalPlayoutControlService,
    playoutController: playoutCoordinator,
  })
  return externalPlayoutControlService.start().then(() => createMainWindow())
})

app.on('window-all-closed', () => {
  mainWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void externalPlayoutControlService.stop()
})

app.on('second-instance', () => {
  if (!mainWindow) {
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.focus()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow()
  } else {
    BrowserWindow.getAllWindows()[0]?.focus()
  }
})
