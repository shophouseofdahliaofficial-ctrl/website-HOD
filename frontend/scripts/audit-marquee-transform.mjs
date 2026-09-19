/**
 * Demonstrates position:fixed + transform ancestor (same issue as .photobookEditorOverlay).
 * Run: node scripts/audit-marquee-transform.mjs
 */
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'tmp', 'marquee-audit');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  body { margin: 0; font-family: sans-serif; }
  .overlay {
    position: fixed; inset: 0; background: #1e1e1e;
    animation: fadeIn 0.35s forwards;
    overflow: hidden;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(1.02); }
    to { opacity: 1; transform: scale(1); }
  }
  .workspace {
    margin: 80px; height: 400px; overflow: auto; background: #333; position: relative;
  }
  .nestedFixed {
    position: fixed; left: 120px; top: 120px; width: 200px; height: 100px;
    border: 1px solid #ff4fa3; background: rgba(255,79,163,0.12); z-index: 10;
  }
  .bodyPortal {
    position: fixed; left: 120px; top: 120px; width: 200px; height: 100px;
    border: 1px solid #00ff00; background: rgba(0,255,0,0.12); z-index: 2147483647;
  }
</style></head><body>
  <div class="overlay" id="overlay">
    <div class="workspace">
      <div class="nestedFixed" id="nested"></div>
      <div style="height:800px;color:#fff;padding:16px">scroll content</div>
    </div>
  </div>
  <div class="bodyPortal" id="portal"></div>
</body></html>`;

async function audit(page, selector) {
  return page.evaluate((sel) => {
    const box = document.querySelector(sel);
    const chain = [];
    let node = box;
    let firstTransformAncestor = null;
    while (node) {
      const style = getComputedStyle(node);
      const entry = {
        tag: node.tagName,
        id: node.id,
        className: node.className,
        transform: style.transform,
        position: style.position,
        overflow: style.overflow,
      };
      chain.push(entry);
      if (
        !firstTransformAncestor &&
        node !== box &&
        style.transform !== 'none'
      ) {
        firstTransformAncestor = entry;
      }
      node = node.parentElement;
    }
    return {
      selector: sel,
      parentTag: box?.parentElement?.tagName ?? null,
      rect: box?.getBoundingClientRect(),
      chain,
      firstTransformAncestor,
    };
  }, selector);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

  const nested = await audit(page, '#nested');
  const portal = await audit(page, '#portal');

  const report = {
    conclusion:
      'Nested fixed marquee is contained by first transform ancestor (.photobookEditorOverlay via photobookFadeIn). Body portal is direct child of BODY.',
    nested,
    portal,
  };

  writeFileSync(join(outDir, 'transform-audit.json'), JSON.stringify(report, null, 2));
  await page.screenshot({ path: join(outDir, 'transform-audit.png'), fullPage: true });
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
