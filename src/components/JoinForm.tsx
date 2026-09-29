import { normalizeRoomName } from '@/lib/room-name'
import { AvatarPicker } from '@/components/AvatarPicker'

interface Props {
  mode: 'create' | 'join'
  roomName: string
  password: string
  name: string
  avatar: string
  onRoomName: (value: string) => void
  onPassword: (value: string) => void
  onName: (value: string) => void
  onAvatar: (value: string) => void
  onMode: (value: 'create' | 'join') => void
  onSubmit: () => void
  busy: boolean
  error: string | null
}

// Each letter of "Guess" is a different game piece, like a box-lid logo.
const TITLE = [
  { letter: 'G', className: 'text-orange -rotate-6' },
  { letter: 'u', className: 'text-blue rotate-3' },
  { letter: 'e', className: 'text-green -rotate-2' },
  { letter: 's', className: 'text-berry rotate-6' },
  { letter: 's', className: 'text-yellow -rotate-3' },
]

export function JoinForm({
  mode,
  roomName,
  password,
  name,
  avatar,
  onRoomName,
  onPassword,
  onName,
  onAvatar,
  onMode,
  onSubmit,
  busy,
  error,
}: Props) {
  const code = normalizeRoomName(roomName)
  const missing = !name.trim() ? 'your name' : !code ? 'a room name' : !password ? 'a room password' : null

  return (
    <form
      className="w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="mb-8 text-center">
        <h1 className="font-display leading-none">
          <span className="inline-flex text-6xl [text-shadow:3px_3px_0_var(--color-ink)] sm:text-7xl" aria-label="Guess">
            {TITLE.map(({ letter, className }, index) => (
              <span key={index} className={`inline-block ${className}`} aria-hidden>
                {letter}
              </span>
            ))}
          </span>
          <span className="mt-1 block text-3xl text-ink sm:text-4xl">My Number</span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm font-medium text-muted">
          Everyone sees every number but their own. Ask questions, narrow it down, call it.
        </p>
      </div>

      <div className="card mb-5 flex rounded-2xl p-1.5 shadow-hard-sm">
        {(['create', 'join'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onMode(option)}
            data-active={mode === option}
            className={`flex-1 rounded-xl border-2 px-4 py-2 text-sm font-bold transition ${
              mode === option ? 'border-ink bg-blue text-white' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {option === 'create' ? 'Start a room' : 'Join a room'}
          </button>
        ))}
      </div>

      <div className="card space-y-4 p-5 shadow-hard-lg">
        <div>
          <label htmlFor="name" className="label">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => onName(event.target.value)}
            placeholder="Dana"
            maxLength={20}
            autoComplete="off"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="room" className="label">
            Room name
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-bold text-muted">/</span>
            <input
              id="room"
              value={roomName}
              onChange={(event) => onRoomName(event.target.value)}
              placeholder={mode === 'create' ? 'fridays-game' : 'which room?'}
              maxLength={24}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="field pl-8"
            />
          </div>
          {code.length > 0 && (
            <p className="mt-1.5 text-xs font-semibold text-muted">
              room: <span className="font-display text-blue">{code}</span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="label">
            Room password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => onPassword(event.target.value)}
            placeholder="shared secret"
            autoComplete="off"
            className="field"
          />
        </div>

        <AvatarPicker value={avatar} onChange={onAvatar} />

        {error && (
          <p className="animate-rise rounded-xl border-2 border-berry bg-berry/10 px-4 py-2.5 text-sm font-semibold text-berry">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || missing !== null}
          className="btn btn-primary w-full px-4 py-3.5 text-lg"
        >
          {busy ? 'Opening…' : mode === 'create' ? 'Create room' : 'Enter room'}
        </button>
        {missing && !busy && <p className="-mt-1 text-center text-xs font-semibold text-muted">Add {missing} to continue.</p>}
      </div>

      <p className="mt-6 text-center text-xs font-medium text-muted">
        Talk to each other on Discord — this app just tracks the numbers and the turns.
      </p>
    </form>
  )
}
