import { useEffect, useId, useState } from 'react'

// Form fields for the dashboard editors. Each takes the field's value, an
// onChange(value) callback and an optional error from the server's validation.

function Field({ label, hint, error, required, children, id }) {
  return (
    <div className="jd-field">
      <label className="jd-field-label" htmlFor={id}>
        {label}
        {required && <span className="jd-field-required"> (required to go live)</span>}
      </label>
      {hint && <p className="jd-field-hint" id={`${id}-hint`}>{hint}</p>}
      {children}
      {error && <p className="jd-field-error" id={`${id}-error`}>{error}</p>}
    </div>
  )
}

function describedBy(id, hint, error) {
  return [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
}

export function TextField({ label, hint, error, required, value, onChange, maxLength, multiline = false, rows = 4, ...rest }) {
  const id = useId()
  const Input = multiline ? 'textarea' : 'input'
  return (
    <Field label={label} hint={hint} error={error} required={required} id={id}>
      <Input
        id={id}
        className={`jd-input${multiline ? ' jd-input--multiline' : ''}`}
        value={value ?? ''}
        maxLength={maxLength}
        rows={multiline ? rows : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
        {...rest}
      />
      {maxLength && multiline && (
        <span className="jd-field-count" aria-hidden="true">{(value || '').length} / {maxLength}</span>
      )}
    </Field>
  )
}

export function SelectField({ label, hint, error, value, onChange, options }) {
  const id = useId()
  return (
    <Field label={label} hint={hint} error={error} id={id}>
      <select
        id={id}
        className="jd-input jd-select"
        value={value ?? ''}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </Field>
  )
}

export function ChoiceField({ label, hint, value, onChange, options }) {
  const name = useId()
  return (
    <fieldset className="jd-field jd-choice">
      <legend className="jd-field-label">{label}</legend>
      {hint && <p className="jd-field-hint">{hint}</p>}
      <div className="jd-choice-options">
        {options.map((option) => (
          <label key={option.value} className="jd-choice-option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>
              <strong>{option.label}</strong>
              {option.hint && <small>{option.hint}</small>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function ToggleField({ label, hint, checked, onChange }) {
  const id = useId()
  return (
    <div className="jd-field jd-toggle">
      <input id={id} type="checkbox" role="switch" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>
        <span className="jd-field-label">{label}</span>
        {hint && <span className="jd-field-hint">{hint}</span>}
      </label>
    </div>
  )
}

const parseTags = (text) => text.split(',').map((tag) => tag.trim()).filter(Boolean)

// Comma-separated words, stored as a list. The typed text is kept as-is so a
// trailing comma survives while typing; it only resets if the list changes
// from outside (for example, Discard).
export function TagsField({ label, hint, value, onChange }) {
  const joined = (value || []).join(', ')
  const [text, setText] = useState(joined)

  useEffect(() => {
    setText((current) => (parseTags(current).join(', ') === joined ? current : joined))
  }, [joined])

  return (
    <TextField
      label={label}
      hint={hint}
      value={text}
      onChange={(next) => {
        setText(next)
        onChange(parseTags(next))
      }}
      spellCheck={false}
    />
  )
}

export function FormSection({ title, description, children }) {
  return (
    <section className="jd-form-section">
      <div className="jd-form-section-head">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="jd-form-section-body">{children}</div>
    </section>
  )
}
