import AsyncStorage from "@react-native-async-storage/async-storage";

import type { QueuedClockIn, QueuedClockOut, QueuedPing } from "../types";

const QUEUE_KEY = "sync_queue_v1";

export type SyncQueue = {
  clock_ins: QueuedClockIn[];
  clock_outs: QueuedClockOut[];
  pings: QueuedPing[];
};

const emptyQueue = (): SyncQueue => ({
  clock_ins: [],
  clock_outs: [],
  pings: [],
});

export async function loadQueue(): Promise<SyncQueue> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return emptyQueue();
  try {
    return { ...emptyQueue(), ...JSON.parse(raw) };
  } catch {
    return emptyQueue();
  }
}

export async function saveQueue(queue: SyncQueue) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueClockIn(item: QueuedClockIn) {
  const q = await loadQueue();
  q.clock_ins.push(item);
  await saveQueue(q);
}

export async function enqueueClockOut(item: QueuedClockOut) {
  const q = await loadQueue();
  q.clock_outs.push(item);
  await saveQueue(q);
}

export async function enqueuePing(item: QueuedPing) {
  const q = await loadQueue();
  q.pings.push(item);
  await saveQueue(q);
}

export async function clearQueue() {
  await saveQueue(emptyQueue());
}

/** Remove only acknowledged items; keep anything the server did not accept. */
export async function applySyncAck(ack: {
  clock_in_uuids?: string[];
  clock_out_uuids?: string[];
  ping_uuids?: string[];
  /** When true, clear all clock_ins that were sent (legacy servers). */
  clear_all_clock_ins?: boolean;
  clear_all_clock_outs?: boolean;
}): Promise<void> {
  const q = await loadQueue();
  const pingSet = new Set((ack.ping_uuids || []).map(String));
  const clockInSet = new Set((ack.clock_in_uuids || []).map(String));
  const clockOutSet = new Set((ack.clock_out_uuids || []).map(String));

  if (ack.clear_all_clock_ins) {
    q.clock_ins = [];
  } else if (clockInSet.size) {
    q.clock_ins = q.clock_ins.filter(
      (c) => !clockInSet.has(String(c.client_uuid))
    );
  }

  if (ack.clear_all_clock_outs) {
    q.clock_outs = [];
  } else if (clockOutSet.size) {
    q.clock_outs = q.clock_outs.filter((c) => {
      const key = c.client_uuid ? String(c.client_uuid) : "";
      if (key && clockOutSet.has(key)) return false;
      if (c.shift_id != null && clockOutSet.has(`shift:${c.shift_id}`)) {
        return false;
      }
      return true;
    });
  }

  if (pingSet.size) {
    q.pings = q.pings.filter((p) => !pingSet.has(String(p.client_uuid)));
  }

  await saveQueue(q);
}
