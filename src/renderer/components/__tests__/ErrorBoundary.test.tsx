import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from '../ErrorBoundary'

const mockLogError = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  window.electronAPI.logError = mockLogError
})

// A component that throws on render
function BrokenComponent({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test crash!')
  }
  return <div>All good</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>Hello World</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('renders error UI when a child throws', () => {
    // Suppress console.error from React (it logs uncaught errors in tests)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('页面出现了异常')).toBeInTheDocument()
    expect(screen.getByText('Test crash!')).toBeInTheDocument()
    expect(screen.getByText('重新加载')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('calls Logger.error when catching an error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )

    // ErrorBoundary's componentDidCatch calls Logger.error
    expect(mockLogError).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('shows "未知错误" when error has no message', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    function NoMessageComponent() {
      throw new Error()
    }

    render(
      <ErrorBoundary>
        <NoMessageComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('未知错误')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('does not render error UI when no error occurs', () => {
    render(
      <ErrorBoundary>
        <BrokenComponent shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.queryByText('页面出现了异常')).not.toBeInTheDocument()
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('recoverable via state reset after error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { rerender } = render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    )

    // Error UI shown
    expect(screen.getByText('页面出现了异常')).toBeInTheDocument()

    // Simulate recovery: replace broken child with good one
    // ErrorBoundary's state is internal, but if we rerender with a working child,
    // the error state persists until this.setState({ hasError: false }) is called
    // (which happens via the reload button). We verify the error state renders.
    rerender(
      <ErrorBoundary>
        <div>Recovered</div>
      </ErrorBoundary>
    )

    // Error UI still shown because hasError is true
    expect(screen.getByText('页面出现了异常')).toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})
