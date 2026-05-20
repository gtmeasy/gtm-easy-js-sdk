import type { GrowthEventProperties } from "./types"

/**
 * In-process debug sink. When the analytics instance was created with
 * `debug: true`, every identify / track is mirrored here BEFORE the network
 * call, and emitted on the `DebugSink` event target so a debug UI can subscribe.
 *
 * Browser console + RN `console.log` get a structured log line as well.
 */

export type DebugKind = "identify" | "track" | "attribution" | "error"

export interface DebugEvent {
  kind: DebugKind
  label: string
  properties: GrowthEventProperties
  occurredAt: string
}

type Listener = (event: DebugEvent) => void

export class GrowthDebugSink {
  private buffer: DebugEvent[] = []
  private readonly listeners = new Set<Listener>()
  private readonly maxBuffer: number

  constructor(maxBuffer = 200) {
    this.maxBuffer = maxBuffer
  }

  record(event: DebugEvent): void {
    this.buffer.push(event)
    if (this.buffer.length > this.maxBuffer) this.buffer.shift()
    for (const listener of this.listeners) {
      try { listener(event) } catch { /* swallow */ }
    }
    try {
      // eslint-disable-next-line no-console
      console.log(`[GrowthAnalytics] ${event.kind} ${event.label}`, event.properties)
    } catch { /* ignore */ }
  }

  recent(limit = 50): DebugEvent[] {
    return this.buffer.slice(-limit)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  clear(): void {
    this.buffer = []
  }
}

/** Shared default sink — convenient for apps that don't want to thread one through. */
export const defaultDebugSink = new GrowthDebugSink()
