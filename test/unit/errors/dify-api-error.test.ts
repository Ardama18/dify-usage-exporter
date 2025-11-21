import { describe, expect, it } from 'vitest'
import {
  DIFY_API_ERROR_CODES,
  DifyApiError,
  type DifyApiErrorCode,
} from '../../../src/errors/dify-api-error.js'

describe('DifyApiError', () => {
  describe('インスタンス生成', () => {
    it('基本的なエラーを作成できる', () => {
      const error = new DifyApiError('テストエラー', DIFY_API_ERROR_CODES.NETWORK_ERROR)

      expect(error).toBeInstanceOf(DifyApiError)
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('テストエラー')
      expect(error.code).toBe('DIFY_NETWORK_ERROR')
      expect(error.name).toBe('DifyApiError')
    })

    it('statusCodeを設定できる', () => {
      const error = new DifyApiError('認証エラー', DIFY_API_ERROR_CODES.AUTHENTICATION_ERROR, 401)

      expect(error.message).toBe('認証エラー')
      expect(error.code).toBe('DIFY_AUTH_ERROR')
      expect(error.statusCode).toBe(401)
    })

    it('detailsを設定できる', () => {
      const details = { endpoint: '/api/usage', retryCount: 3 }
      const error = new DifyApiError(
        'サーバーエラー',
        DIFY_API_ERROR_CODES.SERVER_ERROR,
        500,
        details,
      )

      expect(error.message).toBe('サーバーエラー')
      expect(error.code).toBe('DIFY_SERVER_ERROR')
      expect(error.statusCode).toBe(500)
      expect(error.details).toEqual(details)
    })

    it('statusCodeとdetailsはオプションである', () => {
      const error = new DifyApiError('バリデーションエラー', DIFY_API_ERROR_CODES.VALIDATION_ERROR)

      expect(error.statusCode).toBeUndefined()
      expect(error.details).toBeUndefined()
    })

    it('statusCodeを省略してdetailsのみ設定できる', () => {
      const details = { field: 'date', reason: 'invalid format' }
      const error = new DifyApiError(
        'バリデーションエラー',
        DIFY_API_ERROR_CODES.VALIDATION_ERROR,
        undefined,
        details,
      )

      expect(error.statusCode).toBeUndefined()
      expect(error.details).toEqual(details)
    })
  })

  describe('エラー継承チェーン', () => {
    it('Errorクラスを正しく継承している', () => {
      const error = new DifyApiError('テストエラー', DIFY_API_ERROR_CODES.NETWORK_ERROR)

      expect(error instanceof Error).toBe(true)
      expect(error.stack).toBeDefined()
      expect(error.name).toBe('DifyApiError')
    })

    it('throw/catchで正しく動作する', () => {
      expect(() => {
        throw new DifyApiError('テストエラー', DIFY_API_ERROR_CODES.RATE_LIMIT_ERROR, 429)
      }).toThrow(DifyApiError)
    })

    it('catchブロックで型安全にアクセスできる', () => {
      try {
        throw new DifyApiError('テストエラー', DIFY_API_ERROR_CODES.SERVER_ERROR, 503, {
          service: 'dify',
        })
      } catch (e) {
        if (e instanceof DifyApiError) {
          expect(e.code).toBe('DIFY_SERVER_ERROR')
          expect(e.statusCode).toBe(503)
          expect(e.details).toEqual({ service: 'dify' })
        } else {
          throw new Error('DifyApiErrorインスタンスではありません')
        }
      }
    })
  })

  describe('DIFY_API_ERROR_CODES', () => {
    it('すべての必要なエラーコードが定義されている', () => {
      expect(DIFY_API_ERROR_CODES.NETWORK_ERROR).toBe('DIFY_NETWORK_ERROR')
      expect(DIFY_API_ERROR_CODES.AUTHENTICATION_ERROR).toBe('DIFY_AUTH_ERROR')
      expect(DIFY_API_ERROR_CODES.PERMISSION_ERROR).toBe('DIFY_PERMISSION_ERROR')
      expect(DIFY_API_ERROR_CODES.VALIDATION_ERROR).toBe('DIFY_VALIDATION_ERROR')
      expect(DIFY_API_ERROR_CODES.RATE_LIMIT_ERROR).toBe('DIFY_RATE_LIMIT_ERROR')
      expect(DIFY_API_ERROR_CODES.SERVER_ERROR).toBe('DIFY_SERVER_ERROR')
      expect(DIFY_API_ERROR_CODES.NOT_FOUND_ERROR).toBe('DIFY_NOT_FOUND_ERROR')
      expect(DIFY_API_ERROR_CODES.BAD_REQUEST_ERROR).toBe('DIFY_BAD_REQUEST_ERROR')
    })

    it('エラーコードがreadonlyである', () => {
      // as constで定義されているため、値を変更しようとすると型エラーになる
      // ランタイムでの確認として、オブジェクトがfreezeされているかは確認できない
      // ただし、型レベルでの不変性は保証されている
      const codes = DIFY_API_ERROR_CODES
      expect(Object.keys(codes).length).toBe(8)
    })
  })

  describe('DifyApiErrorCode型', () => {
    it('型安全なエラーコードを使用できる', () => {
      // 型が正しく推論されることを確認
      const code: DifyApiErrorCode = DIFY_API_ERROR_CODES.NETWORK_ERROR
      const error = new DifyApiError('テスト', code)
      expect(error.code).toBe('DIFY_NETWORK_ERROR')
    })
  })

  describe('各エラーコードの用途確認', () => {
    it('ネットワークエラー用のコードが存在する', () => {
      const error = new DifyApiError('接続に失敗しました', DIFY_API_ERROR_CODES.NETWORK_ERROR)
      expect(error.code).toBe('DIFY_NETWORK_ERROR')
    })

    it('認証エラー用のコードが存在する（401）', () => {
      const error = new DifyApiError(
        '認証に失敗しました',
        DIFY_API_ERROR_CODES.AUTHENTICATION_ERROR,
        401,
      )
      expect(error.code).toBe('DIFY_AUTH_ERROR')
      expect(error.statusCode).toBe(401)
    })

    it('権限エラー用のコードが存在する（403）', () => {
      const error = new DifyApiError(
        'アクセス権限がありません',
        DIFY_API_ERROR_CODES.PERMISSION_ERROR,
        403,
      )
      expect(error.code).toBe('DIFY_PERMISSION_ERROR')
      expect(error.statusCode).toBe(403)
    })

    it('バリデーションエラー用のコードが存在する（400）', () => {
      const error = new DifyApiError('入力値が不正です', DIFY_API_ERROR_CODES.VALIDATION_ERROR, 400)
      expect(error.code).toBe('DIFY_VALIDATION_ERROR')
      expect(error.statusCode).toBe(400)
    })

    it('Rate Limitエラー用のコードが存在する（429）', () => {
      const error = new DifyApiError(
        'リクエスト制限を超えました',
        DIFY_API_ERROR_CODES.RATE_LIMIT_ERROR,
        429,
      )
      expect(error.code).toBe('DIFY_RATE_LIMIT_ERROR')
      expect(error.statusCode).toBe(429)
    })

    it('サーバーエラー用のコードが存在する（5xx）', () => {
      const error = new DifyApiError(
        'サーバーエラーが発生しました',
        DIFY_API_ERROR_CODES.SERVER_ERROR,
        500,
      )
      expect(error.code).toBe('DIFY_SERVER_ERROR')
      expect(error.statusCode).toBe(500)
    })

    it('Not Foundエラー用のコードが存在する（404）', () => {
      const error = new DifyApiError(
        'リソースが見つかりません',
        DIFY_API_ERROR_CODES.NOT_FOUND_ERROR,
        404,
      )
      expect(error.code).toBe('DIFY_NOT_FOUND_ERROR')
      expect(error.statusCode).toBe(404)
    })

    it('Bad Requestエラー用のコードが存在する（400）', () => {
      const error = new DifyApiError(
        'リクエストが不正です',
        DIFY_API_ERROR_CODES.BAD_REQUEST_ERROR,
        400,
      )
      expect(error.code).toBe('DIFY_BAD_REQUEST_ERROR')
      expect(error.statusCode).toBe(400)
    })
  })
})
