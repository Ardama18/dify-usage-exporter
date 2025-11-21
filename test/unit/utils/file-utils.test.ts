import { promises as fs } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  ensureDirectory,
  setPermission600,
  writeFileAtomic,
} from '../../../src/utils/file-utils.js'

describe('FileUtils', () => {
  const testDir = 'tmp/test-file-utils'
  const testFile = `${testDir}/test.json`

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('writeFileAtomic', () => {
    it('should write file atomically with permission 600', async () => {
      const content = JSON.stringify({ test: 'data' })

      await writeFileAtomic(testFile, content)

      // ファイル存在確認
      const stat = await fs.stat(testFile)
      expect(stat.isFile()).toBe(true)

      // パーミッション確認（600 = rw-------）
      const mode = stat.mode & 0o777
      expect(mode).toBe(0o600)

      // 内容確認
      const readContent = await fs.readFile(testFile, 'utf-8')
      expect(readContent).toBe(content)
    })

    it('should create directory if not exists', async () => {
      const nestedFile = `${testDir}/nested/deep/test.json`
      const content = JSON.stringify({ test: 'data' })

      await writeFileAtomic(nestedFile, content)

      const stat = await fs.stat(nestedFile)
      expect(stat.isFile()).toBe(true)
    })

    it('should remove temp file on error', async () => {
      const invalidPath = '/invalid/path/test.json'

      await expect(writeFileAtomic(invalidPath, 'test')).rejects.toThrow()

      // 一時ファイルが残っていないことを確認
      const tempPath = `${invalidPath}.tmp`
      await expect(fs.access(tempPath)).rejects.toThrow()
    })
  })

  describe('setPermission600', () => {
    it('should set permission to 600', async () => {
      await fs.writeFile(testFile, 'test', { mode: 0o644 })

      await setPermission600(testFile)

      const stat = await fs.stat(testFile)
      const mode = stat.mode & 0o777
      expect(mode).toBe(0o600)
    })
  })

  describe('ensureDirectory', () => {
    it('should create directory if not exists', async () => {
      const nestedDir = `${testDir}/nested/deep`

      await ensureDirectory(nestedDir)

      const stat = await fs.stat(nestedDir)
      expect(stat.isDirectory()).toBe(true)
    })

    it('should not throw if directory already exists', async () => {
      await ensureDirectory(testDir)
      await expect(ensureDirectory(testDir)).resolves.toBeUndefined()
    })
  })
})
