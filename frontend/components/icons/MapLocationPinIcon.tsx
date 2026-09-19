import type { SVGProps } from 'react';

/** Same path as the centre pin in `AddressLocationPicker` (customer add/edit address map). */
export const MAP_LOCATION_PIN_PATH =
  'M6,0C3.2385864,0,1,2.2385864,1,5s2.5,5,5,7c2.5-2,5-4.2385864,5-7S8.7614136,0,6,0z M6,7 C4.8954468,7,4,6.1045532,4,5s0.8954468-2,2-2s2,0.8954468,2,2S7.1045532,7,6,7z';

/** Data URL for `google.maps.Marker` icon (same pin as customer map picker). */
export function mapLocationPinIconDataUrl(pixelSize = 48, fill = '#0062ff'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="${pixelSize}" height="${pixelSize}"><path d="${MAP_LOCATION_PIN_PATH}" fill="${fill}"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export type MapLocationPinIconProps = SVGProps<SVGSVGElement> & {
  /** Default matches customer map picker */
  pinFill?: string;
};

export default function MapLocationPinIcon({
  pinFill = '#0062ff',
  className,
  ...rest
}: MapLocationPinIconProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden
      {...rest}
    >
      <path d={MAP_LOCATION_PIN_PATH} fill={pinFill} />
    </svg>
  );
}
