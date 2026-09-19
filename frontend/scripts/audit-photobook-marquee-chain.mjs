/**
 * Audits ancestor chain for marquee inside photobook editor DOM (static replica).
 * Run: node scripts/audit-photobook-marquee-chain.mjs
 */
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'tmp', 'marquee-audit');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  .photobookEditorOverlay {
    position: fixed; inset: 0; overflow: hidden;
    animation: photobookFadeIn 0.35s forwards;
  }
  @keyframes photobookFadeIn {
    from { opacity: 0; transform: scale(1.02); }
    to { opacity: 1; transform: scale(1); }
  }
  .photobookCenterWorkspaceColumn { overflow: hidden; height: 100%; position: relative; }
  .photobookMainWorkspace { overflow: auto; height: 400px; position: relative; }
  .pbWorkspaceMarqueeOverlay { position: absolute; inset: 0; }
  .pbWorkspaceMarqueeBox {
    position: fixed; left: 200px; top: 150px; width: 180px; height: 90px;
    border: 1px solid #ff4fa3; background: rgba(255,79,163,0.12);
  }
</style></head><body>
  <div class="photobookEditorOverlay">
    <div class="photobookCenterWorkspaceColumn">
      <main class="photobookMainWorkspace">
        <div class="pbWorkspaceMarqueeOverlay">
          <div class="pbWorkspaceMarqueeBox"></div>
        </div>
      </main>
    </div>
  </div>
</body></html>`;

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const audit = await page.evaluate(() => {
    const box = document.querySelector('.pbWorkspaceMarqueeBox');
    const workspace = document.querySelector('.photobookMainWorkspace');
    const chain = [];
    let firstBad = null;
    let node = box;
    while (node) {
      const style = getComputedStyle(node);
      const row = {
        tag: node.tagName,
        className: node.className,
        position: style.position,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        transform: style.transform,
        filter: style.filter,
        perspective: style.perspective,
        contain: style.contain,
        clipPath: style.clipPath,
        maskImage: style.maskImage,
        zoom: style.zoom,
      };
      chain.push(row);
      if (
        !firstBad &&
        node !== box &&
        (style.transform !== 'none' ||
          style.filter !== 'none' ||
          style.perspective !== 'none' ||
          style.contain.includes('paint'))
      ) {
        firstBad = row;
      }
      node = node.parentElement;
    }
    return {
      boxRect: box?.getBoundingClientRect(),
      workspaceRect: workspace?.getBoundingClientRect(),
      chain,
      firstContainingBlockAncestor: firstBad,
    };
  });

  writeFileSync(join(outDir, 'photobook-chain-audit.json'), JSON.stringify(audit, null, 2));
  console.log(JSON.stringify(audit, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
