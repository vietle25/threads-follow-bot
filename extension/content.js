/**
 * content.js — Threads Chéo Follow Bot
 * Runs as a Chrome Extension content script on https://www.threads.com/*
 * Receives messages from popup.js to start/stop the bot.
 */

// ── State ─────────────────────────────────────────────────────────────────────
let botRunning = false;
let CONFIG     = {};

// ── Messaging helpers ─────────────────────────────────────────────────────────
const send = (type, data = {}) => {
  chrome.runtime.sendMessage({ type, ...data }).catch(() => {});
};

const log = (text, level = "") => send("log", { text, level });

let stats = { followed: 0, skipped: 0, commented: 0, commentFailed: 0, errors: 0 };

const emitStats = () => send("stats", { stats: { ...stats } });

// ── Delay helpers ─────────────────────────────────────────────────────────────
const delay = (min, max) => {
  if (!botRunning) return Promise.resolve(); // abort fast if stopped
  const r1 = Math.random(), r2 = Math.random();
  const skewed = Math.min(r1, r2);
  const multiplier = Math.random() < 0.2 ? 1.4 + Math.random() * 0.8 : 1.0;
  const ms = Math.floor((min + skewed * (max - min)) * multiplier);
  return new Promise((r) => setTimeout(r, Math.min(ms, max * 1.5)));
};

const rnd = (cfg) => delay(cfg.min, cfg.max);

// ── Mouse wiggle ──────────────────────────────────────────────────────────────
function humanMouseWiggle() {
  const moves = Math.floor(Math.random() * 5) + 3;
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(window.innerWidth  * 0.15 + Math.random() * window.innerWidth  * 0.70);
    const y = Math.floor(window.innerHeight * 0.15 + Math.random() * window.innerHeight * 0.70);
    document.dispatchEvent(new MouseEvent("mousemove", {
      clientX: x, clientY: y, bubbles: true, cancelable: true
    }));
  }
}

// ── Wait for a selector to appear in the DOM ─────────────────────────────────
function waitForSelector(selector, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for: ${selector}`));
    }, timeout);
  });
}

// ── Simulate typing into a Lexical/contenteditable element ───────────────────
async function typeIntoEditor(el, text) {
  el.focus();
  await delay(100, 300);

  for (const char of text) {
    // 10% chance of a longer "thinking" pause
    const charDelay = Math.random() < 0.1
      ? Math.floor(Math.random() * 300) + 150
      : Math.floor(Math.random() * 90) + 35;

    // Use execCommand for contenteditable (works with Lexical)
    document.execCommand("insertText", false, char);

    await new Promise((r) => setTimeout(r, charDelay));
    if (!botRunning) return;
  }
}

// ── Selectors ─────────────────────────────────────────────────────────────────
// "+" follow button on avatar: only present when NOT following
const SEL_FOLLOW_BTN = 'div[role="button"] svg[aria-label="Follow"]';

// Reply/comment button
const SEL_REPLY_BTN  = 'svg[aria-label="Reply"]';

// Author link
const SEL_AUTHOR     = 'a[href^="/@"]';

// Comment input
const SEL_INPUT      = 'div[contenteditable="true"][data-lexical-editor="true"], div[contenteditable="true"]';

// ── Find all posts with the "+" button, return structured data ────────────────
function collectUnfollowedPosts() {
  const followSvgs = Array.from(document.querySelectorAll(SEL_FOLLOW_BTN));
  const results    = [];
  const seen       = new Set();

  for (const svg of followSvgs) {
    // The clickable "+" button is the div[role="button"] ancestor of the SVG
    const followBtn = svg.closest('div[role="button"]');
    if (!followBtn) continue;

    // Walk up to find the post container that also has a Reply button + author link
    let postEl = followBtn.parentElement;
    let found  = false;
    for (let i = 0; i < 12; i++) {
      if (!postEl) break;
      if (
        postEl.querySelector(SEL_REPLY_BTN) &&
        postEl.querySelector(SEL_AUTHOR)
      ) {
        found = true;
        break;
      }
      postEl = postEl.parentElement;
    }
    if (!found || !postEl) continue;

    const authorEl  = postEl.querySelector(SEL_AUTHOR);
    const authorHref = authorEl?.href || null;
    if (!authorHref || seen.has(authorHref)) continue;
    seen.add(authorHref);

    const replyBtnEl = postEl.querySelector(SEL_REPLY_BTN)?.closest('div[role="button"]');

    results.push({ postEl, authorHref, followBtn, replyBtnEl });
  }

  return results;
}

// ── Follow via the "+" dialog ─────────────────────────────────────────────────
async function followViaDialog(followBtn) {
  followBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  await delay(250, 500);
  followBtn.click();
  log(`  👆 Clicked "+" button...`);

  await rnd(CONFIG.delayAfterClickPlus);

  // Wait for a dialog/menu to appear
  let dialog = null;
  try {
    dialog = await waitForSelector('[role="dialog"], [role="menu"]', 2500);
  } catch {
    // No dialog — might already be following
    return false;
  }
  await delay(250, 500);
  humanMouseWiggle();

  // Find "Follow" button inside the dialog
  const btns = Array.from(dialog.querySelectorAll('div[role="button"], button'));
  const followBtn2 = btns.find((b) => {
    const t = (b.innerText || "").trim().toLowerCase();
    return t === "follow" || t === "theo dõi" || t.includes("follow");
  });

  if (!followBtn2) {
    // Dismiss and skip
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  followBtn2.click();
  await delay(300, 600);
  humanMouseWiggle();

  // Dismiss dialog
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await delay(250, 600);
  return true;
}

// ── Comment on a post ─────────────────────────────────────────────────────────
async function postComment(replyBtnEl) {
  if (!replyBtnEl) {
    log("  ⚠️ No reply button for this post.", "warn");
    return false;
  }

  humanMouseWiggle();
  replyBtnEl.scrollIntoView({ behavior: "smooth", block: "center" });
  await delay(120, 270);
  replyBtnEl.click();

  await rnd(CONFIG.delayBeforeComment);

  let inputEl;
  try {
    inputEl = await waitForSelector(SEL_INPUT, 5000);
  } catch {
    log("  ⚠️ Comment input not found.", "warn");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }

  humanMouseWiggle();
  inputEl.click();
  await delay(120, 360);

  await typeIntoEditor(inputEl, CONFIG.commentText);
  if (!botRunning) return false;

  log(`  💬 Typed: "${CONFIG.commentText}"`);
  await delay(300, 750);

  // Try to find and click the Post/Submit button
  const allBtns = Array.from(document.querySelectorAll('div[role="button"], button'));
  const submitBtn = allBtns.find((b) => {
    const t = (b.innerText || b.getAttribute("aria-label") || "").trim().toLowerCase();
    return t === "post" || t === "reply" || t === "send" || t === "đăng" || t === "trả lời";
  });

  if (submitBtn) {
    submitBtn.click();
  } else {
    // Fallback: Enter key
    inputEl.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", bubbles: true, cancelable: true
    }));
  }

  await rnd(CONFIG.delayAfterComment);
  humanMouseWiggle();

  // Go back to the feed
  history.back();
  await delay(1000, 2000);

  return true;
}

// ── Main bot loop ─────────────────────────────────────────────────────────────
async function runBot() {
  const processedAuthors = new Set();
  let emptyScrolls = 0;
  const MAX_EMPTY = 5;

  stats = { followed: 0, skipped: 0, commented: 0, commentFailed: 0, errors: 0 };
  emitStats();

  log("🌐 Scanning feed for unfollowed posts...", "info");

  while (botRunning && processedAuthors.size < CONFIG.maxPosts) {
    const unfollowed = collectUnfollowedPosts();
    const nextPost   = unfollowed.find((p) => !processedAuthors.has(p.authorHref));

    log(`📋 ${unfollowed.length} unfollowed visible | done: ${processedAuthors.size}/${CONFIG.maxPosts}`);

    if (!nextPost) {
      emptyScrolls++;
      if (emptyScrolls >= MAX_EMPTY) {
        log("⚠️ No more new posts after scrolling. Done.", "warn");
        break;
      }
      log(`  ↓ Scrolling for more... (${emptyScrolls}/${MAX_EMPTY})`);
      window.scrollBy(0, window.innerHeight * 1.5);
      await delay(1000, 2000);
      continue;
    }

    emptyScrolls = 0; // reset on new post found

    const { authorHref, followBtn, replyBtnEl } = nextPost;
    processedAuthors.add(authorHref);

    const author = authorHref.replace("https://www.threads.com", "");
    log(`\n👤 ${author}`);

    try {
      const followed = await followViaDialog(followBtn);

      if (!followed) {
        log("  ⚠️ Follow dialog issue or already following.", "warn");
        stats.skipped++;
        emitStats();
      } else {
        log("  ✅ Followed!", "success");
        stats.followed++;
        emitStats();

        await rnd(CONFIG.delayAfterFollow);

        if (!botRunning) break;

        const commented = await postComment(replyBtnEl);
        if (commented) {
          log("  ✅ Commented!", "success");
          stats.commented++;
        } else {
          log("  ⚠️ Comment failed.", "warn");
          stats.commentFailed++;
        }
        emitStats();
      }
    } catch (err) {
      log(`  ❌ Error: ${err.message}`, "error");
      stats.errors++;
      emitStats();

      // Recover if navigated away
      if (!location.href.includes("search")) {
        location.href = CONFIG.topicUrl;
        await delay(2000, 3000);
      }
    }

    if (!botRunning) break;

    await rnd(CONFIG.delayBetweenPosts);
  }

  if (botRunning) {
    send("done", { reason: `Processed ${processedAuthors.size} posts.` });
  } else {
    send("stopped");
  }

  botRunning = false;
}

// ── Listen for messages from popup ───────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "start") {
    if (botRunning) { sendResponse({ ok: false, reason: "already running" }); return; }

    CONFIG = {
      topicUrl:          "https://www.threads.com/search?q=ch%C3%A9o+follow&serp_type=default",
      commentText:       msg.config.commentText || "Đã follow ạ",
      maxPosts:          msg.config.maxPosts    || 100,
      delayBetweenPosts: { min: 2100, max: 5400 },
      delayAfterClickPlus:{ min: 480,  max: 1320 },
      delayAfterFollow:  { min: 600,  max: 2100  },
      delayBeforeComment:{ min: 480,  max: 1800  },
      delayAfterComment: { min: 900,  max: 3000  },
    };

    botRunning = true;
    sendResponse({ ok: true });
    runBot();
  }

  if (msg.action === "stop") {
    botRunning = false;
    sendResponse({ ok: true });
  }

  return true; // keep channel open for async response
});
