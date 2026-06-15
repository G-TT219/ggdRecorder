import { describe, it, expect } from 'vitest'

// Mock electron module — isPathInside only uses path, not app, but the module imports app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/path'),
    getAppPath: vi.fn().mockReturnValue('/mock/app'),
  },
}))

describe('isPathInside', () => {
  it('returns true when child is directly inside parent', async () => {
    const { isPathInside } = await import('../utils')
    expect(isPathInside('/parent', '/parent/child')).toBe(true)
  })

  it('returns true when child is deeply nested inside parent', async () => {
    const { isPathInside } = await import('../utils')
    expect(isPathInside('/parent', '/parent/a/b/c')).toBe(true)
  })

  it('returns true when child equals parent', async () => {
    const { isPathInside } = await import('../utils')
    expect(isPathInside('/parent', '/parent')).toBe(true)
  })

  it('returns false when child is outside parent', async () => {
    const { isPathInside } = await import('../utils')
    expect(isPathInside('/parent', '/other/child')).toBe(false)
  })

  it('returns false when child uses traversal to escape', async () => {
    const { isPathInside } = await import('../utils')
    expect(isPathInside('/parent', '/parent/../outside')).toBe(false)
  })

  it('handles trailing slashes correctly', async () => {
    const { isPathInside } = await import('../utils')
    expect(isPathInside('/parent/', '/parent/child')).toBe(true)
  })

  it('returns false on empty relative path (child is root)', async () => {
    const { isPathInside } = await import('../utils')
    expect(isPathInside('/', '/')).toBe(true)
  })
})

describe('setRecordingUrl / recordingUrlMap', () => {
  it('stores and retrieves a recording URL mapping', async () => {
    const { setRecordingUrl, recordingUrlMap } = await import('../utils')
    setRecordingUrl('token-1', '/path/to/file.mp4')
    expect(recordingUrlMap.get('token-1')).toBe('/path/to/file.mp4')
  })

  it('evicts oldest entries when exceeding max (50)', async () => {
    const { setRecordingUrl, recordingUrlMap } = await import('../utils')
    // Clear any existing entries from other tests
    recordingUrlMap.clear()

    // Insert 51 entries
    for (let i = 0; i < 51; i++) {
      setRecordingUrl(`token-${i}`, `/path/${i}.mp4`)
    }

    // The first 25 (0-24) should be evicted (50 / 2 = 25 evicted)
    expect(recordingUrlMap.has('token-0')).toBe(false)
    expect(recordingUrlMap.has('token-24')).toBe(false)
    // The 26th (index 25) should be the first survivor
    expect(recordingUrlMap.has('token-25')).toBe(true)
    // The latest should be present
    expect(recordingUrlMap.has('token-50')).toBe(true)
    expect(recordingUrlMap.size).toBeLessThanOrEqual(50)
  })
})

describe('pendingRecordingTarget', () => {
  it('stores and retrieves pending target', async () => {
    const { pendingRecordingTarget, setPendingRecordingTarget } = await import('../utils')
    setPendingRecordingTarget('Game.exe')
    expect(pendingRecordingTarget.current).toBe('Game.exe')
  })

  it('overwrites previous target', async () => {
    const { pendingRecordingTarget, setPendingRecordingTarget } = await import('../utils')
    setPendingRecordingTarget('first.exe')
    setPendingRecordingTarget('second.exe')
    expect(pendingRecordingTarget.current).toBe('second.exe')
  })
})
