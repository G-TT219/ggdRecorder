import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Logger module — isolate from the real window.electronAPI
const mockLogInfo = vi.fn()
const mockLogError = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  window.electronAPI.logInfo = mockLogInfo
  window.electronAPI.logError = mockLogError
})

describe('Logger', () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('calls window.electronAPI.logInfo with the message', async () => {
    // Set NODE_ENV to production to avoid console.log noise in test output
    process.env.NODE_ENV = 'production'
    window.electronAPI.logInfo = mockLogInfo

    const Logger = (await import('../logger')).default
    Logger.info('test message')

    expect(mockLogInfo).toHaveBeenCalledWith('test message')
  })

  it('calls console.log in non-production', async () => {
    process.env.NODE_ENV = 'development'
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    window.electronAPI.logInfo = mockLogInfo

    const Logger = (await import('../logger')).default
    Logger.info('dev message')

    expect(consoleSpy).toHaveBeenCalledWith('[INFO] dev message')

    consoleSpy.mockRestore()
  })

  it('does not call console.log in production', async () => {
    process.env.NODE_ENV = 'production'
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    // Re-import to pick up the new env
    const Logger = (await import('../logger')).default
    Logger.info('prod message')

    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('calls window.electronAPI.logError with formatted message for Error objects', async () => {
    process.env.NODE_ENV = 'production'
    window.electronAPI.logError = mockLogError

    const Logger = (await import('../logger')).default
    const error = new Error('something broke')
    Logger.error('failed', error)

    expect(mockLogError).toHaveBeenCalledWith('failed: something broke')
  })

  it('calls window.electronAPI.logError with stringified message for non-Error', async () => {
    process.env.NODE_ENV = 'production'
    window.electronAPI.logError = mockLogError

    const Logger = (await import('../logger')).default
    Logger.error('failed', { code: 42 })

    expect(mockLogError).toHaveBeenCalledWith('failed: [object Object]')
  })

  it('handles error with no extra context', async () => {
    process.env.NODE_ENV = 'production'
    window.electronAPI.logError = mockLogError

    const Logger = (await import('../logger')).default
    Logger.error('just a message')

    expect(mockLogError).toHaveBeenCalledWith('just a message')
  })

  it('calls console.error regardless of NODE_ENV', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const Logger = (await import('../logger')).default
    Logger.error('oops')

    expect(consoleSpy).toHaveBeenCalledWith('[ERROR] oops', undefined)
    consoleSpy.mockRestore()
  })
})
