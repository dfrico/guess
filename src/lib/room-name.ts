export function normalizeRoomName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
}

export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s{2,}/g, ' ').slice(0, 20)
}
