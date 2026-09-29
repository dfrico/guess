// Each player is a coloured game piece, assigned by seat. The most distinct
// colours come first because most games have 3-5 players. Yellow is left out
// because it marks whose turn it is, and green because it means "solved".
// Class names are written out in full so Tailwind can see them.
export interface PlayerColor {
  band: string
  // The big "?" on your own card. Light colours use ink so it stays visible on cream.
  text: string
  token: string
}

const COLORS: PlayerColor[] = [
  { band: 'bg-blue text-white', text: 'text-blue', token: 'bg-blue' },
  { band: 'bg-orange text-white', text: 'text-orange', token: 'bg-orange' },
  { band: 'bg-berry text-white', text: 'text-berry', token: 'bg-berry' },
  { band: 'bg-lime text-ink', text: 'text-ink', token: 'bg-lime' },
  { band: 'bg-purple text-white', text: 'text-purple', token: 'bg-purple' },
  { band: 'bg-ochre text-white', text: 'text-ochre', token: 'bg-ochre' },
  { band: 'bg-pink text-ink', text: 'text-ink', token: 'bg-pink' },
  { band: 'bg-brown text-white', text: 'text-brown', token: 'bg-brown' },
  { band: 'bg-teal text-white', text: 'text-teal', token: 'bg-teal' },
]

export function playerColor(seat: number): PlayerColor {
  return COLORS[seat % COLORS.length]
}

const TILTS = ['-rotate-1', 'rotate-[0.75deg]', '-rotate-[0.5deg]', 'rotate-1', 'rotate-[0.25deg]']

export function cardTilt(seat: number): string {
  return TILTS[seat % TILTS.length]
}
