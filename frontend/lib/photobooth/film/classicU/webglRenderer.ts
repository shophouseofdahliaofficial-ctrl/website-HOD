import { CLASSIC_U_RECIPE } from '../recipes/classic-u';
import type { ClassicURecipe } from './types';
import { CLASSIC_U_FRAG, CLASSIC_U_VERT } from './shaders';
import { uploadWebGLTextureSource } from '../platform';

type CanvasImageSourceLike = CanvasImageSource;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[ClassicU WebGL] shader compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, CLASSIC_U_VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, CLASSIC_U_FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[ClassicU WebGL] program link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export type ClassicUUniforms = {
  uTexture: WebGLUniformLocation | null;
  uResolution: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uMirror: WebGLUniformLocation | null;
  uExposure: WebGLUniformLocation | null;
  uContrast: WebGLUniformLocation | null;
  uHighlights: WebGLUniformLocation | null;
  uShadows: WebGLUniformLocation | null;
  uWhites: WebGLUniformLocation | null;
  uBlacks: WebGLUniformLocation | null;
  uTemperature: WebGLUniformLocation | null;
  uTint: WebGLUniformLocation | null;
  uSaturation: WebGLUniformLocation | null;
  uTexAmount: WebGLUniformLocation | null;
  uClarity: WebGLUniformLocation | null;
  uDehaze: WebGLUniformLocation | null;
  uGrainAmount: WebGLUniformLocation | null;
  uGrainSize: WebGLUniformLocation | null;
  uGrainRoughness: WebGLUniformLocation | null;
  uBlackLift: WebGLUniformLocation | null;
  uShadowLift: WebGLUniformLocation | null;
  uMidContrast: WebGLUniformLocation | null;
  uHighlightCompress: WebGLUniformLocation | null;
  uWhiteCeiling: WebGLUniformLocation | null;
  uRedHSL: WebGLUniformLocation | null;
  uOrangeHSL: WebGLUniformLocation | null;
  uYellowHSL: WebGLUniformLocation | null;
  uGreenHSL: WebGLUniformLocation | null;
  uBlueHSL: WebGLUniformLocation | null;
  uMagentaHSL: WebGLUniformLocation | null;
  uShadowGradeHue: WebGLUniformLocation | null;
  uShadowGradeSat: WebGLUniformLocation | null;
  uHighlightGradeHue: WebGLUniformLocation | null;
  uHighlightGradeSat: WebGLUniformLocation | null;
};

export class ClassicUWebGLRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGLRenderingContext;
  readonly program: WebGLProgram;
  readonly uniforms: ClassicUUniforms;
  readonly texture: WebGLTexture;
  readonly buffer: WebGLBuffer;
  width = 0;
  height = 0;

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    uniforms: ClassicUUniforms,
    texture: WebGLTexture,
    buffer: WebGLBuffer,
  ) {
    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.uniforms = uniforms;
    this.texture = texture;
    this.buffer = buffer;
  }

  static create(): ClassicUWebGLRenderer | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!gl) return null;

    const program = createProgram(gl);
    if (!program) return null;

    const loc = (name: string) => gl.getUniformLocation(program, name);
    const uniforms: ClassicUUniforms = {
      uTexture: loc('uTexture'),
      uResolution: loc('uResolution'),
      uTime: loc('uTime'),
      uMirror: loc('uMirror'),
      uExposure: loc('uExposure'),
      uContrast: loc('uContrast'),
      uHighlights: loc('uHighlights'),
      uShadows: loc('uShadows'),
      uWhites: loc('uWhites'),
      uBlacks: loc('uBlacks'),
      uTemperature: loc('uTemperature'),
      uTint: loc('uTint'),
      uSaturation: loc('uSaturation'),
      uTexAmount: loc('uTexAmount'),
      uClarity: loc('uClarity'),
      uDehaze: loc('uDehaze'),
      uGrainAmount: loc('uGrainAmount'),
      uGrainSize: loc('uGrainSize'),
      uGrainRoughness: loc('uGrainRoughness'),
      uBlackLift: loc('uBlackLift'),
      uShadowLift: loc('uShadowLift'),
      uMidContrast: loc('uMidContrast'),
      uHighlightCompress: loc('uHighlightCompress'),
      uWhiteCeiling: loc('uWhiteCeiling'),
      uRedHSL: loc('uRedHSL'),
      uOrangeHSL: loc('uOrangeHSL'),
      uYellowHSL: loc('uYellowHSL'),
      uGreenHSL: loc('uGreenHSL'),
      uBlueHSL: loc('uBlueHSL'),
      uMagentaHSL: loc('uMagentaHSL'),
      uShadowGradeHue: loc('uShadowGradeHue'),
      uShadowGradeSat: loc('uShadowGradeSat'),
      uHighlightGradeHue: loc('uHighlightGradeHue'),
      uHighlightGradeSat: loc('uHighlightGradeSat'),
    };

    const texture = gl.createTexture();
    const buffer = gl.createBuffer();
    if (!texture || !buffer) return null;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return new ClassicUWebGLRenderer(canvas, gl, program, uniforms, texture, buffer);
  }

  private setRecipeUniforms(recipe: ClassicURecipe, time: number, mirror: boolean): void {
    const gl = this.gl;
    const u = this.uniforms;
    const { light, whiteBalance, color, effects, grain, toneCurve, hsl, colorGrading } = recipe;

    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uMirror, mirror ? 1 : 0);
    gl.uniform2f(u.uResolution, this.width, this.height);

    gl.uniform1f(u.uExposure, light.exposure);
    gl.uniform1f(u.uContrast, light.contrast);
    gl.uniform1f(u.uHighlights, light.highlights);
    gl.uniform1f(u.uShadows, light.shadows);
    gl.uniform1f(u.uWhites, light.whites);
    gl.uniform1f(u.uBlacks, light.blacks);

    gl.uniform1f(u.uTemperature, whiteBalance.temperature);
    gl.uniform1f(u.uTint, whiteBalance.tint);
    gl.uniform1f(u.uSaturation, color.saturation);

    gl.uniform1f(u.uTexAmount, effects.texture);
    gl.uniform1f(u.uClarity, effects.clarity);
    gl.uniform1f(u.uDehaze, effects.dehaze);

    gl.uniform1f(u.uGrainAmount, grain.amount);
    gl.uniform1f(u.uGrainSize, grain.size);
    gl.uniform1f(u.uGrainRoughness, grain.roughness);

    gl.uniform1f(u.uBlackLift, toneCurve.blackLift);
    gl.uniform1f(u.uShadowLift, toneCurve.shadowLift);
    gl.uniform1f(u.uMidContrast, toneCurve.midContrast);
    gl.uniform1f(u.uHighlightCompress, toneCurve.highlightCompress);
    gl.uniform1f(u.uWhiteCeiling, toneCurve.whiteCeiling);

    gl.uniform3f(u.uRedHSL, hsl.red.hue, hsl.red.saturation, hsl.red.luminance);
    gl.uniform3f(u.uOrangeHSL, hsl.orange.hue, hsl.orange.saturation, hsl.orange.luminance);
    gl.uniform3f(u.uYellowHSL, hsl.yellow.hue, hsl.yellow.saturation, hsl.yellow.luminance);
    gl.uniform3f(u.uGreenHSL, hsl.green.hue, hsl.green.saturation, hsl.green.luminance);
    gl.uniform3f(u.uBlueHSL, hsl.blue.hue, hsl.blue.saturation, hsl.blue.luminance);
    gl.uniform3f(u.uMagentaHSL, hsl.magenta.hue, hsl.magenta.saturation, hsl.magenta.luminance);

    gl.uniform1f(u.uShadowGradeHue, colorGrading.shadows.hue);
    gl.uniform1f(u.uShadowGradeSat, colorGrading.shadows.saturation / 100);
    gl.uniform1f(u.uHighlightGradeHue, colorGrading.highlights.hue);
    gl.uniform1f(u.uHighlightGradeSat, colorGrading.highlights.saturation / 100);
  }

  render(
    source: CanvasImageSourceLike,
    width: number,
    height: number,
    recipe: ClassicURecipe = CLASSIC_U_RECIPE,
    time = 0,
    mirror = false,
  ): boolean {
    if (width <= 0 || height <= 0) return false;

    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.width = width;
      this.height = height;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    uploadWebGLTextureSource(gl, this.texture, source as TexImageSource);
    gl.uniform1i(this.uniforms.uTexture, 0);

    this.setRecipeUniforms(recipe, time, mirror);

    const posLoc = gl.getAttribLocation(this.program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
}

let sharedRenderer: ClassicUWebGLRenderer | null = null;

export function getClassicUWebGLRenderer(): ClassicUWebGLRenderer | null {
  if (sharedRenderer) return sharedRenderer;
  sharedRenderer = ClassicUWebGLRenderer.create();
  return sharedRenderer;
}

export function renderClassicUToCanvas(
  target: HTMLCanvasElement,
  source: CanvasImageSourceLike,
  width: number,
  height: number,
  recipe: ClassicURecipe = CLASSIC_U_RECIPE,
  time = 0,
  mirror = false,
): boolean {
  const renderer = getClassicUWebGLRenderer();
  if (!renderer) return false;
  if (!renderer.render(source, width, height, recipe, time, mirror)) return false;

  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(renderer.canvas, 0, 0);
  return true;
}
