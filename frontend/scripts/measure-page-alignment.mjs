import puppeteer from 'puppeteer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = process.env.FLIPBOOK_TEST_URL ?? 'http://localhost:3002/flipbook-test';
const OUTPUT_DIR = path.resolve('scripts/flipbook-alignment-output');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForIdle(page) {
  const start = Date.now();
  while (Date.now() - start < 8000) {
    const phase = await page.$eval('[data-flip-phase]', (el) => el.getAttribute('data-flip-phase'));
    if (phase === 'idle') return;
    await wait(16);
  }
  throw new Error('Timed out waiting for idle');
}

async function measureRightImageAtSeam(page, imageSelector) {
  return page.evaluate((selector) => {
    const spread = document.querySelector('[data-flip-phase]');
    const image = document.querySelector(selector);
    if (!spread || !image) return { missing: true, selector };

    const spreadRect = spread.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const centerSeam = spreadRect.left + spreadRect.width / 2;
    const phase = spread.getAttribute('data-flip-phase');

    return {
      phase,
      imageLeft: imageRect.left,
      centerSeam,
      offsetFromSeam: imageRect.left - centerSeam,
    };
  }, imageSelector);
}

async function dragRightPage(page, distancePx, release = true) {
  const box = await page.$eval('[class*="bookPageRight"]', (el) => {
    const rect = el.getBoundingClientRect();
    return { startX: rect.right - 24, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(box.startX, box.y);
  await page.mouse.down();
  await page.mouse.move(box.startX - distancePx, box.y, { steps: 16 });
  if (release) await page.mouse.up();
}

async function goToSpread(page, index) {
  while (true) {
    const label = await page.$eval('[class*="pageIndicator"]', (el) => el.textContent ?? '');
    const match = label.match(/Page (\d+)/);
    const current = match ? Math.ceil(Number(match[1]) / 2) - 1 : 0;
    if (current >= index) break;
    await page.click('button[aria-label="Next pages"]');
    await waitForIdle(page);
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[data-flip-phase]');

  await goToSpread(page, 2);
  await wait(600);

  const beforeDrag = await measureRightImageAtSeam(page, '[data-testid="right-page-image"]');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'before-drag.png') });

  await dragRightPage(page, 180, false);
  await wait(150);
  const duringDrag = await measureRightImageAtSeam(page, '[data-testid="flip-front-image"]');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'during-drag.png') });

  await page.mouse.up();
  await waitForIdle(page);
  await wait(200);

  const afterRelease = await measureRightImageAtSeam(page, '[data-testid="right-page-image"]');
  await page.screenshot({ path: path.join(OUTPUT_DIR, 'after-release.png') });

  const idleDelta = Math.abs((beforeDrag.imageLeft ?? 0) - (afterRelease.imageLeft ?? 0));

  const report = {
    beforeDrag,
    duringDrag,
    afterRelease,
    idleBeforeAfterDeltaPx: idleDelta,
    passSeamAlignment: Math.abs(afterRelease.offsetFromSeam ?? 99) <= 1.5,
    passIdleStable: idleDelta <= 1.5,
  };

  await writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();

  console.log('Center seam x:', afterRelease.centerSeam);
  console.log('Before drag — right image left:', beforeDrag.imageLeft, 'offset from seam:', beforeDrag.offsetFromSeam);
  console.log('During drag — flip front image left:', duringDrag.imageLeft, 'offset:', duringDrag.offsetFromSeam);
  console.log('After release — right image left:', afterRelease.imageLeft, 'offset from seam:', afterRelease.offsetFromSeam);
  console.log('Idle before/after delta px:', idleDelta);

  if (!report.passSeamAlignment || !report.passIdleStable) {
    console.error('FAIL');
    process.exit(1);
  }

  console.log('PASS: document left edge at center seam, stable across snap-back');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
