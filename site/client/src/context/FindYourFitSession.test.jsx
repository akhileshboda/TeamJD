import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  COMPETITION_PREP_SLUG,
  FIND_YOUR_FIT_SESSION_KEY,
  FIND_YOUR_FIT_SESSION_VERSION,
  FindYourFitSessionProvider,
  readFindYourFitSession,
  useFindYourFitSession,
} from './FindYourFitSession'

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
})

const prepOutcome = {
  status: 'recommended',
  recommendationSlug: COMPETITION_PREP_SLUG,
  qualifiesSlug: COMPETITION_PREP_SLUG,
  reason: 'Prep is the match.',
  evidence: ['Ready for prep.'],
}

function SessionProbe() {
  const session = useFindYourFitSession()
  return (
    <>
      <output data-testid="session">
        {JSON.stringify({
          completed: session.completed,
          valid: session.validForCompetitionPrep,
          canView: session.canViewCompetitionPrep,
          bypass: session.competitionPrepPageBypass,
        })}
      </output>
      <button onClick={() => session.completeFindYourFit(prepOutcome)}>Complete prep result</button>
      <button onClick={session.clearFindYourFitOutcome}>Start again</button>
      <button onClick={session.grantCompetitionPrepPageAccess}>View anyway</button>
    </>
  )
}

function renderProbe() {
  return render(
    <FindYourFitSessionProvider>
      <SessionProbe />
    </FindYourFitSessionProvider>,
  )
}

describe('FindYourFitSession', () => {
  it('stores only a versioned outcome and the independent page bypass', () => {
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'Complete prep result' }))
    fireEvent.click(screen.getByRole('button', { name: 'View anyway' }))

    const stored = JSON.parse(window.sessionStorage.getItem(FIND_YOUR_FIT_SESSION_KEY))
    expect(stored).toMatchObject({
      version: FIND_YOUR_FIT_SESSION_VERSION,
      outcome: prepOutcome,
      competitionPrepPageBypass: true,
    })
    expect(JSON.stringify(stored)).not.toContain('answers')
    expect(screen.getByTestId('session')).toHaveTextContent('"valid":true')
  })

  it('keeps the page bypass when the questionnaire is restarted', () => {
    renderProbe()
    fireEvent.click(screen.getByRole('button', { name: 'View anyway' }))
    fireEvent.click(screen.getByRole('button', { name: 'Complete prep result' }))
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))

    expect(screen.getByTestId('session')).toHaveTextContent('"completed":false')
    expect(screen.getByTestId('session')).toHaveTextContent('"canView":true')
    expect(readFindYourFitSession()).toMatchObject({
      outcome: null,
      competitionPrepPageBypass: true,
    })
  })

  it('restores a valid session and rejects malformed or outdated records', () => {
    window.sessionStorage.setItem(FIND_YOUR_FIT_SESSION_KEY, JSON.stringify({
      version: FIND_YOUR_FIT_SESSION_VERSION,
      outcome: prepOutcome,
      competitionPrepPageBypass: false,
    }))
    renderProbe()
    expect(screen.getByTestId('session')).toHaveTextContent('"valid":true')

    cleanup()
    window.sessionStorage.setItem(FIND_YOUR_FIT_SESSION_KEY, JSON.stringify({
      version: 999,
      outcome: prepOutcome,
      competitionPrepPageBypass: true,
    }))
    renderProbe()
    expect(screen.getByTestId('session')).toHaveTextContent('"completed":false')
    expect(screen.getByTestId('session')).toHaveTextContent('"canView":false')
  })
})
