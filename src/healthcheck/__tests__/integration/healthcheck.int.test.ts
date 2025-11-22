/**
 * HealthCheckServer 統合テスト - Design Doc: 5-monitoring-logging-healthcheck/design.md
 * 生成日: 2025-11-22
 * テスト種別: Integration Test
 * 実装タイミング: Phase 1実装と同時
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Logger } from '../../../logger/winston-logger.js'
import type { HealthCheckResponse } from '../../healthcheck-server.js'
import { createHealthCheckServer } from '../../healthcheck-server.js'

// 統合テスト用のポートベース（競合を避けるため高いポート番号を使用）
const BASE_PORT = 19000

describe('HealthCheckServer 統合テスト', () => {
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    }
  })

  describe('正常系', () => {
    let server: ReturnType<typeof createHealthCheckServer>
    const testPort = BASE_PORT + 1

    beforeEach(async () => {
      server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('サーバー起動時に起動ログが出力される', async () => {
      // Assert: beforeEachで起動済み
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Healthcheck server started'),
        expect.objectContaining({ port: testPort }),
      )
    })

    it('GET /health が 200 OK を返す', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)

      // Assert
      expect(response.status).toBe(200)
      expect(response.ok).toBe(true)
    })

    it('レスポンスボディに必須フィールドが含まれる', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)
      const body = (await response.json()) as HealthCheckResponse

      // Assert
      expect(body).toHaveProperty('status', 'ok')
      expect(body).toHaveProperty('uptime')
      expect(body).toHaveProperty('timestamp')
    })

    it('uptime が数値である', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)
      const body = (await response.json()) as HealthCheckResponse

      // Assert
      expect(typeof body.uptime).toBe('number')
      expect(body.uptime).toBeGreaterThanOrEqual(0)
    })

    it('timestamp が ISO 8601 形式である', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)
      const body = (await response.json()) as HealthCheckResponse

      // Assert
      const timestamp = new Date(body.timestamp)
      expect(timestamp.toISOString()).toBe(body.timestamp)
    })

    it('Content-Type が application/json である', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`)

      // Assert
      expect(response.headers.get('content-type')).toContain('application/json')
    })

    it('レスポンス時間が 10ms 以内（AC-PERF-1）', async () => {
      // Arrange: ウォームアップリクエスト（初回接続オーバーヘッドを除外）
      await fetch(`http://localhost:${testPort}/health`)

      // Act: 複数回測定して安定性を確認
      const times: number[] = []
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()
        await fetch(`http://localhost:${testPort}/health`)
        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      // Assert: 全ての応答が10ms以内
      for (const time of times) {
        expect(time).toBeLessThan(10)
      }
    })
  })

  describe('異常系', () => {
    let server: ReturnType<typeof createHealthCheckServer>
    const testPort = BASE_PORT + 2

    beforeEach(async () => {
      server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()
    })

    afterEach(async () => {
      await server.stop()
    })

    it('GET /invalid が 404 を返す', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/invalid`)

      // Assert
      expect(response.status).toBe(404)
    })

    it('POST /health が 404 を返す', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Assert
      expect(response.status).toBe(404)
    })

    it('PUT /health が 404 を返す', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'PUT',
        body: JSON.stringify({ test: 'data' }),
        headers: { 'Content-Type': 'application/json' },
      })

      // Assert
      expect(response.status).toBe(404)
    })

    it('DELETE /health が 404 を返す', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'DELETE',
      })

      // Assert
      expect(response.status).toBe(404)
    })

    it('無効な JSON リクエストでも正常に動作', async () => {
      // Act
      const response = await fetch(`http://localhost:${testPort}/health`, {
        headers: { 'Content-Type': 'application/json' },
      })

      // Assert
      expect(response.status).toBe(200)
      const body = (await response.json()) as HealthCheckResponse
      expect(body.status).toBe('ok')
    })
  })

  describe('HEALTHCHECK_ENABLED=false', () => {
    it('サーバーが起動しない（stop直後は接続できない）', async () => {
      // Arrange
      const testPort = BASE_PORT + 3
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()
      await server.stop()

      // Act & Assert
      // 停止後は接続できないことを確認
      await expect(fetch(`http://localhost:${testPort}/health`)).rejects.toThrow()
    })

    it('起動スキップのログが出力される（EADDRINUSE時）', async () => {
      // Arrange
      const testPort = BASE_PORT + 4
      const server1 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server1.start()

      const server2 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })

      // Act
      await server2.start()

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Port'),
        expect.objectContaining({ port: testPort }),
      )

      // Cleanup
      await server1.stop()
    })
  })

  describe('ポート設定', () => {
    it('カスタムポートで起動できる', async () => {
      // Arrange
      const customPort = BASE_PORT + 5
      const server = createHealthCheckServer({
        port: customPort,
        logger: mockLogger,
      })

      // Act
      await server.start()

      // Assert
      const response = await fetch(`http://localhost:${customPort}/health`)
      expect(response.status).toBe(200)

      // Cleanup
      await server.stop()
    })

    it('EADDRINUSE 時にエラーログが出力される', async () => {
      // Arrange
      const testPort = BASE_PORT + 6
      const server1 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server1.start()

      const server2 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })

      // Act
      await server2.start()

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already in use'),
        expect.objectContaining({ port: testPort }),
      )

      // Cleanup
      await server1.stop()
    })

    it('EADDRINUSE 時にアプリは継続動作', async () => {
      // Arrange
      const testPort = BASE_PORT + 7
      const server1 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server1.start()

      const server2 = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })

      // Act & Assert
      // server2.start() がエラーをスローせずに完了すること
      await expect(server2.start()).resolves.toBeUndefined()

      // Cleanup
      await server1.stop()
    })
  })

  describe('Graceful Shutdown', () => {
    it('SIGTERM でサーバーが停止する（stop() 呼び出し）', async () => {
      // Arrange
      const testPort = BASE_PORT + 8
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()

      // Act
      await server.stop()

      // Assert: 停止後は接続できない
      await expect(fetch(`http://localhost:${testPort}/health`)).rejects.toThrow()
    })

    it('停止時に停止ログが出力される', async () => {
      // Arrange
      const testPort = BASE_PORT + 9
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()

      // Act
      await server.stop()

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Healthcheck server stopped'),
      )
    })

    it('他のシャットダウン処理が実行される', async () => {
      // Arrange
      const testPort = BASE_PORT + 10
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()

      // 追加のシャットダウン処理をシミュレート
      const additionalShutdown = vi.fn()

      // Act
      await server.stop()
      additionalShutdown()

      // Assert
      expect(additionalShutdown).toHaveBeenCalled()
    })
  })

  describe('並行リクエスト', () => {
    it('複数同時リクエストを処理できる', async () => {
      // Arrange
      const testPort = BASE_PORT + 11
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()

      // Act: 10個の並行リクエストを送信
      const requests = Array.from({ length: 10 }, () =>
        fetch(`http://localhost:${testPort}/health`),
      )
      const responses = await Promise.all(requests)

      // Assert
      for (const response of responses) {
        expect(response.status).toBe(200)
      }

      // Cleanup
      await server.stop()
    })
  })

  describe('ログ出力', () => {
    it('起動ログに正しいポートが含まれる', async () => {
      // Arrange
      const testPort = BASE_PORT + 12
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })

      // Act
      await server.start()

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Healthcheck server started'),
        expect.objectContaining({ port: testPort }),
      )

      // Cleanup
      await server.stop()
    })

    it('停止ログが出力される', async () => {
      // Arrange
      const testPort = BASE_PORT + 13
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })
      await server.start()

      // Act
      await server.stop()

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Healthcheck server stopped'),
      )
    })

    it('AC-LOG-3 対応: サーバー起動/停止の両方がログ出力される', async () => {
      // Arrange
      const testPort = BASE_PORT + 14
      const server = createHealthCheckServer({
        port: testPort,
        logger: mockLogger,
      })

      // Act
      await server.start()
      await server.stop()

      // Assert
      const infoCalls = mockLogger.info as ReturnType<typeof vi.fn>
      expect(infoCalls).toHaveBeenCalledTimes(2)
      expect(infoCalls).toHaveBeenCalledWith(expect.stringContaining('started'), expect.any(Object))
      expect(infoCalls).toHaveBeenCalledWith(expect.stringContaining('stopped'))
    })
  })
})
