import { create } from "zustand";

import { api } from "../api/client";
import {
  applySyncAck,
  enqueueClockIn,
  enqueueClockOut,
  loadQueue,
} from "../storage/queue";
import {
  clearShiftMilesProgress,
  loadMilesForShift,
  saveShiftMilesProgress,
} from "../storage/shiftMiles";
import { tokenStorage } from "../storage/tokens";
import type { Shift, User } from "../types";
import {
  haversineKm,
  isUsableGpsFix,
  kmToMiles,
  LOCATION_DISTANCE_INTERVAL_M,
  newClientUuid,
  shouldAcceptSegment,
} from "../tracking/constants";
import {
  requestTrackingPermissions,
  setLocationHandler,
  startBackgroundTracking,
  stopBackgroundTracking,
} from "../tracking/locationService";

type AuthState = {
  user: User | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  async hydrate() {
    try {
      const access = await tokenStorage.getAccess();
      if (!access) {
        set({ user: null, loading: false });
        return;
      }
      const user = await api.me();
      set({ user, loading: false });
    } catch {
      await tokenStorage.clear();
      set({ user: null, loading: false });
    }
  },
  async login(email, password) {
    const res = await api.login(email.trim().toLowerCase(), password);
    await tokenStorage.setTokens(res.access, res.refresh);
    set({ user: res.user });
  },
  async register(payload) {
    const res = await api.register({
      ...payload,
      email: payload.email.trim().toLowerCase(),
      first_name: payload.first_name.trim(),
      last_name: payload.last_name.trim(),
      phone: payload.phone?.trim() || undefined,
    });
    await tokenStorage.setTokens(res.access, res.refresh);
    set({ user: res.user });
  },
  async logout() {
    await stopBackgroundTracking();
    await tokenStorage.clear();
    set({ user: null });
  },
  async deleteAccount() {
    await api.deleteAccount();
    await stopBackgroundTracking();
    await tokenStorage.clear();
    set({ user: null });
  },
}));

type Point = { latitude: number; longitude: number; recordedAtMs?: number };

type TrackingState = {
  currentShift: Shift | null;
  localMiles: number;
  /** First valid GPS lock after clock-in; null until then (miles stay 0). */
  initialLocation: Point | null;
  /** Previous accepted fix used for segment distance. */
  lastPoint: Point | null;
  /** Epoch ms when location last moved enough (~25 m or driving miles). */
  lastMovedAt: number | null;
  busy: boolean;
  error: string | null;
  history: Shift[];
  refreshCurrent: () => Promise<void>;
  loadHistory: () => Promise<void>;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  startBreak: () => Promise<void>;
  endBreak: () => Promise<void>;
  flushSync: () => Promise<void>;
  attachLocationHandler: () => void;
};

function persistMilesState(
  get: () => TrackingState,
  override?: Partial<{
    localMiles: number;
    lastPoint: Point | null;
    initialLocation: Point | null;
    lastMovedAt: number | null;
  }>
) {
  const state = get();
  const shift = state.currentShift;
  if (!shift) return;
  const localMiles = override?.localMiles ?? state.localMiles;
  const lastPoint =
    override && "lastPoint" in override ? override.lastPoint! : state.lastPoint;
  const initialLocation =
    override && "initialLocation" in override
      ? override.initialLocation!
      : state.initialLocation;
  const lastMovedAt =
    override && "lastMovedAt" in override
      ? override.lastMovedAt!
      : state.lastMovedAt;
  void saveShiftMilesProgress({
    shiftId: shift.id || undefined,
    shiftClientUuid: shift.client_uuid,
    localMiles,
    lastMovedAt,
    lastPoint,
    initialLocation,
  });
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  currentShift: null,
  localMiles: 0,
  initialLocation: null,
  lastPoint: null,
  lastMovedAt: null,
  busy: false,
  error: null,
  history: [],

  attachLocationHandler() {
    setLocationHandler((coords) => {
      const {
        lastPoint,
        localMiles,
        initialLocation,
        lastMovedAt,
        currentShift,
      } = get();
      if (!currentShift || currentShift.is_on_break) return;

      if (
        !isUsableGpsFix({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        })
      ) {
        return;
      }

      const nextPoint: Point = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        recordedAtMs: Date.parse(coords.recorded_at) || Date.now(),
      };

      // Wait for a valid initial GPS lock before any distance math.
      if (!initialLocation) {
        // Keep any already-hydrated miles (e.g. after background resume).
        set({
          initialLocation: nextPoint,
          lastPoint: nextPoint,
        });
        persistMilesState(get, {
          lastPoint: nextPoint,
          initialLocation: nextPoint,
        });
        return;
      }

      // Need both previous and current before haversine.
      if (!lastPoint) {
        set({ lastPoint: nextPoint });
        persistMilesState(get, { lastPoint: nextPoint });
        return;
      }

      const segment = shouldAcceptSegment(lastPoint, nextPoint, {
        accuracy: coords.accuracy,
        speed: coords.speed,
        prevRecordedAtMs: lastPoint.recordedAtMs,
        nextRecordedAtMs: nextPoint.recordedAtMs,
      });

      if (!segment.acceptPoint) {
        return;
      }

      const nextMiles = localMiles + kmToMiles(segment.addDistanceKm);
      const fromInitialM =
        haversineKm(
          initialLocation.latitude,
          initialLocation.longitude,
          nextPoint.latitude,
          nextPoint.longitude
        ) * 1000;
      const movedEnough =
        segment.addDistanceKm > 0 ||
        fromInitialM >= LOCATION_DISTANCE_INTERVAL_M;
      const nextMovedAt = movedEnough
        ? nextPoint.recordedAtMs ?? Date.now()
        : lastMovedAt;

      set({
        lastPoint: nextPoint,
        localMiles: nextMiles,
        lastMovedAt: nextMovedAt,
      });
      persistMilesState(get, {
        localMiles: nextMiles,
        lastPoint: nextPoint,
        lastMovedAt: nextMovedAt,
      });
    });
  },

  async refreshCurrent() {
    try {
      const { shift } = await api.currentShift();
      const prev = get();
      const sameOpenShift =
        Boolean(shift) &&
        Boolean(prev.currentShift) &&
        (shift!.id === prev.currentShift!.id ||
          (Boolean(shift!.client_uuid) &&
            shift!.client_uuid === prev.currentShift!.client_uuid));

      const serverMiles = shift ? Number(shift.total_miles || 0) : 0;
      const stored = shift
        ? await loadMilesForShift({
            id: shift.id,
            client_uuid: shift.client_uuid,
          })
        : null;

      const localMiles = Math.max(
        sameOpenShift ? prev.localMiles : 0,
        serverMiles,
        stored?.localMiles ?? 0
      );

      const lastPoint =
        (sameOpenShift ? prev.lastPoint : null) ??
        stored?.lastPoint ??
        null;
      const initialLocation =
        (sameOpenShift ? prev.initialLocation : null) ??
        stored?.initialLocation ??
        null;
      const lastMovedAt =
        (sameOpenShift ? prev.lastMovedAt : null) ??
        (typeof stored?.lastMovedAt === "number" ? stored.lastMovedAt : null);

      set({
        currentShift: shift,
        localMiles,
        lastPoint,
        initialLocation,
        lastMovedAt,
        error: null,
      });

      if (shift) {
        void saveShiftMilesProgress({
          shiftId: shift.id || undefined,
          shiftClientUuid: shift.client_uuid,
          localMiles,
          lastMovedAt,
          lastPoint,
          initialLocation,
        });
      } else {
        await clearShiftMilesProgress();
      }

      if (shift && !shift.is_on_break) {
        await startBackgroundTracking({
          shiftId: shift.id,
          shiftClientUuid: shift.client_uuid,
        });
      } else if (shift?.is_on_break) {
        await stopBackgroundTracking();
      } else if (!shift) {
        await stopBackgroundTracking();
      }
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load shift" });
    }
  },

  async loadHistory() {
    try {
      const history = await api.listShifts();
      set({ history });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load history" });
    }
  },

  async clockIn() {
    set({ busy: true, error: null });
    const client_uuid = newClientUuid();
    const clock_in = new Date().toISOString();
    try {
      const ok = await requestTrackingPermissions();
      if (!ok) {
        set({
          busy: false,
          error:
            "Always-on location permission is required to track mileage while clocked in.",
        });
        return;
      }
      let shift: Shift;
      try {
        shift = await api.clockIn({ client_uuid, clock_in });
      } catch {
        await enqueueClockIn({ client_uuid, clock_in });
        shift = {
          id: 0,
          user: 0,
          clock_in,
          clock_out: null,
          total_hours: null,
          total_distance_km: 0,
          total_miles: 0,
          live_hours: 0,
          is_open: true,
          is_on_break: false,
          total_break_minutes: 0,
          client_uuid,
        };
      }
      await clearShiftMilesProgress();
      set({
        currentShift: shift,
        localMiles: 0,
        initialLocation: null,
        lastPoint: null,
        lastMovedAt: null,
        busy: false,
      });
      void saveShiftMilesProgress({
        shiftId: shift.id || undefined,
        shiftClientUuid: shift.client_uuid,
        localMiles: 0,
        lastMovedAt: null,
        lastPoint: null,
        initialLocation: null,
      });
      await startBackgroundTracking({
        shiftId: shift.id || undefined,
        shiftClientUuid: shift.client_uuid,
      });
      get().attachLocationHandler();
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "Clock-in failed",
      });
    }
  },

  async clockOut() {
    const { currentShift } = get();
    if (!currentShift) return;
    set({ busy: true, error: null });
    const clock_out = new Date().toISOString();
    try {
      await get().flushSync();
      let closed: Shift | null = null;
      if (currentShift.id) {
        try {
          closed = await api.clockOut(currentShift.id, clock_out);
        } catch {
          await enqueueClockOut({
            shift_id: currentShift.id,
            client_uuid: currentShift.client_uuid,
            clock_out,
          });
        }
      } else {
        await enqueueClockOut({
          client_uuid: currentShift.client_uuid,
          clock_out,
        });
      }
      await stopBackgroundTracking();
      await clearShiftMilesProgress();
      set({
        currentShift: null,
        localMiles: 0,
        initialLocation: null,
        lastPoint: null,
        lastMovedAt: null,
        busy: false,
      });
      if (closed) {
        await get().loadHistory();
      }
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "Clock-out failed",
      });
    }
  },

  async startBreak() {
    const { currentShift } = get();
    if (!currentShift?.id) return;
    set({ busy: true, error: null });
    try {
      await stopBackgroundTracking();
      const shift = await api.startBreak(currentShift.id);
      set({ currentShift: shift, busy: false });
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "Could not start break",
      });
    }
  },

  async endBreak() {
    const { currentShift } = get();
    if (!currentShift?.id) return;
    set({ busy: true, error: null });
    try {
      const shift = await api.endBreak(currentShift.id);
      // Re-lock GPS after break; do not carry lastPoint across the pause.
      set({
        currentShift: shift,
        busy: false,
        lastPoint: null,
        initialLocation: null,
        lastMovedAt: null,
      });
      await startBackgroundTracking({
        shiftId: shift.id,
        shiftClientUuid: shift.client_uuid,
      });
      get().attachLocationHandler();
    } catch (e) {
      set({
        busy: false,
        error: e instanceof Error ? e.message : "Could not end break",
      });
    }
  },

  async flushSync() {
    const queue = await loadQueue();
    if (
      !queue.clock_ins.length &&
      !queue.clock_outs.length &&
      !queue.pings.length
    ) {
      return;
    }
    try {
      const result = await api.syncBatch(queue);
      await applySyncAck({
        clock_in_uuids: result.accepted_clock_in_uuids,
        clock_out_uuids: result.accepted_clock_out_uuids,
        ping_uuids: result.accepted_ping_uuids,
        // Legacy servers without ack fields: clear only what we know succeeded.
        clear_all_clock_ins:
          !result.accepted_clock_in_uuids && Boolean(result.shifts?.length),
        clear_all_clock_outs:
          !result.accepted_clock_out_uuids &&
          Boolean(result.clock_outs?.length),
      });

      // If server has no ack fields, fall back: dequeue pings only when created
      // count matches sent (best-effort) — otherwise keep them.
      if (!result.accepted_ping_uuids && result.pings_created > 0) {
        const sent = queue.pings.map((p) => p.client_uuid);
        await applySyncAck({
          ping_uuids: sent.slice(0, result.pings_created),
        });
      }

      const updatedShift = result.shift ?? result.shifts?.[0] ?? null;
      if (result.clock_outs?.length) {
        await stopBackgroundTracking();
        await clearShiftMilesProgress();
        set({
          currentShift: null,
          localMiles: 0,
          initialLocation: null,
          lastPoint: null,
          lastMovedAt: null,
        });
      } else if (updatedShift) {
        const prev = get();
        const serverMiles = Number(updatedShift.total_miles || 0);
        const localMiles = Math.max(prev.localMiles, serverMiles);
        set({
          currentShift: updatedShift,
          localMiles,
        });
        void saveShiftMilesProgress({
          shiftId: updatedShift.id || undefined,
          shiftClientUuid: updatedShift.client_uuid,
          localMiles,
          lastMovedAt: prev.lastMovedAt,
          lastPoint: prev.lastPoint,
          initialLocation: prev.initialLocation,
        });
        if (updatedShift.is_open && !updatedShift.is_on_break) {
          await startBackgroundTracking({
            shiftId: updatedShift.id,
            shiftClientUuid: updatedShift.client_uuid,
          });
        }
      }
    } catch {
      // keep queue for next attempt
    }
  },
}));
