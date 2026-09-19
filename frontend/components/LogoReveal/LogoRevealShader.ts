/**
 * LogoRevealShader.ts
 * Dual-Texture Local Organic Dissolve Reveal with Behind-Logo Glowing Aura
 * - Primary Logo: Clean Scribble Black Logo (scribble-logo-bw.png)
 * - Secondary Logo: Organic Graphic Overlay (ChatGPT Image Sep 12, 2026, 06_37_15 PM.png)
 * - Behind-Logo Glowing Shimmer: A soft radiant glowing aura sweeps from BEHIND the logo outline.
 * - Hover State: Cursor opens a grainy organic dissolve portal revealing a portion of the secondary logo.
 */

export const logoRevealVertexShader = /* glsl */ `
  varying vec2 vUv;
  
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const logoRevealFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;        // Primary logo (scribble-logo-bw.png)
  uniform sampler2D uTextureOverlay; // Secondary artwork logo (ChatGPT Image Sep 12, 2026, 06_37_15 PM.png)
  uniform vec2 uResolution;
  uniform float uLogoAspect;      // Logo texture aspect ratio (width / height)
  uniform float uTime;

  // --- INITIAL LOAD ANIMATION UNIFORMS ---
  uniform float uFadeIn;          // Container smooth fade-in (0.0 to 1.0)

  // --- SYSTEM A: MOUSE HOVER (Liquid + Dissolve + Grain) ---
  uniform vec2 uMouse;            // Exact plane UV cursor position (0.0 to 1.0)
  uniform vec2 uMouseVelocity;    // Mouse velocity vector
  uniform float uHover;           // Hover factor (0.0 = away/clean, 1.0 = hovering over logo)
  uniform vec2 uHoverTrail;       // Trailing cursor position

  // --- SYSTEM B: SCROLL (Zoom only, zero grain) ---
  uniform float uScrollProgress;  // GSAP ScrollTrigger progress (0.0 to 1.0)

  varying vec2 vUv;

  // --- Fast Simplex 2D Noise ---
  vec3 permute(vec3 x) { 
    return mod(((x * 34.0) + 1.0) * x, 289.0); 
  }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
     -0.577350269189626,
      0.024390243902439
    );
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // --- Fast 2-Octave FBM ---
  float fastFbm(vec2 st) {
    float value = 0.5 * snoise(st);
    value += 0.25 * snoise(st * 2.1);
    return value;
  }

  void main() {
    vec2 aspectVec = vec2(uLogoAspect, 1.0);
    vec2 currentUv = vUv;

    // --- 1. SYSTEM A: SUBTLE LOCAL LIQUID DEFORMATION ---
    if (uHover > 0.001) {
      float distCursor = length((vUv - uMouse) * aspectVec);
      float distTrail  = length((vUv - uHoverTrail) * aspectVec);

      float infCursor = smoothstep(0.35, 0.0, distCursor) * uHover;
      float infTrail  = smoothstep(0.40, 0.0, distTrail) * uHover * 0.7;
      float totalInfluence = max(infCursor, infTrail);

      vec2 noiseSt = (vUv - vec2(0.5)) * 3.5;
      float n1 = fastFbm(noiseSt * 1.5 + vec2(uTime * 0.12));
      float n2 = snoise(noiseSt * 4.0 - vec2(uTime * 0.15, -uTime * 0.08));
      vec2 organicOffset = vec2(n1, n2);

      vec2 pushDir = (vUv - uMouse) + uMouseVelocity * 0.25;

      vec2 liquidDisplacement = (pushDir * 0.07 + organicOffset * 0.02) * totalInfluence;
      currentUv -= liquidDisplacement;
    }

    // --- 2. SAMPLE PRIMARY LOGO TEXTURE ---
    vec4 texPrimary = texture2D(uTexture, currentUv);
    if (currentUv.x < 0.0 || currentUv.x > 1.0 || currentUv.y < 0.0 || currentUv.y > 1.0) {
      texPrimary = vec4(0.0);
    }
    float rawAlpha1 = texPrimary.a;
    float cleanMask1 = smoothstep(0.08, 0.28, rawAlpha1);

    // --- 3. SAMPLE SECONDARY OVERLAY TEXTURE ---
    vec4 texOverlay = texture2D(uTextureOverlay, currentUv);
    if (currentUv.x < 0.0 || currentUv.x > 1.0 || currentUv.y < 0.0 || currentUv.y > 1.0) {
      texOverlay = vec4(0.0);
    }

    // Boost saturation & vibrancy of secondary artwork logo
    float luminance = dot(texOverlay.rgb, vec3(0.2126, 0.7152, 0.0722));
    vec3 saturatedOverlayRGB = mix(vec3(luminance), texOverlay.rgb, 1.85); // 85% Saturation Boost
    saturatedOverlayRGB = pow(saturatedOverlayRGB, vec3(0.92)); // Richer contrast & vibrancy

    vec3 logoPrimaryRGB = texPrimary.rgb;
    if (rawAlpha1 < 0.01) {
      logoPrimaryRGB = vec3(0.0);
    }

    // --- 4. ZERO HOVER (uHover <= 0.001): RENDER CLEAN PRIMARY LOGO ---
    if (uHover <= 0.001) {
      float scrollFade = 1.0 - smoothstep(0.88, 1.0, uScrollProgress);
      float finalAlphaZero = cleanMask1 * scrollFade * uFadeIn;
      gl_FragColor = vec4(logoPrimaryRGB, finalAlphaZero);
      return;
    }

    // --- 5. HOVER STATE: LOCAL ORGANIC DISSOLVE REVEAL OF SECONDARY LOGO ---
    float distCursor = length((vUv - uMouse) * aspectVec);

    vec2 st = (vUv - vec2(0.5)) * 4.0;
    float bigGrain = snoise(st * 12.0 + vec2(-uTime * 0.2, uTime * 0.12));
    float macroNoise = fastFbm(st * 1.8 + vec2(uTime * 0.08));

    // Local organic dissolve portal around cursor position
    float noiseDissolve = bigGrain * 0.5 + macroNoise * 0.5;
    float revealRadius = 0.35 + noiseDissolve * 0.09;
    float overlayRevealMask = smoothstep(revealRadius, 0.02, distCursor) * uHover;

    // Blend primary logo and saturated secondary overlay artwork
    vec3 finalRGB = mix(logoPrimaryRGB, saturatedOverlayRGB, overlayRevealMask * texOverlay.a * 0.95);

    // Edge gradient detection for local organic grain
    vec2 eps = vec2(0.005, 0.005);
    float aRight = smoothstep(0.08, 0.28, texture2D(uTexture, currentUv + vec2(eps.x, 0.0)).a);
    float aUp    = smoothstep(0.08, 0.28, texture2D(uTexture, currentUv + vec2(0.0, eps.y)).a);
    float edgeGradient = abs(cleanMask1 - aRight) + abs(cleanMask1 - aUp);
    float isEdge = smoothstep(0.02, 0.35, edgeGradient);

    float cursorInfluence = smoothstep(0.42, 0.0, distCursor) * uHover;
    float localGrain = isEdge * cursorInfluence * (bigGrain * 0.65 + macroNoise * 0.35);

    float combinedMask = max(cleanMask1, texOverlay.a * overlayRevealMask);
    float finalAlpha = clamp(combinedMask - localGrain * 0.75, 0.0, 1.0);

    if (isEdge > 0.05 && cursorInfluence > 0.05) {
      float particlePattern = snoise(vUv * 28.0 + vec2(uTime * 0.35));
      float particleMask = smoothstep(-0.2, 0.5, particlePattern + bigGrain * 0.4);
      finalAlpha *= mix(1.0, particleMask, cursorInfluence * isEdge * 0.88);
    }

    // --- 6. SYSTEM B: SCROLL FADE-OUT AT END OF ZOOM ---
    float scrollFade = 1.0 - smoothstep(0.88, 1.0, uScrollProgress);
    finalAlpha *= scrollFade * uFadeIn;

    gl_FragColor = vec4(finalRGB, finalAlpha);
  }
`;
