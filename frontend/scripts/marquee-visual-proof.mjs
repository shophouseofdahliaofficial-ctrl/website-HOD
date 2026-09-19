/**
 * Marquee visual proof harness — run with photobook editor open:
 *   PB_URL=http://localhost:3000/product/... PB_PASSWORD=... node scripts/marquee-visual-proof.mjs
 *
 * Saves screenshots to tmp/marquee-proof/
 */
import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'tmp', 'marquee-proof');
const url = process.env.PB_URL || 'http://localhost:3004/product/test-id';
const password = process.env.PB_PASSWORD || '';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryOpenEditor(page) {
  const editor = await page.$('[data-photobook-editor]');
  if (editor) return true;

  const link = await page.$('a[class*="photobookPasswordLink"], .photobookPasswordLink');
  if (link) {
    await link.click();
    await sleep(400);
    if (password) {
      await page.type('input[type="password"]', password, { delay: 20 });
      await page.click('button[type="submit"]');
      await sleep(2000);
    }
  }
  return Boolean(await page.$('.photobookMainWorkspace'));
}

async function setZoom(page, percent) {
  await page.evaluate((pct) => {
    const input = document.querySelector('input[type="range"][class*="zoom"], [class*="pbZoom"] input');
    if (input) {
      input.value = String(pct);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, percent);
  await sleep(400);
}

async function dragMarquee(page, fromX, fromY, toX, toY) {
  const workspace = await page.$('.photobookMainWorkspace');
  if (!workspace) throw new Error('Workspace not found');

  await page.mouse.move(fromX, fromY);
  await page.mouse.down();
  await sleep(80);

  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const x = fromX + ((toX - fromX) * i) / steps;
    const y = fromY + ((toY - fromY) * i) / steps;
    await page.mouse.move(x, y);
    await sleep(30);
  }

  await sleep(120);
  await page.screenshot({ path: join(outDir, `drag-${fromX}-${fromY}-to-${toX}-${toY}.png`) });

  const audit = await page.evaluate(() => {
    const box = document.querySelector('.pbGlobalMarqueeBox');
    const dot = document.querySelector('.pbGlobalMarqueeDebugDot');
    const mouse = window.__lastPointerDebug;
    const boxRect = box?.getBoundingClientRect();
    const dotRect = dot?.getBoundingClientRect();
    return {
      boxParent: box?.parentElement?.tagName ?? null,
      boxIsBodyChild: box?.parentElement === document.body,
      boxRect: boxRect
        ? { left: boxRect.left, top: boxRect.top, width: boxRect.width, height: boxRect.height }
        : null,
      dotRect: dotRect
        ? {
            cx: dotRect.left + dotRect.width / 2,
            cy: dotRect.top + dotRect.height / 2,
          }
        : null,
      mouse,
      dotMatchesMouse:
        dotRect && mouse
          ? Math.abs(dotRect.left + dotRect.width / 2 - mouse.clientX) < 2 &&
            Math.abs(dotRect.top + dotRect.height / 2 - mouse.clientY) < 2
          : null,
    };
  });

  writeFileSync(join(outDir, `audit-${fromX}-${fromY}.json`), JSON.stringify(audit, null, 2));
  await page.mouse.up();
  await sleep(200);
  return audit;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: false, defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  const opened = await tryOpenEditor(page);
  if (!opened) {
    console.error('Photobook editor not open. Set PB_URL and PB_PASSWORD, or open editor manually first.');
    await page.screenshot({ path: join(outDir, 'editor-not-open.png'), fullPage: true });
    await browser.close();
    process.exit(1);
  }

  await page.waitForSelector('.photobookMainWorkspace', { timeout: 30000 });
  const wsBox = await page.$eval('.photobookMainWorkspace', (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });

  for (const zoom of [50, 100, 200]) {
    await setZoom(page, zoom);
    const fromX = wsBox.left + wsBox.width * 0.45;
    const fromY = wsBox.top + wsBox.height * 0.4;
    const toX = wsBox.left + wsBox.width * 0.75;
    const toY = wsBox.top + wsBox.height * 0.65;
    const audit = await dragMarquee(page, fromX, fromY, toX, toY);
    console.log(`zoom ${zoom}%`, audit);
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
