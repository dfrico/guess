'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { JoinForm } from '@/components/JoinForm'
import { saveProfile, saveSession, useStoredProfile } from '@/lib/identity'
import { normalizeRoomName } from '@/lib/room-name'
import { emitWithAck } from '@/lib/socket-client'
import { useSearchParam, useStartingAvatar } from '@/lib/use-search-param'

export default function JoinPage() {
  const router = useRouter()
  const profile = useStoredProfile()
  const roomParam = useSearchParam('room')
  const kicked = useSearchParam('kicked')
  const randomAvatar = useStartingAvatar()

  const [mode, setMode] = useState<'create' | 'join'>('create')
  // null until the user types, so the saved name shows by default but an
  // emptied field stays empty instead of snapping back to it.
  const [name, setName] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string>('')
  const [roomName, setRoomName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    kicked ? 'The host removed you from that room.' : null,
  )

  const [seeded, setSeeded] = useState(false)
  if (roomParam && !seeded) {
    setSeeded(true)
    setRoomName(normalizeRoomName(roomParam))
    setMode('join')
  }

  const displayName = name ?? profile?.name ?? ''
  const displayAvatar = avatar || profile?.avatar || randomAvatar

  async function submit() {
    setBusy(true)
    setError(null)
    const cleanName = displayName.trim()
    try {
      const code = normalizeRoomName(roomName)
      const result = await emitWithAck<{ code: string; token: string }>(
        mode === 'create' ? 'room:create' : 'room:join',
        { roomName: code, password, name: cleanName, avatar: displayAvatar },
      )
      if (!result.ok) {
        setError(result.error)
        return
      }
      saveProfile({ name: cleanName, avatar: displayAvatar })
      saveSession({ roomCode: result.code, token: result.token })
      router.push(`/room/${result.code}`)
    } catch {
      setError('Could not reach the server. Is it still running?')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <JoinForm
        mode={mode}
        name={displayName}
        avatar={displayAvatar}
        roomName={roomName}
        password={password}
        busy={busy}
        error={error}
        onMode={setMode}
        onName={setName}
        onAvatar={setAvatar}
        onRoomName={setRoomName}
        onPassword={setPassword}
        onSubmit={submit}
      />
    </main>
  )
}
