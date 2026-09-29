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
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Guess your number"
        onClick={(event) => event.stopPropagation()}
        className="animate-pop-in card w-full max-w-sm p-6 shadow-hard-lg"
      >
        <h2 className="font-display text-2xl">Commit to a number</h2>
        <p className="mt-1 text-sm text-muted">{playerName}, is this yours? A wrong guess ends your turn.</p>

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
            className="field py-5 text-center font-display text-6xl tabular-nums"
            placeholder="?"
          />
          <p className="mt-2 h-4 text-center text-xs font-semibold text-muted">
            {numeric === '' ? `${min} – ${max}` : valid ? 'ready' : `must be ${min}–${max}`}
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary flex-1 px-4 py-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid}
              className="btn btn-primary flex-1 px-4 py-3"
            >
              Guess it
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
