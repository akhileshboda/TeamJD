import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ListField, RowsField, TagsField } from './components/fields'

afterEach(() => cleanup())

describe('list fields', () => {
  it('adds, edits, moves and removes items', () => {
    const onChange = vi.fn()
    render(<ListField label="Steps" items={['One', 'Two']} noun="step" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Step 2'), { target: { value: 'Second' } })
    expect(onChange).toHaveBeenLastCalledWith(['One', 'Second'])
    fireEvent.click(screen.getByRole('button', { name: 'Move step 2 up' }))
    expect(onChange).toHaveBeenLastCalledWith(['Two', 'One'])
    fireEvent.click(screen.getByRole('button', { name: 'Remove step 1' }))
    expect(onChange).toHaveBeenLastCalledWith(['Two'])
    fireEvent.click(screen.getByRole('button', { name: 'Add step' }))
    expect(onChange).toHaveBeenLastCalledWith(['One', 'Two', ''])
  })

  it('fixed rows can be edited but not added or removed, and show cell errors', () => {
    const onChange = vi.fn()
    render(
      <RowsField label="Facts" rows={[{ label: 'Where', url: 'bad' }]} fixed noun="fact"
        columns={[{ key: 'label', label: 'Label' }, { key: 'url', label: 'Link' }]}
        errors={{ 'facts.0.url': 'Links need to start with https://' }} errorPrefix="facts" onChange={onChange} />,
    )
    expect(screen.queryByRole('button', { name: /Add fact|Remove/ })).not.toBeInTheDocument()
    expect(screen.getByText('Links need to start with https://')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Label (fact 1)'), { target: { value: 'Studio' } })
    expect(onChange).toHaveBeenLastCalledWith([{ label: 'Studio', url: 'bad' }])
  })

  it('tags keep a trailing comma while typing', () => {
    const onChange = vi.fn()
    render(<TagsField label="Search words" value={['posing']} onChange={onChange} />)
    const input = screen.getByLabelText('Search words')
    fireEvent.change(input, { target: { value: 'posing, ' } })
    expect(input).toHaveValue('posing, ')
    expect(onChange).toHaveBeenLastCalledWith(['posing'])
  })
})
