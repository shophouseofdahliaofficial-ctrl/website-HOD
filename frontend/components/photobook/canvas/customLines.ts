import { Control, Point, util } from 'fabric';
import { readPbStackZoomFromCanvas, zoomControlUnits } from './controls';
import type { FabricObject } from './types';

/** On-screen diameter for line anchor dots (px). */
const PB_LINE_DOT_SCREEN_PX = 20;

/** Default stroke weight and span when a line is dropped on the canvas. */
export const PB_LINE_DEFAULT_STROKE_WIDTH = 12;
const PB_LINE_DEFAULT_HALF_SPAN = 130;
const PB_LINE_DEFAULT_WAVE_OFFSET = 65;

export const PB_LINE_HOVER_STROKE = 'rgba(139, 92, 246, 0.92)';

export function isPbLineObject(obj: unknown): obj is FabricObject & {
  pbKind: 'line';
  pathPoints: { x: number; y: number }[];
  strokeWidth?: number;
} {
  return !!(
    obj &&
    typeof obj === 'object' &&
    (obj as { pbKind?: string }).pbKind === 'line' &&
    Array.isArray((obj as { pathPoints?: unknown }).pathPoints)
  );
}

type LinePathStrokeStyle = {
  stroke: string;
  lineWidth: number;
};

/**
 * Stroke a custom line's spline path in canvas space (not its rectangular bbox).
 */
export function drawPbLinePathStroke(
  ctx: CanvasRenderingContext2D,
  obj: FabricObject,
  style: LinePathStrokeStyle,
) {
  if (!isPbLineObject(obj) || obj.pathPoints.length < 2) return;

  const matrix = obj.calcTransformMatrix();
  const pathStr = getSplinePathString(obj.pathPoints);

  ctx.save();
  ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
  ctx.strokeStyle = style.stroke;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash([]);
  ctx.stroke(new Path2D(pathStr));
  ctx.restore();
}

/** Hover highlight that follows the line path only. */
export function drawPbLineHoverOutline(ctx: CanvasRenderingContext2D, obj: FabricObject) {
  if (!isPbLineObject(obj)) return;
  const domZoom = readPbStackZoomFromCanvas(obj.canvas);
  const baseW = obj.strokeWidth ?? PB_LINE_DEFAULT_STROKE_WIDTH;
  const glowW = baseW + zoomControlUnits(10, domZoom);
  const coreW = baseW + zoomControlUnits(3, domZoom);
  drawPbLinePathStroke(ctx, obj, { stroke: 'rgba(139, 92, 246, 0.28)', lineWidth: glowW });
  drawPbLinePathStroke(ctx, obj, { stroke: PB_LINE_HOVER_STROKE, lineWidth: coreW });
}

/**
 * Generates a smooth Catmull-Rom spline path string through a list of points.
 */
export function getSplinePathString(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let pathStr = `M ${points[0].x} ${points[0].y}`;
  const tension = 0.5;
  const steps = 30; // Number of intermediate line segments per curve interval

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[0] : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 >= points.length ? p2 : points[i + 2];

    for (let step = 1; step <= steps; step++) {
      const t = step / steps;
      const t2 = t * t;
      const t3 = t2 * t;

      // Catmull-Rom basis functions
      const f1 = -tension * t3 + 2 * tension * t2 - tension * t;
      const f2 = (2 - tension) * t3 + (tension - 3) * t2 + 1;
      const f3 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t;
      const f4 = tension * t3 - tension * t2;

      const x = p0.x * f1 + p1.x * f2 + p2.x * f3 + p3.x * f4;
      const y = p0.y * f1 + p1.y * f2 + p2.y * f3 + p3.y * f4;
      pathStr += ` L ${x} ${y}`;
    }
  }
  return pathStr;
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  type: string | undefined,
  px: number,
  py: number,
  angle: number,
  isStart: boolean,
  strokeColor: string | undefined,
  strokeWidth: number | undefined
) {
  if (!type || type === 'none') return;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle + (isStart ? Math.PI : 0));

  ctx.strokeStyle = strokeColor || '#ff1e68';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = strokeWidth || PB_LINE_DEFAULT_STROKE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const w = strokeWidth || PB_LINE_DEFAULT_STROKE_WIDTH;
  const size = 10 + w * 0.8;
  const radius = size * 0.35;
  const shift = 0.5 * w + 1.5;

  switch (type) {
    case 'arrow':
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.6);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size * 0.6);
      ctx.stroke();
      break;
    case 'arrow-filled':
      ctx.beginPath();
      ctx.moveTo(-size, -size * 0.6);
      ctx.lineTo(0, 0);
      ctx.lineTo(-size, size * 0.6);
      ctx.closePath();
      ctx.fillStyle = strokeColor || '#ff1e68';
      ctx.fill();
      ctx.stroke();
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(shift - radius, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    case 'circle-filled':
      ctx.beginPath();
      ctx.arc(shift - radius, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor || '#ff1e68';
      ctx.fill();
      ctx.stroke();
      break;
    case 'square':
      ctx.beginPath();
      ctx.rect(shift - size, -size * 0.4, size, size * 0.8);
      ctx.fill();
      ctx.stroke();
      break;
    case 'square-filled':
      ctx.beginPath();
      ctx.rect(shift - size, -size * 0.4, size, size * 0.8);
      ctx.fillStyle = strokeColor || '#ff1e68';
      ctx.fill();
      ctx.stroke();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(shift - size, 0);
      ctx.lineTo(shift - size * 0.5, -size * 0.4);
      ctx.lineTo(shift, 0);
      ctx.lineTo(shift - size * 0.5, size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      break;
    case 'diamond-filled':
      ctx.beginPath();
      ctx.moveTo(shift - size, 0);
      ctx.lineTo(shift - size * 0.5, -size * 0.4);
      ctx.lineTo(shift, 0);
      ctx.lineTo(shift - size * 0.5, size * 0.4);
      ctx.closePath();
      ctx.fillStyle = strokeColor || '#ff1e68';
      ctx.fill();
      ctx.stroke();
      break;
    case 'bar':
      ctx.beginPath();
      ctx.moveTo(shift, -size * 0.6);
      ctx.lineTo(shift, size * 0.6);
      ctx.stroke();
      break;
  }

  ctx.restore();
}

/**
 * Overrides a Path instance's rendering, controls, and update logic to behave as an interactive custom line.
 */
export function setupCustomLineObject(obj: any, fabric: any): void {
  // Lock scaling and rotation so user can only translate the line or adjust its path points
  obj.set({
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasBorders: false,
    objectCaching: false,
    strokeUniform: true,
    perPixelTargetFind: true,
    padding: 0,
    pbKind: 'line',
    transparentCorners: true,
    cornerColor: 'transparent',
    cornerStrokeColor: 'transparent',
    cornerStyle: 'circle',
    cornerSize: 20,
  });

  // Re-attach custom _render method to draw the circle dots at each point and start/end markers
  const originalRender = obj._render;
  obj._render = function (ctx: CanvasRenderingContext2D) {
    // Ensure strokeLineCap is applied to the canvas context before Fabric renders the path
    if (this.strokeLineCap) {
      ctx.lineCap = this.strokeLineCap;
    }
    if (originalRender) {
      originalRender.call(this, ctx);
    }

    if (!this.pathPoints || this.pathPoints.length < 2) return;

    // 1. Draw start and end markers
    const p0 = this.pathPoints[0];
    const p1 = this.pathPoints[1];
    const angleStart = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    drawMarker(ctx, this.lineStartMarker, p0.x, p0.y, angleStart, true, this.stroke, this.strokeWidth);

    const pn = this.pathPoints[this.pathPoints.length - 1];
    const pnMinus1 = this.pathPoints[this.pathPoints.length - 2];
    const angleEnd = Math.atan2(pn.y - pnMinus1.y, pn.x - pnMinus1.x);
    drawMarker(ctx, this.lineEndMarker, pn.x, pn.y, angleEnd, false, this.stroke, this.strokeWidth);

    // 2. Only draw the circle dots if this object is selected AND not temporarily hidden
    const activeObject = this.canvas && this.canvas.getActiveObject();
    const isSelected = activeObject === this || (activeObject && activeObject.type === 'activeSelection' && typeof (activeObject as any).getObjects === 'function' && (activeObject as any).getObjects().includes(this));

    // Check if control dots are temporarily hidden (1-second suppression after edits)
    const dotsHidden = this._hideDotsUntil && Date.now() < this._hideDotsUntil;

    if (isSelected && !dotsHidden) {
      const domZoom = readPbStackZoomFromCanvas(this.canvas);
      const dotRadius = zoomControlUnits(PB_LINE_DOT_SCREEN_PX, domZoom) / 2;
      const dotStroke = Math.max(1.5, 2.5 / Math.max(domZoom, 0.25));

      ctx.save();
      ctx.lineWidth = dotStroke;

      this.pathPoints.forEach((pt: { x: number; y: number }) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ff1e68';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      });
      ctx.restore();
    }
  };

  // Recenter path and adjust left/top position to prevent local coordinate drift
  obj.recenterPath = function () {
    if (!this.pathPoints || this.pathPoints.length < 2) return;

    // 1. Calculate the bounding box of pathPoints
    const xs = this.pathPoints.map((p: any) => p.x);
    const ys = this.pathPoints.map((p: any) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const newWidth = maxX - minX;
    const newHeight = maxY - minY;

    // 2. Compute the new center relative to the current local origin (0, 0)
    const newCx = minX + newWidth / 2;
    const newCy = minY + newHeight / 2;

    // Shift check to avoid tiny movements or infinite loops
    if (Math.abs(newCx) < 0.01 && Math.abs(newCy) < 0.01) return;

    // 3. Shift pathPoints so they are centered around the new origin
    this.pathPoints.forEach((pt: any) => {
      pt.x -= newCx;
      pt.y -= newCy;
    });

    // 4. Update the object's left and top positions by the center offset
    this.left += newCx;
    this.top += newCy;

    // 5. Generate the new spline path string
    const pathStr = getSplinePathString(this.pathPoints);
    const tempPath = new fabric.Path(pathStr);

    this.set({
      path: tempPath.path,
      width: tempPath.width,
      height: tempPath.height,
    });
    this.setCoords();

    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  };

  // Re-attach updatePath function to update path string based on current pathPoints visually (during drag)
  obj.updatePath = function () {
    if (!this.pathPoints || this.pathPoints.length < 2) return;

    const pathStr = getSplinePathString(this.pathPoints);
    const tempPath = new fabric.Path(pathStr);

    this.set({
      path: tempPath.path,
      width: tempPath.width,
      height: tempPath.height,
    });
    this.setCoords();

    if (this.canvas) {
      this.canvas.requestRenderAll();
    }
  };

  // Re-center coordinate origin when modification ends
  obj.on('modified', function (this: any) {
    this.recenterPath();
    if (this.canvas) {
      this.canvas.fire('object:modified', { target: this });
    }
  });

  // Build custom controls for editing the spline points
  const customControls: Record<string, any> = {};
  obj.pathPoints.forEach((pt: any, index: number) => {
    const touchSize = 28;
    customControls[`p${index}`] = new Control({
      x: 0,
      y: 0,
      sizeX: touchSize,
      sizeY: touchSize,
      touchSizeX: touchSize + 6,
      touchSizeY: touchSize + 6,
      positionHandler: function (dim: any, finalMatrix: any, fabricObject: any) {
        const point = fabricObject.pathPoints[index];
        if (!point) return new Point(0, 0);
        return util.transformPoint(
          new Point(point.x, point.y),
          fabricObject.calcTransformMatrix()
        );
      },
      actionHandler: function (eventData: any, transform: any, x: number, y: number) {
        const target = transform.target;
        // Convert screen coordinates to local object coordinates
        const localPt = util.transformPoint(
          new Point(x, y),
          util.invertTransform(target.calcTransformMatrix())
        );
        const point = target.pathPoints[index];
        if (point) {
          point.x = localPt.x;
          point.y = localPt.y;
          target.updatePath();
        }
        return true;
      },
      cursorStyle: 'pointer',
      actionName: 'modifyPoints',
      render: () => {},
    });
  });

  obj.controls = customControls;
}

/**
 * Creates a standard fabric.Path object initialized with the custom interactive line behaviors.
 */
export function createCustomLineObject(
  fabric: any,
  lineType: 'straight' | 'curve' | 'zigzag',
  cx: number,
  cy: number
): any {
  // 1. Define initial absolute points relative to the drop center (cx, cy)
  let initialPoints: { x: number; y: number }[] = [];

  if (lineType === 'straight') {
    initialPoints = [
      { x: cx - PB_LINE_DEFAULT_HALF_SPAN, y: cy },
      { x: cx + PB_LINE_DEFAULT_HALF_SPAN, y: cy },
    ];
  } else if (lineType === 'curve') {
    initialPoints = [
      { x: cx - PB_LINE_DEFAULT_HALF_SPAN, y: cy + PB_LINE_DEFAULT_WAVE_OFFSET },
      { x: cx, y: cy - PB_LINE_DEFAULT_WAVE_OFFSET },
      { x: cx + PB_LINE_DEFAULT_HALF_SPAN, y: cy + PB_LINE_DEFAULT_WAVE_OFFSET },
    ];
  } else if (lineType === 'zigzag') {
    const midInset = Math.round(PB_LINE_DEFAULT_HALF_SPAN * 0.38);
    initialPoints = [
      { x: cx - PB_LINE_DEFAULT_HALF_SPAN, y: cy + PB_LINE_DEFAULT_WAVE_OFFSET },
      { x: cx - midInset, y: cy - PB_LINE_DEFAULT_WAVE_OFFSET },
      { x: cx + midInset, y: cy + PB_LINE_DEFAULT_WAVE_OFFSET },
      { x: cx + PB_LINE_DEFAULT_HALF_SPAN, y: cy - PB_LINE_DEFAULT_WAVE_OFFSET },
    ];
  }

  // Calculate bounding box and center of the points
  const xs = initialPoints.map((p) => p.x);
  const ys = initialPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = maxX - minX;
  const height = maxY - minY;
  const newCx = minX + width / 2;
  const newCy = minY + height / 2;

  // Make pathPoints relative to the bounding box center
  const relativePoints = initialPoints.map((pt) => ({
    x: pt.x - newCx,
    y: pt.y - newCy,
  }));

  // 2. Generate spline path string
  const pathStr = getSplinePathString(relativePoints);

  // 3. Instantiate fabric.Path centered at (newCx, newCy)
  const pathObj = new fabric.Path(pathStr, {
    fill: 'transparent',
    stroke: '#ff1e68',
    strokeWidth: PB_LINE_DEFAULT_STROKE_WIDTH,
    strokeLineCap: 'round',
    strokeLinejoin: 'round',
    left: newCx,
    top: newCy,
    originX: 'center',
    originY: 'center',
    pbKind: 'line',
    pbLineType: lineType,
  });

  // Attach local pathPoints to the object
  pathObj.pathPoints = relativePoints;

  // Setup the custom interactive line features
  setupCustomLineObject(pathObj, fabric);

  return pathObj;
}
