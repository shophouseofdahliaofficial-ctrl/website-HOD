'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { textureCache, geometryCache, glbCache } from './ModelViewer3D';
import styles from './SitePreloader.module.css';

interface SitePreloaderProps {
  onComplete: () => void;
  onStartReveal?: () => void;
  onVideoTrigger?: () => void;
}

interface AssetDef {
  url: string;
  type: 'glb' | 'obj' | 'fbx' | 'texture';
  weight: number;
}

const ASSETS: AssetDef[] = [
  { url: '/fashion+model+3d+model-reduced (1).glb', type: 'glb', weight: 25 },
  { url: '/evening+dress+3d+model.glb', type: 'glb', weight: 25 },
  { url: '/realone.glb', type: 'glb', weight: 25 },
  { url: '/pink+sequin+dress+3d+model.glb', type: 'glb', weight: 25 },
  { url: '/nature_3dmodel.png', type: 'texture', weight: 3 },
  { url: '/back2.png', type: 'texture', weight: 3 },
  { url: '/whiteback.png', type: 'texture', weight: 3 },
  { url: '/sun.png', type: 'texture', weight: 3 },
  { url: '/pinkbackground.png', type: 'texture', weight: 3 },
];

export default function SitePreloader({ onComplete, onStartReveal, onVideoTrigger }: SitePreloaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const subTextRef = useRef<HTMLDivElement>(null);
  const [percent, setPercent] = useState(0);
  const targetPercentRef = useRef(0);
  const currentPercentRef = useRef(0);
  const isFinishedRef = useRef(false);

  useEffect(() => {
    let animId: number;
    let completedCount = 0;
    const totalAssets = ASSETS.length;
    const progressMap = new Map<string, number>();

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    const pseudoRandom = (seed: number) => {
      const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    ASSETS.forEach((a) => progressMap.set(a.url, 0));

    const computeWeightedProgress = () => {
      let totalWeighted = 0;
      let sumWeights = 0;
      ASSETS.forEach((a) => {
        sumWeights += a.weight;
        const p = progressMap.get(a.url) || 0;
        totalWeighted += p * a.weight;
      });
      return sumWeights > 0 ? totalWeighted / sumWeights : 0;
    };

    // Smooth counter tick loop
    const updateCounter = () => {
      if (!isFinishedRef.current) {
        currentPercentRef.current += (targetPercentRef.current - currentPercentRef.current) * 0.08;
        const rounded = Math.min(100, Math.round(currentPercentRef.current));
        setPercent(rounded);

        if (rounded >= 99 && targetPercentRef.current >= 100) {
          finishLoading();
          return;
        }
      }
      animId = requestAnimationFrame(updateCounter);
    };

    const finishLoading = () => {
      if (isFinishedRef.current) return;
      isFinishedRef.current = true;
      setPercent(100);

      const cvs = canvasRef.current;
      const ctx = cvs?.getContext('2d');

      const tl = gsap.timeline();

      // Step 1: Brief pause at 100%, then smooth fade-out for percentage and subtitle
      if (contentRef.current || subTextRef.current) {
        tl.to(
          [contentRef.current, subTextRef.current].filter(Boolean),
          {
            opacity: 0,
            scale: 0.95,
            duration: 0.45,
            ease: 'power2.out',
            delay: 0.2,
          }
        );
      }

      // Step 2: Switch container background to transparent for canvas control
      if (cvs && ctx) {
        tl.add(() => {
          if (containerRef.current) {
            containerRef.current.style.backgroundColor = 'transparent';
          }
        });

        const PIXEL_SIZE = 16;
        const width = (cvs.width = window.innerWidth);
        const height = (cvs.height = window.innerHeight);
        const cols = Math.ceil(width / PIXEL_SIZE);
        const rows = Math.ceil(height / PIXEL_SIZE);
        const cx = width / 2;
        const cy = height / 2;
        const maxDist = Math.hypot(cx, cy);
        const dotSize = Math.round(PIXEL_SIZE * 1.2); // +20% bigger initial blinking dot
        const dotPx = Math.round(cx - dotSize / 2);
        const dotPy = Math.round(cy - dotSize / 2);

        // Step 3: Single center dot blinks 3 times (appears immediately, fades out smoothly)
        const blinkState = { alpha: 0 };
        const drawBlinkFrame = () => {
          ctx.clearRect(0, 0, width, height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          if (blinkState.alpha > 0.01) {
            ctx.fillStyle = `rgba(83, 0, 0, ${blinkState.alpha.toFixed(3)})`;
            ctx.fillRect(dotPx, dotPy, dotSize, dotSize);
          }
        };

        for (let i = 0; i < 3; i++) {
          tl.set(blinkState, { alpha: 1.0, onUpdate: drawBlinkFrame });
          tl.to(blinkState, {
            alpha: 0.0,
            duration: 0.68,
            ease: 'power2.out',
            onUpdate: drawBlinkFrame,
          });
          tl.to({}, { duration: 0.18 }); // breathing pause between blinks
        }

        // Step 4: Ultra-slow cinematic growth (4.6s) with a wider, expansive forward spread
        const progressObj = { val: 0 };
        let hasTriggeredVideo = false;

        tl.to(progressObj, {
          val: 1,
          duration: 4.6, // Ultra-slow, deliberate cinematic pace
          ease: 'power2.inOut', // Starts gently and swells outward in wide spread
          onUpdate: () => {
            if (progressObj.val >= 0.72 && !hasTriggeredVideo) {
              hasTriggeredVideo = true;
              onVideoTrigger?.();
            }

            ctx.clearRect(0, 0, width, height);

            // Stable high-definition grid size (prevents any grid jumping or quantization flicker)
            const PIXEL_SIZE = 22;
            const cols = Math.ceil(width / PIXEL_SIZE);
            const rows = Math.ceil(height / PIXEL_SIZE);
            const tileSize = PIXEL_SIZE + 0.8; // 0.8px subpixel overlap eliminates all rasterization seam lines

            const rThreshold = progressObj.val * (maxDist * 1.45);
            const noiseScale = Math.min(1.0, progressObj.val * 3.5);
            const coronaZone = PIXEL_SIZE * 9.0; // Forward smooth growth zone
            const crestWidth = PIXEL_SIZE * 2.2; // Solid active crest width
            const dissolveZone = PIXEL_SIZE * 10.0; // Smooth trailing shrink & dissolve zone

            // Luxury alphanumeric cipher character set
            const GLYPHS = ['H', 'O', 'D', '0', '1', '7', '8', '9', 'A', 'E', 'X', 'Z', 'V', 'K', '3', '4', 'F', '+', '§', 'Ø', '9', '2'];
            const fontSize = Math.max(8, Math.round(PIXEL_SIZE * 0.52));
            ctx.font = `600 ${fontSize}px 'Inter', -apple-system, monospace, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let c = 0; c < cols; c++) {
              for (let r = 0; r < rows; r++) {
                const px = c * PIXEL_SIZE;
                const py = r * PIXEL_SIZE;
                const dist = Math.hypot(px + PIXEL_SIZE / 2 - cx, py + PIXEL_SIZE / 2 - cy);
                const angle = Math.atan2(py + PIXEL_SIZE / 2 - cy, px + PIXEL_SIZE / 2 - cx);

                // Multi-frequency organic stepped noise curve scaling with radius
                const wave1 = Math.sin(angle * 5) * 0.18;
                const wave2 = Math.sin(angle * 11 + 1.4) * 0.14;
                const randomSpike = (pseudoRandom(c * 19 + r * 37) - 0.5) * 0.4;
                const noise = (wave1 + wave2 + randomSpike) * (rThreshold * 0.32 * noiseScale);

                const effectiveDist = dist + noise;
                const delta = rThreshold - effectiveDist;

                if (delta < -coronaZone) {
                  // Outer white mask: clean solid white far from the expanding shape
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(px, py, tileSize, tileSize);
                } else if (delta < 0) {
                  // Forward Spreading Fringe: cubes smoothly grow from 0 scale into full size
                  const growProgress = (delta + coronaZone) / coronaZone; // Smooth 0.0 -> 1.0 ramp
                  const cellSeed = pseudoRandom(c * 137 + r * 283);

                  // White mask background tile
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(px, py, tileSize, tileSize);

                  if (cellSeed < 0.75 * noiseScale) {
                    // Smooth scaling cube emergence
                    const easeGrow = Math.pow(growProgress, 1.3);
                    const cubeScale = easeGrow * (0.35 + 0.65 * (1 - cellSeed * 0.4));
                    const cubeAlpha = Math.min(1.0, Math.pow(growProgress, 1.1) * 1.15);
                    const cubeSize = PIXEL_SIZE * cubeScale;
                    const pOffset = (PIXEL_SIZE - cubeSize) / 2;

                    ctx.fillStyle = `rgba(83, 0, 0, ${cubeAlpha.toFixed(3)})`;
                    ctx.fillRect(px + pOffset, py + pOffset, cubeSize, cubeSize);

                    if (cubeScale > 0.55 && pseudoRandom(c * 47 + r * 73) < 0.5) {
                      const gIdx = Math.floor((pseudoRandom(c * 101 + r * 131) + progressObj.val * 4) * GLYPHS.length) % GLYPHS.length;
                      ctx.fillStyle = `rgba(255, 255, 255, ${(cubeAlpha * 0.9).toFixed(3)})`;
                      ctx.fillText(GLYPHS[gIdx], px + PIXEL_SIZE / 2, py + PIXEL_SIZE / 2);
                    }
                  }
                } else if (delta < crestWidth) {
                  // Active boundary pixel crest: full size solid burgundy pixel squares with crisp alphanumeric glyphs
                  ctx.fillStyle = '#530000';
                  ctx.fillRect(px, py, tileSize, tileSize);

                  if (pseudoRandom(c * 23 + r * 41) < 0.6) {
                    const gIdx = Math.floor((pseudoRandom(c * 67 + r * 89) + progressObj.val * 5) * GLYPHS.length) % GLYPHS.length;
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
                    ctx.fillText(GLYPHS[gIdx], px + PIXEL_SIZE / 2, py + PIXEL_SIZE / 2);
                  }
                } else if (delta < crestWidth + dissolveZone) {
                  // Trailing Dissolution Zone: cubes smoothly shrink and fade to transparent
                  const dissolveProgress = (delta - crestWidth) / dissolveZone; // Smooth 0.0 -> 1.0 ramp
                  const cellSeed = pseudoRandom(c * 43 + r * 67);

                  if (cellSeed < 0.65 * (1 - dissolveProgress * 0.5)) {
                    const shrinkScale = Math.max(0, 1.0 - Math.pow(dissolveProgress, 1.15));
                    const fadeAlpha = Math.max(0, Math.pow(1.0 - dissolveProgress, 1.35));
                    const cubeSize = PIXEL_SIZE * shrinkScale;
                    const pOffset = (PIXEL_SIZE - cubeSize) / 2;

                    ctx.fillStyle = `rgba(83, 0, 0, ${fadeAlpha.toFixed(3)})`;
                    ctx.fillRect(px + pOffset, py + pOffset, cubeSize, cubeSize);

                    if (shrinkScale > 0.48 && pseudoRandom(c * 31 + r * 53) < 0.5) {
                      const gIdx = Math.floor((pseudoRandom(c * 71 + r * 97) + progressObj.val * 3) * GLYPHS.length) % GLYPHS.length;
                      ctx.fillStyle = `rgba(255, 255, 255, ${(fadeAlpha * 0.9).toFixed(3)})`;
                      ctx.fillText(GLYPHS[gIdx], px + PIXEL_SIZE / 2, py + PIXEL_SIZE / 2);
                    }
                  }
                }
              }
            }
          },
          onComplete: () => {
            ctx.clearRect(0, 0, width, height);
            onComplete();
          },
        });
      } else {
        onComplete();
      }
    };

    // Preload each asset
    const texLoader = new THREE.TextureLoader();
    const objLoader = new OBJLoader();
    const fbxLoader = new FBXLoader();
    const gltfLoader = new GLTFLoader();

    ASSETS.forEach((asset) => {
      if (asset.type === 'glb') {
        gltfLoader.load(
          asset.url,
          (gltf) => {
            glbCache.set(asset.url, gltf);
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
            if (completedCount >= totalAssets) {
              targetPercentRef.current = 100;
            }
          },
          (xhr) => {
            if (xhr.total > 0) {
              progressMap.set(asset.url, xhr.loaded / xhr.total);
              targetPercentRef.current = computeWeightedProgress() * 100;
            }
          },
          () => {
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
          }
        );
      } else if (asset.type === 'texture') {
        if (textureCache.has(asset.url)) {
          progressMap.set(asset.url, 1.0);
          completedCount++;
          targetPercentRef.current = computeWeightedProgress() * 100;
          return;
        }
        texLoader.load(
          asset.url,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            textureCache.set(asset.url, tex);
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
            if (completedCount >= totalAssets) {
              targetPercentRef.current = 100;
            }
          },
          (xhr) => {
            if (xhr.total > 0) {
              progressMap.set(asset.url, xhr.loaded / xhr.total);
              targetPercentRef.current = computeWeightedProgress() * 100;
            }
          },
          () => {
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
          }
        );
      } else if (asset.type === 'obj') {
        if (geometryCache.has(asset.url)) {
          progressMap.set(asset.url, 1.0);
          completedCount++;
          targetPercentRef.current = computeWeightedProgress() * 100;
          return;
        }
        objLoader.load(
          asset.url,
          (obj) => {
            obj.traverse((child) => {
              if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                if (mesh.geometry) {
                  mesh.geometry.computeVertexNormals();
                  geometryCache.set(asset.url, mesh.geometry);
                }
              }
            });
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
            if (completedCount >= totalAssets) {
              targetPercentRef.current = 100;
            }
          },
          (xhr) => {
            if (xhr.total > 0) {
              progressMap.set(asset.url, xhr.loaded / xhr.total);
              targetPercentRef.current = computeWeightedProgress() * 100;
            }
          },
          () => {
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
          }
        );
      } else if (asset.type === 'fbx') {
        fbxLoader.load(
          asset.url,
          () => {
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
            if (completedCount >= totalAssets) {
              targetPercentRef.current = 100;
            }
          },
          (xhr) => {
            if (xhr.total > 0) {
              progressMap.set(asset.url, xhr.loaded / xhr.total);
              targetPercentRef.current = computeWeightedProgress() * 100;
            }
          },
          () => {
            progressMap.set(asset.url, 1.0);
            completedCount++;
            targetPercentRef.current = computeWeightedProgress() * 100;
          }
        );
      }
    });

    animId = requestAnimationFrame(updateCounter);

    const handleResize = () => {
      if (canvasRef.current && !isFinishedRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#530000';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    // Safety fallback: if anything hangs on slow networks, ensure site reveals smoothly within 6.5s
    const safetyTimer = setTimeout(() => {
      targetPercentRef.current = 100;
    }, 6500);

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(safetyTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [onComplete]);

  return (
    <div ref={containerRef} className={styles.preloaderContainer}>
      <canvas ref={canvasRef} className={styles.pixelCanvas} />

      {/* Top Left Subtext */}
      <div ref={subTextRef} className={styles.topLeftWrap}>
        <span className={styles.subText}>Preparing your experience</span>
      </div>

      {/* Center Counter */}
      <div ref={contentRef} className={styles.contentWrap}>
        <div className={styles.counterWrap}>
          <span className={styles.shimmerText}>
            {percent}
            <span className={styles.percentSymbol}>%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
