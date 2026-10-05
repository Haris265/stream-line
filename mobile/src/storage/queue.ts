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
