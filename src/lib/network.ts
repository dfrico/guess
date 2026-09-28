import { hostname as osHostname, networkInterfaces } from 'node:os'

export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
}

export function devOriginCandidates(): string[] {
  return [...new Set([...lanAddresses(), osHostname(), `${osHostname()}.local`])]
}
