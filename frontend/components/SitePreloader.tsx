'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';
import { textureCache, geometryCache } from './ModelViewer3D';
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
  { url: '/fashion+model+3d+model-reduced (1).glb', type: 'glb', weight: 40 },
  { url: '/rp_nathan_animated_003_walking.fbx', type: 'fbx', weight: 25 },
  { url: '/rp_nathan_animated_003_dif.jpg', type: 'texture', weight: 15 },
  { url: '/12248_Bird_v1_L2.obj', type: 'obj', weight: 10 },
  { url: '/12248_Bird_v1_diff.jpg', type: 'texture', weight: 10 },
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

        // Step 4: After 3 blinks, mask starts slowly from center dot and accelerates fast across screen
        const progressObj = { val: 0 };
        let hasTriggeredVideo = false;

        tl.to(progressObj, {
          val: 1,
          duration: 1.75,
          ease: 'power2.in', // Begins slowly as pixels emerge, then accelerates rapidly
          onUpdate: () => {
            if (progressObj.val >= 0.85 && !hasTriggeredVideo) {
              hasTriggeredVideo = true;
              onVideoTrigger?.();
            }

            ctx.clearRect(0, 0, width, height);

            // Dynamic pixel square size: starts at 16px and grows larger (up to 38px) as the aperture expands
            const curPixelSize = Math.round(16 + Math.pow(progressObj.val, 1.15) * 22);
            const curCols = Math.ceil(width / curPixelSize);
            const curRows = Math.ceil(height / curPixelSize);
            const tileSize = curPixelSize + 0.8; // 0.8px subpixel overlap eliminates all rasterization seam lines

            const rThreshold = progressObj.val * (maxDist * 1.35);
            // Smooth noise ramp: 0 at exact start (starts from 1 single square) and builds organic noise as circle grows
            const noiseScale = Math.min(1.0, progressObj.val * 3.5);
            const dissolveZone = Math.max(85, curPixelSize * 4.5);

            for (let c = 0; c < curCols; c++) {
              for (let r = 0; r < curRows; r++) {
                const px = c * curPixelSize;
                const py = r * curPixelSize;
                const dist = Math.hypot(px + curPixelSize / 2 - cx, py + curPixelSize / 2 - cy);
                const angle = Math.atan2(py + curPixelSize / 2 - cy, px + curPixelSize / 2 - cx);

                // Multi-frequency organic stepped noise curve scaling with radius
                const wave1 = Math.sin(angle * 5) * 0.18;
                const wave2 = Math.sin(angle * 11 + 1.4) * 0.14;
                const randomSpike = (pseudoRandom(c * 19 + r * 37) - 0.5) * 0.4;
                const noise = (wave1 + wave2 + randomSpike) * (rThreshold * 0.32 * noiseScale);

                const effectiveDist = dist + noise;

                const coronaZone = curPixelSize * 3.5; // Corona band right ahead of the expanding crest

                if (effectiveDist > rThreshold + curPixelSize + coronaZone) {
                  // Outer white mask: clean solid white far from the expanding shape
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(px, py, tileSize, tileSize);
                } else if (effectiveDist > rThreshold + curPixelSize) {
                  // Forward fringe: random scattered pixel squares budding close to the outgrowing perimeter
                  const distAhead = effectiveDist - (rThreshold + curPixelSize);
                  const proximity = 1 - (distAhead / coronaZone); // 1 near crest, 0 at outer corona edge
                  const scatterChance = (0.52 * Math.pow(proximity, 1.2) + 0.08) * noiseScale;
                  const cellRand = pseudoRandom(c * 137 + r * 283);

                  if (cellRand < scatterChance) {
                    const scatterScale = 0.4 + 0.6 * proximity;
                    const pOffset = (curPixelSize * (1 - scatterScale)) / 2;
                    const scatterAlpha = Math.min(1.0, 0.35 + proximity * 0.65);

                    if (proximity > 0.7) {
                      // Close to crest: transparent cutout with sharp burgundy square
                      ctx.fillStyle = `rgba(83, 0, 0, ${scatterAlpha.toFixed(3)})`;
                      ctx.fillRect(px + pOffset, py + pOffset, curPixelSize * scatterScale, curPixelSize * scatterScale);
                    } else {
                      // Outer fringe: white tile base with budding burgundy pixel accent
                      ctx.fillStyle = '#ffffff';
                      ctx.fillRect(px, py, tileSize, tileSize);
                      ctx.fillStyle = `rgba(83, 0, 0, ${scatterAlpha.toFixed(3)})`;
                      ctx.fillRect(px + pOffset, py + pOffset, curPixelSize * scatterScale, curPixelSize * scatterScale);
                    }
                  } else {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(px, py, tileSize, tileSize);
                  }
                } else if (effectiveDist > rThreshold) {
                  // Active boundary pixel crest: signature burgundy pixel squares (growing in size)
                  ctx.fillStyle = '#530000';
                  ctx.fillRect(px, py, tileSize, tileSize);
                } else if (effectiveDist > rThreshold - dissolveZone) {
                  // Dissolve slowly into the screen: progressive shrinking scale & fading alpha burgundy pixels
                  const distanceBehind = rThreshold - effectiveDist;
                  const dissolveRatio = 1 - distanceBehind / dissolveZone;
                  const spawnChance = (0.42 * dissolveRatio + 0.15) * noiseScale;
                  if (pseudoRandom(c * 43 + r * 67) < spawnChance) {
                    const alpha = Math.pow(dissolveRatio, 1.25);
                    const pScale = 0.35 + 0.65 * dissolveRatio;
                    const pOffset = (curPixelSize * (1 - pScale)) / 2;
                    ctx.fillStyle = `rgba(83, 0, 0, ${alpha.toFixed(3)})`;
                    ctx.fillRect(px + pOffset, py + pOffset, curPixelSize * pScale, curPixelSize * pScale);
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
