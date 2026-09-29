'use client'

import { cardTilt, playerColor } from '@/lib/player-colors'
import type { PlayerView } from '@/lib/types'

interface Props {
  player: PlayerView
  seat: number
  shaking: boolean
  // The viewer's own wrong guesses. Only passed for their own card.
  wrongGuesses?: number[]
}

export function PlayerCell({ player, seat, shaking, wrongGuesses = [] }: Props) {
  const hidden = player.isYou && !player.solved && player.number === null
  const asking = player.isTurn && !player.solved
  const color = playerColor(seat)

  return (
    <div
      className={`card relative flex aspect-square flex-col overflow-hidden transition duration-300 ${
        asking ? 'animate-turn-ring z-10 -translate-y-1 scale-[1.04] rotate-0 bg-yellow-soft' : cardTilt(seat)
      } ${shaking ? 'animate-shake' : ''}`}
    >
      <div className={`flex items-center gap-1.5 border-b-2 border-ink px-3 py-2 text-sm font-bold ${color.band}`}>
        <span aria-hidden>{player.avatar}</span>
        <span className="min-w-0 truncate">{player.name}</span>
        {player.isHost && (
          <span className="ml-auto rounded-md bg-card/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-ink uppercase">
            host
          </span>
        )}
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center p-3">
        {hidden ? (
          <div className="flex h-full w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink/30">
            <span
              className={`font-display leading-none ${color.text} ${
                wrongGuesses.length > 0 ? 'text-6xl sm:text-7xl' : 'text-7xl sm:text-8xl'
              }`}
              aria-label="Your number is hidden"
            >
              ?
            </span>
            {/* Once there are wrong guesses they take the caption's place; the ? already says whose card it is. */}
            {wrongGuesses.length === 0 ? (
              <span className="mt-1 text-[11px] font-bold tracking-widest text-muted uppercase">your number</span>
            ) : (
              <span
                className="mt-1.5 flex max-w-full flex-wrap items-center justify-center gap-1 px-1.5"
                aria-label={`You already tried ${wrongGuesses.join(', ')}`}
              >
                <span className="text-[11px] font-bold text-muted" aria-hidden>
                  not
                </span>
                {[...wrongGuesses].sort((a, b) => a - b).map((value, index) => (
                  <span
                    key={index}
                    className="rounded-md border border-berry/40 bg-berry/10 px-1.5 font-display text-xs text-berry line-through decoration-2"
                    aria-hidden
                  >
                    {value}
                  </span>
                ))}
              </span>
            )}
          </div>
        ) : (
          <span
            className={`font-display text-6xl leading-none tabular-nums sm:text-7xl ${
              player.solved ? 'text-green' : 'text-ink'
            }`}
          >
            {player.number}
          </span>
        )}

        {asking && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-yellow px-2.5 py-0.5 text-[11px] font-extrabold tracking-wider text-ink uppercase shadow-hard-sm">
            asking
          </span>
        )}

        {player.solved && (
          <span className="animate-stamp absolute right-3 bottom-3 -rotate-12 rounded-md border-[3px] border-green px-2 py-0.5 font-display text-sm tracking-wider text-green uppercase opacity-90 mix-blend-multiply">
            solved
          </span>
        )}
      </div>

      {!player.connected && <OfflineBadge />}
    </div>
  )
}

function OfflineBadge() {
  return (
    <span
      className="absolute top-11 right-2.5 rounded-full border-2 border-ink bg-card px-1.5 text-[10px] font-bold text-muted"
      title="Disconnected"
    >
      away
    </span>
  )
}

export function GridLegend({ min, max }: { min: number; max: number }) {
  return (
    <p className="text-center text-sm text-muted">
      every number is between <span className="font-display text-ink">{min}</span> and{' '}
      <span className="font-display text-ink">{max}</span>
    </p>
  )
}
