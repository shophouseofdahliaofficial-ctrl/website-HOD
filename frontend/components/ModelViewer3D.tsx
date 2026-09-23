'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import styles from './ModelViewer3D.module.css';

// In-memory module cache for high-performance zero-reloading across models
export const textureCache = new Map<string, THREE.Texture>();
export const geometryCache = new Map<string, THREE.BufferGeometry>();
export const glbCache = new Map<string, any>();

interface ModelViewer3DProps {
  modelPath?: string;
  texturePath?: string;
  autoRotateSpeed?: number;
  playAnimation?: boolean;
}

export default function ModelViewer3D({
  modelPath = '/12248_Bird_v1_L2.obj',
  texturePath = '/12248_Bird_v1_diff.jpg',
  autoRotateSpeed = 12.0,
  playAnimation = false,
}: ModelViewer3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const autoRotateSpeedRef = useRef(autoRotateSpeed);
  autoRotateSpeedRef.current = autoRotateSpeed;
  const [loading, setLoading] = useState(() => !geometryCache.has(modelPath));
  const [progress, setProgress] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Dynamic autoRotateSpeed update without scene teardown
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotateSpeed > 0;
      controlsRef.current.autoRotateSpeed = autoRotateSpeed;
    }
  }, [autoRotateSpeed]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    let mixer: THREE.AnimationMixer | null = null;
    const clock = new THREE.Clock();

    // 1. Scene setup
    const scene = new THREE.Scene();

    // 2. Camera setup
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3.4);

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);
    renderer.domElement.className = styles.canvas;

    // 4. OrbitControls: Horizontal turntable rotation only (vertical pitch locked)
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = autoRotateSpeed > 0;
    controls.autoRotateSpeed = autoRotateSpeed;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);
    controls.update();

    // Lock polar angle so dragging top/bottom does not pitch the model, but dragging left/right rotates horizontally
    const fixedPolar = controls.getPolarAngle();
    controls.minPolarAngle = fixedPolar;
    controls.maxPolarAngle = fixedPolar;

    // Pause auto-rotation while user touches/drags, and resume rotation when released
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
    });

    controls.addEventListener('end', () => {
      if (autoRotateSpeedRef.current > 0) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = autoRotateSpeedRef.current;
      }
    });

    // 5. Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe0dad4, 1.4);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Key front light
    const keyLight = new THREE.DirectionalLight(0xfffaf5, 2.4);
    keyLight.position.set(4, 7, 5);
    scene.add(keyLight);

    // Fill soft side light
    const fillLight = new THREE.DirectionalLight(0xf0f3f8, 1.4);
    fillLight.position.set(-5, 4, 3);
    scene.add(fillLight);

    // Rim light for silhouette definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.8);
    rimLight.position.set(0, 6, -5);
    scene.add(rimLight);

    // Bottom bounce
    const groundLight = new THREE.DirectionalLight(0xfcf8f5, 0.6);
    groundLight.position.set(0, -5, 2);
    scene.add(groundLight);

    // 6. Model Root Group
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // 7. Load or Reuse Texture Map
    const texLoader = new THREE.TextureLoader();
    let modelTexture: THREE.Texture | null = texturePath ? (textureCache.get(texturePath) || null) : null;
    if (!modelTexture && texturePath) {
      modelTexture = texLoader.load(
        texturePath,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.RepeatWrapping;
          tex.needsUpdate = true;
          textureCache.set(texturePath, tex);

          modelGroup.traverse((child) => {
            if ((child as THREE.Mesh).isMesh || (child as any).isSkinnedMesh) {
              const mesh = child as THREE.Mesh;
              if (mesh.material) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((m) => {
                  if ('map' in m) {
                    (m as THREE.MeshStandardMaterial).map = tex;
                    (m as THREE.MeshStandardMaterial).needsUpdate = true;
                  }
                });
              } else {
                mesh.material = new THREE.MeshStandardMaterial({
                  map: tex,
                  color: 0xffffff,
                  roughness: 0.52,
                  metalness: 0.05,
                  side: THREE.DoubleSide,
                });
              }
            }
          });
        },
        undefined,
        (err) => {
          console.error('Error loading texture map:', err);
        }
      );
    }

    // Material with texture support
    const baseMaterial = new THREE.MeshStandardMaterial({
      map: modelTexture,
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    let meshRef: THREE.Mesh | null = null;
    const isGlb = modelPath.toLowerCase().endsWith('.glb') || modelPath.toLowerCase().endsWith('.gltf');
    const isObj = modelPath.toLowerCase().endsWith('.obj');
    const cachedGeo = geometryCache.get(modelPath);

    // 8. Load or Reuse Cached Geometry / Models
    const isBird = modelPath.toLowerCase().includes('bird');
    if (isGlb) {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        modelPath,
        (gltf) => {
          const model = gltf.scene;
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh || (child as any).isSkinnedMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.frustumCulled = false;
              if (mesh.material) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((m) => {
                  m.side = THREE.DoubleSide;
                  m.needsUpdate = true;
                });
              }
            }
          });

          if (gltf.animations && gltf.animations.length > 0 && playAnimation) {
            mixer = new THREE.AnimationMixer(model);
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
          }

          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          const maxDim = Math.max(size.x, size.y, size.z) || 50;
          const targetHeight = 2.2;
          const scale = targetHeight / maxDim;
          model.scale.setScalar(scale);

          model.position.x = -center.x * scale;
          model.position.y = -center.y * scale;
          model.position.z = -center.z * scale;

          modelGroup.add(model);
          setLoading(false);
        },
        (xhr) => {
          if (xhr.total > 0) {
            setProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => {
          console.error('Error loading GLB 3D model:', error);
          setLoadError('Failed to load 3D model.');
          setLoading(false);
        }
      );
    } else if (isObj && cachedGeo) {
      const mesh = new THREE.Mesh(cachedGeo, baseMaterial);
      meshRef = mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      const obj = new THREE.Group();
      obj.add(mesh);
      obj.rotation.x = isBird ? -Math.PI / 2 : 0;

      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z) || 50;
      const targetHeight = isBird ? 1.45 : 2.2;
      const scale = targetHeight / maxDim;
      obj.scale.setScalar(scale);

      obj.position.x = -center.x * scale;
      obj.position.y = -center.y * scale;
      obj.position.z = -center.z * scale;

      modelGroup.add(obj);
      setLoading(false);
    } else if (isObj) {
      const objLoader = new OBJLoader();
      objLoader.load(
        modelPath,
        (obj) => {
          obj.rotation.x = isBird ? -Math.PI / 2 : 0;

          obj.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              meshRef = mesh;
              mesh.material = baseMaterial;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.frustumCulled = false;
              if (mesh.geometry) {
                mesh.geometry.computeVertexNormals();
                geometryCache.set(modelPath, mesh.geometry);
              }
            }
          });

          const box = new THREE.Box3().setFromObject(obj);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          const maxDim = Math.max(size.x, size.y, size.z) || 50;
          const targetHeight = isBird ? 1.45 : 2.2;
          const scale = targetHeight / maxDim;
          obj.scale.setScalar(scale);

          obj.position.x = -center.x * scale;
          obj.position.y = -center.y * scale;
          obj.position.z = -center.z * scale;

          modelGroup.add(obj);
          setLoading(false);
        },
        (xhr) => {
          if (xhr.total > 0) {
            setProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => {
          console.error('Error loading OBJ 3D model:', error);
          setLoadError('Failed to load 3D model.');
          setLoading(false);
        }
      );
    } else {
      const fbxLoader = new FBXLoader();
      fbxLoader.load(
        modelPath,
        (fbx) => {
          fbx.traverse((child) => {
            if ((child as THREE.Mesh).isMesh || (child as any).isSkinnedMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.frustumCulled = false;

              if (mesh.material) {
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                mats.forEach((m) => {
                  m.side = THREE.DoubleSide;
                  m.transparent = false;
                  m.opacity = 1.0;
                  if ('color' in m) {
                    (m as any).color = new THREE.Color(0xffffff);
                  }
                  if (modelTexture) {
                    (m as any).map = modelTexture;
                  }
                  m.needsUpdate = true;
                });
              } else if (modelTexture) {
                mesh.material = new THREE.MeshStandardMaterial({
                  map: modelTexture,
                  color: 0xffffff,
                  roughness: 0.52,
                  metalness: 0.05,
                  side: THREE.DoubleSide,
                });
              }
            }
          });

          fbx.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(fbx);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          let maxDim = Math.max(size.x, size.y, size.z);
          if (!isFinite(maxDim) || maxDim <= 0.001) {
            maxDim = 180;
            center.set(0, 90, 0);
          }

          const targetHeight = 2.2;
          const scale = isFinite(targetHeight / maxDim) ? targetHeight / maxDim : 0.0075;
          fbx.scale.setScalar(scale);

          fbx.position.x = isFinite(-center.x * scale) ? -center.x * scale : 0;
          fbx.position.y = isFinite(-center.y * scale) ? -center.y * scale : -0.6;
          fbx.position.z = isFinite(-center.z * scale) ? -center.z * scale : 0;

          if (fbx.animations && fbx.animations.length > 0) {
            mixer = new THREE.AnimationMixer(fbx);
            const action = mixer.clipAction(fbx.animations[0]);
            action.play();
            if (!playAnimation) {
              // Frame where hands are down naturally by sides
              mixer.update(0.35);
              action.paused = true;
            }
          }

          modelGroup.add(fbx);
          setLoading(false);
        },
        (xhr) => {
          if (xhr.total > 0) {
            setProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (error) => {
          console.error('Error loading FBX 3D model:', error);
          setLoadError('Failed to load 3D model.');
          setLoading(false);
        }
      );
    }

    // 9. Resize Handler
    const updateSize = () => {
      if (!container) return;
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || 600;
      if (newWidth === 0 || newHeight === 0) return;

      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener('resize', updateSize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateSize);
      resizeObserver.observe(container);
    }
    updateSize();

    // 10. Animation Loop
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const delta = clock.getDelta();

      if (mixer && playAnimation) {
        mixer.update(delta);
      }

      controls.update();

      renderer.render(scene, camera);
    };

    animate();

    // 11. Clean-up on unmount
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateSize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (mixer) {
        mixer.stopAllAction();
      }

      controls.dispose();

      scene.traverse((object) => {
        if ((object as THREE.Mesh).isMesh) {
          const mesh = object as THREE.Mesh;
          const isCachedGeo = Array.from(geometryCache.values()).includes(mesh.geometry);
          if (mesh.geometry && !isCachedGeo) {
            mesh.geometry.dispose();
          }
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((m) => {
              const isCachedTex = m.map && Array.from(textureCache.values()).includes(m.map);
              if (m.map && !isCachedTex) {
                m.map.dispose();
              }
              m.dispose();
            });
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [modelPath, texturePath]);

  return (
    <div ref={containerRef} className={styles.modelContainer}>
      {loading && !loadError && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>
            Loading 3D Model{progress > 0 ? ` (${progress}%)` : '…'}
          </span>
        </div>
      )}

      {loadError && (
        <div className={styles.loadingOverlay}>
          <span className={styles.loadingText}>{loadError}</span>
        </div>
      )}
    </div>
  );
}
