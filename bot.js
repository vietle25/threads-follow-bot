/**
 * Threads "Chéo Follow" Bot  — Playwright CDP  v3
 * ─────────────────────────────────────────────────────────────
 * Stays entirely in the topic feed. For each post:
 *   1. Detects the "+" button on avatar (svg[aria-label="Follow"])
 *      → present ONLY when you are NOT following that person
 *   2. Clicks "+" → dialog → clicks Follow → presses Escape to close
 *   3. Clicks Reply button → types comment → submits
 *
 * START CHROME:  bash start-chrome.sh
 * THEN RUN BOT:  node bot.js
 * ─────────────────────────────────────────────────────────────
 */

const { chromium } = require("playwright-core");
const http = require("http");

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  topicUrl: "https://www.threads.com/search?q=ch%C3%A9o+follow&serp_type=default",
  commentText: "Đã follow ạ",
  maxPosts: 100,

  // Delays (ms) — reduced by ~40%
  delayBetweenPosts: { min: 2100, max: 4400 },
  delayAfterClickPlus: { min: 480, max: 1320 },
  delayAfterFollow: { min: 600, max: 2100 },
  delayBeforeComment: { min: 480, max: 1800 },
  delayAfterComment: { min: 900, max: 2100 },
  delayScroll: { min: 720, max: 1500 },

  // Mouse wiggle: how many random moves per wiggle call
  wiggleMoves: { min: 3, max: 7 },

  chromeHost: "http://127.0.0.1:9222",
};
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Skewed random delay — most values land in the lower half of the range,
 * with occasional longer pauses, mimicking real human rhythm.
 */
const delay = (min, max) => {
  // Use the minimum of two random values → skews toward shorter times
  // but still allows occasional longer pauses (more human)
  const r1 = Math.random();
  const r2 = Math.random();
  const skewed = Math.min(r1, r2); // skew toward 0 (shorter)
  // 20% chance of a longer "distracted" pause
  const multiplier = Math.random() < 0.2 ? 1.4 + Math.random() * 0.8 : 1.0;
  const ms = Math.floor((min + skewed * (max - min)) * multiplier);
  return new Promise((r) => setTimeout(r, Math.min(ms, max * 1.5)));
};
const rnd = (cfg) => delay(cfg.min, cfg.max);

/**
 * Move the mouse to several random positions on screen,
 * simulating natural idle movement between actions.
 * This helps avoid bot-detection heuristics that look for a static cursor.
 */
async function humanMouseWiggle(page) {
  try {
    const viewport = page.viewportSize() || { width: 1280, height: 800 };
    const moves = Math.floor(
      Math.random() * (CONFIG.wiggleMoves.max - CONFIG.wiggleMoves.min + 1)
    ) + CONFIG.wiggleMoves.min;

    for (let i = 0; i < moves; i++) {
      // Random position within the central 70% of the screen
      const x = Math.floor(viewport.width * 0.15 + Math.random() * viewport.width * 0.70);
      const y = Math.floor(viewport.height * 0.15 + Math.random() * viewport.height * 0.70);
      await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 8) + 4 });
      // Short pause between moves (20–120ms)
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 100) + 20));
    }
  } catch {
    // Non-fatal — ignore if viewport/mouse not available
  }
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Bad JSON from " + url)); }
      });
    }).on("error", reject);
  });
}

async function getChromeWsUrl() {
  const hint =
    "\n→ Run:  bash start-chrome.sh\n" +
    "  Then log in to Threads, then re-run: node bot.js\n";
  let v;
  try { v = await httpGet(`${CONFIG.chromeHost}/json/version`); }
  catch { throw new Error("Cannot reach Chrome on port 9222." + hint); }
  if (v?.webSocketDebuggerUrl) return v.webSocketDebuggerUrl;
  throw new Error("Chrome gave no WS URL." + hint);
}

async function scrollDown(page, times = 4) {
  for (let i = 0; i < times; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
    await rnd(CONFIG.delayScroll);
  }
}

// ─── SELECTORS (confirmed by DOM inspection) ──────────────────────────────────
// "+" button on avatar: only exists when NOT following
const SEL_FOLLOW_BTN = 'div[role="button"]:has(svg[aria-label="Follow"])';

// Reply/comment speech-bubble button
const SEL_REPLY_BTN = 'div[role="button"]:has(svg[aria-label="Reply"])';

// Author link
const SEL_AUTHOR_LINK = 'a[href^="/@"]';

// Comment input (Lexical rich text editor)
const SEL_COMMENT_INPUT = [
  'div[contenteditable="true"][data-lexical-editor="true"]',
  'div[contenteditable="true"]',
].join(", ");

// Post button after typing comment
const SEL_POST_BTN = [
  'div[role="button"]:has(svg[aria-label="Post"])',
  'div[role="button"]:has(svg[aria-label="Submit"])',
  'button[type="submit"]',
].join(", ");
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find all currently-visible post containers that have the "+" follow button.
 * Returns array of { postEl, authorHref, followBtnEl, replyBtnEl }
 */
async function collectUnfollowedPosts(page) {
  // All "+" buttons visible in the feed right now
  const followBtns = await page.$$(SEL_FOLLOW_BTN);
  const results = [];

  for (const followBtn of followBtns) {
    // Walk up the DOM to find the post container that owns this button
    const postEl = await followBtn.evaluateHandle((btn) => {
      // Go up until we find the element that also contains a reply button and author link
      let el = btn.parentElement;
      for (let i = 0; i < 10; i++) {
        if (!el) break;
        const hasReply = el.querySelector('div[role="button"] svg[aria-label="Reply"]');
        const hasAuthor = el.querySelector('a[href^="/@"]');
        if (hasReply && hasAuthor) return el;
        el = el.parentElement;
      }
      return null;
    });

    const postElHandle = postEl.asElement();
    if (!postElHandle) continue;

    const authorHref = await postElHandle.$eval(SEL_AUTHOR_LINK, (a) => a.href).catch(() => null);
    if (!authorHref) continue;

    const replyBtn = await postElHandle.$(SEL_REPLY_BTN);

    results.push({ postEl: postElHandle, authorHref, followBtn, replyBtn });
  }

  return results;
}

/**
 * Click the "+" button → wait for Follow dialog → click Follow → dismiss.
 * Returns true if successfully followed.
 */
async function followViaDialog(page, followBtn) {
  // Scroll into view and click the "+" button
  await followBtn.scrollIntoViewIfNeeded();
  await delay(180, 360);
  await followBtn.click();

  await rnd(CONFIG.delayAfterClickPlus);

  // Wait for the dialog/popup that contains a Follow button
  // The dialog has a "Follow" text button (not an SVG, a text button)
  let dialogFollowBtn = null;
  try {
    // Look for a text-based "Follow" button that just appeared in a dialog
    dialogFollowBtn = await page.waitForSelector(
      '[role="dialog"] div[role="button"], [role="dialog"] button, ' +
      '[role="menu"] div[role="button"], [role="menu"] button',
      { timeout: 2500 }
    );
  } catch {
    // Dialog may not have appeared — might already be following
    return false;
  }

  // Find and click the "Follow" option in the dialog
  const followed = await page.evaluate(() => {
    const dialogSels = ['[role="dialog"]', '[role="menu"]', '[role="alertdialog"]'];
    for (const sel of dialogSels) {
      const dialog = document.querySelector(sel);
      if (!dialog) continue;
      const btns = dialog.querySelectorAll('div[role="button"], button');
      for (const btn of btns) {
        const t = (btn.innerText || "").trim().toLowerCase();
        if (t === "follow" || t === "theo dõi" || t.includes("follow")) {
          btn.click();
          return true;
        }
      }
    }
    // Fallback: any newly-appeared "Follow" text button anywhere on page
    const allBtns = document.querySelectorAll('div[role="button"], button');
    for (const btn of allBtns) {
      const t = (btn.innerText || "").trim().toLowerCase();
      if (t === "follow" || t === "theo dõi") {
        btn.click();
        return true;
      }
    }
    return false;
  });

  await delay(500, 900);
  await humanMouseWiggle(page);

  // Dismiss dialog
  await page.keyboard.press("Escape");
  await delay(250, 550);

  return followed;
}

/**
 * Click Reply on a post → type the comment → submit it.
 * Returns true on success.
 */
async function postComment(page, replyBtn) {
  if (!replyBtn) {
    console.log("  ⚠️  No reply button found for this post.");
    return false;
  }

  await humanMouseWiggle(page);
  await replyBtn.scrollIntoViewIfNeeded();
  await delay(180, 420);
  await replyBtn.click();

  await rnd(CONFIG.delayBeforeComment);

  // Wait for comment input
  let inputEl;
  try {
    inputEl = await page.waitForSelector(SEL_COMMENT_INPUT, { timeout: 5000 });
  } catch {
    console.log("  ⚠️  Comment input did not appear.");
    await page.keyboard.press("Escape");
    return false;
  }

  await humanMouseWiggle(page);
  await inputEl.click();
  await delay(120, 360);

  // Type comment character by character with varied speed
  for (const char of CONFIG.commentText) {
    // Occasionally pause mid-word like a real person thinking
    const charDelay = Math.random() < 0.1
      ? Math.floor(Math.random() * 300) + 150  // rare long pause
      : Math.floor(Math.random() * 90) + 35;    // normal typing speed
    await page.keyboard.type(char, { delay: charDelay });
  }

  console.log(`  💬 Typed: "${CONFIG.commentText}"`);
  await delay(300, 750);

  // Submit — try Post button first, then Enter key
  const postBtn = await page.$(SEL_POST_BTN);
  if (postBtn) {
    await postBtn.click();
  } else {
    await page.keyboard.press("Enter");
  }

  await rnd(CONFIG.delayAfterComment);
  await humanMouseWiggle(page);

  // Go back to the feed list
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => { });
  await delay(600, 1500);

  return true;
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  🤖  Threads Chéo-Follow Bot  v3");
  console.log("═══════════════════════════════════════════════════\n");

  const wsUrl = await getChromeWsUrl().catch((e) => {
    console.error("\n❌ " + e.message);
    process.exit(1);
  });
  console.log("✅ Chrome connected\n");

  const browser = await chromium.connectOverCDP(wsUrl);
  const context = browser.contexts()[0] || await browser.newContext();
  const pages = context.pages();
  const page =
    pages.find((p) => p.url().includes("threads")) ||
    pages[0] ||
    (await context.newPage());

  console.log(`🌐 Navigating to "chéo follow" topic...`);
  await page.goto(CONFIG.topicUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(2500, 4000);

  const processedAuthors = new Set();
  const stats = { followed: 0, skipped: 0, commented: 0, commentFailed: 0, errors: 0 };
  let emptyScrolls = 0;
  const MAX_EMPTY_SCROLLS = 5; // stop after 5 consecutive scrolls with no new posts

  while (processedAuthors.size < CONFIG.maxPosts) {
    // Re-query ONE fresh unprocessed post per iteration.
    // We cannot pre-collect all handles because goBack() remounts the DOM,
    // making any previously-collected element handles stale/detached.
    const unfollowedPosts = await collectUnfollowedPosts(page);
    const nextPost = unfollowedPosts.find((p) => !processedAuthors.has(p.authorHref));

    console.log(`\n📋 ${unfollowedPosts.length} unfollowed visible | processed: ${processedAuthors.size}`);

    if (!nextPost) {
      emptyScrolls++;
      if (emptyScrolls >= MAX_EMPTY_SCROLLS) {
        console.log(`\n⚠️  No new posts after ${MAX_EMPTY_SCROLLS} scrolls. Ending.`);
        break;
      }
      console.log(`  ↓ No new posts. Scrolling for more... (${emptyScrolls}/${MAX_EMPTY_SCROLLS})`);
      await scrollDown(page, 4);
      await delay(1200, 2000);
      continue;
    }

    // Found a new post — reset the empty scroll counter
    emptyScrolls = 0;

    const { authorHref, followBtn, replyBtn } = nextPost;
    processedAuthors.add(authorHref);
    const author = authorHref.replace("https://www.threads.com", "");
    console.log(`\n👤 ${author}`);

    try {
      // Step 1: Follow via the "+" dialog
      const followed = await followViaDialog(page, followBtn);

      if (!followed) {
        console.log("  ⚠️  Could not complete follow (dialog issue or already following).");
        stats.skipped++;
      } else {
        console.log("  ✅ Followed!");
        stats.followed++;
        await rnd(CONFIG.delayAfterFollow);

        // Step 2: Comment (replyBtn is still valid — we haven't navigated yet)
        const commented = await postComment(page, replyBtn);
        if (commented) {
          console.log("  ✅ Commented!");
          stats.commented++;
        } else {
          stats.commentFailed++;
        }
      }
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}`);
      stats.errors++;
      // Recover: go back to feed if we navigated away mid-error
      if (!page.url().includes("search")) {
        await page.goto(CONFIG.topicUrl, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => { });
        await delay(1200, 2000);
      }
    }

    const pauseMs = Math.floor(
      Math.random() * (CONFIG.delayBetweenPosts.max - CONFIG.delayBetweenPosts.min + 1)
    ) + CONFIG.delayBetweenPosts.min;
    console.log(`  ⏳ Waiting ${(pauseMs / 1000).toFixed(1)}s...`);
    await delay(pauseMs, pauseMs);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  📊  Session Summary");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  ✅ Followed:        ${stats.followed}`);
  console.log(`  ⏭️  Skipped:         ${stats.skipped}`);
  console.log(`  💬 Commented:       ${stats.commented}`);
  console.log(`  ⚠️  Comment failed:  ${stats.commentFailed}`);
  console.log(`  ❌ Errors:          ${stats.errors}`);
  console.log(`  📋 Total processed: ${processedAuthors.size}`);
  console.log("═══════════════════════════════════════════════════\n");

  await browser.close();
  console.log("👋 Done!");
}

main();
