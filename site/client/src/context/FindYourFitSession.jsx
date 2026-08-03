import { createContext, useCallback, useContext, useMemo, useState } from 'react'

export const FIND_YOUR_FIT_SESSION_KEY = 'teamjd:find-your-fit-session'
export const FIND_YOUR_FIT_SESSION_VERSION = 1
export const COMPETITION_PREP_SLUG = 'competition-preparation'

const EMPTY_SESSION = Object.freeze({
  version: FIND_YOUR_FIT_SESSION_VERSION,
  outcome: null,
  competitionPrepPageBypass: false,
})

const FindYourFitSessionContext = createContext(null)

function getSessionStorage(storage) {
  if (storage) return storage
  if (typeof window === 'undefined') return null

  try {
    return window.sessionStorage
  } catch (_) {
    return null
  }
}

function normaliseOutcome(outcome) {
  if (!outcome || !['recommended', 'consult'].includes(outcome.status)) return null

  return {
    status: outcome.status,
    recommendationSlug:
      typeof outcome.recommendationSlug === 'string' ? outcome.recommendationSlug : null,
    qualifiesSlug: typeof outcome.qualifiesSlug === 'string' ? outcome.qualifiesSlug : null,
    reason: typeof outcome.reason === 'string' ? outcome.reason : '',
    evidence: Array.isArray(outcome.evidence)
      ? outcome.evidence.filter((item) => typeof item === 'string')
      : [],
  }
}

export function readFindYourFitSession(storage) {
  const sessionStorage = getSessionStorage(storage)
  if (!sessionStorage) return { ...EMPTY_SESSION }

  try {
    const raw = sessionStorage.getItem(FIND_YOUR_FIT_SESSION_KEY)
    if (!raw) return { ...EMPTY_SESSION }

    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      parsed.version !== FIND_YOUR_FIT_SESSION_VERSION ||
      typeof parsed.competitionPrepPageBypass !== 'boolean'
    ) {
      return { ...EMPTY_SESSION }
    }

    const outcome = parsed.outcome === null ? null : normaliseOutcome(parsed.outcome)
    if (parsed.outcome !== null && !outcome) return { ...EMPTY_SESSION }

    return {
      version: FIND_YOUR_FIT_SESSION_VERSION,
      outcome,
      competitionPrepPageBypass: parsed.competitionPrepPageBypass,
    }
  } catch (_) {
    return { ...EMPTY_SESSION }
  }
}

export function writeFindYourFitSession(session, storage) {
  const sessionStorage = getSessionStorage(storage)
  if (!sessionStorage) return

  try {
    sessionStorage.setItem(FIND_YOUR_FIT_SESSION_KEY, JSON.stringify(session))
  } catch (_) {}
}

export function FindYourFitSessionProvider({ children }) {
  const [session, setSession] = useState(readFindYourFitSession)

  const updateSession = useCallback((updater) => {
    setSession((current) => {
      const next = updater(current)
      writeFindYourFitSession(next)
      return next
    })
  }, [])

  const completeFindYourFit = useCallback(
    (result) => {
      const outcome = normaliseOutcome(result)
      if (!outcome) return

      updateSession((current) => ({ ...current, outcome }))
    },
    [updateSession],
  )

  const clearFindYourFitOutcome = useCallback(() => {
    updateSession((current) => ({ ...current, outcome: null }))
  }, [updateSession])

  const grantCompetitionPrepPageAccess = useCallback(() => {
    updateSession((current) => ({ ...current, competitionPrepPageBypass: true }))
  }, [updateSession])

  const value = useMemo(() => {
    const completed = Boolean(session.outcome)
    const validForCompetitionPrep =
      session.outcome?.status === 'recommended' &&
      session.outcome?.qualifiesSlug === COMPETITION_PREP_SLUG

    return {
      outcome: session.outcome,
      completed,
      validForCompetitionPrep,
      canViewCompetitionPrep:
        validForCompetitionPrep || session.competitionPrepPageBypass,
      competitionPrepPageBypass: session.competitionPrepPageBypass,
      completeFindYourFit,
      clearFindYourFitOutcome,
      grantCompetitionPrepPageAccess,
    }
  }, [
    clearFindYourFitOutcome,
    completeFindYourFit,
    grantCompetitionPrepPageAccess,
    session,
  ])

  return (
    <FindYourFitSessionContext.Provider value={value}>
      {children}
    </FindYourFitSessionContext.Provider>
  )
}

export function useFindYourFitSession() {
  const context = useContext(FindYourFitSessionContext)
  if (!context) {
    throw new Error('useFindYourFitSession must be used within FindYourFitSessionProvider')
  }
  return context
}
