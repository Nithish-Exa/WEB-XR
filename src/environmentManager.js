/**
 * environmentManager.js
 * Studio and outdoor environment switching with procedural/HDR lighting.
 */

import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const HDR_STUDIO = '/hdr/studio.hdr';
const HDR_OUTDOOR = '/hdr/outdoor.hdr';

export class EnvironmentManager {
    constructor(scene) {
        this.scene = scene;
        this.currentEnv = null;
        this.envObjects = [];
        this.pmremGenerator = null;
        this.rgbeLoader = new RGBELoader();
    }

    /** Initialize PMREMGenerator with a renderer */
    initPMREM(renderer) {
        if (renderer._rendererType === 'webgpu') return; // Skip for WebGPU
        if (this.pmremGenerator) this.pmremGenerator.dispose();
        this.pmremGenerator = new THREE.PMREMGenerator(renderer);
        this.pmremGenerator.compileEquirectangularShader();
    }

    /** Switch environment */
    async setEnvironment(type, renderer) {
        this._clearEnvironment();
        this.initPMREM(renderer);

        if (type === 'studio') {
            await this._setupStudio(renderer);
        } else {
            await this._setupOutdoor(renderer);
        }

        this.currentEnv = type;
    }

    /** Studio: closed neutral room with soft lighting */
    async _setupStudio(renderer) {
        const isWebGPU = renderer._rendererType === 'webgpu';

        // Floor
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.8,
            metalness: 0.1,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.01;
        floor.receiveShadow = true;
        floor.name = 'floor';
        this.scene.add(floor);
        this.envObjects.push(floor);

        // Back wall
        const wallGeo = new THREE.PlaneGeometry(20, 10);
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x1e1e1e,
            roughness: 0.9,
            metalness: 0.0,
        });
        const backWall = new THREE.Mesh(wallGeo, wallMat);
        backWall.position.set(0, 5, -10);
        backWall.receiveShadow = true;
        backWall.name = 'wall';
        this.scene.add(backWall);
        this.envObjects.push(backWall);

        // Side walls
        const leftWall = new THREE.Mesh(wallGeo.clone(), wallMat.clone());
        leftWall.position.set(-10, 5, 0);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        leftWall.name = 'wall';
        this.scene.add(leftWall);
        this.envObjects.push(leftWall);

        const rightWall = new THREE.Mesh(wallGeo.clone(), wallMat.clone());
        rightWall.position.set(10, 5, 0);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.receiveShadow = true;
        rightWall.name = 'wall';
        this.scene.add(rightWall);
        this.envObjects.push(rightWall);

        // Ceiling
        const ceiling = new THREE.Mesh(floorGeo.clone(), wallMat.clone());
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 10;
        ceiling.name = 'ceiling';
        this.scene.add(ceiling);
        this.envObjects.push(ceiling);

        // Optimized Studio Lights (SpotLights instead of RectAreaLights for VR performance)
        const light1 = new THREE.SpotLight(0xffffff, 40);
        light1.position.set(0, 8, 3);
        light1.angle = Math.PI / 4;
        light1.penumbra = 0.5;
        light1.decay = 2;
        light1.distance = 20;
        light1.castShadow = false; // Primary light in SceneManager handles shadows
        light1.name = 'envLight_Aux';
        this.scene.add(light1);
        this.envObjects.push(light1);

        const light2 = new THREE.PointLight(0xe8e0d8, 15);
        light2.position.set(-5, 6, -2);
        light2.decay = 2;
        light2.distance = 15;
        light2.name = 'envLight_Aux';
        this.scene.add(light2);
        this.envObjects.push(light2);

        const light3 = new THREE.PointLight(0xd8e0e8, 10);
        light3.position.set(5, 5, 2);
        light3.decay = 2;
        light3.distance = 15;
        light3.name = 'envLight_Aux';
        this.scene.add(light3);
        this.envObjects.push(light3);

        // Try loading studio HDR for reflections
        try {
            const envMap = await this._loadHDR(HDR_STUDIO, renderer);
            if (envMap) {
                this.scene.environment = envMap;
            } else {
                this._setNeutralEnvironment(renderer);
            }
        } catch {
            this._setNeutralEnvironment(renderer);
        }

        this.scene.background = new THREE.Color(0x1a1a1a);
    }

    /** Outdoor: HDRI sky with sun */
    async _setupOutdoor(renderer) {
        // Ground plane
        const groundGeo = new THREE.PlaneGeometry(100, 100);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x4a5a3a,
            roughness: 0.95,
            metalness: 0.0,
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.01;
        ground.receiveShadow = true;
        ground.name = 'ground';
        this.scene.add(ground);
        this.envObjects.push(ground);

        // Sun directional light
        const sun = new THREE.DirectionalLight(0xfffbe8, 2.0);
        sun.position.set(10, 15, 8);
        sun.castShadow = true;

        // Optimisation for budget mobile devices
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
        const shadowRes = isMobile ? 512 : 2048;
        sun.shadow.mapSize.set(shadowRes, shadowRes);

        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 60;
        sun.shadow.camera.left = -15;
        sun.shadow.camera.right = 15;
        sun.shadow.camera.top = 15;
        sun.shadow.camera.bottom = -15;
        sun.shadow.bias = -0.0001;
        sun.name = 'envLight';
        this.scene.add(sun);
        this.envObjects.push(sun);

        // Hemisphere light for outdoor ambient
        const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a5a3a, 0.6);
        hemi.name = 'envLight';
        this.scene.add(hemi);
        this.envObjects.push(hemi);

        // Try loading outdoor HDR
        try {
            const envMap = await this._loadHDR(HDR_OUTDOOR, renderer);
            if (envMap) {
                this.scene.environment = envMap;
                this.scene.background = envMap;
            } else {
                this._setOutdoorFallback();
            }
        } catch {
            this._setOutdoorFallback();
        }
    }

    _setOutdoorFallback() {
        // Gradient sky background
        const topColor = new THREE.Color(0x0077ff);
        const bottomColor = new THREE.Color(0x89cff0);
        const skyGeo = new THREE.SphereGeometry(50, 32, 16);
        const skyMat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: {
                topColor: { value: topColor },
                bottomColor: { value: bottomColor },
                offset: { value: 10 },
                exponent: { value: 0.6 },
            },
            vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
            fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        sky.name = 'sky';
        this.scene.add(sky);
        this.envObjects.push(sky);

        this._setNeutralEnvironment(renderer);
    }

    _setNeutralEnvironment(renderer) {
        const isWebGPU = renderer?._rendererType === 'webgpu';

        if (isWebGPU) {
            // Fallback for WebGPU: use background color and ensure lights are active
            this.scene.background = new THREE.Color(0x1a1a1a);
            this.scene.environment = null;

            // Add a subtle hemisphere light if none exists to ensure objects aren't black
            if (!this.scene.getObjectByName('envFallbackLight')) {
                const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
                hemi.name = 'envFallbackLight';
                this.scene.add(hemi);
                this.envObjects.push(hemi);
            }
            return;
        }

        if (!this.pmremGenerator) return;
        const neutralScene = new THREE.Scene();
        neutralScene.background = new THREE.Color(0x888888);
        const light = new THREE.AmbientLight(0xffffff, 1);
        neutralScene.add(light);
        const envMap = this.pmremGenerator.fromScene(neutralScene, 0.04).texture;
        this.scene.environment = envMap;
        neutralScene.background = null;
    }

    async _loadHDR(path, renderer) {
        if (renderer?._rendererType === 'webgpu') return null; // Skip HDR for WebGPU stability

        return new Promise((resolve) => {
            try {
                this.rgbeLoader.load(
                    path,
                    (texture) => {
                        if (this.pmremGenerator && texture) {
                            const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
                            texture.dispose();
                            resolve(envMap);
                        } else if (texture) {
                            // WebGPU fallback: use texture directly with mapping
                            texture.mapping = THREE.EquirectangularReflectionMapping;
                            resolve(texture);
                        } else {
                            resolve(null);
                        }
                    },
                    undefined,
                    () => resolve(null)
                );
            } catch (err) {
                console.warn('HDR Loader caught error:', err);
                resolve(null);
            }
        });
    }

    /** Clear all environment objects */
    _clearEnvironment() {
        this.envObjects.forEach((obj) => {
            try {
                this.scene.remove(obj);
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => { if (m) m.dispose(); });
                    } else {
                        obj.material.dispose();
                    }
                }
            } catch (err) {
                console.warn('Silent failure during environment object disposal:', err);
            }
        });
        this.envObjects = [];
        this.scene.environment = null;
        this.scene.background = null;
    }

    dispose() {
        this._clearEnvironment();
        if (this.pmremGenerator) this.pmremGenerator.dispose();
    }
}
