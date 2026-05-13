// background.js — The persistent part of the extension

let state = {
  isRunning: false,
  threadsTabId: null,
  stats: { followed: 0, skipped: 0, commented: 0, commentFailed: 0, errors: 0 },
  logs: []
};

// ── Listen for messages from popup and content scripts ───────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "get-state") {
    sendResponse(state);
    return false;
  }

  if (msg.action === "start-bot") {
    startBotFlow(msg.tabId, msg.config);
    sendResponse({ ok: true });
    return false;
  }

  if (msg.action === "stop-bot") {
    stopBot();
    sendResponse({ ok: true });
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
    chrome.tabs.sendMessage(tabId, { action: "start", config }, (resp) => {
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

function getTime() {
  return new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function broadcastToPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {});
}
