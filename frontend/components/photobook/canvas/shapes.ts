import type { FabricModule, FabricObject } from './types';

const DEFAULT_FILL = '#3b82f6';
const DEFAULT_STROKE = '#3b82f6';

export function createShapeObject(
  fabric: FabricModule,
  shapeName: string,
  centerX: number,
  centerY: number,
  pageSizePx: number,
): FabricObject | null {
  const size = pageSizePx * 0.24;

  const base = {
    fill: DEFAULT_FILL,
    stroke: DEFAULT_STROKE,
    strokeWidth: 1.5,
    strokeUniform: true,
    objectCaching: false,
    noScaleCache: true,
    originX: 'center' as const,
    originY: 'center' as const,
    left: centerX,
    top: centerY,
    pbKind: 'shape',
  };

  const name = shapeName.toLowerCase();

  if (name === 'circle') {
    return new fabric.Circle({ ...base, radius: size / 2 });
  }
  if (name === 'square') {
    return new fabric.Rect({ ...base, width: size, height: size });
  }
  if (name === 'rectangle') {
    return new fabric.Rect({ ...base, width: size * 1.35, height: size * 0.75 });
  }
  if (name === 'oval') {
    return new fabric.Ellipse({ ...base, rx: size * 0.55, ry: size * 0.38 });
  }
  if (name === 'triangle' || name === 'equilateral triangle') {
    return new fabric.Triangle({ ...base, width: size, height: size });
  }
  if (name === 'right triangle') {
    return new fabric.Polygon(
      [
        { x: -size / 2, y: -size / 2 },
        { x: size / 2, y: -size / 2 },
        { x: -size / 2, y: size / 2 },
      ],
      base,
    );
  }
  if (name === 'isosceles triangle') {
    return new fabric.Polygon(
      [
        { x: 0, y: -size / 2 },
        { x: -size / 2, y: size / 2 },
        { x: size / 2, y: size / 2 },
      ],
      base,
    );
  }
  if (name === 'diamond') {
    return new fabric.Polygon(
      [
        { x: 0, y: -size / 2 },
        { x: size / 2, y: 0 },
        { x: 0, y: size / 2 },
        { x: -size / 2, y: 0 },
      ],
      base,
    );
  }
  if (name === 'parallelogram') {
    return new fabric.Polygon(
      [
        { x: -size / 2 + 12, y: -size / 2 },
        { x: size / 2, y: -size / 2 },
        { x: size / 2 - 12, y: size / 2 },
        { x: -size / 2, y: size / 2 },
      ],
      base,
    );
  }
  if (name === 'trapezoid') {
    return new fabric.Polygon(
      [
        { x: -size / 3, y: -size / 2 },
        { x: size / 3, y: -size / 2 },
        { x: size / 2, y: size / 2 },
        { x: -size / 2, y: size / 2 },
      ],
      base,
    );
  }
  if (name === 'pentagon') return regularPolygon(fabric, 5, size / 2, base);
  if (name === 'hexagon') return regularPolygon(fabric, 6, size / 2, base);
  if (name === 'heptagon') return regularPolygon(fabric, 7, size / 2, base);
  if (name === 'octagon') return regularPolygon(fabric, 8, size / 2, base);
  if (name === 'nonagon') return regularPolygon(fabric, 9, size / 2, base);
  if (name === 'decagon') return regularPolygon(fabric, 10, size / 2, base);
  if (name === 'dodecagon') return regularPolygon(fabric, 12, size / 2, base);
  if (name === 'semi-circle') {
    return new fabric.Path(`M ${-size / 2} ${size / 4} A ${size / 2} ${size / 2} 0 0 1 ${size / 2} ${size / 4} Z`, {
      ...base,
      fill: DEFAULT_FILL,
    });
  }
  if (name === 'quarter circle') {
    return new fabric.Path(`M ${-size / 2} ${size / 2} L ${-size / 2} ${-size / 2} A ${size} ${size} 0 0 1 ${size / 2} ${size / 2} Z`, {
      ...base,
      fill: DEFAULT_FILL,
    });
  }
  if (name === 'ring / donut') {
    return new fabric.Circle({
      ...base,
      radius: size / 2,
      fill: 'transparent',
      stroke: DEFAULT_STROKE,
      strokeWidth: size * 0.18,
    });
  }
  if (name === 'pill / capsule') {
    return new fabric.Rect({
      ...base,
      width: size * 1.4,
      height: size * 0.55,
      rx: size * 0.275,
      ry: size * 0.275,
    });
  }
  if (name === 'crescent') {
    return new fabric.Path(
      `M ${size * 0.15} ${-size / 2} A ${size / 2} ${size / 2} 0 1 0 ${size * 0.15} ${size / 2} A ${size * 0.35} ${size * 0.35} 0 1 1 ${size * 0.15} ${-size / 2} Z`,
      { ...base, fill: DEFAULT_FILL },
    );
  }

  return new fabric.Rect({ ...base, width: size, height: size * 0.75 });
}

function regularPolygon(
  fabric: FabricModule,
  sides: number,
  radius: number,
  base: Record<string, unknown>,
) {
  const points = Array.from({ length: sides }, (_, i) => {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  return new fabric.Polygon(points, base);
}
