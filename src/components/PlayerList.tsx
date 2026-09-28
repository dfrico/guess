'use client'

import type { PlayerView } from '@/lib/types'

interface Props {
  players: PlayerView[]
  youId: string
  isHost: boolean
  onKick: (playerId: string) => void
}

export function PlayerList({ players, youId, isHost, onKick }: Props) {
  return (
    <aside className="rounded-2xl border border-edge bg-panel/70 p-3 backdrop-blur lg:sticky lg:top-4">
      <h2 className="mb-2 px-1 text-[11px] font-bold tracking-widest text-muted uppercase">
        Turn order
      </h2>
      <ol className="flex flex-wrap gap-1.5 lg:block lg:space-y-1">
        {players.map((player, index) => (
          <li key={player.id}>
            <div
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
                player.solved
                  ? 'border-good/25 bg-good/5 opacity-60'
                  : player.isTurn
                    ? 'border-accent/60 bg-accent/15'
                    : 'border-transparent bg-panel-2/50'
              }`}
            >
              <span className="w-4 shrink-0 text-center text-[11px] font-bold text-muted/70 tabular-nums">
                {index + 1}
              </span>
              <span className="text-base" aria-hidden>
                {player.avatar}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm font-semibold ${
                    player.solved ? 'text-good/90 line-through' : 'text-ink'
                  }`}
                >
                  {player.name}
                  {player.id === youId && <span className="text-muted"> (you)</span>}
                </span>
                {player.isTurn && !player.solved && (
                  <span className="block text-[10px] font-bold tracking-wider text-accent-2 uppercase">
                    asking now
                  </span>
                )}
                {!player.solved && player.guesses > 0 && (
                  <span className="block text-[10px] text-muted/80">
                    {player.guesses} wrong {player.guesses === 1 ? 'guess' : 'guesses'}
                  </span>
                )}
              </span>

              {player.solved ? (
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good/90 text-canvas">
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
                    className="shrink-0 rounded-md px-1.5 text-muted/60 transition hover:bg-bad/15 hover:text-bad"
                  >
                    ✕
                  </button>
                )
              )}

              {!player.connected && (
                <span className="h-2 w-2 shrink-0 rounded-full bg-muted/70" title="Disconnected" />
              )}
            </div>
          </li>
        ))}
      </ol>
    </aside>
  )
}
