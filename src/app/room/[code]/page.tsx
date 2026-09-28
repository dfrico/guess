import { normalizeRoomName } from '@/lib/room-name'
import { RoomScreen } from '@/components/RoomScreen'

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <RoomScreen code={normalizeRoomName(code)} />
}
