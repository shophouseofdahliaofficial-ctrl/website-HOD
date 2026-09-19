/**
 * Run with dev server + photobook editor open, or pass URL:
 *   node scripts/audit-marquee-dom.mjs http://localhost:3000/...
 *
 * In browser console (while dragging), also:
 *   globalThis.__PB_AUDIT_MARQUEE__?.()
 */
import puppeteer from 'puppeteer';

const url = process.argv[2] || 'http://localhost:3000';

const auditFn = `() => {
  const box =
    document.querySelector('.pbGlobalMarqueeBox') ||
    document.querySelector('.pbWorkspaceMarqueeBox');
  const workspace = document.querySelector('.photobookMainWorkspace');

  const result = {
    box,
    boxRect: box?.getBoundingClientRect(),
    boxComputed: box
      ? {
          position: getComputedStyle(box).position,
          left: getComputedStyle(box).left,
          top: getComputedStyle(box).top,
          width: getComputedStyle(box).width,
          height: getComputedStyle(box).height,
          transform: getComputedStyle(box).transform,
          zoom: getComputedStyle(box).zoom,
          display: getComputedStyle(box).display,
          visibility: getComputedStyle(box).visibility,
          opacity: getComputedStyle(box).opacity,
        }
      : null,
    workspaceRect: workspace?.getBoundingClientRect(),
    mouse: window.__lastPointerDebug,
    boxParentChain: [],
  };

  let node = box;
  while (node) {
    const style = getComputedStyle(node);
    result.boxParentChain.push({
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
    });
    node = node.parentElement;
  }

  return result;
}`;

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.evaluateOnNewDocument(() => {
    globalThis.__PB_AUDIT_MARQUEE__ = () => {
      const box =
        document.querySelector('.pbGlobalMarqueeBox') ||
        document.querySelector('.pbWorkspaceMarqueeBox');
      const workspace = document.querySelector('.photobookMainWorkspace');
      console.log('[audit]', { box, workspace, mouse: globalThis.__lastPointerDebug });
      let node = box;
      while (node) {
        const style = getComputedStyle(node);
        console.log(node.tagName, node.className, {
          position: style.position,
          overflow: style.overflow,
          transform: style.transform,
          filter: style.filter,
        });
        node = node.parentElement;
      }
    };
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
  } catch (e) {
    console.error('Could not load', url, '- open photobook editor manually and run __PB_AUDIT_MARQUEE__()');
    await browser.close();
    process.exit(1);
  }

  const audit = await page.evaluate(auditFn);
  console.log(JSON.stringify(audit, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
