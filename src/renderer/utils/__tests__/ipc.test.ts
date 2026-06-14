import { describe, it, expect } from 'vitest'
import { isSuccess, isFailure } from '../ipc'
import type { IpcResult } from '../../types/electron-api'

describe('isSuccess', () => {
  it('returns true when result has success: true', () => {
    const result: IpcResult = { success: true }
    expect(isSuccess(result)).toBe(true)
  })

  it('returns false when result has success: false', () => {
    const result: IpcResult = { success: false, error: 'something went wrong' }
    expect(isSuccess(result)).toBe(false)
  })

  it('narrows type correctly with extra data', () => {
    const result: IpcResult<{ data: string }> = { success: true, data: 'hello' }
    if (isSuccess(result)) {
      expect(result.data).toBe('hello')
    }
  })
})

describe('isFailure', () => {
  it('returns true when result has success: false', () => {
    const result: IpcResult = { success: false, error: 'failed' }
    expect(isFailure(result)).toBe(true)
  })

  it('returns false when result has success: true', () => {
    const result: IpcResult = { success: true }
    expect(isFailure(result)).toBe(false)
  })

  it('handles canceled error', () => {
    const result: IpcResult = { success: false, error: 'canceled', canceled: true }
    expect(isFailure(result)).toBe(true)
  })
})
