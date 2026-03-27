import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export async function createLocalImageFixture() {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 'electro-plasma-image-'))
  const sourceDir = path.join(rootDir, 'source')
  const storageDir = path.join(rootDir, 'storage')

  await mkdir(sourceDir, { recursive: true })
  await mkdir(storageDir, { recursive: true })

  return {
    rootDir,
    sourceDir,
    storageDir,
    async createSourceImage(fileName: string, content: string) {
      const filePath = path.join(sourceDir, fileName)
      await writeFile(filePath, content, 'utf8')
      return filePath
    },
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true })
    },
  }
}
