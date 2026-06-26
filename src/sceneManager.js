/**
 * sceneManager.js
 * Scene, camera, model loading, controls, and XR interaction.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const MODEL_PATH = '/models/Ronine.glb';
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';
const isMobileDevice = () =>
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
        this.camera.position.set(-3.25, 1.34, 3.85);

        // XR Rig for proper positioning and teleportation
        this.xrRig = new THREE.Group();
        this.xrRig.name = 'xrRig';
        this.xrRig.add(this.camera);
        this.scene.add(this.xrRig);

        this.model = null;
        this.controls = null;
        this.autoRotate = false;
        this.clock = new THREE.Clock();

        // XR
        this.controllers = [];
        this.controllerGrips = [];
        this.raycaster = new THREE.Raycaster();
        this.tempMatrix = new THREE.Matrix4();
        this.hoveredObject = null;
        this.originalMaterials = new Map();
        this.polishedMaterialCache = new Map();

        // Highlight material
        this.highlightColor = new THREE.Color(0x00d4ff);

        this._setupLighting();
        this._initLoader();
    }

    _setupLighting() {
        const hemi = new THREE.HemisphereLight(0xf2f6ff, 0x241b14, 0.22);
        hemi.name = 'defaultAmbient';
        this.scene.add(hemi);

        const ambientLift = new THREE.AmbientLight(0xfff6e8, 0.05);
        ambientLift.name = 'ambientLift';
        this.scene.add(ambientLift);

        const shadowRes = isMobileDevice() ? 1024 : 2048;

        const key = new THREE.DirectionalLight(0xfff4df, 1.72);
        key.name = 'defaultKey';
        key.position.set(-3.8, 5.8, 3.2);
        key.castShadow = true;
        key.shadow.mapSize.set(shadowRes, shadowRes);
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 50;
        key.shadow.camera.left = -10;
        key.shadow.camera.right = 10;
        key.shadow.camera.top = 10;
        key.shadow.camera.bottom = -10;
        key.shadow.bias = -0.00008;
        key.shadow.normalBias = 0.025;
        key.shadow.radius = 7;
        key.target.position.set(0, 0.8, 0);
        this.scene.add(key);
        this.scene.add(key.target);

        const fill = new THREE.DirectionalLight(0xc7dcff, 0.56);
        fill.name = 'defaultFill';
        fill.position.set(4, 4, -3);
        fill.target.position.set(0, 0.8, 0);
        this.scene.add(fill);
        this.scene.add(fill.target);

        const rim = new THREE.DirectionalLight(0xffdfb2, 0.72);
        rim.name = 'defaultRim';
        rim.position.set(3.4, 3.1, -4.8);
        rim.target.position.set(0, 0.7, 0);
        this.scene.add(rim);
        this.scene.add(rim.target);

        const topLights = [
            { position: [-1.9, 4.75, 1.55], intensity: 8.5, color: 0xfff2dc, angle: 0.46 },
            { position: [0.35, 5.05, 0.2], intensity: 10.8, color: 0xffffff, angle: 0.5 },
            { position: [2.45, 4.55, -1.45], intensity: 6.5, color: 0xe3ecff, angle: 0.48 },
        ];

        topLights.forEach((cfg, index) => {
            const light = new THREE.SpotLight(cfg.color, cfg.intensity);
            light.name = `roundShowroomLight_${index + 1}`;
            light.position.set(...cfg.position);
            light.angle = cfg.angle;
            light.penumbra = 0.84;
            light.decay = 2;
            light.distance = 9;
            light.target.position.set(0, 0.75, 0);
            light.castShadow = false;
            if (light.castShadow) {
                light.shadow.mapSize.set(1024, 1024);
                light.shadow.bias = -0.00008;
                light.shadow.normalBias = 0.02;
                light.shadow.radius = 4;
            }
            this.scene.add(light);
            this.scene.add(light.target);
        });
    }

    _initLoader() {
        this.gltfLoader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
        this.gltfLoader.setDRACOLoader(dracoLoader);
    }

    /** Load the bike GLB model */
    async loadModel(onProgress) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                MODEL_PATH,
                (gltf) => {
                    this.model = gltf.scene;
                    this._processModel(this.model);
                    this.scene.add(this.model);
                    resolve(this.model);
                },
                (xhr) => {
                    if (onProgress && xhr.total > 0) {
                        onProgress(xhr.loaded / xhr.total);
                    }
                },
                (err) => reject(err)
            );
        });
    }

    _processModel(model) {
        const sourceBox = new THREE.Box3().setFromObject(model);
        const sourceSize = sourceBox.getSize(new THREE.Vector3());
        const sourceMaxDim = Math.max(sourceSize.x, sourceSize.y, sourceSize.z);
        const targetMaxDim = 3.0;

        if (sourceMaxDim > 0) {
            model.scale.setScalar(targetMaxDim / sourceMaxDim);
        }

        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        model.position.set(
            model.position.x - scaledCenter.x,
            model.position.y - scaledBox.min.y,
            model.position.z - scaledCenter.z
        );

        // Preserve product-render depth while skipping tiny shadow casters.
        model.traverse((child) => {
            if (child.isMesh) {
                child.frustumCulled = true;

                // Tiny details receive shadows but do not need to cast them.
                const triangleCount = child.geometry.attributes.position.count / 3;
                child.castShadow = triangleCount > 50;

                child.receiveShadow = true;

                if (child.geometry && !child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                }
                if (typeof child.geometry?.normalizeNormals === 'function') {
                    child.geometry.normalizeNormals();
                }
                child.geometry?.computeBoundingSphere?.();

                // Ensure proper material settings
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map((mat) => this._polishMaterial(mat, child.name));
                    } else {
                        child.material = this._polishMaterial(child.material, child.name);
                    }
                }
            }
        });

        const finalBox = new THREE.Box3().setFromObject(model);
        this._updateShadowFrustum(finalBox);

        // Point camera at center of bike
        const finalSize = finalBox.getSize(new THREE.Vector3());
        this._setPresentationCamera();
        const presentationTargetY = Math.max(finalSize.y * 0.68, 1.28);
        this.camera.lookAt(0, presentationTargetY, 0);
        if (this.controls) {
            this.controls.target.set(0, presentationTargetY, 0);
            this.controls.update();
        }
    }

    _setPresentationCamera() {
        const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
        if (aspect < 0.8) {
            this.camera.position.set(-4.35, 1.8, 5.05);
            return;
        }

        this.camera.position.set(-3.25, 1.34, 3.85);
    }

    _polishMaterial(material, meshName = '') {
        if (!material) return material;

        if (this.polishedMaterialCache.has(material.uuid)) {
            return this.polishedMaterialCache.get(material.uuid);
        }

        let polished = material;

        if (polished.isMeshStandardMaterial || polished.isMeshPhysicalMaterial) {
            const name = `${polished.name || ''} ${meshName}`.toLowerCase();
            const looksHelperTransparency = /transparency|transparencey/.test(name);
            const looksRubber = /rubber|tyre|tire|grip|seat|leather|saddle/.test(name);
            const looksGlass = /glass|screen|lens|visor|windshield/.test(name);
            const looksEmitter = /headlight|tail|brake|indicator|turn|lamp|light|led|bulb/.test(name);
            const looksPaint =
                /main_body|paint|body|tank|fuel|panel|cover|fairing|fender|mudguard|cowl|red|yellow|blue|white|black/.test(name) &&
                !/pad|bag|sticker|graphics|logo|rubber|tyre|tire|seat|leather|saddle|engine|brake|disc|screw|muffler|fork|rim|lever|reservoir|caliper/.test(name);
            const texturedPaint = looksPaint && !!polished.map;
            const looksMetal =
                !looksPaint &&
                !looksRubber &&
                ((polished.metalness ?? 0) > 0.55 ||
                    /metal|chrome|steel|alum|alloy|fork|rim|disc|brake|exhaust|engine|bolt|screw/.test(name));

            if (looksPaint && !polished.map && polished.isMeshStandardMaterial && !polished.isMeshPhysicalMaterial) {
                const physicalPaint = new THREE.MeshPhysicalMaterial({
                    color: polished.color?.clone() ?? new THREE.Color(0xffffff),
                    map: polished.map ?? null,
                    normalMap: polished.normalMap ?? null,
                    roughnessMap: polished.roughnessMap ?? null,
                    metalnessMap: polished.metalnessMap ?? null,
                    aoMap: polished.aoMap ?? null,
                    alphaMap: polished.alphaMap ?? null,
                    emissive: polished.emissive?.clone() ?? new THREE.Color(0x000000),
                    emissiveMap: polished.emissiveMap ?? null,
                    emissiveIntensity: polished.emissiveIntensity ?? 1,
                    transparent: polished.transparent,
                    opacity: polished.opacity,
                    side: polished.side,
                    alphaTest: polished.alphaTest,
                    depthWrite: polished.depthWrite,
                    depthTest: polished.depthTest,
                    polygonOffset: polished.polygonOffset,
                    polygonOffsetFactor: polished.polygonOffsetFactor,
                    polygonOffsetUnits: polished.polygonOffsetUnits,
                });
                if (polished.normalScale) physicalPaint.normalScale.copy(polished.normalScale);
                physicalPaint.name = polished.name;
                physicalPaint.userData = { ...polished.userData };
                polished = physicalPaint;
            }

            this._prepareMaterialTextures(polished);

            polished.dithering = true;
            polished.toneMapped = true;

            if (looksHelperTransparency) {
                if (polished.color) polished.color.set(0x000000);
                if (polished.emissive) polished.emissive.set(0x000000);
                polished.emissiveIntensity = 0;
                polished.transparent = true;
                polished.opacity = 0;
                polished.depthWrite = false;
                polished.depthTest = true;
                polished.colorWrite = false;
                polished.metalness = 0;
                polished.roughness = 1;
                polished.envMapIntensity = 0;
                polished.needsUpdate = true;
                this.polishedMaterialCache.set(material.uuid, polished);
                return polished;
            }

            polished.envMapIntensity = Math.max(polished.envMapIntensity ?? 1, looksPaint ? 1.55 : 1.35);

            if (looksRubber) {
                polished.metalness = Math.min(polished.metalness ?? 0, 0.08);
                polished.roughness = Math.max(polished.roughness ?? 0.72, 0.64);
                polished.envMapIntensity = Math.min(polished.envMapIntensity, 0.9);
            } else if (looksGlass) {
                polished.roughness = Math.min(polished.roughness ?? 0.12, 0.16);
                polished.envMapIntensity = 1.65;
            } else if (looksMetal) {
                polished.metalness = Math.max(polished.metalness ?? 0, 0.82);
                polished.roughness = THREE.MathUtils.clamp(polished.roughness ?? 0.32, 0.22, 0.46);
                polished.envMapIntensity = THREE.MathUtils.clamp(polished.envMapIntensity, 1.25, 1.95);
            } else if (looksPaint) {
                if (texturedPaint) {
                    polished.roughness = THREE.MathUtils.clamp(polished.roughness ?? 0.24, 0.2, 0.32);
                    polished.envMapIntensity = THREE.MathUtils.clamp(polished.envMapIntensity, 1.55, 2.05);
                } else {
                    polished.metalness = THREE.MathUtils.clamp(polished.metalness ?? 0.08, 0.02, 0.14);
                    polished.roughness = THREE.MathUtils.clamp(polished.roughness ?? 0.24, 0.2, 0.34);
                    polished.envMapIntensity = THREE.MathUtils.clamp(polished.envMapIntensity, 1.48, 1.9);
                }
            }

            if ('clearcoat' in polished && looksPaint) {
                polished.clearcoat = 0.86;
                polished.clearcoatRoughness = 0.1;
                polished.ior = 1.55;
                polished.reflectivity = 0.0;
                polished.specularIntensity = 0.9;
            }

            if (polished.emissive && polished.emissiveIntensity > 0) {
                polished.emissiveIntensity = looksEmitter
                    ? Math.min(polished.emissiveIntensity, 1.15)
                    : Math.min(polished.emissiveIntensity, 0.28);
            }
        }

        polished.needsUpdate = true;
        this.polishedMaterialCache.set(material.uuid, polished);
        return polished;
    }

    _prepareMaterialTextures(material) {
        const textureKeys = [
            'map',
            'emissiveMap',
            'aoMap',
            'roughnessMap',
            'metalnessMap',
            'normalMap',
            'bumpMap',
            'alphaMap',
        ];

        textureKeys.forEach((key) => {
            const texture = material[key];
            if (!texture?.isTexture) return;

            texture.anisotropy = Math.max(texture.anisotropy ?? 1, 8);
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            if (key === 'map' || key === 'emissiveMap') {
                texture.colorSpace = THREE.SRGBColorSpace;
            }
            texture.needsUpdate = true;
        });
    }

    _updateShadowFrustum(box) {
        const key = this.scene.getObjectByName('defaultKey');
        if (!key || !key.shadow) return;

        // Auto-fit shadow camera to the model's bounding box
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        key.shadow.camera.left = -maxDim;
        key.shadow.camera.right = maxDim;
        key.shadow.camera.top = maxDim * 1.5;
        key.shadow.camera.bottom = -maxDim;
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = maxDim * 10;
        key.shadow.camera.updateProjectionMatrix();
    }

    /** Attach OrbitControls for desktop */
    setupControls(renderer) {
        if (this.controls) {
            this.controls.dispose();
        }
        this.controls = new OrbitControls(this.camera, renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.set(0, 1.28, 0);
        this.controls.minDistance = 1;
        this.controls.maxDistance = 20;
        this.controls.maxPolarAngle = Math.PI * 0.85;
        this.controls.update();
    }

    /** Setup VR controllers */
    setupXRControllers(renderer) {
        // Clean up previous controllers
        this.controllers.forEach(c => this.scene.remove(c));
        this.controllerGrips.forEach(g => this.scene.remove(g));
        this.controllers = [];
        this.controllerGrips = [];

        const controllerModelFactory = new XRControllerModelFactory();

        for (let i = 0; i < 2; i++) {
            const controller = renderer.xr.getController(i);
            controller.addEventListener('selectstart', () => this._onSelectStart(controller));
            controller.addEventListener('selectend', () => this._onSelectEnd(controller));
            this.xrRig.add(controller);

            // Controller line
            const geo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -5),
            ]);
            const mat = new THREE.LineBasicMaterial({ color: 0x00d4ff, linewidth: 2 });
            const line = new THREE.Line(geo, mat);
            line.name = 'controllerRay';
            line.scale.z = 5;
            controller.add(line);
            this.controllers.push(controller);

            // Controller grip model
            const grip = renderer.xr.getControllerGrip(i);
            grip.add(controllerModelFactory.createControllerModel(grip));
            this.xrRig.add(grip);
            this.controllerGrips.push(grip);
        }
    }

    _onSelectStart(controller) {
        // Teleport: raycast against floor
        this.tempMatrix.identity().extractRotation(controller.matrixWorld);
        this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

        const floorObjects = this.scene.children.filter(
            c => c.name === 'floor' || c.name === 'ground'
        );
        const intersects = this.raycaster.intersectObjects(floorObjects, true);
        if (intersects.length > 0) {
            const point = intersects[0].point;
            // Teleport the XR camera rig
            const xrCamera = controller.parent; // The XR reference space
            if (xrCamera) {
                // Simple teleportation by adjusting the reference space offset is complex,
                // so we just log for now — full teleport requires XR reference space manipulation
                console.log('Teleport target:', point);
            }
        }
    }

    _onSelectEnd(_controller) {
        // intentionally empty — extend as needed
    }

    /** XR raycasting for hover highlight */
    updateXRInteraction() {
        for (const controller of this.controllers) {
            this.tempMatrix.identity().extractRotation(controller.matrixWorld);
            this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
            this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

            if (!this.model) continue;

            const meshes = [];
            this.model.traverse((child) => {
                if (child.isMesh) meshes.push(child);
            });

            const intersects = this.raycaster.intersectObjects(meshes, false);

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                if (this.hoveredObject !== obj) {
                    this._clearHighlight();
                    this._highlight(obj);
                    this.hoveredObject = obj;
                }
                // Shorten ray to hit point
                const rayLine = controller.children.find(c => c.name === 'controllerRay');
                if (rayLine) rayLine.scale.z = intersects[0].distance;
            } else {
                if (this.hoveredObject) {
                    this._clearHighlight();
                    this.hoveredObject = null;
                }
                const rayLine = controller.children.find(c => c.name === 'controllerRay');
                if (rayLine) rayLine.scale.z = 5;
            }
        }
    }

    _highlight(mesh) {
        if (!mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
            this.originalMaterials.set(m.uuid, m.emissive ? m.emissive.clone() : null);
            if (m.emissive) m.emissive.copy(this.highlightColor).multiplyScalar(0.3);
        });
    }

    _clearHighlight() {
        if (!this.hoveredObject || !this.hoveredObject.material) return;
        const mats = Array.isArray(this.hoveredObject.material)
            ? this.hoveredObject.material
            : [this.hoveredObject.material];
        mats.forEach((m) => {
            const orig = this.originalMaterials.get(m.uuid);
            if (orig && m.emissive) m.emissive.copy(orig);
        });
        this.originalMaterials.clear();
    }

    /** Update per frame */
    update(delta) {
        // OrbitControls
        if (this.controls) this.controls.update();

        // Auto-rotation
        if (this.autoRotate && this.model) {
            this.model.rotation.y += delta * 0.3;
        }
    }

    /** Resize camera */
    resize(width, height) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    /** Get camera state for preservation across renderer switch */
    getCameraState() {
        return {
            position: this.camera.position.clone(),
            target: this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0.7, 0),
        };
    }

    /** Restore camera state */
    restoreCameraState(state) {
        if (!state) return;
        this.camera.position.copy(state.position);
        if (this.controls) {
            this.controls.target.copy(state.target);
            this.controls.update();
        }
    }

    /** Toggle auto-rotation */
    setAutoRotate(val) {
        this.autoRotate = val;
    }
}
