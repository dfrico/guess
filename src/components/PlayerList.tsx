'use client'

import { playerColor } from '@/lib/player-colors'
import type { PlayerView } from '@/lib/types'

interface Props {
  players: PlayerView[]
  youId: string
  isHost: boolean
  onKick: (playerId: string) => void
}

export function PlayerList({ players, youId, isHost, onKick }: Props) {
  return (
    <aside className="card self-start p-3 lg:sticky lg:top-4">
      <h2 className="mb-2.5 px-1 font-display text-sm tracking-wide uppercase">Turn order</h2>
      <ol className="flex flex-wrap gap-2 lg:block lg:space-y-2">
        {players.map((player, seat) => (
          <li key={player.id}>
            <div
              className={`flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 transition ${
                player.solved
                  ? 'border-transparent bg-green/10'
                  : player.isTurn
                    ? 'border-ink bg-yellow shadow-hard-sm'
                    : 'border-transparent bg-panel-2/70'
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-ink text-base ${
                  playerColor(seat).token
                }`}
                aria-hidden
              >
                {player.avatar}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm font-bold ${
                    player.solved ? 'text-green line-through decoration-2' : 'text-ink'
                  }`}
                >
                  {player.name}
                  {player.id === youId && <span className="font-semibold text-muted"> (you)</span>}
                </span>
                {player.isTurn && !player.solved && (
                  <span className="block text-[11px] font-extrabold tracking-wider text-ink uppercase">
                    asking now
                  </span>
                )}
                {!player.solved && player.guesses > 0 && (
                  <span className="block text-[11px] font-semibold text-muted">
                    {player.guesses} wrong {player.guesses === 1 ? 'guess' : 'guesses'}
                  </span>
                )}
              </span>

              {player.solved ? (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-green text-white">
                  <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3.5}>
                    <path d="M4 10.5 8 14.5 16 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : (
                isHost &&
                player.id !== youId && (
                  <button
                    type="button"
                    onClick={() => onKick(player.id)}
                    title={`Remove ${player.name}`}
                    aria-label={`Remove ${player.name}`}
                    className="shrink-0 rounded-md px-1.5 text-muted transition hover:bg-berry/15 hover:text-berry"
                  >
                    ✕
                  </button>
                )
              )}

              {!player.connected && (
                <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-ink bg-muted/60" title="Disconnected" />
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}
