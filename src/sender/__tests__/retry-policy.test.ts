import { AxiosError } from 'axios'
import { describe, expect, it } from 'vitest'
import { is409Conflict, isNonRetryableError, isRetryableError } from '../retry-policy.js'

describe('RetryPolicy', () => {
  describe('isRetryableError', () => {
    it('should return true for 5xx errors', () => {
      const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for 503 error', () => {
      const error = new AxiosError(
        'Service Unavailable',
        'ERR_BAD_RESPONSE',
        undefined,
        undefined,
        {
          status: 503,
          statusText: 'Service Unavailable',
          data: {},
          headers: {},
          config: {} as never,
        },
      )
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for 429 error', () => {
      const error = new AxiosError('Too Many Requests', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 429,
        statusText: 'Too Many Requests',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for ECONNREFUSED network error', () => {
      const error = new AxiosError('Network Error', 'ECONNREFUSED')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for ETIMEDOUT network error', () => {
      const error = new AxiosError('Timeout', 'ETIMEDOUT')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for ENOTFOUND network error', () => {
      const error = new AxiosError('DNS Error', 'ENOTFOUND')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for ECONNRESET network error', () => {
      const error = new AxiosError('Connection Reset', 'ECONNRESET')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for response without status (network failure)', () => {
      const error = new AxiosError('Network Error', 'ERR_NETWORK')
      expect(isRetryableError(error)).toBe(true)
    })

    it('should return false for 400 error', () => {
      const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isRetryableError(error)).toBe(false)
    })

    it('should return false for 404 error', () => {
      const error = new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isRetryableError(error)).toBe(false)
    })

    it('should return false for non-AxiosError', () => {
      const error = new Error('Generic Error')
      expect(isRetryableError(error)).toBe(false)
    })
  })

  describe('isNonRetryableError', () => {
    it('should return true for 400 error', () => {
      const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isNonRetryableError(error)).toBe(true)
    })

    it('should return true for 401 error', () => {
      const error = new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isNonRetryableError(error)).toBe(true)
    })

    it('should return true for 403 error', () => {
      const error = new AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 403,
        statusText: 'Forbidden',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isNonRetryableError(error)).toBe(true)
    })

    it('should return true for 404 error', () => {
      const error = new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isNonRetryableError(error)).toBe(true)
    })

    it('should return false for 500 error', () => {
      const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isNonRetryableError(error)).toBe(false)
    })

    it('should return false for 429 error', () => {
      const error = new AxiosError('Too Many Requests', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 429,
        statusText: 'Too Many Requests',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(isNonRetryableError(error)).toBe(false)
    })

    it('should return false for non-AxiosError', () => {
      const error = new Error('Generic Error')
      expect(isNonRetryableError(error)).toBe(false)
    })

    it('should return false for error without status', () => {
      const error = new AxiosError('Network Error', 'ERR_NETWORK')
      expect(isNonRetryableError(error)).toBe(false)
    })
  })

  describe('is409Conflict', () => {
    it('should return true for 409 error', () => {
      const error = new AxiosError('Conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409,
        statusText: 'Conflict',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(is409Conflict(error)).toBe(true)
    })

    it('should return false for 404 error', () => {
      const error = new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(is409Conflict(error)).toBe(false)
    })

    it('should return false for 400 error', () => {
      const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(is409Conflict(error)).toBe(false)
    })

    it('should return false for 500 error', () => {
      const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 500,
        statusText: 'Internal Server Error',
        data: {},
        headers: {},
        config: {} as never,
      })
      expect(is409Conflict(error)).toBe(false)
    })

    it('should return false for non-AxiosError', () => {
      const error = new Error('Generic Error')
      expect(is409Conflict(error)).toBe(false)
    })

    it('should return false for error without status', () => {
      const error = new AxiosError('Network Error', 'ERR_NETWORK')
      expect(is409Conflict(error)).toBe(false)
    })
  })
})
