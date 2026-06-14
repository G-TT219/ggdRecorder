import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/path'),
    getAppPath: vi.fn().mockReturnValue('/mock/app'),
  },
}))

describe('normalizeFavoritesConfig', () => {
  let normalizeFavoritesConfig: (config: Record<string, unknown>) => {
    version: 2; favorites: string[]; notes: Record<string, string>;
    groups: { id: string; name: string; createdAt: string; updatedAt: string }[];
    recordingGroups: Record<string, string>
  }
  let getFavoritesResponse: (config: ReturnType<typeof normalizeFavoritesConfig>) => import('../../shared/types').FavoritesMetadata

  beforeEach(async () => {
    const mod = await import('../config')
    normalizeFavoritesConfig = mod.normalizeFavoritesConfig
    getFavoritesResponse = mod.getFavoritesResponse
  })

  it('returns default empty structure for undefined config', () => {
    const result = normalizeFavoritesConfig(undefined as unknown as Record<string, unknown>)
    expect(result.version).toBe(2)
    expect(result.favorites).toEqual([])
    expect(result.notes).toEqual({})
    expect(result.groups).toEqual([])
    expect(result.recordingGroups).toEqual({})
  })

  it('returns default empty structure for empty config', () => {
    const result = normalizeFavoritesConfig({})
    expect(result.version).toBe(2)
    expect(result.favorites).toEqual([])
    expect(result.notes).toEqual({})
    expect(result.groups).toEqual([])
    expect(result.recordingGroups).toEqual({})
  })

  it('preserves valid favorites array', () => {
    const result = normalizeFavoritesConfig({ favorites: ['id1', 'id2'] })
    expect(result.favorites).toEqual(['id1', 'id2'])
  })

  it('filters out non-array favorites', () => {
    const result = normalizeFavoritesConfig({ favorites: 'not-an-array' })
    expect(result.favorites).toEqual([])
  })

  it('preserves valid notes object', () => {
    const result = normalizeFavoritesConfig({ notes: { id1: 'great game' } })
    expect(result.notes).toEqual({ id1: 'great game' })
  })

  it('filters out non-object notes', () => {
    const result = normalizeFavoritesConfig({ notes: 'not-an-object' })
    expect(result.notes).toEqual({})
  })

  it('preserves valid groups array', () => {
    const groups = [{ id: 'g1', name: 'Group 1', createdAt: '2024-01-01', updatedAt: '2024-01-02' }]
    const result = normalizeFavoritesConfig({ groups })
    expect(result.groups).toEqual(groups)
  })

  it('filters out non-array groups', () => {
    const result = normalizeFavoritesConfig({ groups: 'not-an-array' })
    expect(result.groups).toEqual([])
  })

  it('preserves valid recordingGroups object', () => {
    const result = normalizeFavoritesConfig({ recordingGroups: { id1: 'g1' } })
    expect(result.recordingGroups).toEqual({ id1: 'g1' })
  })

  it('handles partial config', () => {
    const result = normalizeFavoritesConfig({ favorites: ['id1'] })
    expect(result.favorites).toEqual(['id1'])
    expect(result.notes).toEqual({})
    expect(result.groups).toEqual([])
    expect(result.recordingGroups).toEqual({})
  })
})

describe('getFavoritesResponse', () => {
  it('transforms normalized config to FavoritesMetadata', async () => {
    const { normalizeFavoritesConfig, getFavoritesResponse } = await import('../config')
    const normalized = normalizeFavoritesConfig({
      favorites: ['id1'],
      notes: { id1: 'note' },
      groups: [],
      recordingGroups: {},
    })
    const response = getFavoritesResponse(normalized)
    expect(response).toEqual({
      favorites: ['id1'],
      notes: { id1: 'note' },
      groups: [],
      recordingGroups: {},
    })
  })
})
