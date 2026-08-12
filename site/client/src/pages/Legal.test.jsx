import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Legal from './Legal'

vi.mock('../components/SectionReveal', () => ({
  default: ({ children, className = '' }) => <div className={className}>{children}</div>,
}))

afterEach(() => {
  cleanup()
})

function renderLegal(initialTab) {
  return render(
    <MemoryRouter>
      <Legal initialTab={initialTab} />
    </MemoryRouter>,
  )
}

describe('Legal page', () => {
  it('shows the Privacy panel selected when initialTab is privacy', () => {
    renderLegal('privacy')

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Privacy Policy' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Terms & Conditions' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'legal-panel-privacy')
  })

  it('shows the Terms panel selected when initialTab is terms', () => {
    renderLegal('terms')

    expect(screen.getByRole('heading', { name: 'Terms & Conditions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Terms & Conditions' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Privacy Policy' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'legal-panel-terms')
  })

  it('switches panels when a tab is clicked', () => {
    renderLegal('privacy')

    fireEvent.click(screen.getByRole('tab', { name: 'Terms & Conditions' }))

    expect(screen.getByRole('heading', { name: 'Terms & Conditions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Terms & Conditions' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'legal-panel-terms')
  })

  it('moves selection with arrow key navigation', () => {
    renderLegal('privacy')

    const privacyTab = screen.getByRole('tab', { name: 'Privacy Policy' })
    privacyTab.focus()
    fireEvent.keyDown(privacyTab, { key: 'ArrowRight' })

    const termsTab = screen.getByRole('tab', { name: 'Terms & Conditions' })
    expect(termsTab).toHaveAttribute('aria-selected', 'true')
    expect(termsTab).toHaveFocus()
  })
})
