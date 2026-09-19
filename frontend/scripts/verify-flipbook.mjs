import puppeteer from 'puppeteer';

const BASE_URL = process.env.FLIPBOOK_TEST_URL ?? 'http://localhost:3000/flipbook-test';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPhase(page, phase, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const current = await page.$eval('[data-flip-phase]', (el) => el.getAttribute('data-flip-phase'));
    if (current === phase) return true;
    await wait(16);
  }
  throw new Error(`Timed out waiting for phase "${phase}"`);
}

async function waitForIdle(page, timeoutMs = 8000) {
  await waitForPhase(page, 'idle', timeoutMs);
}

async function getFlipState(page) {
  return page.$eval('[data-flip-phase]', (el) => ({
    phase: el.getAttribute('data-flip-phase'),
    progress: Number(el.getAttribute('data-flip-progress')),
    flipSheetCount: document.querySelectorAll('[data-testid="flip-sheet"]').length,
    landingCount: document.querySelectorAll('[class*="landingLayer"]').length,
  }));
}

async function clickNav(page, direction) {
  const selector = direction === 'next'
    ? 'button[aria-label="Next pages"]'
    : 'button[aria-label="Previous pages"]';
  await page.click(selector);
}

async function runCycle(page, direction) {
  await clickNav(page, direction);
  await waitForIdle(page);
  const state = await getFlipState(page);
  return state;
}

async function dragPage(page, side, distancePx) {
  const selector = side === 'right'
    ? '[class*="bookPageRight"]'
    : '[class*="bookPageLeft"]';
  const box = await page.$eval(selector, (el, pageSide) => {
    const rect = el.getBoundingClientRect();
    return {
      startX: pageSide === 'right' ? rect.right - 24 : rect.left + 24,
      y: rect.top + rect.height / 2,
    };
  }, side);

  await page.mouse.move(box.startX, box.y);
  await page.mouse.down();
  await page.mouse.move(box.startX - distancePx, box.y, { steps: 12 });
  await page.mouse.up();
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 900 });

  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[data-flip-phase]');

  const initial = await getFlipState(page);
  console.log('Initial state:', initial);

  const failures = [];

  for (let i = 0; i < 10; i += 1) {
    const afterCommit = await runCycle(page, 'next');
    if (afterCommit.phase !== 'idle') {
      failures.push(`commit #${i + 1}: phase=${afterCommit.phase}`);
    }
    if (afterCommit.flipSheetCount !== 0) {
      failures.push(`commit #${i + 1}: flip sheet still mounted (${afterCommit.flipSheetCount})`);
    }
    if (afterCommit.progress !== 0) {
      failures.push(`commit #${i + 1}: progress=${afterCommit.progress} after idle`);
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const afterSnap = await runCycle(page, 'prev');
    if (afterSnap.phase !== 'idle') {
      failures.push(`snap-back #${i + 1}: phase=${afterSnap.phase}`);
    }
    if (afterSnap.flipSheetCount !== 0) {
      failures.push(`snap-back #${i + 1}: flip sheet still mounted (${afterSnap.flipSheetCount})`);
    }
    if (afterSnap.progress !== 0) {
      failures.push(`snap-back #${i + 1}: progress=${afterSnap.progress} after idle`);
    }
  }

  await clickNav(page, 'next');
  await waitForIdle(page);
  const afterCommit = await getFlipState(page);
  if (afterCommit.flipSheetCount !== 0) {
    failures.push('after commit: flip sheet still mounted');
  }

  // Pointer drag commit (right page)
  await dragPage(page, 'right', 280);
  await waitForIdle(page);
  const dragCommit = await getFlipState(page);
  if (dragCommit.flipSheetCount !== 0 || dragCommit.phase !== 'idle') {
    failures.push(`pointer drag commit: phase=${dragCommit.phase}, sheets=${dragCommit.flipSheetCount}`);
  }

  // Pointer drag snap-back (right page, small drag)
  await dragPage(page, 'right', 40);
  await waitForIdle(page);
  const dragSnap = await getFlipState(page);
  if (dragSnap.flipSheetCount !== 0 || dragSnap.phase !== 'idle') {
    failures.push(`pointer drag snap-back: phase=${dragSnap.phase}, sheets=${dragSnap.flipSheetCount}`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.error('FAILURES:');
    failures.forEach((f) => console.error(` - ${f}`));
    process.exit(1);
  }

  console.log('PASS: 20 nav-button flip cycles completed');
  console.log('PASS: flip sheet absent at idle with progress 0');
  console.log('PASS: pointer drag commit and snap-back completed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
