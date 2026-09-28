'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  min: number
  max: number
  playerName: string
  onCancel: () => void
  onSubmit: (value: number) => void
}

export function GuessSheet({ min, max, playerName, onCancel, onSubmit }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const numeric = value.replace(/[^0-9]/g, '').slice(0, 3)
  const parsed = Number(numeric)
  const valid = numeric !== '' && parsed >= min && parsed <= max

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guess your number"
        onClick={(event) => event.stopPropagation()}
        className="animate-pop-in w-full max-w-sm rounded-3xl border border-edge bg-panel p-6 shadow-2xl shadow-black/60"
      >
        <h2 className="text-xl font-bold">Commit to a number</h2>
        <p className="mt-1 text-sm text-muted">{playerName}, is this yours? No take-backs.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) onSubmit(parsed)
          }}
          className="mt-5"
        >
          <input
            ref={inputRef}
            value={numeric}
            onChange={(event) => setValue(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            aria-label="Your number"
            className="w-full rounded-2xl border-2 border-edge bg-panel-2 py-5 text-center text-5xl font-black tabular-nums outline-none transition focus:border-accent"
            placeholder="?"
          />
          <p className="mt-2 h-4 text-center text-xs text-muted">
            {numeric === '' ? `${min} – ${max}` : valid ? 'ready' : `must be ${min}–${max}`}
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-edge px-4 py-3 font-semibold text-muted transition hover:bg-panel-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="flex-1 rounded-xl bg-accent px-4 py-3 font-bold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Guess it
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
