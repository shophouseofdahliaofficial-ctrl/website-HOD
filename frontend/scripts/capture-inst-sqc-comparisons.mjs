/**
 * Capture Inst SQC comparison PNGs via headless browser.
 * Usage: node scripts/capture-inst-sqc-comparisons.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'lib', 'photobooth', 'film', 'instSqc', 'comparisons');
const PORT = process.env.PORT || '3000';
const URL = `http://localhost:${PORT}/dev/inst-sqc-compare`;

async function waitForServer(ms = 90000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(URL);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`Server not ready at ${URL}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let devProc = null;
  try {
    await fetch(URL);
  } catch {
    console.log('Starting dev server…');
    devProc = spawn('npm', ['run', 'dev'], {
      cwd: ROOT,
      shell: true,
      stdio: 'ignore',
    });
    await waitForServer();
  }

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 2400 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForSelector('[data-step-id]', { timeout: 60000 });

  const shots = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-step-id]')].map((fig) => {
      const id = fig.getAttribute('data-step-id');
      const canvas = fig.querySelector('canvas');
      if (!id || !canvas) return null;
      return { id, dataUrl: canvas.toDataURL('image/png') };
    }).filter(Boolean);
  });

  for (const shot of shots) {
    const b64 = shot.dataUrl.replace(/^data:image\/png;base64,/, '');
    await writeFile(join(OUT_DIR, `inst-sqc-${shot.id}.png`), Buffer.from(b64, 'base64'));
    console.log(`Saved inst-sqc-${shot.id}.png`);
  }

  await page.screenshot({
    path: join(OUT_DIR, 'inst-sqc-full-grid.png'),
    fullPage: true,
  });
  console.log(`Saved ${shots.length} step PNGs + full grid to ${OUT_DIR}`);

  await browser.close();
  if (devProc) devProc.kill();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
