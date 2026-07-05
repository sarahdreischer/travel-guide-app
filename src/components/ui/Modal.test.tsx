/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Modal from './Modal'

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Test">
        <p>Content</p>
      </Modal>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog when isOpen is true', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="Confirm">
        <p>Are you sure?</p>
      </Modal>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Confirm')).toBeInTheDocument()
    expect(screen.getByText('Are you sure?')).toBeInTheDocument()
  })

  it('has aria-modal=true and aria-labelledby', () => {
    render(
      <Modal isOpen={true} onClose={jest.fn()} title="My Modal">
        <p>Body</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title')
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    )
    // The backdrop is the outer fixed div
    const backdrop = screen.getByRole('dialog').parentElement!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not call onClose when content area is clicked', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <p>Content</p>
      </Modal>
    )
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('traps focus with Tab key', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <button>First</button>
        <button>Last</button>
      </Modal>
    )

    const firstBtn = screen.getByText('First')
    const lastBtn = screen.getByText('Last')
    const dialog = screen.getByRole('dialog')

    // Focus the last button, then tab forward — should cycle to first
    lastBtn.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(firstBtn)
  })

  it('traps focus with Shift+Tab key', () => {
    const onClose = jest.fn()
    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <button>First</button>
        <button>Last</button>
      </Modal>
    )

    const firstBtn = screen.getByText('First')
    const lastBtn = screen.getByText('Last')
    const dialog = screen.getByRole('dialog')

    // Focus the first button, then shift+tab — should cycle to last
    firstBtn.focus()
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastBtn)
  })
})
