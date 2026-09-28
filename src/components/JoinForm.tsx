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

const field =
  'w-full rounded-xl border border-edge bg-panel-2/70 px-4 py-3 text-ink placeholder:text-muted/60 outline-none transition focus:border-accent focus:bg-panel-2'

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

  return (
    <form
      className="w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-accent via-fuchsia-400 to-accent-2 bg-clip-text text-transparent">
            Guess
          </span>{' '}
          <span className="text-ink/90">My Number</span>
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
          Everyone sees every number but their own. Ask questions, narrow it down, call it.
        </p>
      </div>

      <div className="mb-5 flex rounded-xl border border-edge bg-panel/60 p-1">
        {(['create', 'join'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onMode(option)}
            data-active={mode === option}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === option ? 'bg-accent text-white shadow-lg shadow-accent/25' : 'text-muted hover:text-ink'
            }`}
          >
            {option === 'create' ? 'Start a room' : 'Join a room'}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-2xl border border-edge bg-panel/70 p-5 shadow-2xl shadow-black/40 backdrop-blur">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(event) => onName(event.target.value)}
            placeholder="Dana"
            maxLength={20}
            autoComplete="off"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="room" className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
            Room name
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">/</span>
            <input
              id="room"
              value={roomName}
              onChange={(event) => onRoomName(event.target.value)}
              placeholder={mode === 'create' ? 'fridays-game' : 'which room?'}
              maxLength={24}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={`${field} pl-8`}
            />
          </div>
          {code.length > 0 && (
            <p className="mt-1.5 text-xs text-muted">
              room: <span className="font-mono text-accent-2">{code}</span>
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium tracking-wide text-muted uppercase">
            Room password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => onPassword(event.target.value)}
            placeholder="shared secret"
            autoComplete="off"
            className={field}
          />
        </div>

        <AvatarPicker value={avatar} onChange={onAvatar} />

        {error && (
          <p className="animate-rise rounded-xl border border-bad/40 bg-bad/10 px-4 py-2.5 text-sm text-bad">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !name.trim() || !code || !password}
          className="w-full rounded-xl bg-accent px-4 py-3.5 font-bold text-white shadow-lg shadow-accent/25 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? 'Opening…' : mode === 'create' ? 'Create room' : 'Enter room'}
        </button>
      </div>

      <p className="mt-6 text-center text-xs text-muted/80">
        Talk to each other on Discord — this app just tracks the numbers and the turns.
      </p>
    </form>
  )
}
