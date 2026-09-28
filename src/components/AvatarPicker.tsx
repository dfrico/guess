'use client'

import { AVATARS } from '@/lib/types'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function AvatarPicker({ value, onChange }: Props) {
  const current = AVATARS.includes(value as (typeof AVATARS)[number]) ? value : AVATARS[0]

  return (
    <div className="rounded-2xl border border-edge bg-panel/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Your face</span>
        <button
          type="button"
          onClick={() => onChange(AVATARS[Math.floor(Math.random() * AVATARS.length)])}
          className="rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-panel-2 hover:text-ink"
        >
          shuffle
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {AVATARS.map((avatar) => {
          const active = avatar === current
          return (
            <button
              key={avatar}
              type="button"
              onClick={() => onChange(avatar)}
              aria-label={`Use ${avatar}`}
              aria-pressed={active}
              className={`grid aspect-square place-items-center rounded-lg text-lg transition ${
                active
                  ? 'bg-accent/25 ring-2 ring-accent scale-105'
                  : 'bg-panel-2/60 hover:bg-edge/60 opacity-70 hover:opacity-100'
              }`}
            >
              {avatar}
            </button>
          )
        })}
      </div>
    </div>
  )
}
