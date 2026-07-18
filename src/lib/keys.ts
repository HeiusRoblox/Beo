import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const KEYS_PATH = resolve(__dirname, "../../keys.json");

export interface DeviceEntry {
  id: string;
  /** ms epoch when this device first activated the key. null = not yet activated */
  startTime: number | null;
  /** ms epoch when this device's session expires. null = never activated, or LIFETIME key */
  expireTime: number | null;
}

export interface KeyEntry {
  key: string;
  /** duration code, see DURATIONS below */
  typeKey: string;
  maxDeviceIds: number;
  deviceIds: DeviceEntry[];
}

/** Duration each device gets, counted from the moment THAT device first logs in. null = never expires */
export const DURATIONS: Record<string, number | null> = {
  "1H": 60 * 60 * 1000,
  "24H": 24 * 60 * 60 * 1000,
  "1D": 24 * 60 * 60 * 1000,
  "7D": 7 * 24 * 60 * 60 * 1000,
  "30D": 30 * 24 * 60 * 60 * 1000,
  "365D": 365 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
  LIFETIME: null,
};

export function durationFor(typeKey: string): number | null {
  return Object.prototype.hasOwnProperty.call(DURATIONS, typeKey) ? DURATIONS[typeKey] : null;
}

export function loadKeys(): KeyEntry[] {
  if (!existsSync(KEYS_PATH)) return [];
  const raw = JSON.parse(readFileSync(KEYS_PATH, "utf-8"));
  // tolerate a single-object file as well as an array
  return Array.isArray(raw) ? raw : [raw];
}

export function saveKeys(keys: KeyEntry[]): void {
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2), "utf-8");
}

/** true once every occupied device slot on this key has expired (and all slots are filled) */
export function isKeyFullyExpired(entry: KeyEntry, now = Date.now()): boolean {
  if (entry.deviceIds.length === 0) return false;
  if (entry.deviceIds.length < entry.maxDeviceIds) return false; // still has a free slot, not "both used up"
  return entry.deviceIds.every((d) => d.expireTime !== null && now >= d.expireTime);
}

export function deviceStatus(device: DeviceEntry, now = Date.now()): "unused" | "active" | "expired" {
  if (device.startTime === null) return "unused";
  if (device.expireTime === null) return "active"; // lifetime
  return now >= device.expireTime ? "expired" : "active";
}
