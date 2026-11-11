'use client'

import { signInAction, type LoginState } from '@/app/admin/login/actions'
import { useSafeForm } from './safeAction'

export function LoginForm({ next }: { next: string }) {
  const { state, onSubmit, pending } = useSafeForm<LoginState>(
    signInAction,
    { error: null, login: '' },
    'Could not reach the site. Check your connection and try again.',
  )

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium text-ink">Email or phone</span>
        <input
          name="login"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          defaultValue={state.login}
          className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-3 text-base"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block w-full rounded-md border border-line bg-surface px-3 py-3 text-base"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-md bg-accent-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
