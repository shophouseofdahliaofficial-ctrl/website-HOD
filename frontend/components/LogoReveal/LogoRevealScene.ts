import * as THREE from 'three';
import { logoRevealVertexShader, logoRevealFragmentShader } from './LogoRevealShader';

export interface LogoRevealSceneOptions {
  container: HTMLElement;
  logoUrl: string;
  overlayLogoUrl?: string;
  fillContainer?: boolean;
  instantFadeIn?: boolean;
  onLoaded?: () => void;
  onError?: (err: Error) => void;
}

export class LogoRevealScene {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private texture: THREE.Texture | null = null;
  private overlayTexture: THREE.Texture | null = null;

  private logoAspect = 1.0;
  
  // System B: Scroll & Zoom state
  private scrollProgress = 0.0;
  private initialScale = 0.35;
  private targetScale = 12.0;

  // System A: Mouse Liquid & Grain state
  private targetHover = 0.0;
  private currentHover = 0.0;
  private mouseTarget = new THREE.Vector2(0.5, 0.5);
  private mouseCurrent = new THREE.Vector2(0.5, 0.5);
  private mouseTrail = new THREE.Vector2(0.5, 0.5);
  private mouseVelocity = new THREE.Vector2(0.0, 0.0);
  private prevMousePos = new THREE.Vector2(0.5, 0.5);

  private rafId: number | null = null;
  private isDestroyed = false;
  private clock = new THREE.Clock();
  private fillContainer = false;

  constructor(options: LogoRevealSceneOptions) {
    this.container = options.container;
    this.fillContainer = !!options.fillContainer;

    // 1. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      precision: 'highp',
    });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0xffffff, 0);

    const canvas = this.renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    this.container.appendChild(canvas);

    // 2. Initialize Scene & Orthographic Camera
    this.scene = new THREE.Scene();
    const aspect = width / height;
    this.camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    // 3. Load Logo Textures & Build Plane Geometry
    const textureLoader = new THREE.TextureLoader();
    
    // Load primary logo texture
    textureLoader.load(
      options.logoUrl,
      (loadedPrimary) => {
        if (this.isDestroyed) return;
        this.texture = loadedPrimary;
        this.texture.generateMipmaps = true;
        this.texture.minFilter = THREE.LinearMipmapLinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.needsUpdate = true;

        const imgWidth = loadedPrimary.image.width || 1;
        const imgHeight = loadedPrimary.image.height || 1;
        this.logoAspect = imgWidth / imgHeight;

        // Load secondary overlay logo texture
        const overlayUrl = options.overlayLogoUrl || options.logoUrl;
        textureLoader.load(
          overlayUrl,
          (loadedOverlay) => {
            if (this.isDestroyed) return;
            this.overlayTexture = loadedOverlay;
            this.overlayTexture.generateMipmaps = true;
            this.overlayTexture.minFilter = THREE.LinearMipmapLinearFilter;
            this.overlayTexture.magFilter = THREE.LinearFilter;
            this.overlayTexture.needsUpdate = true;

            // Build Shader Material with dual textures
            this.material = new THREE.ShaderMaterial({
              vertexShader: logoRevealVertexShader,
              fragmentShader: logoRevealFragmentShader,
              uniforms: {
                uTexture: { value: this.texture },
                uTextureOverlay: { value: this.overlayTexture },
                uResolution: { value: new THREE.Vector2(width, height) },
                uLogoAspect: { value: this.logoAspect },
                uTime: { value: 0 },

                // Initial Load Fade (0.0 = hidden initially unless instantFadeIn is true)
                uFadeIn: { value: options.instantFadeIn ? 1.0 : 0.0 },
                
                // System A: Mouse Liquid + Grain
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uMouseVelocity: { value: new THREE.Vector2(0.0, 0.0) },
                uHover: { value: 0.0 },
                uHoverTrail: { value: new THREE.Vector2(0.5, 0.5) },

                // System B: Scroll Zoom
                uScrollProgress: { value: 0.0 },
              },
              transparent: true,
              depthTest: false,
              depthWrite: false,
            });

            // Unit height plane geometry preserving aspect ratio
            const geometry = new THREE.PlaneGeometry(2 * this.logoAspect, 2);
            this.mesh = new THREE.Mesh(geometry, this.material);
            
            this.updateScaleAndCamera();
            this.scene.add(this.mesh);

            if (options.onLoaded) {
              options.onLoaded();
            }

            this.startLoop();
          },
          undefined,
          (err) => {
            console.warn('[LogoRevealScene] Overlay texture fallback to primary:', err);
            this.overlayTexture = this.texture;
          }
        );
      },
      undefined,
      (err) => {
        console.error('[LogoRevealScene] Failed to load logo texture:', err);
        if (options.onError) {
          options.onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    );
  }

  /**
   * Smoothly fade in the logo
   */
  public fadeInLogo(durationSec = 0.75) {
    if (!this.material) return;
    const start = this.clock.getElapsedTime();
    const animateFade = () => {
      if (this.isDestroyed || !this.material) return;
      const elapsed = this.clock.getElapsedTime() - start;
      const progress = Math.min(1.0, elapsed / durationSec);
      // Smooth cubic easing
      const eased = Math.pow(progress, 2) * (3 - 2 * progress);
      this.material.uniforms.uFadeIn.value = eased;
      if (progress < 1.0) {
        requestAnimationFrame(animateFade);
      }
    };
    animateFade();
  }

  private updateScaleAndCamera() {
    if (!this.mesh) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    if (this.fillContainer) {
      this.initialScale = 1.0;
      this.targetScale = 1.0;
      this.mesh.scale.set(1.0, 1.0, 1);
      return;
    }

    const isMobile = width < 768;
    this.initialScale = isMobile ? 0.45 : 0.32;
    this.targetScale = isMobile ? 14.0 : 12.0;

    const easeProgress = Math.pow(this.scrollProgress, 2.2);
    const scale = this.initialScale + (this.targetScale - this.initialScale) * easeProgress;

    this.mesh.scale.set(scale, scale, 1);
  }

  // --- SYSTEM B: SCROLL CONTROL (Zoom Only) ---
  public updateScrollProgress(progress: number) {
    this.scrollProgress = Math.max(0, Math.min(1, progress));
    
    if (this.material) {
      this.material.uniforms.uScrollProgress.value = this.scrollProgress;
    }
    
    this.updateScaleAndCamera();
  }

  // --- SYSTEM A: MOUSE CONTROL ---
  public updateMouseFromScreen(clientX: number, clientY: number) {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;

    const ndcX = (clientX / width) * 2 - 1;
    const ndcY = -(clientY / height) * 2 + 1;

    const worldX = ndcX * aspect;
    const worldY = ndcY * 1.0;

    const currentScale = this.mesh ? this.mesh.scale.x : this.initialScale;
    const planeWidth = currentScale * 2 * this.logoAspect;
    const planeHeight = currentScale * 2;

    const uvX = 0.5 + worldX / planeWidth;
    const uvY = 0.5 + worldY / planeHeight;

    this.targetHover = 1.0;
    this.mouseTarget.set(uvX, uvY);

    const vx = (uvX - this.prevMousePos.x) * 10.0;
    const vy = (uvY - this.prevMousePos.y) * 10.0;
    this.mouseVelocity.set(
      Math.max(-1.5, Math.min(1.5, vx)),
      Math.max(-1.5, Math.min(1.5, vy))
    );
    this.prevMousePos.set(uvX, uvY);
  }

  public setHoverState(isHovering: boolean) {
    this.targetHover = isHovering ? 1.0 : 0.0;
  }

  public resize(width: number, height: number) {
    if (!this.renderer || !this.camera) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);

    const aspect = width / height;
    this.camera.left = -aspect;
    this.camera.right = aspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();

    if (this.material) {
      this.material.uniforms.uResolution.value.set(width, height);
    }

    this.updateScaleAndCamera();
  }

  private startLoop = () => {
    const tick = () => {
      if (this.isDestroyed) return;

      const elapsedTime = this.clock.getElapsedTime();

      // Smooth interpolation for hover activation
      this.currentHover += (this.targetHover - this.currentHover) * 0.15;
      if (this.currentHover < 0.001) this.currentHover = 0.0;

      // Fast cursor tracking
      this.mouseCurrent.lerp(this.mouseTarget, 0.65);
      this.mouseTrail.lerp(this.mouseCurrent, 0.25);
      this.mouseVelocity.multiplyScalar(0.90);

      if (this.material) {
        this.material.uniforms.uTime.value = elapsedTime;

        this.material.uniforms.uHover.value = this.currentHover;
        this.material.uniforms.uMouse.value.copy(this.mouseCurrent);
        this.material.uniforms.uHoverTrail.value.copy(this.mouseTrail);
        this.material.uniforms.uMouseVelocity.value.copy(this.mouseVelocity);
      }

      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };

    tick();
  };

  public destroy() {
    this.isDestroyed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.scene.remove(this.mesh);
    }

    if (this.material) {
      this.material.dispose();
    }

    if (this.texture) {
      this.texture.dispose();
    }

    if (this.overlayTexture && this.overlayTexture !== this.texture) {
      this.overlayTexture.dispose();
    }

    if (this.renderer) {
      this.renderer.dispose();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
    }
  }
}
