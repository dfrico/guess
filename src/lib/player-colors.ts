// Each player is a coloured game piece, assigned by seat. Yellow is left out
// because it marks whose turn it is. Class names are written out in full so
// Tailwind can see them.
export interface PlayerColor {
  band: string
  text: string
  token: string
}

const COLORS: PlayerColor[] = [
  { band: 'bg-blue text-white', text: 'text-blue', token: 'bg-blue' },
  { band: 'bg-orange text-white', text: 'text-orange', token: 'bg-orange' },
  { band: 'bg-green text-white', text: 'text-green', token: 'bg-green' },
  { band: 'bg-berry text-white', text: 'text-berry', token: 'bg-berry' },
  { band: 'bg-forest text-white', text: 'text-forest', token: 'bg-forest' },
]

export function playerColor(seat: number): PlayerColor {
  return COLORS[seat % COLORS.length]
}

const TILTS = ['-rotate-1', 'rotate-[0.75deg]', '-rotate-[0.5deg]', 'rotate-1', 'rotate-[0.25deg]']

export function cardTilt(seat: number): string {
  return TILTS[seat % TILTS.length]
}
