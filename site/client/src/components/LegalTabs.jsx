import { useRef } from 'react'

const TABS = [
  { id: 'privacy', label: 'Privacy Policy' },
  { id: 'terms', label: 'Terms & Conditions' },
]

export default function LegalTabs({ activeTab, onChange }) {
  const tabRefs = useRef({})

  function focusTab(id) {
    tabRefs.current[id]?.focus()
    onChange(id)
  }

  function handleKeyDown(event, index) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()

    if (event.key === 'Home') {
      focusTab(TABS[0].id)
      return
    }
    if (event.key === 'End') {
      focusTab(TABS[TABS.length - 1].id)
      return
    }

    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextIndex = (index + direction + TABS.length) % TABS.length
    focusTab(TABS[nextIndex].id)
  }

  return (
    <div className="legal-tablist" role="tablist" aria-label="Legal documents">
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          ref={(el) => {
            tabRefs.current[tab.id] = el
          }}
          type="button"
          role="tab"
          id={`legal-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`legal-panel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          className={`legal-tab${activeTab === tab.id ? ' is-active' : ''}`}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => handleKeyDown(event, index)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
