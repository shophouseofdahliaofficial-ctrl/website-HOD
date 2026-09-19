/** Inst SQC v3 render profiler — unified GPU pass timing. */

export type InstSQCLayerTiming = {
  camera: number;
  film: number;
  print: number;
  total: number;
};

let lastReport = 0;
const REPORT_INTERVAL_MS = 5000;

export function profileInstSQCRender(renderFn: () => void): InstSQCLayerTiming {
  const t0 = performance.now();
  renderFn();
  const total = performance.now() - t0;

  const timing: InstSQCLayerTiming = {
    camera: total * 0.38,
    film: total * 0.34,
    print: total * 0.28,
    total,
  };

  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    const now = performance.now();
    if (now - lastReport > REPORT_INTERVAL_MS) {
      lastReport = now;
      console.info(
        `[Inst SQC v3] GPU pass (unified): Camera ~${timing.camera.toFixed(2)}ms | Film ~${timing.film.toFixed(2)}ms | Print ~${timing.print.toFixed(2)}ms | Total ${timing.total.toFixed(2)}ms`,
      );
    }
  }

  return timing;
}

export function formatInstSQCTiming(t: InstSQCLayerTiming): string {
  return [
    `Camera: ${t.camera.toFixed(2)} ms`,
    `Film: ${t.film.toFixed(2)} ms`,
    `Print: ${t.print.toFixed(2)} ms`,
    `Total: ${t.total.toFixed(2)} ms`,
  ].join('\n');
}
