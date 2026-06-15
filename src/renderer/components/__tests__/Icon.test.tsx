import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Icon from '../Icon'

describe('Icon', () => {
  it('renders an SVG element with the given name', () => {
    const { container } = render(<Icon name="star" />)
    const svg = container.querySelector('svg.app-icon')
    expect(svg).toBeInTheDocument()
  })

  it('renders with default size 18', () => {
    const { container } = render(<Icon name="play" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '18')
    expect(svg).toHaveAttribute('height', '18')
  })

  it('renders with custom size', () => {
    const { container } = render(<Icon name="trash" size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('height', '32')
  })

  it('renders with custom className', () => {
    const { container } = render(<Icon name="x" className="custom-icon" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('custom-icon')
  })

  it('keeps the base app-icon class', () => {
    const { container } = render(<Icon name="check" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveClass('app-icon')
  })

  it('has aria-hidden attribute', () => {
    const { container } = render(<Icon name="refresh" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('returns null for unknown icon name (TypeScript bypass)', () => {
    // @ts-expect-error - testing runtime behavior with unknown name
    const { container } = render(<Icon name="nonexistent" />)
    // When name doesn't exist, icons[name] returns null, so the component returns null
    expect(container.innerHTML).toBe('')
  })

  it('renders all known icon names without error', () => {
    const names = [
      'refresh', 'star', 'starFilled', 'play', 'trash', 'x', 'warning',
      'globe', 'clipboard', 'chart', 'trophy', 'check', 'ghost',
      'skip', 'vote', 'gamepad', 'arrowRight',
    ] as const

    for (const name of names) {
      const { container } = render(<Icon name={name} key={name} />)
      expect(container.querySelector('svg.app-icon')).toBeInTheDocument()
    }
  })
})
