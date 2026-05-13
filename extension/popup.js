// popup.js — UI logic that syncs with background.js

const $ = (id) => document.getElementById(id);

// ── Initialization ───────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Restore saved config from storage
  chrome.storage.local.get(["maxPosts", "commentText"], (data) => {
    if (data.maxPosts)    $("maxPosts").value    = data.maxPosts;
    if (data.commentText) $("commentText").value = data.commentText;
  });

  // 2. Get current state from background script
  chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
    if (state) {
      updateUIFromState(state);
    }
  });
});

function updateUIFromState(state) {
  // Update Buttons & Dot
  if (state.isRunning) {
    $("btn-start").disabled = true;
    $("btn-stop").disabled  = false;
    $("status-dot").className = "status-dot running";
  } else {
    $("btn-start").disabled = false;
    $("btn-stop").disabled  = true;
    $("status-dot").className = "status-dot stopped";
  }

  // Update Stats
  updateStat("stat-followed",  state.stats.followed);
  updateStat("stat-commented", state.stats.commented);
  updateStat("stat-skipped",   state.stats.skipped);
  updateStat("stat-errors",    state.stats.errors);

  // Update Logs
  const logEl = $("log");
  logEl.innerHTML = "";
  if (state.logs.length === 0) {
    logEl.innerHTML = '<div class="log-entry idle-msg">Bot is idle. Press Start to begin.</div>';
  } else {
    state.logs.forEach(entry => appendLogToUI(entry));
  }
}

// ── UI Helpers ───────────────────────────────────────────────────────────────
function updateStat(id, val) {
  $(id).textContent = val;
}

function appendLogToUI(entry) {
  const logEl = $("log");
  const div = document.createElement("div");
  div.className = "log-entry " + (entry.type || "");
  div.textContent = `[${entry.time}] ${entry.text}`;
  
  // Remove idle placeholder if it exists
  const idleMsg = logEl.querySelector(".idle-msg");
  if (idleMsg) idleMsg.remove();

  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Actions ──────────────────────────────────────────────────────────────────
$("btn-start").addEventListener("click", async () => {
  chrome.tabs.query({ url: "https://www.threads.com/*" }, async (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      alert("Please open threads.com first!");
      return;
    }

    const config = {
      maxPosts:    parseInt($("maxPosts").value)    || 100,
      commentText: $("commentText").value.trim()    || "Đã follow ạ",
    };

    // Save config
    chrome.storage.local.set(config);

    // Tell background to start the bot
    chrome.runtime.sendMessage({ 
      action: "start-bot", 
      tabId: tab.id, 
      config 
    });
  });
});

$("btn-stop").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "stop-bot" });
});

// ── Listen for state updates from background ─────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "state-changed") {
    updateUIFromState(msg.state);
  }
  if (msg.type === "stats-update") {
    updateStat("stat-followed",  msg.stats.followed);
    updateStat("stat-commented", msg.stats.commented);
    updateStat("stat-skipped",   msg.stats.skipped);
    updateStat("stat-errors",    msg.stats.errors);
  }
  if (msg.type === "new-log") {
    appendLogToUI(msg.log);
  }
});
