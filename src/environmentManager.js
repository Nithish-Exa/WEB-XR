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

    /** Studio: premium motorcycle showroom with textured architectural detail. */
    async _setupStudio(renderer) {
        const tileTexture = this._createTileTexture();
        const floorGeo = new THREE.PlaneGeometry(18, 16);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x747474,
            map: tileTexture,
            bumpMap: tileTexture,
            bumpScale: 0.025,
            roughness: 0.58,
            metalness: 0.08,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.22;
        floor.receiveShadow = true;
        floor.name = 'floor';
        this.scene.add(floor);
        this.envObjects.push(floor);

        const backWall = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 7),
            new THREE.MeshStandardMaterial({
                color: 0x575550,
                roughness: 0.92,
                metalness: 0,
            })
        );
        backWall.position.set(0, 3.05, -4.8);
        backWall.receiveShadow = true;
        backWall.name = 'wall';
        this.scene.add(backWall);
        this.envObjects.push(backWall);

        const brickTexture = this._createBrickTexture();
        const brickWall = new THREE.Mesh(
            new THREE.PlaneGeometry(10.5, 6.4),
            new THREE.MeshStandardMaterial({
                color: 0x9a9488,
                map: brickTexture,
                bumpMap: brickTexture,
                bumpScale: 0.045,
                roughness: 0.94,
                metalness: 0,
            })
        );
        brickWall.position.set(2.6, 3.0, -4.76);
        brickWall.receiveShadow = true;
        brickWall.name = 'brickFeatureWall';
        this.scene.add(brickWall);
        this.envObjects.push(brickWall);

        const plasterWall = new THREE.Mesh(
            new THREE.PlaneGeometry(5.3, 6.4),
            new THREE.MeshStandardMaterial({
                color: 0xb7b7ae,
                roughness: 0.96,
                metalness: 0,
            })
        );
        plasterWall.position.set(-5.3, 3.0, -4.74);
        plasterWall.receiveShadow = true;
        plasterWall.name = 'plasterWall';
        this.scene.add(plasterWall);
        this.envObjects.push(plasterWall);

        const leftWall = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 7),
            new THREE.MeshStandardMaterial({
                color: 0x3d3b38,
                roughness: 0.9,
                metalness: 0,
            })
        );
        leftWall.position.set(-8, 3.05, 0);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        leftWall.name = 'wall';
        this.scene.add(leftWall);
        this.envObjects.push(leftWall);

        const baseboard = new THREE.Mesh(
            new THREE.BoxGeometry(16, 0.22, 0.16),
            new THREE.MeshStandardMaterial({
                color: 0x121315,
                roughness: 0.42,
                metalness: 0.3,
            })
        );
        baseboard.position.set(0, -0.08, -4.64);
        baseboard.name = 'baseboard';
        this.scene.add(baseboard);
        this.envObjects.push(baseboard);

        this._addDisplayPlatform();
        this._addPoster({
            position: [-2.05, 3.65, -4.68],
            size: [0.85, 1.12],
            title: 'THE ROAD',
            accent: '#b87a2c',
            variant: 0,
        });
        this._addPoster({
            position: [-0.85, 3.48, -4.68],
            size: [0.72, 1.0],
            title: 'MOTOR',
            accent: '#315d75',
            variant: 1,
        });

        this._addSoftboxPanel({
            name: 'frontTopSoftbox',
            position: [-0.5, 4.8, 1.4],
            rotation: [-Math.PI / 2, 0, 0],
            size: [4.8, 0.48],
            color: 0xfff8ea,
            intensity: 0.8,
        });
        this._addSoftboxPanel({
            name: 'rearTopSoftbox',
            position: [1.5, 4.7, -1.8],
            rotation: [-Math.PI / 2, 0, 0],
            size: [3.2, 0.35],
            color: 0xdce9ff,
            intensity: 0.62,
        });

        const frontFill = new THREE.PointLight(0xfff2df, 7, 9, 2);
        frontFill.position.set(-2.8, 2.1, 3.2);
        frontFill.name = 'envLight_Aux';
        this.scene.add(frontFill);
        this.envObjects.push(frontFill);

        const lowerWarmFill = new THREE.PointLight(0xffc880, 5, 7, 2);
        lowerWarmFill.position.set(-3.4, 0.65, 1.9);
        lowerWarmFill.name = 'envLight_Aux';
        this.scene.add(lowerWarmFill);
        this.envObjects.push(lowerWarmFill);

        try {
            const envMap = await this._loadHDR(HDR_STUDIO, renderer);
            if (envMap) {
                this.scene.environment = envMap;
                this.scene.environmentIntensity = 0.9;
            } else {
                this._setStudioEnvironment(renderer);
            }
        } catch {
            this._setStudioEnvironment(renderer);
        }

        this.scene.background = new THREE.Color(0x151719);
        this.scene.fog = new THREE.Fog(0x151719, 12, 28);
    }

    _addSoftboxPanel({ name, position, rotation, size, color, intensity = 1 }) {
        const panelColor = new THREE.Color(color).multiplyScalar(intensity);
        const panel = new THREE.Mesh(
            new THREE.PlaneGeometry(size[0], size[1]),
            new THREE.MeshBasicMaterial({
                color: panelColor,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.32,
                toneMapped: false,
            })
        );
        panel.name = name;
        panel.position.set(...position);
        panel.rotation.set(...rotation);
        this.scene.add(panel);
        this.envObjects.push(panel);
    }

    _addDisplayPlatform() {
        const woodTexture = this._createWoodTexture();
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(4.7, 0.16, 2.4),
            new THREE.MeshStandardMaterial({
                color: 0x3f241a,
                map: woodTexture,
                roughness: 0.5,
                metalness: 0.02,
            })
        );
        platform.position.set(0, -0.08, 0);
        platform.receiveShadow = true;
        platform.name = 'displayPlatform';
        this.scene.add(platform);
        this.envObjects.push(platform);

        const base = new THREE.Mesh(
            new THREE.BoxGeometry(4.4, 0.12, 2.16),
            new THREE.MeshStandardMaterial({
                color: 0x171513,
                roughness: 0.55,
                metalness: 0.18,
            })
        );
        base.position.set(0, -0.19, 0);
        base.receiveShadow = true;
        base.name = 'displayPlatformBase';
        this.scene.add(base);
        this.envObjects.push(base);

        const stripMaterial = new THREE.MeshStandardMaterial({
            color: 0xfff6df,
            emissive: 0xffecd0,
            emissiveIntensity: 5,
            roughness: 0.18,
            metalness: 0,
            toneMapped: false,
        });
        const frontStrip = new THREE.Mesh(
            new THREE.BoxGeometry(4.2, 0.022, 0.026),
            stripMaterial
        );
        frontStrip.position.set(0, 0.012, 1.185);
        frontStrip.name = 'platformLight';
        this.scene.add(frontStrip);
        this.envObjects.push(frontStrip);

        const sideStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.026, 0.022, 2.05),
            stripMaterial.clone()
        );
        sideStrip.position.set(-2.33, 0.012, 0);
        sideStrip.name = 'platformLight';
        this.scene.add(sideStrip);
        this.envObjects.push(sideStrip);
    }

    _addPoster({ position, size, title, accent, variant }) {
        const texture = this._createPosterTexture(title, accent, variant);
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(size[0] + 0.1, size[1] + 0.1, 0.055),
            new THREE.MeshStandardMaterial({
                color: 0x171513,
                roughness: 0.3,
                metalness: 0.55,
            })
        );
        frame.position.set(...position);
        frame.name = 'posterFrame';
        this.scene.add(frame);
        this.envObjects.push(frame);

        const print = new THREE.Mesh(
            new THREE.PlaneGeometry(size[0], size[1]),
            new THREE.MeshStandardMaterial({
                map: texture,
                roughness: 0.72,
                metalness: 0,
            })
        );
        print.position.set(position[0], position[1], position[2] + 0.032);
        print.name = 'poster';
        this.scene.add(print);
        this.envObjects.push(print);
    }

    _createTileTexture() {
        return this._createCanvasTexture(512, 512, (ctx, width, height) => {
            ctx.fillStyle = '#26282a';
            ctx.fillRect(0, 0, width, height);
            const tile = 128;
            for (let row = 0; row < 4; row += 1) {
                for (let col = 0; col < 4; col += 1) {
                    const shade = 43 + ((row * 13 + col * 7) % 10);
                    ctx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade + 1})`;
                    ctx.fillRect(col * tile + 3, row * tile + 3, tile - 6, tile - 6);
                }
            }
            ctx.strokeStyle = '#111214';
            ctx.lineWidth = 5;
            for (let i = 0; i <= 4; i += 1) {
                ctx.beginPath();
                ctx.moveTo(i * tile, 0);
                ctx.lineTo(i * tile, height);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, i * tile);
                ctx.lineTo(width, i * tile);
                ctx.stroke();
            }
        }, [3.4, 3.0]);
    }

    _createBrickTexture() {
        return this._createCanvasTexture(1024, 512, (ctx, width, height) => {
            ctx.fillStyle = '#3a3834';
            ctx.fillRect(0, 0, width, height);
            const brickW = 128;
            const brickH = 64;
            for (let row = 0; row < height / brickH; row += 1) {
                const offset = row % 2 === 0 ? 0 : -brickW / 2;
                for (let col = -1; col < width / brickW + 1; col += 1) {
                    const x = col * brickW + offset + 4;
                    const y = row * brickH + 4;
                    const shade = 104 + ((row * 17 + col * 11) % 18);
                    ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 11})`;
                    ctx.fillRect(x, y, brickW - 8, brickH - 8);
                    ctx.fillStyle = 'rgba(255,255,255,0.045)';
                    ctx.fillRect(x + 3, y + 3, brickW - 14, 4);
                    ctx.fillStyle = 'rgba(0,0,0,0.08)';
                    ctx.fillRect(x + 3, y + brickH - 15, brickW - 14, 5);
                }
            }
        }, [3.2, 2.8]);
    }

    _createWoodTexture() {
        return this._createCanvasTexture(512, 512, (ctx, width, height) => {
            ctx.fillStyle = '#5c3523';
            ctx.fillRect(0, 0, width, height);
            for (let y = 0; y < height; y += 12) {
                const wave = Math.sin(y * 0.08) * 9;
                ctx.strokeStyle = y % 36 === 0
                    ? 'rgba(30, 12, 6, 0.34)'
                    : 'rgba(235, 164, 103, 0.12)';
                ctx.lineWidth = y % 36 === 0 ? 3 : 1;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.bezierCurveTo(130, y + wave, 330, y - wave, width, y + wave * 0.4);
                ctx.stroke();
            }
        }, [2.4, 1.2]);
    }

    _createPosterTexture(title, accent, variant) {
        return this._createCanvasTexture(512, 720, (ctx, width, height) => {
            ctx.fillStyle = '#e6dfcf';
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = accent;
            ctx.fillRect(32, 32, width - 64, 12);
            ctx.fillStyle = '#252525';
            ctx.font = '700 54px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(title, width / 2, 112);
            ctx.font = '20px sans-serif';
            ctx.fillText('MOTORCYCLE WORKS', width / 2, 150);

            ctx.strokeStyle = accent;
            ctx.lineWidth = 16;
            ctx.beginPath();
            ctx.arc(150, 490, 78, 0, Math.PI * 2);
            ctx.arc(370, 490, 78, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#222222';
            ctx.lineWidth = 12;
            ctx.beginPath();
            ctx.moveTo(150, 490);
            ctx.lineTo(225, 355 - variant * 18);
            ctx.lineTo(318, 490);
            ctx.lineTo(150, 490);
            ctx.moveTo(225, 355 - variant * 18);
            ctx.lineTo(370, 490);
            ctx.moveTo(205, 374);
            ctx.lineTo(325, 374);
            ctx.lineTo(350, 330);
            ctx.stroke();
            ctx.fillStyle = '#222222';
            ctx.font = '18px sans-serif';
            ctx.fillText('EST. 1901', width / 2, 650);
        });
    }

    _createCanvasTexture(width, height, draw, repeat = null) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        draw(context, width, height);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 8;
        if (repeat) {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(repeat[0], repeat[1]);
        }
        texture.needsUpdate = true;
        return texture;
    }

    _setStudioEnvironment(renderer) {
        if (renderer?._rendererType === 'webgpu' || !this.pmremGenerator) {
            this._setNeutralEnvironment(renderer);
            return;
        }

        const reflectionScene = new THREE.Scene();
        reflectionScene.background = new THREE.Color(0x17191b);

        const addPanel = ({ position, rotation, size, color, intensity }) => {
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(color).multiplyScalar(intensity),
                side: THREE.DoubleSide,
                toneMapped: false,
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), mat);
            mesh.position.set(...position);
            mesh.rotation.set(...rotation);
            reflectionScene.add(mesh);
        };

        addPanel({
            position: [-0.8, 4.4, 2.2],
            rotation: [-Math.PI / 2, 0, 0],
            size: [5.2, 0.55],
            color: 0xfff7e8,
            intensity: 9.5,
        });
        addPanel({
            position: [1.4, 4.6, -2.1],
            rotation: [-Math.PI / 2, 0, 0],
            size: [3.8, 0.42],
            color: 0xeaf5ff,
            intensity: 7.5,
        });
        addPanel({
            position: [-4.1, 1.65, 0.4],
            rotation: [0, Math.PI / 2, 0],
            size: [3.6, 0.75],
            color: 0xffe8c5,
            intensity: 6.2,
        });
        addPanel({
            position: [4.3, 1.8, -0.5],
            rotation: [0, -Math.PI / 2, 0],
            size: [3.8, 0.72],
            color: 0xdce9ff,
            intensity: 5.2,
        });
        addPanel({
            position: [0, 1.7, -4.4],
            rotation: [0, 0, 0],
            size: [4.8, 0.5],
            color: 0xfff5e8,
            intensity: 4.8,
        });

        const envMap = this.pmremGenerator.fromScene(reflectionScene, 0.02).texture;
        this.scene.environment = envMap;
        this.scene.environmentIntensity = 0.92;

        reflectionScene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
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
                this._setOutdoorFallback(renderer);
            }
        } catch {
            this._setOutdoorFallback(renderer);
        }
    }

    _setOutdoorFallback(renderer) {
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
            this.scene.background = new THREE.Color(0xd8dee6);
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
        this.scene.environmentIntensity = 1.2;
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
                        obj.material.forEach((material) => this._disposeMaterial(material));
                    } else {
                        this._disposeMaterial(obj.material);
                    }
                }
            } catch (err) {
                console.warn('Silent failure during environment object disposal:', err);
            }
        });
        this.envObjects = [];
        this.scene.environment = null;
        this.scene.background = null;
        this.scene.environmentIntensity = 1;
        this.scene.fog = null;
    }

    _disposeMaterial(material) {
        if (!material) return;
        const textures = new Set();
        Object.values(material).forEach((value) => {
            if (value?.isTexture) textures.add(value);
        });
        textures.forEach((texture) => texture.dispose());
        material.dispose();
    }

    dispose() {
        this._clearEnvironment();
        if (this.pmremGenerator) this.pmremGenerator.dispose();
    }
}
