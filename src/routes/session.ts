import { Router } from "express";
import { loadKeys, deviceStatus } from "../lib/keys.js";

const router = Router();

/**
 * Polled periodically by the client while the app is open.
 * Each device counts down independently from its own startTime, so this
 * only ever looks at the caller's own deviceId — other devices on the same
 * key keep running on their own clock regardless of this one's state.
 */
router.post("/session", (req, res) => {
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

  const device = entry.deviceIds.find((d) => d.id === deviceId);

  if (!device) {
    res.json({ success: false, message: "Thiết bị chưa đăng nhập key này" });
    return;
  }

  if (deviceStatus(device) === "expired") {
    res.json({ success: false, message: "Key đã hết hạn trên thiết bị này" });
    return;
  }

  res.json({
    success: true,
    typeKey: entry.typeKey,
    maxDeviceIds: entry.maxDeviceIds,
    deviceIds: entry.deviceIds.map((d) => d.id),
    startTime: device.startTime,
    expireTime: device.expireTime,
  });
});

export default router;
