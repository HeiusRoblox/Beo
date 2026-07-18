import { Router, Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import {
  loadKeys,
  saveKeys,
  DURATIONS,
  deviceStatus,
  isKeyFullyExpired,
} from "../lib/keys.js";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const activeSessions = new Set<string>();

function auth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.headers["authorization"] || "").toString().replace("Bearer ", "").trim();
  if (!activeSessions.has(token)) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  next();
}

const router = Router();

router.post("/admin/login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ success: false, message: "Invalid password" });
    return;
  }
  const token = randomUUID();
  activeSessions.add(token);
  res.json({ success: true, token });
});

router.post("/admin/logout", auth, (req: Request, res: Response) => {
  const token = (req.headers["authorization"] || "").toString().replace("Bearer ", "").trim();
  activeSessions.delete(token);
  res.json({ success: true });
});

// ── List keys ────────────────────────────────────────────────────────────────
router.get("/admin/keys", auth, (_req: Request, res: Response) => {
  const keys = loadKeys();
  const now = Date.now();
  const result = keys.map((k) => ({
    key: k.key,
    typeKey: k.typeKey,
    maxDeviceIds: k.maxDeviceIds,
    deviceCount: k.deviceIds.length,
    devices: k.deviceIds.map((d) => ({
      id: d.id,
      startTime: d.startTime,
      expireTime: d.expireTime,
      status: deviceStatus(d, now),
    })),
    // true once every device slot is filled AND every one of them has expired —
    // this is the signal your separate cleanup tool can poll for before
    // calling DELETE /admin/keys/:key to remove it from keys.json.
    allDevicesExpired: isKeyFullyExpired(k, now),
  }));
  res.json({ success: true, keys: result, durationCodes: Object.keys(DURATIONS) });
});

// ── Create key ───────────────────────────────────────────────────────────────
router.post("/admin/keys", auth, (req: Request, res: Response) => {
  const { key, typeKey, maxDeviceIds } = req.body as {
    key?: string;
    typeKey?: string;
    maxDeviceIds?: number;
  };
  if (!key || !typeKey) {
    res.status(400).json({ success: false, message: "key and typeKey are required" });
    return;
  }
  if (!Object.prototype.hasOwnProperty.call(DURATIONS, typeKey)) {
    res.status(400).json({ success: false, message: `typeKey must be one of: ${Object.keys(DURATIONS).join(", ")}` });
    return;
  }
  const keys = loadKeys();
  if (keys.find((k) => k.key === key)) {
    res.status(409).json({ success: false, message: "Key already exists" });
    return;
  }
  const max = Number(maxDeviceIds) > 0 ? Number(maxDeviceIds) : 1;
  keys.push({ key, typeKey, maxDeviceIds: max, deviceIds: [] });
  saveKeys(keys);
  res.json({ success: true });
});

// ── Edit key ─────────────────────────────────────────────────────────────────
router.put("/admin/keys/:key", auth, (req: Request, res: Response) => {
  const { newKey, typeKey, maxDeviceIds, resetDevices } = req.body as {
    newKey?: string;
    typeKey?: string;
    maxDeviceIds?: number;
    resetDevices?: boolean;
  };
  if (typeKey && !Object.prototype.hasOwnProperty.call(DURATIONS, typeKey)) {
    res.status(400).json({ success: false, message: `typeKey must be one of: ${Object.keys(DURATIONS).join(", ")}` });
    return;
  }
  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.key === req.params.key);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Key not found" });
    return;
  }
  if (newKey && newKey !== req.params.key && keys.find((k) => k.key === newKey)) {
    res.status(409).json({ success: false, message: "Key name already exists" });
    return;
  }
  if (newKey) keys[idx].key = newKey;
  if (typeKey) keys[idx].typeKey = typeKey;
  if (maxDeviceIds !== undefined && Number(maxDeviceIds) > 0) keys[idx].maxDeviceIds = Number(maxDeviceIds);
  if (resetDevices) keys[idx].deviceIds = []; // wipes every device's timer, all slots free again
  saveKeys(keys);
  res.json({ success: true });
});

// ── Remove a single device from a key (frees its slot, resets that device's timer) ──
router.delete("/admin/keys/:key/devices/:deviceId", auth, (req: Request, res: Response) => {
  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.key === req.params.key);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Key not found" });
    return;
  }
  const before = keys[idx].deviceIds.length;
  keys[idx].deviceIds = keys[idx].deviceIds.filter((d) => d.id !== req.params.deviceId);
  if (keys[idx].deviceIds.length === before) {
    res.status(404).json({ success: false, message: "Device not found on this key" });
    return;
  }
  saveKeys(keys);
  res.json({ success: true });
});

// ── Delete key ───────────────────────────────────────────────────────────────
router.delete("/admin/keys/:key", auth, (req: Request, res: Response) => {
  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.key === req.params.key);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Key not found" });
    return;
  }
  keys.splice(idx, 1);
  saveKeys(keys);
  res.json({ success: true });
});

export default router;
