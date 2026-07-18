import { Router } from "express";
import { loadKeys, saveKeys, durationFor, deviceStatus, type DeviceEntry } from "../lib/keys.js";

const router = Router();

router.post("/login", (req, res) => {
  const { apiKey, deviceId } = req.body as { apiKey?: string; deviceId?: string };

  if (!apiKey || !deviceId) {
    res.status(400).json({ success: false, message: "apiKey và deviceId là bắt buộc" });
    return;
  }

  const keys = loadKeys();
  const entry = keys.find((k) => k.key === apiKey);

  if (!entry) {
    res.json({ success: false, message: "Key không tồn tại" });
    return;
  }

  const now = Date.now();
  let device: DeviceEntry | undefined = entry.deviceIds.find((d) => d.id === deviceId);

  if (device) {
    // Device already has its own timer running (started the moment it first logged in)
    if (deviceStatus(device, now) === "expired") {
      res.json({ success: false, message: "Key đã hết hạn trên thiết bị này" });
      return;
    }
  } else {
    // First time this device logs in with this key -> its own countdown starts now
    if (entry.deviceIds.length >= entry.maxDeviceIds) {
      res.json({ success: false, message: "Key đã đạt giới hạn số thiết bị" });
      return;
    }
    const duration = durationFor(entry.typeKey);
    device = {
      id: deviceId,
      startTime: now,
      expireTime: duration === null ? null : now + duration,
    };
    entry.deviceIds.push(device);
    saveKeys(keys);
  }

  res.json({
    success: true,
    message: "Đăng nhập thành công",
    apiKey: entry.key,
    typeKey: entry.typeKey,
    maxDeviceIds: entry.maxDeviceIds,
    deviceIds: entry.deviceIds.map((d) => d.id),
    startTime: device.startTime,
    expireTime: device.expireTime,
  });
});

export default router;
