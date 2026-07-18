const API = "/api";
let token = localStorage.getItem("admin_token") || "";
let lastKeys = [];

const $ = (id) => document.getElementById(id);

// ── Auth ──────────────────────────────────────────────────────────────────────

async function apiRequest(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

$("login-btn").addEventListener("click", async () => {
  const password = $("password-input").value.trim();
  if (!password) return;
  $("login-error").classList.add("hidden");
  const data = await fetch(API + "/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  }).then((r) => r.json());

  if (data.success) {
    token = data.token;
    localStorage.setItem("admin_token", token);
    showAdmin();
  } else {
    $("login-error").textContent = data.message || "Invalid password";
    $("login-error").classList.remove("hidden");
  }
});

$("password-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("login-btn").click();
});

$("logout-btn").addEventListener("click", async () => {
  await apiRequest("POST", "/admin/logout");
  token = "";
  localStorage.removeItem("admin_token");
  showLogin();
});

function showLogin() {
  $("admin-screen").classList.add("hidden");
  $("login-screen").classList.remove("hidden");
  $("password-input").value = "";
}

async function showAdmin() {
  $("login-screen").classList.add("hidden");
  $("admin-screen").classList.remove("hidden");
  await loadKeys();
}

// ── Keys ──────────────────────────────────────────────────────────────────────

const DURATION_CODES = ["1H", "24H", "7D", "30D", "365D", "LIFETIME"];

async function loadKeys() {
  const data = await apiRequest("GET", "/admin/keys");
  if (!data.success) { showLogin(); return; }
  lastKeys = data.keys;
  renderKeys(data.keys);
  const openKey = $("device-card").dataset.key;
  if (openKey) {
    const k = data.keys.find((x) => x.key === openKey);
    if (k) renderDevices(k); else $("device-card").style.display = "none";
  }
}

function renderKeys(keys) {
  const tbody = $("keys-body");
  if (!keys.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No keys found.</td></tr>`;
    return;
  }
  tbody.innerHTML = keys.map((k) => {
    const devCls = k.deviceCount >= k.maxDeviceIds ? "days-warn" : "days-ok";
    const deviceLabel = `<span class="days-badge ${devCls}" style="cursor:pointer" onclick="showDevices('${k.key}')">${k.deviceCount}/${k.maxDeviceIds}</span>`;
    const statusCls = k.allDevicesExpired ? "days-expired" : "days-ok";
    const statusLabel = k.allDevicesExpired ? "All devices expired" : "OK";
    return `<tr>
      <td><span class="key-badge" style="cursor:pointer" onclick="showDevices('${k.key}')">${k.key}</span></td>
      <td>${k.typeKey}</td>
      <td>${k.maxDeviceIds}</td>
      <td>${deviceLabel}</td>
      <td><span class="days-badge ${statusCls}">${statusLabel}</span></td>
      <td>
        <div class="actions">
          <button class="btn btn-sm btn-primary" onclick="openEdit('${k.key}', '${k.typeKey}', ${k.maxDeviceIds}, ${k.deviceCount > 0})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDelete('${k.key}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

// ── Device details panel ────────────────────────────────────────────────────

function fmtTime(ms) {
  return ms ? new Date(ms).toLocaleString() : "—";
}

function fmtTimeLeft(expireTime) {
  if (expireTime === null) return "Never (lifetime)";
  const diff = expireTime - Date.now();
  if (diff <= 0) return "Expired";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

function showDevices(key) {
  const k = lastKeys.find((x) => x.key === key);
  if (!k) return;
  $("device-card").dataset.key = key;
  $("device-card").style.display = "block";
  renderDevices(k);
  $("device-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderDevices(k) {
  $("device-key-info").textContent = `Key: ${k.key} — Type: ${k.typeKey} — ${k.deviceCount}/${k.maxDeviceIds} devices used`;
  const tbody = $("device-body");
  if (!k.devices.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">No device has logged in yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = k.devices.map((d) => {
    const cls = d.status === "expired" ? "days-expired" : d.status === "active" ? "days-ok" : "days-warn";
    return `<tr>
      <td class="device-id-text">${d.id}</td>
      <td>${fmtTime(d.startTime)}</td>
      <td>${d.expireTime === null ? "Never" : fmtTime(d.expireTime)}</td>
      <td>${fmtTimeLeft(d.expireTime)}</td>
      <td><span class="days-badge ${cls}">${d.status}</span></td>
      <td><button class="btn btn-sm btn-danger" onclick="removeDevice('${k.key}', '${d.id}')">Remove</button></td>
    </tr>`;
  }).join("");
}

async function removeDevice(key, deviceId) {
  const data = await apiRequest("DELETE", `/admin/keys/${key}/devices/${deviceId}`);
  if (data.success) {
    showAlert(`Device ${deviceId} removed — its slot is free again.`);
    loadKeys();
  } else {
    showAlert(data.message || "Failed to remove device.", "error");
  }
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function showAlert(msg, type = "success") {
  const el = $("alert");
  el.textContent = msg;
  el.className = `alert alert-${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
}

// ── Modal helpers ──────────────────────────────────────────────────────────────

function openModal(title, bodyHTML, onConfirm) {
  $("modal-title").textContent = title;
  $("modal-body").innerHTML = bodyHTML;
  $("modal-overlay").classList.remove("hidden");
  const btn = $("modal-confirm");
  const handler = async () => {
    await onConfirm();
    closeModal();
    btn.removeEventListener("click", handler);
  };
  btn.addEventListener("click", handler);
}

function closeModal() {
  $("modal-overlay").classList.add("hidden");
  $("modal-body").innerHTML = "";
}

$("modal-close").addEventListener("click", closeModal);
$("modal-cancel").addEventListener("click", closeModal);
$("modal-overlay").addEventListener("click", (e) => {
  if (e.target === $("modal-overlay")) closeModal();
});

function typeKeyOptions(selected) {
  return DURATION_CODES.map((c) => `<option value="${c}" ${c === selected ? "selected" : ""}>${c}</option>`).join("");
}

// ── Add Key ───────────────────────────────────────────────────────────────────

$("add-key-btn").addEventListener("click", () => {
  openModal("New Key", `
    <div class="field">
      <label>API Key</label>
      <input type="text" id="new-key" placeholder="e.g. MYKEY001" />
    </div>
    <div class="field">
      <label>Type Key</label>
      <select id="new-type-key">${typeKeyOptions("24H")}</select>
    </div>
    <div class="field">
      <label>Max Devices</label>
      <input type="number" id="new-max-devices" value="1" min="1" max="100" />
    </div>
  `, async () => {
    const key = $("new-key").value.trim();
    const typeKey = $("new-type-key").value;
    const maxDeviceIds = parseInt($("new-max-devices").value) || 1;
    if (!key || !typeKey) return;
    const data = await apiRequest("POST", "/admin/keys", { key, typeKey, maxDeviceIds });
    if (data.success) {
      showAlert("Key created successfully.");
      loadKeys();
    } else {
      showAlert(data.message || "Failed to create key.", "error");
    }
  });
});

// ── Edit Key ──────────────────────────────────────────────────────────────────

function openEdit(key, currentTypeKey, currentMaxDevices, hasDevices) {
  openModal(`Edit: ${key}`, `
    <div class="field">
      <label>Key Name</label>
      <input type="text" id="edit-key" value="${key}" />
    </div>
    <div class="field">
      <label>Type Key</label>
      <select id="edit-type-key">${typeKeyOptions(currentTypeKey)}</select>
    </div>
    <div class="field">
      <label>Max Devices</label>
      <input type="number" id="edit-max-devices" value="${currentMaxDevices}" min="1" max="100" />
    </div>
    ${hasDevices ? `
    <div class="field" style="display:flex;align-items:center;gap:10px;margin-top:4px">
      <input type="checkbox" id="edit-reset-devices" style="width:auto;accent-color:#4f72e3" />
      <label for="edit-reset-devices" style="margin:0;cursor:pointer">Reset All Devices (clears every device's timer)</label>
    </div>` : ""}
  `, async () => {
    const newKey = $("edit-key").value.trim();
    const typeKey = $("edit-type-key").value;
    const maxDeviceIds = parseInt($("edit-max-devices").value) || 1;
    const resetDevices = hasDevices ? $("edit-reset-devices").checked : false;
    if (!newKey || !typeKey) return;
    const body = {
      newKey: newKey !== key ? newKey : undefined,
      typeKey,
      maxDeviceIds,
      resetDevices,
    };
    const data = await apiRequest("PUT", `/admin/keys/${key}`, body);
    if (data.success) {
      showAlert("Key updated.");
      loadKeys();
    } else {
      showAlert(data.message || "Failed to update.", "error");
    }
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

function confirmDelete(key) {
  openModal("Delete Key", `
    <p style="color:#a0aec0;line-height:1.6">
      Are you sure you want to delete key <strong style="color:#fc8181">${key}</strong>?<br/>
      This action cannot be undone.
    </p>
  `, async () => {
    const data = await apiRequest("DELETE", `/admin/keys/${key}`);
    if (data.success) {
      showAlert(`Key ${key} deleted.`);
      if ($("device-card").dataset.key === key) $("device-card").style.display = "none";
      loadKeys();
    } else {
      showAlert(data.message || "Failed to delete.", "error");
    }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

setInterval(() => { if (token) loadKeys(); }, 15000);

if (token) {
  showAdmin();
} else {
  showLogin();
}
