/**
 * Dance Factory - Canonical Cross-Device & Tab Event Bus
 * Synchronizes crm-app and student-app across browser tabs and physical devices.
 * 
 * Transport Layers:
 * 1. Window CustomEvent (Same Tab DOM)
 * 2. BroadcastChannel("dance_factory_sync") (Same Machine Cross-Tab)
 * 3. Supabase Realtime Broadcast "public:realtime_sync" (Cross-Device Cloud Sync)
 */

import { supabase } from "@/lib/supabase/client";

export type SyncEventType =
  | "df_reservas_updated"
  | "df_pagos_updated"
  | "df_checkin_success"
  | "df_pending_bonos_updated"
  | "df_checkin_denied"
  | string;

export interface SyncEventPayload<T = any> {
  type: string;
  detail: T;
  eventId: string;
  senderId: string;
  timestamp: number;
}

// Generate unique persistent instance ID for current browser tab session
const CLIENT_INSTANCE_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "client_" + Math.random().toString(36).slice(2, 11) + "_" + Date.now();

export const BROADCAST_CHANNEL_NAME = "dance_factory_sync";
export const REALTIME_CHANNEL_NAME = "public:realtime_sync";
export const DEDUP_TTL_MS = 10000;

class SyncEventBusManager {
  private broadcastChannel: BroadcastChannel | null = null;
  private realtimeChannel: any = null;
  private recentEventIds: Map<string, number> = new Map();
  private cleanupInterval: any = null;
  private isInitialized = false;

  constructor() {
    this.init();
  }

  public init(): void {
    if (this.isInitialized || typeof window === "undefined") return;
    this.isInitialized = true;

    // 1. Initialize BroadcastChannel (Tier 2: Same-machine cross-tab)
    if (typeof BroadcastChannel !== "undefined") {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingMessage(event.data, "broadcast_channel");
        };
      } catch (e) {
        console.warn("[SyncEventBus] BroadcastChannel not supported in this context:", e);
      }
    }

    // 2. Initialize Supabase Realtime Channel (Tier 3: Multi-device cloud sync)
    try {
      if (supabase && typeof supabase.channel === "function") {
        this.realtimeChannel = supabase.channel(REALTIME_CHANNEL_NAME, {
          config: {
            broadcast: {
              ack: false,
              self: false // Server ignores sending broadcast back to sender socket
            }
          }
        });

        this.realtimeChannel
          .on("broadcast", { event: "sync_event" }, (payload: any) => {
            if (payload && payload.payload) {
              this.handleIncomingMessage(payload.payload, "supabase_realtime");
            }
          })
          .subscribe((status: string, err: any) => {
            if (status === "CHANNEL_ERROR") {
              console.warn("[SyncEventBus] Supabase Realtime channel error:", err);
            }
          });
      }
    } catch (e) {
      console.warn("[SyncEventBus] Failed to initialize Supabase Realtime:", e);
    }

    // 3. Prune deduplication cache periodically
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, time] of this.recentEventIds.entries()) {
        if (now - time > DEDUP_TTL_MS) {
          this.recentEventIds.delete(id);
        }
      }
    }, 30000);
  }

  private handleIncomingMessage(msg: any, source: string): void {
    if (!msg || !msg.type || !msg.eventId) return;

    // Discard messages originating from this exact client tab
    if (msg.senderId === CLIENT_INSTANCE_ID) return;

    // Discard duplicates already processed within TTL window
    if (this.recentEventIds.has(msg.eventId)) return;

    // Record event in dedup cache
    this.recentEventIds.set(msg.eventId, Date.now());

    // Dispatch locally as CustomEvent on window so local listeners react
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent(msg.type, {
          detail: msg.detail
        }));
      } catch (e) {
        console.warn(`[SyncEventBus] Error dispatching local event ${msg.type}:`, e);
      }
    }
  }

  public async publish<T = any>(type: SyncEventType, detail: T = {} as T): Promise<void> {
    const eventId = `${CLIENT_INSTANCE_ID}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const payload: SyncEventPayload<T> = {
      type,
      detail,
      eventId,
      senderId: CLIENT_INSTANCE_ID,
      timestamp: Date.now()
    };

    // 1. Record in own dedup cache so echoes are ignored
    this.recentEventIds.set(eventId, Date.now());

    // 2. Local DOM CustomEvent (Tier 1)
    if (typeof window !== "undefined") {
      try {
        window.dispatchEvent(new CustomEvent(type, { detail }));
      } catch (e) {
        console.warn(`[SyncEventBus] Local dispatch error for ${type}:`, e);
      }
    }

    // 3. Cross-Tab BroadcastChannel (Tier 2)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch (e) {
        console.warn(`[SyncEventBus] BroadcastChannel send error:`, e);
      }
    }

    // 4. Supabase Realtime Broadcast (Tier 3)
    if (this.realtimeChannel) {
      try {
        await this.realtimeChannel.send({
          type: "broadcast",
          event: "sync_event",
          payload
        });
      } catch (e) {
        // Non-blocking: network failure in realtime does not break local app state
        console.warn(`[SyncEventBus] Supabase Realtime send error:`, e);
      }
    }
  }

  public subscribe(
    types: SyncEventType | SyncEventType[],
    callback: (detail: any, type: SyncEventType) => void
  ): () => void {
    if (typeof window === "undefined") return () => {};

    const typeArray = Array.isArray(types) ? types : [types];
    const listeners: Array<{ type: string; handler: (e: any) => void }> = [];

    for (const t of typeArray) {
      const handler = (e: any) => {
        const detail = e && e.detail !== undefined ? e.detail : e;
        callback(detail, t);
      };
      window.addEventListener(t, handler);
      listeners.push({ type: t, handler });
    }

    return () => {
      for (const { type, handler } of listeners) {
        window.removeEventListener(type, handler);
      }
    };
  }

  public destroy(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.broadcastChannel) {
      try { this.broadcastChannel.close(); } catch {}
      this.broadcastChannel = null;
    }
    if (this.realtimeChannel) {
      try { supabase.removeChannel(this.realtimeChannel); } catch {}
      this.realtimeChannel = null;
    }
    this.isInitialized = false;
  }
}

// Global Singleton Instance
export const syncBus = new SyncEventBusManager();

/**
 * Convenient helper to publish an event across tabs and devices
 */
export function publishSyncEvent<T = any>(type: SyncEventType, payload?: T): Promise<void> {
  return syncBus.publish(type, payload);
}

/**
 * Convenient helper to subscribe to an event across tabs and devices
 */
export function subscribeSyncEvent(
  types: SyncEventType | SyncEventType[],
  handler: (payload: any, type: SyncEventType) => void
): () => void {
  return syncBus.subscribe(types, handler);
}

/**
 * React Hook for subscribing to sync events with automatic cleanup on unmount
 */
export function useSyncEvent(
  types: SyncEventType | SyncEventType[],
  callback: (detail: any, type: SyncEventType) => void,
  deps: any[] = []
): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useEffect, useRef } = require("react");
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = syncBus.subscribe(types, (detail, type) => {
      if (callbackRef.current) {
        callbackRef.current(detail, type);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
