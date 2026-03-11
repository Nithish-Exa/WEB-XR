/**
 * sceneManager.js
 * Scene, camera, model loading, controls, and XR interaction.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';

const MODEL_PATH = '/models/RTR-310-op-v4.glb';
const DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/';

export class SceneManager {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
        this.camera.position.set(3, 2, 5);

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
        // Ambient
        const ambient = new THREE.AmbientLight(0xffffff, 0.4);
        ambient.name = 'defaultAmbient';
        this.scene.add(ambient);

        // Key light
        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.name = 'defaultKey';
        key.position.set(5, 8, 5);
        key.castShadow = true;
        key.shadow.mapSize.set(512, 512); // Reduced from 1024 for 90 FPS perf
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 50;
        key.shadow.camera.left = -10;
        key.shadow.camera.right = 10;
        key.shadow.camera.top = 10;
        key.shadow.camera.bottom = -10;
        key.shadow.bias = -0.0001;
        this.scene.add(key);

        // Fill light
        const fill = new THREE.DirectionalLight(0xb4c6e0, 0.5);
        fill.name = 'defaultFill';
        fill.position.set(-3, 4, -3);
        this.scene.add(fill);
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
        // Compute bounding box and center
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());


        // Position model so its bottom is at y=0 (on the floor)
        model.position.set(-center.x, -center.y + size.y / 2, -center.z);

        // Auto-scale if too large (target max dimension ~3 units)
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 5) {
            const scale = 3 / maxDim;
            model.scale.setScalar(scale);
        }

        // Efficient Shadow Management:
        // 1. Disable bike self-shadowing (saves many draw calls in VR)
        // 2. Disable shadows for very small objects (bolts/detail)
        model.traverse((child) => {
            if (child.isMesh) {
                child.frustumCulled = true;

                // Only cast shadows for reasonably sized meshes (> 100 triangles)
                const triangleCount = child.geometry.attributes.position.count / 3;
                if (triangleCount > 100) {
                    child.castShadow = true;
                } else {
                    child.castShadow = false;
                }

                // Optimization: Usually bikes don't need to receive shadows from themselves
                // in a studio setup—this saves a significant amount of "shadow map read" time.
                child.receiveShadow = false;

                // Ensure proper material settings
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => { m.envMapIntensity = 1.0; });
                    } else {
                        child.material.envMapIntensity = 1.0;
                    }
                }
            }
        });

        // Tighten shadow frustum for maximum quality vs performance
        this._updateShadowFrustum(box);

        // Point camera at center of bike
        this.camera.lookAt(0, size.y * 0.5, 0);
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
        this.controls.target.set(0, 0.5, 0);
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
            target: this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0.5, 0),
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
