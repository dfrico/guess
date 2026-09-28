const NAME = 'guess'

type Labels = Record<string, string>

function escapeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"')
}

function formatLabels(labels: Labels): string {
  const entries = Object.entries(labels)
  if (entries.length === 0) return ''
  const body = entries
    .map(([key, value]) => `${key}="${escapeValue(value)}"`)
    .join(',')
  return `{${body}}`
}

interface Sample {
  labels: Labels
  value: number
}

class Counter {
  private samples = new Map<string, Sample>()

  constructor(
    private name: string,
    private help: string,
  ) {}

  increment(labels: Labels = {}, amount = 1): void {
    const key = JSON.stringify(labels)
    const existing = this.samples.get(key)
    if (existing) existing.value += amount
    else this.samples.set(key, { labels, value: amount })
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`]
    for (const { labels, value } of this.samples.values()) {
      lines.push(`${this.name}${formatLabels(labels)} ${value}`)
    }
    return lines.join('\n')
  }

  reset(): void {
    this.samples.clear()
  }
}

class Gauge {
  collect: () => number

  constructor(
    private name: string,
    private help: string,
    collect: () => number,
  ) {
    this.collect = collect
  }

  render(): string {
    const lines = [
      `# HELP ${this.name} ${this.help}`,
      `# TYPE ${this.name} gauge`,
      `${this.name} ${this.collect()}`,
    ]
    return lines.join('\n')
  }
}

class Histogram {
  private buckets: number[]
  private counts: number[] = []
  private sum = 0
  private total = 0

  constructor(
    private name: string,
    private help: string,
    buckets: number[],
  ) {
    this.buckets = [...buckets].sort((a, b) => a - b)
    this.counts = new Array(this.buckets.length).fill(0)
  }

  observe(value: number): void {
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) this.counts[i]++
    }
    this.sum += value
    this.total++
  }

  render(): string {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`]
    for (let i = 0; i < this.buckets.length; i++) {
      const labels = formatLabels({ le: String(this.buckets[i]) })
      lines.push(`${this.name}_bucket${labels} ${this.counts[i]}`)
    }
    lines.push(`${this.name}_bucket${formatLabels({ le: '+Inf' })} ${this.total}`)
    lines.push(`${this.name}_sum ${this.sum}`)
    lines.push(`${this.name}_count ${this.total}`)
    return lines.join('\n')
  }

  reset(): void {
    this.counts = new Array(this.buckets.length).fill(0)
    this.sum = 0
    this.total = 0
  }
}

export const gameDuration = new Histogram(
  `${NAME}_game_duration_seconds`,
  'Wall-clock seconds from the first guess to the game finishing.',
  [60, 180, 300, 600, 1200, 1800, 3600],
)

export const socketEvents = new Counter(
  `${NAME}_socket_events_total`,
  'Socket events handled, labelled by event and outcome.',
)

export const socketErrors = new Counter(
  `${NAME}_socket_errors_total`,
  'Socket handlers that threw, labelled by event.',
)

export const roomsCreated = new Counter(
  `${NAME}_rooms_created_total`,
  'Rooms created.',
)

export const roomsSwept = new Counter(
  `${NAME}_rooms_swept_total`,
  'Rooms removed by the idle sweeper.',
)

export const roomsEnded = new Counter(
  `${NAME}_rooms_ended_total`,
  'Games that reached the finished phase, labelled by how they got there.',
)

export const reconnects = new Counter(
  `${NAME}_reconnects_total`,
  'room:resume calls, split by whether the session was still valid.',
)

export const roomsActive = new Gauge(
  `${NAME}_rooms_active`,
  'Rooms currently held in memory.',
  () => 0,
)

export const playersConnected = new Gauge(
  `${NAME}_players_connected`,
  'Socket connections currently open.',
  () => 0,
)

export const playersInRooms = new Gauge(
  `${NAME}_players_in_rooms`,
  'Players across all live rooms, connected or not.',
  () => 0,
)

type Registerable = Gauge | Counter | Histogram
const registry: Registerable[] = []

export function register(...metrics: Registerable[]): void {
  for (const metric of metrics) {
    if (!registry.includes(metric)) registry.push(metric)
  }
}

export function setGaugeSource(metric: Gauge, collect: () => number): void {
  metric.collect = collect
}

export function reset(): void {
  for (const metric of registry) {
    if (metric instanceof Counter) metric.reset()
    if (metric instanceof Histogram) metric.reset()
  }
}

export function render(): string {
  return `${registry.map((metric) => metric.render()).join('\n')}\n`
}
