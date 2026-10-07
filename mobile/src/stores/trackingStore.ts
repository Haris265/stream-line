import { create } from "zustand";

import { api } from "../api/client";
import {
  clearQueue,
  enqueueClockIn,
  enqueueClockOut,
  loadQueue,
} from "../storage/queue";
import { tokenStorage } from "../storage/tokens";
import type { Shift, User } from "../types";
import {
  haversineKm,
  kmToMiles,
  newClientUuid,
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

type Point = { latitude: number; longitude: number };

type TrackingState = {
  currentShift: Shift | null;
  localMiles: number;
  lastPoint: Point | null;
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

export const useTrackingStore = create<TrackingState>((set, get) => ({
  currentShift: null,
  localMiles: 0,
  lastPoint: null,
  busy: false,
  error: null,
  history: [],

  attachLocationHandler() {
    setLocationHandler((coords) => {
      const { lastPoint, localMiles, currentShift } = get();
      if (!currentShift || currentShift.is_on_break) return;
      let miles = localMiles;
      if (lastPoint) {
        const km = haversineKm(
          lastPoint.latitude,
          lastPoint.longitude,
          coords.latitude,
          coords.longitude
        );
        miles += kmToMiles(km);
      }
      set({
        lastPoint: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        localMiles: miles,
      });
    });
  },

  async refreshCurrent() {
    try {
      const { shift } = await api.currentShift();
      set({
        currentShift: shift,
        localMiles: shift ? Number(shift.total_miles || 0) : 0,
        lastPoint: null,
        error: null,
      });
      if (shift && !shift.is_on_break) {
        await startBackgroundTracking({
          shiftId: shift.id,
          shiftClientUuid: shift.client_uuid,
        });
      } else if (shift?.is_on_break) {
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
          error: "Location permission is required to track on-shift mileage.",
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
      set({
        currentShift: shift,
        localMiles: 0,
        lastPoint: null,
        busy: false,
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
      set({
        currentShift: null,
        localMiles: 0,
        lastPoint: null,
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
      set({ currentShift: shift, busy: false, lastPoint: null });
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
      await clearQueue();
      if (result.shifts?.[0]) {
        set({ currentShift: result.shifts[0] });
      }
      if (result.clock_outs?.length) {
        set({ currentShift: null });
      }
    } catch {
      // keep queue for next attempt
    }
  },
}));
