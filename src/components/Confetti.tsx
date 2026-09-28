'use client'

import { useEffect, useMemo, useState } from 'react'

const COLORS = ['#7c5cff', '#22d3ee', '#f472b6', '#facc15', '#34d399', '#fb923c', '#a78bfa']

const POOL_SIZE = 320
const VISIBLE_COUNT = 44

const POOL = Array.from({ length: POOL_SIZE }, (_, i) => ({
  key: i,
  left: (i * 37.7) % 100,
  drift: ((i * 53) % 160) - 80,
  spin: (((i * 71) % 720) - 360) * 3,
  delay: ((i * 29) % 50) / 100,
  size: 6 + ((i * 17) % 8),
  color: COLORS[i % COLORS.length],
}))

export function Confetti({ trigger }: { trigger: number | null }) {
  const [cleared, setCleared] = useState<number | null>(null)

  const offset = useMemo(() => (trigger ?? 0) % POOL_SIZE, [trigger])
  const pieces = useMemo(() => {
    if (trigger == null) return []
    return Array.from({ length: VISIBLE_COUNT }, (_, i) => {
      const piece = POOL[(offset + i * 7) % POOL_SIZE]
      return { ...piece, key: `${trigger}-${piece.key}` }
    })
  }, [trigger, offset])

  useEffect(() => {
    if (trigger == null) return
    const timer = setTimeout(() => setCleared(trigger), 3400)
    return () => clearTimeout(timer)
  }, [trigger])

  if (trigger == null || cleared === trigger) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((piece) => (
        <span
          key={piece.key}
          className="animate-drift absolute top-0 rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 1.6,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            ['--drift' as string]: `${piece.drift}px`,
            ['--spin' as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  )
}
