/**
 * Browser probe via /pb-lock-probe (real PbCanvasPage + toggleLock API).
 * Prereq: npm run dev
 * Run: node scripts/pb-rebake-browser-probe.mjs
 */
import { chromium } from 'playwright';

const baseUrl = process.env.PB_PROBE_URL || 'http://localhost:3000/pb-lock-probe';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForFunction(() => !!globalThis.__PB_PROBE_RESULTS__, { timeout: 90_000 });

  const results = await page.evaluate(() => globalThis.__PB_PROBE_RESULTS__);
  const consoleLogs = await page.evaluate(() => globalThis.__PB_PROBE_CONSOLE__ || []);
  if (consoleLogs.length) console.log('Browser console:', consoleLogs);
  console.log('\n========== BROWSER PB LOCK PROBE ==========\n');
  console.log(JSON.stringify(results, null, 2));
} catch (err) {
  const body = await page.content().catch(() => '');
  console.error('Probe failed:', err);
  if (body.includes('error')) console.error(body.slice(0, 500));
  process.exitCode = 1;
} finally {
  await browser.close();
}
