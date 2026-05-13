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
  const btnStart = $("btn-start");
  const btnStop = $("btn-stop");

  // Update Buttons & Dot
  if (state.isRunning) {
    btnStart.disabled = true;
    btnStart.innerHTML = '<span class="spinner"></span> Bot đang chạy...';
    btnStop.disabled  = false;
    $("status-dot").className = "status-dot running";
  } else {
    btnStart.disabled = false;
    btnStart.innerHTML = "Start Bot";
    btnStop.disabled  = true;
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

  // License Screen logic
  const screen = $("license-screen");
  if (state.license && state.license.active) {
    screen.classList.add("hidden");
  } else {
    screen.classList.remove("hidden");
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
  const btnStart = $("btn-start");
  const originalText = btnStart.innerHTML;
  
  // 1. SHOW LOADING IMMEDIATELY
  btnStart.disabled = true;
  btnStart.innerHTML = '<span class="spinner"></span> Đang khởi động...';

  // Check license again before start (double safety)
  chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
    if (!state.license || !state.license.active) {
      btnStart.disabled = false;
      btnStart.innerHTML = originalText;
      $("license-screen").classList.remove("hidden");
      return;
    }

    chrome.tabs.query({ url: "https://www.threads.com/*" }, async (tabs) => {
      const tab = tabs[0];
      if (!tab) {
        btnStart.disabled = false;
        btnStart.innerHTML = originalText;
        alert("Please open threads.com first!");
        return;
      }

      const commentText = $("commentText").value.trim();
      
      // 1. Validate No Links
      const linkRegex = /(https?:\/\/|www\.|[a-z0-9]+\.[a-z]{2,})/gi;
      if (linkRegex.test(commentText)) {
        btnStart.disabled = false;
        btnStart.innerHTML = originalText;
        alert("Nội dung comment không được chứa đường link để tránh bị khóa tài khoản!");
        return;
      }

      // 2. Validate Empty
      if (!commentText) {
        btnStart.disabled = false;
        btnStart.innerHTML = originalText;
        alert("Vui lòng nhập nội dung comment!");
        return;
      }

      const config = {
        maxPosts:    parseInt($("maxPosts").value)    || 100,
        commentText: commentText,
      };

      // Save config
      chrome.storage.local.set(config);

      // Tell background to start the bot
      chrome.runtime.sendMessage({ 
        action: "start-bot", 
        tabId: tab.id, 
        config 
      }, (res) => {
        if (!res || !res.ok) {
          // If fail, restore button
          btnStart.disabled = false;
          btnStart.innerHTML = originalText;
          if (res && res.reason) alert(res.reason);
        }
      });
    });
  });
});

$("btn-activate").addEventListener("click", () => {
  const code = $("license-input").value.trim();
  if (!code) return;

  const btn = $("btn-activate");
  const err = $("license-error");
  
  btn.disabled = true;
  btn.textContent = "Đang kiểm tra...";
  err.textContent = "";

  chrome.runtime.sendMessage({ action: "activate", code }, (res) => {
    btn.disabled = false;
    btn.textContent = "Kích hoạt ngay";

    if (res.ok) {
      $("license-screen").classList.add("hidden");
    } else {
      err.textContent = res.reason === "Invalid code" ? "Mã không hợp lệ" : "Mã đã hết hạn hoặc lỗi kết nối";
    }
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

// Periodic refresh while popup is open
setInterval(() => {
  chrome.runtime.sendMessage({ action: "get-state" }, (state) => {
    if (state) updateUIFromState(state);
  });
}, 2000);

