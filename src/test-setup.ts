import '@testing-library/jest-dom'

// Mock window.electronAPI for renderer tests
window.electronAPI = {
  logInfo: vi.fn(),
  logError: vi.fn(),
} as unknown as Window['electronAPI']
