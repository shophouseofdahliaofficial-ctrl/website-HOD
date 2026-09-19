/** Classic U — isolated WebGL shaders (full Lightroom preset). */

export const CLASSIC_U_VERT = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const CLASSIC_U_FRAG = `
precision highp float;

uniform sampler2D uTexture;
uniform vec2 uResolution;
uniform float uTime;
uniform float uMirror;

uniform float uExposure;
uniform float uContrast;
uniform float uHighlights;
uniform float uShadows;
uniform float uWhites;
uniform float uBlacks;
uniform float uTemperature;
uniform float uTint;
uniform float uSaturation;
uniform float uTexAmount;
uniform float uClarity;
uniform float uDehaze;
uniform float uGrainAmount;
uniform float uGrainSize;
uniform float uGrainRoughness;
uniform float uBlackLift;
uniform float uShadowLift;
uniform float uMidContrast;
uniform float uHighlightCompress;
uniform float uWhiteCeiling;
uniform vec3 uRedHSL;
uniform vec3 uOrangeHSL;
uniform vec3 uYellowHSL;
uniform vec3 uGreenHSL;
uniform vec3 uBlueHSL;
uniform vec3 uMagentaHSL;
uniform float uShadowGradeHue;
uniform float uShadowGradeSat;
uniform float uHighlightGradeHue;
uniform float uHighlightGradeSat;

varying vec2 vUv;

float lum(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

vec3 rgb2hsl(vec3 c) {
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
  return vec3(h / 6.0, s, l);
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
  if (hsl.y <= 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
  float p = 2.0 * hsl.z - q;
  return vec3(
    hue2rgb(p, q, hsl.x + 1.0 / 3.0),
    hue2rgb(p, q, hsl.x),
    hue2rgb(p, q, hsl.x - 1.0 / 3.0)
  );
}

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float filmNoise(vec2 uv, float roughness) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float t = mix(f.x * f.x * (3.0 - 2.0 * f.x), f.x, roughness);
  float u = mix(f.y * f.y * (3.0 - 2.0 * f.y), f.y, roughness);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, t), mix(c, d, t), u);
}

vec3 sampleTex(vec2 uv) {
  vec2 tuv = uv;
  if (uMirror > 0.5) tuv.x = 1.0 - tuv.x;
  return texture2D(uTexture, tuv).rgb;
}

vec3 softBlur(vec2 uv, float radius) {
  vec2 px = radius / uResolution;
  vec3 acc = vec3(0.0);
  acc += sampleTex(uv + vec2(-px.x, 0.0));
  acc += sampleTex(uv + vec2(px.x, 0.0));
  acc += sampleTex(uv + vec2(0.0, -px.y));
  acc += sampleTex(uv + vec2(0.0, px.y));
  acc += sampleTex(uv);
  return acc / 5.0;
}

vec3 applyHSLBand(vec3 rgb, vec3 hslAdjust, float hueMin, float hueMax) {
  vec3 hsl = rgb2hsl(rgb);
  float hDeg = hsl.x * 360.0;
  float inBand = 0.0;
  if (hueMin < hueMax) {
    inBand = smoothstep(hueMin - 10.0, hueMin + 6.0, hDeg)
           * (1.0 - smoothstep(hueMax - 6.0, hueMax + 10.0, hDeg));
  } else {
    inBand = max(
      smoothstep(hueMin - 10.0, hueMin + 6.0, hDeg),
      1.0 - smoothstep(hueMax - 6.0, hueMax + 10.0, hDeg)
    );
  }
  inBand *= smoothstep(0.03, 0.14, hsl.y);
  hsl.x = fract(hsl.x + hslAdjust.x / 360.0 * inBand);
  hsl.y = clamp(hsl.y + hslAdjust.y / 100.0 * 0.35 * inBand, 0.0, 1.0);
  hsl.z = clamp(hsl.z + hslAdjust.z / 100.0 * 0.22 * inBand, 0.0, 1.0);
  return hsl2rgb(hsl);
}

float matteToneCurve(float x) {
  float lift = uBlackLift + uBlacks / 100.0 * 0.06;
  x = lift + x * (1.0 - lift);
  x = x + uShadowLift * smoothstep(0.02, 0.38, x) * (1.0 - smoothstep(0.38, 0.72, x));
  float mid = x * x * (3.0 - 2.0 * x);
  x = mix(x, mid, uMidContrast);
  x = x * (1.0 - uHighlightCompress * smoothstep(0.55, 1.0, x));
  x = min(x, uWhiteCeiling);
  return clamp(x, 0.0, 1.0);
}

vec3 applyToneCurve(vec3 rgb) {
  return vec3(matteToneCurve(rgb.r), matteToneCurve(rgb.g), matteToneCurve(rgb.b));
}

vec3 applySplitGrade(vec3 rgb, float gradeHue, float gradeSat, float mask) {
  vec3 gradeColor = hsl2rgb(vec3(gradeHue / 360.0, gradeSat, lum(rgb) * 0.5 + 0.12));
  return mix(rgb, gradeColor, mask * gradeSat * 2.6);
}

void main() {
  vec2 uv = vUv;
  vec3 color = sampleTex(uv);

  // White balance
  color.r += uTemperature * 0.0045;
  color.b -= uTemperature * 0.0035;
  color.r += uTint * 0.0025;
  color.b += uTint * 0.0025;
  color.g -= uTint * 0.004;

  // Light
  color *= pow(2.0, uExposure);

  float contrastMult = 1.0 + uContrast / 100.0 * 0.7;
  color = (color - 0.5) * contrastMult + 0.5;

  float y = lum(color);
  color *= 1.0 - (uHighlights / 100.0 * 0.32) * smoothstep(0.50, 0.98, y);

  y = lum(color);
  color += (uShadows / 100.0 * 0.38) * (1.0 - smoothstep(0.06, 0.55, y));

  y = lum(color);
  color += (uWhites / 100.0 * 0.18) * smoothstep(0.62, 0.98, y);

  y = lum(color);
  color += (uBlacks / 100.0 * 0.12) * (1.0 - smoothstep(0.0, 0.30, y));

  // Tone curve — matte S-curve
  color = applyToneCurve(clamp(color, 0.0, 1.0));

  // Saturation
  if (abs(uSaturation) > 0.001) {
    float ly = lum(color);
    float satMult = 1.0 + uSaturation / 100.0 * 0.65;
    color = vec3(ly) + (color - vec3(ly)) * satMult;
  }

  // Color Mix (HSL)
  color = applyHSLBand(color, uRedHSL, 330.0, 18.0);
  color = applyHSLBand(color, uOrangeHSL, 10.0, 45.0);
  color = applyHSLBand(color, uYellowHSL, 35.0, 75.0);
  color = applyHSLBand(color, uGreenHSL, 75.0, 165.0);
  color = applyHSLBand(color, uBlueHSL, 195.0, 260.0);
  color = applyHSLBand(color, uMagentaHSL, 275.0, 335.0);

  // Color grading — shadows & highlights
  y = lum(color);
  float shadowMask = (1.0 - smoothstep(0.05, 0.55, y));
  shadowMask = shadowMask * shadowMask;
  color = applySplitGrade(color, uShadowGradeHue, uShadowGradeSat, shadowMask);

  y = lum(color);
  float highlightMask = smoothstep(0.42, 0.92, y);
  highlightMask = highlightMask * highlightMask;
  color = applySplitGrade(color, uHighlightGradeHue, uHighlightGradeSat, highlightMask);

  // Effects — clarity & dehaze (texture = 0)
  float softAmt = clamp(
    (-uTexAmount / 100.0) * 0.30 + (-uClarity / 100.0) * 0.44 + (-uDehaze / 100.0) * 0.22,
    0.0, 0.62
  );
  if (softAmt > 0.001) {
    color = mix(color, softBlur(uv, 1.2 + softAmt * 2.8), softAmt);
  }

  // Grain
  if (uGrainAmount > 0.001) {
    float gScale = max(0.5, uGrainSize / 25.0);
    float rough = clamp(uGrainRoughness / 100.0, 0.0, 1.0);
    vec2 gUv = uv * uResolution / (gScale * 1.4) + uTime * 13.0;
    float n = filmNoise(gUv, rough) - 0.5;
    float ly = lum(color);
    float shadowW = 1.0 - smoothstep(0.10, 0.75, ly);
    float grain = n * (uGrainAmount / 100.0) * 0.16 * (0.30 + shadowW * 0.70);
    color += grain;
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;
