/** Inst SQC v3.2 — staged pipeline; color ops in HSL only. */

export const INST_SQC_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const INST_SQC_FRAG = `
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMirror;
uniform float uQuality;

uniform float uEnableHdr;
uniform float uEnableMicrocontrast;
uniform float uEnableCream;
uniform float uEnablePastel;
uniform float uEnableShadowPoll;
uniform float uEnableDevVar;
uniform float uEnableChromatic;
uniform float uEnableGrain;
uniform float uEnableEdgeDev;
uniform float uEnableFilmLat;

uniform float uDynamicRange;
uniform float uHighlightRoll;
uniform float uShadowLoss;
uniform float uMidtonePriority;
uniform float uMicrocontrast;
uniform float uEdgeSoft;
uniform float uChromatic;
uniform float uFieldCurvature;

uniform float uCreamHighlight;
uniform float uCreamWarmth;
uniform float uPastelStrength;
uniform float uShadowPollution;
uniform float uShadowGradeHue;
uniform float uLatBrightDesat;
uniform float uLatDarkMuddy;

uniform float uGrainAmount;
uniform float uGrainSize;
uniform float uDevVariation;
uniform float uEdgeWeak;
uniform float uCornerCool;
uniform float uBottomWarm;

varying vec2 vUv;

float lum(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 clamp01(vec3 c) {
  return clamp(c, 0.0, 1.0);
}

vec3 rgb2hsl(vec3 c) {
  c = clamp01(c);
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float l = (mx + mn) * 0.5;
  if (mx == mn) return vec3(0.0, 0.0, l);
  float d = mx - mn;
  float s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
  float h;
  if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
  else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
  else h = (c.r - c.g) / d + 4.0;
  return vec3(h / 6.0, clamp(s, 0.0, 1.0), clamp(l, 0.0, 1.0));
}

float hue2rgb(float p, float q, float t) {
  if (t < 0.0) t += 1.0;
  if (t > 1.0) t -= 1.0;
  if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
  if (t < 0.5) return q;
  if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl) {
  hsl.y = clamp(hsl.y, 0.0, 1.0);
  hsl.z = clamp(hsl.z, 0.0, 1.0);
  if (hsl.y <= 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return clamp01(vec3(
    hue2rgb(p, q, fract(hsl.x + 1.0 / 3.0)),
    hue2rgb(p, q, fract(hsl.x)),
    hue2rgb(p, q, fract(hsl.x - 1.0 / 3.0))
  ));
}

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

vec2 mirrorUv(vec2 uv) {
  if (uMirror > 0.5) uv.x = 1.0 - uv.x;
  return uv;
}

vec3 sampleSource(vec2 uv) {
  return clamp01(texture2D(uTexture, mirrorUv(uv)).rgb);
}

vec3 sampleChromatic(vec2 uv) {
  vec2 c = uv - 0.5;
  float edge = smoothstep(0.20, 0.55, length(c));
  vec2 dir = normalize(c + vec2(0.0001));
  float ca = uChromatic * edge;
  float r = texture2D(uTexture, mirrorUv(uv + dir * ca)).r;
  float g = texture2D(uTexture, mirrorUv(uv)).g;
  float b = texture2D(uTexture, mirrorUv(uv - dir * ca)).b;
  return clamp01(vec3(r, g, b));
}

vec3 localMean(vec2 uv, float radius) {
  vec2 px = radius / uResolution;
  vec3 acc = sampleSource(uv);
  acc += sampleSource(uv + vec2(px.x, 0.0));
  acc += sampleSource(uv + vec2(-px.x, 0.0));
  acc += sampleSource(uv + vec2(0.0, px.y));
  acc += sampleSource(uv + vec2(0.0, -px.y));
  return acc / 5.0;
}

vec3 hdrDestroyer(vec3 color) {
  color = clamp01(color);
  float y = lum(color);
  color = color / (color + vec3(max(uDynamicRange, 0.08)));
  y = lum(color);
  color *= 1.0 - smoothstep(0.52, 0.94, y) * clamp(uHighlightRoll, 0.0, 1.0) * 0.48;
  y = lum(color);
  color = mix(vec3(0.045), color, smoothstep(0.0, 0.16 + clamp(uShadowLoss, 0.0, 1.0) * 0.14, y));
  y = lum(color);
  float mid = smoothstep(0.20, 0.56, y) * (1.0 - smoothstep(0.56, 0.82, y));
  color = mix(color, mix(vec3(y), color, 0.72), mid * clamp(uMidtonePriority, 0.0, 1.0) * 0.22);
  return clamp01(color);
}

vec3 stripMicroDetail(vec3 color, vec2 uv, float edgeAmt) {
  if (uMicrocontrast <= 0.001) return color;
  vec3 local = localMean(uv, 1.0 + uQuality * 0.4);
  float amt = clamp(uMicrocontrast, 0.0, 1.0) * (0.28 + edgeAmt * clamp(uEdgeSoft, 0.0, 1.0) * 0.35);
  amt = clamp(amt, 0.0, 0.55);
  return clamp01(mix(color, local, amt));
}

vec3 creamHighlights(vec3 color) {
  if (uCreamHighlight <= 0.001) return color;
  vec3 hsl = rgb2hsl(color);
  float hi = smoothstep(0.56, 0.88, hsl.z);
  float t = hi * clamp(uCreamHighlight, 0.0, 1.0);
  hsl.z = mix(hsl.z, min(hsl.z + 0.05, 0.94), t);
  hsl.y = mix(hsl.y, hsl.y * 0.94, t * 0.4);
  hsl.x = mix(hsl.x, 0.10, t * clamp(uCreamWarmth, 0.0, 1.0) * 0.12);
  return hsl2rgb(hsl);
}

vec3 mapPastelDye(vec3 color) {
  if (uPastelStrength <= 0.001) return color;
  vec3 hsl = rgb2hsl(color);
  float h = hsl.x * 360.0;
  float band = smoothstep(0.04, 0.18, hsl.y);
  vec3 targetHsl = hsl;
  if (h < 25.0 || h > 345.0) targetHsl = vec3(0.02, 0.38, hsl.z);
  else if (h < 55.0) targetHsl = vec3(0.09, 0.34, hsl.z);
  else if (h < 75.0) targetHsl = vec3(0.14, 0.32, hsl.z);
  else if (h < 165.0) targetHsl = vec3(0.48, 0.26, hsl.z);
  else if (h < 250.0) targetHsl = vec3(0.58, 0.28, hsl.z);
  else targetHsl = vec3(0.92, 0.28, hsl.z);
  if (hsl.y < 0.10 && hsl.z > 0.55) targetHsl = vec3(0.11, 0.07, hsl.z);
  float w = clamp(uPastelStrength, 0.0, 1.0) * band;
  hsl.x = mix(hsl.x, targetHsl.x, w);
  hsl.y = mix(hsl.y, targetHsl.y, w * 0.75);
  return hsl2rgb(hsl);
}

vec3 shadowPollute(vec3 color) {
  if (uShadowPollution <= 0.001) return color;
  vec3 hsl = rgb2hsl(color);
  float shadow = 1.0 - smoothstep(0.06, 0.42, hsl.z);
  shadow = shadow * shadow;
  float gradeHue = uShadowGradeHue / 360.0;
  hsl.x = mix(hsl.x, gradeHue, shadow * clamp(uShadowPollution, 0.0, 1.0) * 0.35);
  hsl.y = mix(hsl.y, min(hsl.y + 0.06, 0.45), shadow * clamp(uShadowPollution, 0.0, 1.0) * 0.25);
  return hsl2rgb(hsl);
}

vec3 filmLatitude(vec3 color) {
  vec3 hsl = rgb2hsl(color);
  float hiDesat = smoothstep(0.62, 0.92, hsl.z) * clamp(uLatBrightDesat, 0.0, 1.0);
  float loMud = (1.0 - smoothstep(0.06, 0.36, hsl.z)) * clamp(uLatDarkMuddy, 0.0, 1.0);
  hsl.y *= 1.0 - hiDesat * 0.5;
  hsl.y *= 1.0 - loMud * 0.4;
  hsl.z = mix(hsl.z, hsl.z * 0.92 + 0.04, loMud * 0.5);
  return hsl2rgb(hsl);
}

float grainMask(float y) {
  return smoothstep(0.06, 0.22, y) * (1.0 - smoothstep(0.78, 0.94, y));
}

vec3 applyGrain(vec3 color, vec2 uv) {
  if (uGrainAmount <= 0.001) return color;
  float y = lum(color);
  float mask = grainMask(y);
  float gScale = max(0.6, uGrainSize);
  vec2 gUv = uv * uResolution / (gScale * 1.5) + uTime * 11.0;
  float n = hash21(floor(gUv)) - 0.5;
  float g = n * clamp(uGrainAmount, 0.0, 1.0) * mask * 0.10;
  vec3 hsl = rgb2hsl(color);
  hsl.z = clamp(hsl.z + g, 0.0, 1.0);
  return hsl2rgb(hsl);
}

vec3 developmentVariation(vec3 color, vec2 uv) {
  if (uDevVariation <= 0.001) return color;
  float y = lum(color);
  float mid = smoothstep(0.15, 0.35, y) * (1.0 - smoothstep(0.65, 0.85, y));
  float n = hash21(uv * 3.7 + uTime * 0.03) - 0.5;
  float drift = n * clamp(uDevVariation, 0.0, 1.0) * mid * 0.012;
  vec3 hsl = rgb2hsl(color);
  hsl.z = clamp(hsl.z + drift, 0.0, 1.0);
  return hsl2rgb(hsl);
}

vec3 edgeDevelopment(vec3 color, vec2 uv) {
  vec2 c = uv - 0.5;
  c.x *= uResolution.x / max(uResolution.y, 1.0);
  float corner = smoothstep(0.35, 0.82, length(c));
  vec3 hsl = rgb2hsl(color);
  hsl.z *= 1.0 - corner * clamp(uEdgeWeak, 0.0, 1.0) * 0.5;
  hsl.x = mix(hsl.x, 0.55, corner * clamp(uCornerCool, 0.0, 1.0) * 0.08);
  float bottom = smoothstep(0.55, 1.0, uv.y);
  hsl.x = mix(hsl.x, 0.08, bottom * clamp(uBottomWarm, 0.0, 1.0) * 0.06);
  return hsl2rgb(hsl);
}

void main() {
  vec2 uv = vUv;
  vec2 c = uv - 0.5;
  c.x *= uResolution.x / max(uResolution.y, 1.0);
  float edgeAmt = smoothstep(0.18, 0.72, length(c));

  vec3 color = uEnableChromatic > 0.5 ? sampleChromatic(uv) : sampleSource(uv);

  if (uEnableHdr > 0.5) {
    color = hdrDestroyer(color);
  }

  if (uEnableMicrocontrast > 0.5) {
    color = stripMicroDetail(color, uv, edgeAmt);
  }

  if (uEnableCream > 0.5) {
    color = creamHighlights(color);
  }

  if (uEnablePastel > 0.5) {
    color = mapPastelDye(color);
  }

  if (uEnableShadowPoll > 0.5) {
    color = shadowPollute(color);
  }

  if (uEnableFilmLat > 0.5) {
    color = filmLatitude(color);
  }

  if (uEnableDevVar > 0.5) {
    color = developmentVariation(color, uv);
  }

  if (uEnableGrain > 0.5) {
    color = applyGrain(color, uv);
  }

  if (uEnableEdgeDev > 0.5) {
    color = edgeDevelopment(color, uv);
  }

  gl_FragColor = vec4(clamp01(color), 1.0);
}
`;
