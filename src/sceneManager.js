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
        this.camera.position.set(-2.25, 1.28, 2.65);

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

        // Highlight material
        this.highlightColor = new THREE.Color(0x00d4ff);

        this._setupLighting();
        this._initLoader();
    }

    _setupLighting() {
        const hemi = new THREE.HemisphereLight(0xe9f2ff, 0x181512, 0.42);
        hemi.name = 'defaultAmbient';
        this.scene.add(hemi);

        const ambientLift = new THREE.AmbientLight(0xfff6e8, 0.1);
        ambientLift.name = 'ambientLift';
        this.scene.add(ambientLift);

        const shadowRes = isMobileDevice() ? 1024 : 2048;

        const key = new THREE.DirectionalLight(0xfff8ed, 2.35);
        key.name = 'defaultKey';
        key.position.set(-4, 7, 4.5);
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
        key.shadow.radius = 4;
        key.target.position.set(0, 0.8, 0);
        this.scene.add(key);
        this.scene.add(key.target);

        const fill = new THREE.DirectionalLight(0xbcd7ff, 0.72);
        fill.name = 'defaultFill';
        fill.position.set(4, 4, -3);
        fill.target.position.set(0, 0.8, 0);
        this.scene.add(fill);
        this.scene.add(fill.target);

        const rim = new THREE.DirectionalLight(0xffe1bd, 1.5);
        rim.name = 'defaultRim';
        rim.position.set(-4.5, 3.5, -5);
        rim.target.position.set(0, 0.7, 0);
        this.scene.add(rim);
        this.scene.add(rim.target);

        const topLights = [
            { position: [-2.4, 4.8, 1.7], intensity: 70, color: 0xfff7e9, angle: 0.48 },
            { position: [0.1, 5.2, 0.1], intensity: 92, color: 0xffffff, angle: 0.58 },
            { position: [2.8, 4.5, -1.4], intensity: 56, color: 0xddeaff, angle: 0.5 },
        ];

        topLights.forEach((cfg, index) => {
            const light = new THREE.SpotLight(cfg.color, cfg.intensity);
            light.name = `topSoftbox_${index + 1}`;
            light.position.set(...cfg.position);
            light.angle = cfg.angle;
            light.penumbra = 0.84;
            light.decay = 2;
            light.distance = 9;
            light.target.position.set(0, 0.75, 0);
            light.castShadow = index === 1 && !isMobileDevice();
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

                // Ensure proper material settings
                if (child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material];
                    materials.forEach((mat) => this._polishMaterial(mat, child.name));
                }
            }
        });

        const finalBox = new THREE.Box3().setFromObject(model);
        this._updateShadowFrustum(finalBox);

        // Point camera at center of bike
        const finalSize = finalBox.getSize(new THREE.Vector3());
        this._setPresentationCamera();
        this.camera.lookAt(0, finalSize.y * 0.55, 0);
        if (this.controls) {
            this.controls.target.set(0, finalSize.y * 0.52, 0);
            this.controls.update();
        }
    }

    _setPresentationCamera() {
        const aspect = window.innerWidth / Math.max(window.innerHeight, 1);
        if (aspect < 0.8) {
            this.camera.position.set(-4.55, 1.85, 5.35);
            return;
        }

        this.camera.position.set(-2.25, 1.28, 2.65);
    }

    _polishMaterial(material, meshName = '') {
        if (!material) return;

        material.envMapIntensity = Math.max(material.envMapIntensity ?? 1, 1.65);

        if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
            const name = `${material.name || ''} ${meshName}`.toLowerCase();
            const looksRubber = /rubber|tyre|tire|grip|seat|leather|saddle/.test(name);
            const looksGlass = /glass|screen|lens|visor|windshield/.test(name);
            const looksPaint =
                /paint|body|tank|panel|cover|fairing|fender|mudguard|red|yellow|blue|white/.test(name);
            const looksMetal =
                !looksRubber &&
                ((material.metalness ?? 0) > 0.55 ||
                    /metal|chrome|steel|alum|alloy|fork|rim|disc|brake|exhaust|engine|bolt|screw/.test(name));

            if (looksRubber) {
                material.metalness = Math.min(material.metalness ?? 0, 0.08);
                material.roughness = Math.max(material.roughness ?? 0.72, 0.64);
                material.envMapIntensity = Math.min(material.envMapIntensity, 0.9);
            } else if (looksGlass) {
                material.roughness = Math.min(material.roughness ?? 0.12, 0.16);
                material.envMapIntensity = 2.1;
            } else if (looksMetal) {
                material.metalness = Math.max(material.metalness ?? 0, 0.82);
                material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.28, 0.16, 0.38);
                material.envMapIntensity = 2.5;
            } else if (looksPaint) {
                material.metalness = THREE.MathUtils.clamp(material.metalness ?? 0.35, 0.12, 0.65);
                material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.3, 0.18, 0.38);
                material.envMapIntensity = Math.max(material.envMapIntensity, 2.05);
            }

            if ('clearcoat' in material && looksPaint) {
                material.clearcoat = Math.max(material.clearcoat ?? 0, 0.72);
                material.clearcoatRoughness = Math.min(material.clearcoatRoughness ?? 0.16, 0.2);
            }
        }

        material.needsUpdate = true;
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
        this.controls.target.set(0, 0.7, 0);
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
