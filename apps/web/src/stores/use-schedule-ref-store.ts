"use client";

import { create } from "zustand";
import { api, setApiBaseUrl } from "@skyhub/api";
import type { AircraftTypeRef, FlightServiceTypeRef, CityPairRef } from "@skyhub/api";

setApiBaseUrl("http://localhost:3002");

interface ScheduleRefState {
  aircraftTypes: AircraftTypeRef[];
  serviceTypes: FlightServiceTypeRef[];
  cityPairs: CityPairRef[];
  loaded: boolean;
  loading: boolean;
  loadAll: () => Promise<void>;

  /** Get block minutes for a DEP→ARR pair */
  getBlockMinutes: (dep: string, arr: string) => number | null;

  /** Get AC type options for dropdown */
  getAcTypeOptions: () => { value: string; label: string; icao: string }[];

  /** Get service type options for dropdown */
  getSvcOptions: () => { value: string; label: string }[];
}

export const useScheduleRefStore = create<ScheduleRefState>((set, get) => ({
  aircraftTypes: [],
  serviceTypes: [],
  cityPairs: [],
  loaded: false,
  loading: false,

  loadAll: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const [acTypes, svcTypes, cpPairs] = await Promise.all([
        api.getAircraftTypes(),
        api.getFlightServiceTypes(),
        api.getCityPairs(),
      ]);
      set({
        aircraftTypes: acTypes,
        serviceTypes: svcTypes,
        cityPairs: cpPairs,
        loaded: true,
      });
    } catch (e) {
      console.error("Failed to load reference data:", e);
    } finally {
      set({ loading: false });
    }
  },

  getBlockMinutes: (dep: string, arr: string) => {
    if (!dep || !arr) return null;
    const depU = dep.toUpperCase();
    const arrU = arr.toUpperCase();
    const cp = get().cityPairs.find(
      (p) =>
        (p.station1Icao === depU && p.station2Icao === arrU) ||
        (p.station2Icao === depU && p.station1Icao === arrU) ||
        (p.station1Iata === depU && p.station2Iata === arrU) ||
        (p.station2Iata === depU && p.station1Iata === arrU)
    );
    return cp?.standardBlockMinutes ?? null;
  },

  getAcTypeOptions: () =>
    get()
      .aircraftTypes.filter((t) => t.isActive)
      .map((t) => ({
        value: t._id,
        label: `${t.icaoType} — ${t.name}`,
        icao: t.icaoType,
      }))
      .sort((a, b) => a.icao.localeCompare(b.icao)),

  getSvcOptions: () =>
    get()
      .serviceTypes.filter((t) => t.isActive)
      .map((t) => ({
        value: t.code,
        label: `${t.code} — ${t.name}`,
      }))
      .sort((a, b) => a.value.localeCompare(b.value)),
}));
