import { INST_SQC_RECIPE } from '../recipes/inst-sqc';
import type { InstSQCRecipe } from './types';
import { INST_SQC_FRAG, INST_SQC_VERT } from './shaders';
import { uploadWebGLTextureSource } from '../platform';

type CanvasImageSourceLike = CanvasImageSource;

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[InstSQC WebGL] shader compile:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, INST_SQC_VERT);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, INST_SQC_FRAG);
  if (!vs || !fs) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[InstSQC WebGL] program link:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export type InstSQCUniforms = Record<string, WebGLUniformLocation | null>;

export class InstSQCWebGLRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGLRenderingContext;
  readonly program: WebGLProgram;
  readonly uniforms: InstSQCUniforms;
  readonly texture: WebGLTexture;
  readonly buffer: WebGLBuffer;
  width = 0;
  height = 0;

  private constructor(
    canvas: HTMLCanvasElement,
    gl: WebGLRenderingContext,
    program: WebGLProgram,
    uniforms: InstSQCUniforms,
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

  static create(): InstSQCWebGLRenderer | null {
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

    const names = [
      'uTexture', 'uResolution', 'uTime', 'uMirror', 'uQuality',
      'uEnableHdr', 'uEnableMicrocontrast', 'uEnableCream', 'uEnablePastel',
      'uEnableShadowPoll', 'uEnableDevVar', 'uEnableChromatic', 'uEnableGrain',
      'uEnableEdgeDev', 'uEnableFilmLat',
      'uDynamicRange', 'uHighlightRoll', 'uShadowLoss', 'uMidtonePriority',
      'uMicrocontrast', 'uEdgeSoft', 'uChromatic', 'uFieldCurvature',
      'uCreamHighlight', 'uCreamWarmth', 'uPastelStrength', 'uShadowPollution',
      'uShadowGradeHue', 'uLatBrightDesat', 'uLatDarkMuddy',
      'uGrainAmount', 'uGrainSize', 'uDevVariation',
      'uEdgeWeak', 'uCornerCool', 'uBottomWarm',
    ];
    const uniforms: InstSQCUniforms = {};
    for (const name of names) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

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

    return new InstSQCWebGLRenderer(canvas, gl, program, uniforms, texture, buffer);
  }

  private setRecipeUniforms(
    recipe: InstSQCRecipe,
    time: number,
    mirror: boolean,
    quality: number,
  ): void {
    const gl = this.gl;
    const u = this.uniforms;
    const { stages, camera, film, print } = recipe;

    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uMirror, mirror ? 1 : 0);
    gl.uniform1f(u.uQuality, quality);
    gl.uniform2f(u.uResolution, this.width, this.height);

    gl.uniform1f(u.uEnableHdr, stages.hdrDestroyer ? 1 : 0);
    gl.uniform1f(u.uEnableMicrocontrast, stages.microcontrastDestroyer ? 1 : 0);
    gl.uniform1f(u.uEnableCream, stages.creamHighlights ? 1 : 0);
    gl.uniform1f(u.uEnablePastel, stages.pastelDyeMapper ? 1 : 0);
    gl.uniform1f(u.uEnableShadowPoll, stages.shadowPollution ? 1 : 0);
    gl.uniform1f(u.uEnableDevVar, stages.developmentVariation ? 1 : 0);
    gl.uniform1f(u.uEnableChromatic, stages.chromaticAberration ? 1 : 0);
    gl.uniform1f(u.uEnableGrain, stages.luminanceGrain ? 1 : 0);
    gl.uniform1f(u.uEnableEdgeDev, stages.edgeDevelopment ? 1 : 0);
    gl.uniform1f(u.uEnableFilmLat, stages.filmLatitude ? 1 : 0);

    gl.uniform1f(u.uDynamicRange, camera.dynamicRange);
    gl.uniform1f(u.uHighlightRoll, camera.highlightRoll);
    gl.uniform1f(u.uShadowLoss, camera.shadowLoss);
    gl.uniform1f(u.uMidtonePriority, camera.midtonePriority);
    gl.uniform1f(u.uMicrocontrast, camera.microcontrastReduction);
    gl.uniform1f(u.uEdgeSoft, camera.edgeSoftness);
    gl.uniform1f(u.uChromatic, camera.chromaticAberration);
    gl.uniform1f(u.uFieldCurvature, camera.fieldCurvature);

    gl.uniform1f(u.uCreamHighlight, film.creamHighlight);
    gl.uniform1f(u.uCreamWarmth, film.creamWarmth);
    gl.uniform1f(u.uPastelStrength, film.pastelStrength);
    gl.uniform1f(u.uShadowPollution, film.shadowPollution);
    gl.uniform1f(u.uShadowGradeHue, film.shadowGradeHue);
    gl.uniform1f(u.uLatBrightDesat, film.latitudeBrightDesat);
    gl.uniform1f(u.uLatDarkMuddy, film.latitudeDarkMuddy);

    gl.uniform1f(u.uGrainAmount, print.grainAmount);
    gl.uniform1f(u.uGrainSize, print.grainSize);
    gl.uniform1f(u.uDevVariation, print.developmentVariation);
    gl.uniform1f(u.uEdgeWeak, print.edgeWeakness);
    gl.uniform1f(u.uCornerCool, print.cornerCool);
    gl.uniform1f(u.uBottomWarm, print.bottomWarm);
  }

  render(
    source: CanvasImageSourceLike,
    width: number,
    height: number,
    recipe: InstSQCRecipe = INST_SQC_RECIPE,
    time = 0,
    mirror = false,
    quality: 'preview' | 'capture' = 'preview',
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

    this.setRecipeUniforms(recipe, time, mirror, quality === 'capture' ? 1.0 : 0.0);

    const posLoc = gl.getAttribLocation(this.program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }
}

let sharedRenderer: InstSQCWebGLRenderer | null = null;
const SHADER_GENERATION = 33;
let sharedGeneration = 0;

export function getInstSQCWebGLRenderer(): InstSQCWebGLRenderer | null {
  if (sharedRenderer && sharedGeneration === SHADER_GENERATION) return sharedRenderer;
  sharedRenderer = InstSQCWebGLRenderer.create();
  sharedGeneration = SHADER_GENERATION;
  return sharedRenderer;
}

export function renderInstSQCToCanvas(
  target: HTMLCanvasElement,
  source: CanvasImageSourceLike,
  width: number,
  height: number,
  recipe: InstSQCRecipe = INST_SQC_RECIPE,
  time = 0,
  mirror = false,
  quality: 'preview' | 'capture' = 'capture',
): boolean {
  const renderer = getInstSQCWebGLRenderer();
  if (!renderer) return false;
  if (!renderer.render(source, width, height, recipe, time, mirror, quality)) return false;

  target.width = width;
  target.height = height;
  const ctx = target.getContext('2d');
  if (!ctx) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(renderer.canvas, 0, 0);
  return true;
}
