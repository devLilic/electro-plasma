import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const rootDir = path.resolve(__dirname, '..', '..')
const rendererDir = path.join(rootDir, 'src', 'renderer')

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return collectFiles(fullPath)
    }

    return fullPath
  })
}

function read(filePath: string) {
  return readFileSync(filePath, 'utf8')
}

function isRendererSource(filePath: string) {
  return /\.(ts|tsx|d\.ts)$/.test(filePath)
}

function toPosix(filePath: string) {
  return filePath.split(path.sep).join('/')
}

describe('phase-0 source boundaries', () => {
  test('renderer sources do not import Electron primitives or demo shims', () => {
    const rendererFiles = collectFiles(rendererDir).filter(isRendererSource)

    for (const filePath of rendererFiles) {
      const source = read(filePath)

      expect(source, filePath).not.toMatch(/from ['"]electron['"]/)
      expect(source, filePath).not.toContain('window.ipcRenderer')
      expect(source, filePath).not.toContain('ipcRenderer')
      expect(source, filePath).not.toMatch(/from ['"].*demos\//)
    }
  })

  test('preload exposes the typed plasma namespace instead of raw ipcRenderer', () => {
    const preloadSource = read(path.join(rootDir, 'electron', 'preload', 'index.ts'))

    expect(preloadSource).toContain('contextBridge.exposeInMainWorld(PLASMA_API_NAMESPACE, plasmaApi)')
    expect(preloadSource).not.toContain("exposeInMainWorld('ipcRenderer'")
  })

  test('main window preferences keep renderer isolation enabled', () => {
    const mainSource = read(path.join(rootDir, 'electron', 'main', 'index.ts'))

    expect(mainSource).toContain('contextIsolation: true')
    expect(mainSource).toContain('nodeIntegration: false')
    expect(mainSource).toContain('sandbox: true')
    expect(mainSource).not.toContain("ipcMain.handle('open-win'")
  })

  test('renderer layers respect architectural import boundaries', () => {
    const rendererFiles = collectFiles(rendererDir).filter(isRendererSource)

    for (const filePath of rendererFiles) {
      const normalizedPath = toPosix(filePath)
      const source = read(filePath)

      if (normalizedPath.includes('/src/renderer/domain/')) {
        expect(source, filePath).not.toMatch(/from ['"]@(application|infrastructure|ui|shared)\//)
        expect(source, filePath).not.toContain('window.plasma')
      }

      if (normalizedPath.includes('/src/renderer/application/')) {
        expect(source, filePath).not.toMatch(/from ['"]@(infrastructure|ui)\//)
        expect(source, filePath).not.toContain('window.plasma')
      }

      if (normalizedPath.includes('/src/renderer/infrastructure/')) {
        expect(source, filePath).not.toMatch(/from ['"]@ui\//)
      }
    }
  })
})
