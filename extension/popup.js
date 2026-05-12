// popup.js — communicates with the content script running on the Threads tab

const $ = (id) => document.getElementById(id);

let isRunning = false;
let threadsTabId = null;

// ── Restore saved config ──────────────────────────────────────────────────────
chrome.storage.local.get(["maxPosts", "commentText"], (data) => {
  if (data.maxPosts)    $("maxPosts").value    = data.maxPosts;
  if (data.commentText) $("commentText").value = data.commentText;
});

// ── Logging ───────────────────────────────────────────────────────────────────
function log(msg, type = "") {
  const logEl = $("log");
  const entry = document.createElement("div");
  entry.className = "log-entry " + type;

  const time = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  entry.textContent = `[${time}] ${msg}`;

  // Remove idle placeholder
  const idleMsg = logEl.querySelector(".idle-msg");
  if (idleMsg) idleMsg.remove();

  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(state) {
  const dot = $("status-dot");
  dot.className = "status-dot " + state;
}

function updateStat(id, val) {
  $(id).textContent = val;
}

// ── Find the active Threads tab ───────────────────────────────────────────────
async function getThreadsTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "https://www.threads.com/*" }, (tabs) => {
      resolve(tabs.length > 0 ? tabs[0] : null);
    });
  });
}

// ── Start ─────────────────────────────────────────────────────────────────────
$("btn-start").addEventListener("click", async () => {
  const tab = await getThreadsTab();
  if (!tab) {
    log("❌ No Threads tab found. Open threads.com first.", "error");
    return;
  }

  threadsTabId = tab.id;
  isRunning = true;

  const config = {
    maxPosts:    parseInt($("maxPosts").value)    || 100,
    commentText: $("commentText").value.trim()    || "Đã follow ạ",
  };

  // Save config
  chrome.storage.local.set(config);

  // Update UI
  $("btn-start").disabled = true;
  $("btn-stop").disabled  = false;
  setStatus("running");
  log("🚀 Bot started!", "info");

  // Reset stats display
  ["stat-followed", "stat-commented", "stat-skipped", "stat-errors"].forEach(
    (id) => updateStat(id, "0")
  );

  // Navigate to the chéo follow topic if not already there
  const topicUrl = "https://www.threads.com/search?q=ch%C3%A9o+follow&serp_type=default";
  if (!tab.url.includes("search?q=ch")) {
    chrome.tabs.update(tab.id, { url: topicUrl });
    // Wait for navigation before sending start message
    await new Promise((resolve) => {
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Send start message to content script
  chrome.tabs.sendMessage(tab.id, { action: "start", config }, (resp) => {
    if (chrome.runtime.lastError) {
      log("❌ Could not connect to Threads tab. Try refreshing the page.", "error");
      resetUI();
    }
  });
});

// ── Stop ──────────────────────────────────────────────────────────────────────
$("btn-stop").addEventListener("click", () => {
  if (threadsTabId) {
    chrome.tabs.sendMessage(threadsTabId, { action: "stop" });
  }
  log("⏹ Stop requested...", "warn");
});

function resetUI() {
  isRunning = false;
  $("btn-start").disabled = false;
  $("btn-stop").disabled  = true;
  setStatus("stopped");
}

// ── Listen for messages from content script ───────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  switch (msg.type) {
    case "log":
      log(msg.text, msg.level || "");
      break;

    case "stats":
      updateStat("stat-followed",  msg.stats.followed);
      updateStat("stat-commented", msg.stats.commented);
      updateStat("stat-skipped",   msg.stats.skipped);
      updateStat("stat-errors",    msg.stats.errors);
      break;

    case "done":
      log("✅ Bot finished! " + (msg.reason || ""), "success");
      resetUI();
      setStatus("idle");
      break;

    case "stopped":
      log("⏹ Bot stopped.", "warn");
      resetUI();
      break;

    case "error":
      log("❌ " + msg.text, "error");
      break;
  }
});
