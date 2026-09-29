'use client'

import { AVATARS } from '@/lib/types'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function AvatarPicker({ value, onChange }: Props) {
  const current = AVATARS.includes(value as (typeof AVATARS)[number]) ? value : AVATARS[0]

  return (
    <div className="rounded-2xl border-2 border-ink/15 bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">Your face</span>
        <button
          type="button"
          onClick={() => onChange(AVATARS[Math.floor(Math.random() * AVATARS.length)])}
          className="btn btn-secondary px-2.5 py-1 text-xs"
        >
          🎲 shuffle
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1.5">
        {AVATARS.map((avatar) => {
          const active = avatar === current
          return (
            <button
              key={avatar}
              type="button"
              onClick={() => onChange(avatar)}
              aria-label={`Use ${avatar}`}
              aria-pressed={active}
              className={`grid aspect-square place-items-center rounded-lg border-2 text-xl transition sm:text-2xl ${
                active
                  ? 'scale-110 border-ink bg-yellow shadow-hard-sm'
                  : 'border-transparent bg-card hover:border-ink/30'
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
