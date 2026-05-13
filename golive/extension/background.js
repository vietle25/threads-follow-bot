// background.js — The persistent part of the extension

let state = {
  isRunning: false,
  threadsTabId: null,
  stats: { followed: 0, skipped: 0, commented: 0, commentFailed: 0, errors: 0 },
  logs: [],
  license: { active: false, code: null, expiry: null }
};

// Initialize license from storage
chrome.storage.local.get("license", (data) => {
  if (data.license) {
    if (Date.now() > data.license.expiry) {
      clearLicense();
    } else {
      state.license = data.license;
    }
  }
});

const API_URL = "https://script.google.com/macros/s/AKfycbyre_JtAgalx7HWZ70h_M7e-uNNHsYq4_TdTjDihtQFYyef57nH0NE3UFPFGJ-km-IW/exec";

// ── Listen for messages from popup and content scripts ───────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "get-state") {
    // Send CURRENT state immediately for fast UI response
    sendResponse(state);

    // Then silently check for updates in background
    chrome.storage.local.get("license", (data) => {
      if (data.license && data.license.code) {
        validateLicense(data.license.code).then(res => {
          if (res.valid) {
            state.license = { active: true, code: data.license.code, expiry: res.expiry };
            chrome.storage.local.set({ license: state.license });
          } else {
            clearLicense();
          }
        }).catch(() => {
          if (data.license.expiry && Date.now() > data.license.expiry) {
            clearLicense();
          }
        });
      }
    });
    return false; // Already responded
  }

  if (msg.action === "activate") {
    validateLicense(msg.code).then(res => {
      if (res.valid) {
        state.license = { active: true, code: msg.code, expiry: res.expiry };
        chrome.storage.local.set({ license: state.license });
        sendResponse({ ok: true, expiry: res.expiry });
      } else {
        sendResponse({ ok: false, reason: res.reason });
      }
    });
    return true;
  }

  if (msg.action === "start-bot") {
    if (!state.license.active || Date.now() > state.license.expiry) {
      clearLicense();
      sendResponse({ ok: false, reason: "Mã đã hết hạn sử dụng" });
      broadcastToPopup({ type: "state-changed", state });
      return false;
    }
    startBotFlow(msg.tabId, msg.config);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === "stop-bot") {
    stopBot();
    sendResponse({ ok: true });
    return false;
  }

  if (msg.type === "license-expired") {
    clearLicense();
    return false;
  }

  if (msg.type === "log") { addLog(msg.text, msg.level); return false; }
  if (msg.type === "stats") {
    state.stats = msg.stats;
    broadcastToPopup({ type: "stats-update", stats: state.stats });
    return false;
  }
  if (msg.type === "done") {
    state.isRunning = false;
    addLog("✅ Bot finished! " + (msg.reason || ""), "success");
    broadcastToPopup({ type: "state-changed", state });
    return false;
  }
  if (msg.type === "stopped") {
    state.isRunning = false;
    addLog("⏹ Bot stopped.", "warn");
    broadcastToPopup({ type: "state-changed", state });
    return false;
  }
});

async function startBotFlow(tabId, config) {
  state.isRunning = true;
  state.threadsTabId = tabId;
  state.stats = { followed: 0, skipped: 0, commented: 0, commentFailed: 0, errors: 0 };
  state.logs = [];

  addLog("🚀 Starting bot flow...", "info");
  broadcastToPopup({ type: "state-changed", state });

  try {
    // 1. Ensure we are on the correct URL
    const topicUrl = "https://www.threads.com/search?q=ch%C3%A9o+follow&serp_type=default";
    const tab = await chrome.tabs.get(tabId);

    if (!tab.url.includes("search?q=ch")) {
      addLog("🌐 Navigating to topic page...", "info");
      await chrome.tabs.update(tabId, { url: topicUrl });
      // Wait for navigation
      await new Promise(resolve => {
        chrome.tabs.onUpdated.addListener(function listener(tId, info) {
          if (tId === tabId && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        });
      });
      await new Promise(r => setTimeout(r, 2000));
    }

    // 2. Try to ping the content script
    let ready = await pingContentScript(tabId);

    if (!ready) {
      addLog("💉 Injecting bot script...", "info");
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      }).catch(e => console.error("Injection failed", e));
      await new Promise(r => setTimeout(r, 1000));
    }

    // 3. Start the bot
    chrome.tabs.sendMessage(tabId, { action: "start", config, expiry: state.license.expiry }, (resp) => {
      if (chrome.runtime.lastError) {
        addLog("❌ Connection failed. Please refresh the Threads page and try again.", "error");
        state.isRunning = false;
        broadcastToPopup({ type: "state-changed", state });
      } else {
        addLog("✅ Bot is now running on the page.", "success");
      }
    });

  } catch (err) {
    addLog("❌ System error: " + err.message, "error");
    state.isRunning = false;
    broadcastToPopup({ type: "state-changed", state });
  }
}

async function pingContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "ping" }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.pong) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

function stopBot() {
  if (state.threadsTabId) {
    chrome.tabs.sendMessage(state.threadsTabId, { action: "stop" }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  }
  state.isRunning = false;
  addLog("⏹ Stop requested...", "warn");
  broadcastToPopup({ type: "state-changed", state });
}

function addLog(text, type = "") {
  const entry = { text, type, time: getTime() };
  state.logs.push(entry);
  if (state.logs.length > 100) state.logs.shift();
  broadcastToPopup({ type: "new-log", log: entry });
}

// ── Periodic License Check (Every 5 seconds) ─────────────────────────────────
setInterval(() => {
  if (state.license.active) {
    if (Date.now() > state.license.expiry) {
      clearLicense();
      addLog("🚨 Mã kích hoạt đã hết hạn!", "error");
    }
  }
}, 5000);

function clearLicense() {
  if (state.isRunning) {
    stopBot();
    addLog("🚨 Mã hết hạn! Bot đã bị dừng.", "error");
  }
  state.license = { active: false, code: null, expiry: null };
  chrome.storage.local.remove("license");
  broadcastToPopup({ type: "state-changed", state });
}

function getTime() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function broadcastToPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => { });
}

async function validateLicense(code) {
  try {
    const resp = await fetch(`${API_URL}?code=${code}`);
    return await resp.json();
  } catch (err) {
    return { valid: false, reason: "Server connection error" };
  }
}
