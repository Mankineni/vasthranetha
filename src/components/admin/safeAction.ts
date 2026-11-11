'use client'

// Admin forms and buttons call server actions. On a phone the connection can drop at any
// moment; these helpers turn that into a message and keep what the owner typed, instead
// of a blank error page. Next's own redirects (after a successful save, or to sign-in)
// still go through, via unstable_rethrow.
import { unstable_rethrow } from 'next/navigation'
import { startTransition, useActionState, type FormEvent } from 'react'

export const SAVE_FAILED = 'Could not save. Check your connection and try again.'

/** Runs a server action; a lost connection or server failure resolves to `{ error }`. */
export async function safely<T>(run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run()
  } catch (err) {
    unstable_rethrow(err)
    console.error('action failed', err)
    return { error: SAVE_FAILED }
  }
}

/** True when `safely` gave up on the action (as opposed to the action's own result). */
export function failed(result: unknown): result is { error: string } {
  return typeof result === 'object' && result !== null && (result as { error?: unknown }).error === SAVE_FAILED
}

/**
 * useActionState for a form, submitted from onSubmit rather than the form's action
 * attribute: React then does not reset the fields after the action, so typed values
 * stay put when saving fails. Remount the form with `key={state.version}` to show the
 * stored values after a successful save.
 */
export function useSafeForm<S extends { error: string | null }>(
  action: (prev: S, form: FormData) => Promise<S>,
  initial: S,
  failedMessage = SAVE_FAILED,
) {
  const [state, dispatch, pending] = useActionState<S, FormData>(async (prev, form) => {
    try {
      return await action(prev as S, form)
    } catch (err) {
      unstable_rethrow(err)
      console.error('action failed', err)
      return { ...(prev as S), ok: false, error: failedMessage }
    }
  }, initial as Awaited<S>)

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    startTransition(() => dispatch(form))
  }

  return { state, onSubmit, pending }
}
