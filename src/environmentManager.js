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
        const tileTexture = this._createPolishedStoneFloorTexture();
        const floorGeo = new THREE.PlaneGeometry(18, 16);
        const floorMat = new THREE.MeshPhysicalMaterial({
            color: 0x2b2c29,
            map: tileTexture,
            bumpMap: tileTexture,
            bumpScale: 0.016,
            roughness: 0.24,
            metalness: 0.02,
            clearcoat: 0.36,
            clearcoatRoughness: 0.16,
            envMapIntensity: 1.55,
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
                color: 0x6a675f,
                roughness: 0.92,
                metalness: 0,
            })
        );
        backWall.position.set(0, 3.05, -4.8);
        backWall.receiveShadow = true;
        backWall.name = 'wall';
        this.scene.add(backWall);
        this.envObjects.push(backWall);

        const stoneTexture = this._createStackedStoneTexture();
        const brickWall = new THREE.Mesh(
            new THREE.PlaneGeometry(10.7, 6.4),
            new THREE.MeshStandardMaterial({
                color: 0xc1bdad,
                map: stoneTexture,
                bumpMap: stoneTexture,
                bumpScale: 0.07,
                roughness: 0.96,
                metalness: 0,
            })
        );
        brickWall.position.set(2.6, 3.0, -4.76);
        brickWall.receiveShadow = true;
        brickWall.name = 'stoneFeatureWall';
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

        const ceiling = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 16),
            new THREE.MeshStandardMaterial({
                color: 0x181817,
                roughness: 0.82,
                metalness: 0,
                side: THREE.DoubleSide,
            })
        );
        ceiling.position.set(0, 5.35, 0);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.name = 'showroomCeiling';
        this.scene.add(ceiling);
        this.envObjects.push(ceiling);

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

        this._addPendantLightGrid();
        this._addWallWashLight({
            position: [-2.4, 4.55, 1.75],
            target: [2.4, 3.05, -4.7],
            color: 0xfff0dc,
            intensity: 22,
        });
        this._addWallWashLight({
            position: [2.1, 4.35, 1.25],
            target: [4.1, 2.85, -4.7],
            color: 0xe9f0ff,
            intensity: 13,
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
                this.scene.environmentIntensity = 1.15;
            } else {
                this._setStudioEnvironment(renderer);
            }
        } catch {
            this._setStudioEnvironment(renderer);
        }

        this.scene.background = new THREE.Color(0x151719);
        this.scene.fog = new THREE.Fog(0x151719, 12, 28);
    }

    _addPendantLightGrid() {
        const pendantRadius = 0.34;
        const rows = [
            {
                z: 1.35,
                y: 3.58,
                targetZ: 0.2,
                lights: [
                    [-2.35, 36, true],
                    [-1.25, 20, false],
                    [-0.15, 30, true],
                    [0.95, 20, false],
                    [2.05, 26, false],
                ],
            },
            {
                z: 0.35,
                y: 3.72,
                targetZ: -0.08,
                lights: [
                    [-1.9, 16, false],
                    [-0.9, 24, false],
                    [0.1, 42, true],
                    [1.1, 22, false],
                    [2.1, 16, false],
                ],
            },
            {
                z: -0.7,
                y: 3.88,
                targetZ: -0.2,
                lights: [
                    [-1.4, 12, false],
                    [-0.35, 18, false],
                    [0.7, 20, false],
                    [1.75, 14, false],
                    [2.75, 22, false],
                ],
            },
        ];

        rows.forEach((row) => {
            row.lights.forEach(([x, intensity, castShadow], index) => {
                const targetX = THREE.MathUtils.clamp(x * 0.28, -0.45, 0.55);
                this._addPendantLamp({
                    name: `pendantLamp_${row.z}_${index}`,
                    position: [x, row.y + (index % 2) * 0.08, row.z],
                    radius: pendantRadius,
                    color: index % 2 === 0 ? 0xfff1d2 : 0xffffff,
                    intensity,
                    target: [targetX, 0.62, row.targetZ],
                    castShadow,
                });
            });
        });
    }

    _addPendantLamp({
        name,
        position,
        radius,
        color,
        intensity,
        target,
        castShadow = false,
    }) {
        const ceilingY = 5.3;
        const lightColor = new THREE.Color(color);
        const cordHeight = Math.max(ceilingY - position[1] - radius * 0.28, 0.2);
        const cord = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, cordHeight, 12),
            new THREE.MeshStandardMaterial({
                color: 0x0c0c0c,
                roughness: 0.52,
                metalness: 0.62,
            })
        );
        cord.name = `${name}_cord`;
        cord.position.set(position[0], position[1] + radius * 0.18 + cordHeight * 0.5, position[2]);
        this.scene.add(cord);
        this.envObjects.push(cord);

        const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 0.12, radius * 0.16, radius * 0.22, 24),
            new THREE.MeshStandardMaterial({
                color: 0x2a2926,
                roughness: 0.26,
                metalness: 0.86,
                envMapIntensity: 1.5,
            })
        );
        stem.name = `${name}_stem`;
        stem.position.set(position[0], position[1] + radius * 0.16, position[2]);
        this.scene.add(stem);
        this.envObjects.push(stem);

        const shade = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 56, 18, 0, Math.PI * 2, 0, Math.PI * 0.54),
            new THREE.MeshStandardMaterial({
                color: 0xd5d0c5,
                roughness: 0.18,
                metalness: 0.92,
                side: THREE.DoubleSide,
                envMapIntensity: 1.8,
            })
        );
        shade.name = `${name}_shade`;
        shade.position.set(...position);
        shade.scale.y = 0.48;
        shade.castShadow = true;
        this.scene.add(shade);
        this.envObjects.push(shade);

        const rim = new THREE.Mesh(
            new THREE.TorusGeometry(radius * 0.98, radius * 0.025, 10, 64),
            new THREE.MeshStandardMaterial({
                color: 0xf2eee2,
                roughness: 0.18,
                metalness: 0.92,
                envMapIntensity: 1.7,
            })
        );
        rim.name = `${name}_rim`;
        rim.position.set(position[0], position[1], position[2]);
        rim.rotation.x = Math.PI / 2;
        rim.castShadow = true;
        this.scene.add(rim);
        this.envObjects.push(rim);

        const lens = new THREE.Mesh(
            new THREE.CircleGeometry(radius * 0.74, 48),
            new THREE.MeshBasicMaterial({
                color: lightColor.clone().multiplyScalar(1.85),
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.95,
                toneMapped: false,
            })
        );
        lens.name = `${name}_lens`;
        lens.position.set(position[0], position[1] - radius * 0.03, position[2]);
        lens.rotation.x = -Math.PI / 2;
        this.scene.add(lens);
        this.envObjects.push(lens);

        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.16, 24, 14),
            new THREE.MeshBasicMaterial({
                color: lightColor.clone().multiplyScalar(2.2),
                transparent: true,
                opacity: 0.95,
                toneMapped: false,
            })
        );
        bulb.name = `${name}_bulb`;
        bulb.position.set(position[0], position[1] - radius * 0.12, position[2]);
        this.scene.add(bulb);
        this.envObjects.push(bulb);

        const glow = new THREE.Mesh(
            new THREE.CircleGeometry(radius * 1.18, 56),
            new THREE.MeshBasicMaterial({
                color: lightColor,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.16,
                depthWrite: false,
                toneMapped: false,
            })
        );
        glow.name = `${name}_glow`;
        glow.position.set(position[0], position[1] - radius * 0.05, position[2]);
        glow.rotation.x = -Math.PI / 2;
        glow.renderOrder = 2;
        this.scene.add(glow);
        this.envObjects.push(glow);

        const spot = new THREE.SpotLight(color, intensity, 7.5, 0.43, 0.86, 2);
        spot.name = `${name}_spot`;
        spot.position.set(position[0], position[1] - radius * 0.16, position[2]);
        spot.target.position.set(...target);
        spot.castShadow = castShadow && window.innerWidth > 768;
        if (spot.castShadow) {
            spot.shadow.mapSize.set(1536, 1536);
            spot.shadow.bias = -0.000045;
            spot.shadow.normalBias = 0.015;
            spot.shadow.radius = 6;
            spot.shadow.camera.near = 0.2;
            spot.shadow.camera.far = 8;
        }
        this.scene.add(spot);
        this.scene.add(spot.target);
        this.envObjects.push(spot, spot.target);
    }

    _addCeilingDownlight({
        name,
        position,
        target,
        radius,
        color,
        intensity,
        angle,
        castShadow = false,
    }) {
        const lightColor = new THREE.Color(color);
        const housing = new THREE.Mesh(
            new THREE.CylinderGeometry(radius * 1.12, radius * 1.12, 0.065, 72),
            new THREE.MeshStandardMaterial({
                color: 0x111111,
                roughness: 0.28,
                metalness: 0.72,
                envMapIntensity: 1.2,
            })
        );
        housing.name = `${name}_housing`;
        housing.position.set(position[0], position[1] + 0.025, position[2]);
        this.scene.add(housing);
        this.envObjects.push(housing);

        const lens = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 72),
            new THREE.MeshBasicMaterial({
                color: lightColor.clone().multiplyScalar(1.55),
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.9,
                toneMapped: false,
            })
        );
        lens.name = `${name}_lens`;
        lens.position.set(position[0], position[1] - 0.012, position[2]);
        lens.rotation.x = -Math.PI / 2;
        this.scene.add(lens);
        this.envObjects.push(lens);

        const glow = new THREE.Mesh(
            new THREE.CircleGeometry(radius * 1.42, 72),
            new THREE.MeshBasicMaterial({
                color: lightColor,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.13,
                depthWrite: false,
                toneMapped: false,
            })
        );
        glow.name = `${name}_glow`;
        glow.position.set(position[0], position[1] - 0.018, position[2]);
        glow.rotation.x = -Math.PI / 2;
        glow.renderOrder = 2;
        this.scene.add(glow);
        this.envObjects.push(glow);

        const spot = new THREE.SpotLight(color, intensity, 8.5, angle, 0.88, 2);
        spot.name = name;
        spot.position.set(...position);
        spot.target.position.set(...target);
        spot.castShadow = castShadow && window.innerWidth > 768;
        if (spot.castShadow) {
            spot.shadow.mapSize.set(2048, 2048);
            spot.shadow.bias = -0.00006;
            spot.shadow.normalBias = 0.018;
            spot.shadow.radius = 5;
            spot.shadow.camera.near = 0.25;
            spot.shadow.camera.far = 10;
        }
        this.scene.add(spot);
        this.scene.add(spot.target);
        this.envObjects.push(spot, spot.target);
    }

    _addWallWashLight({ position, target, color, intensity }) {
        const spot = new THREE.SpotLight(color, intensity, 9, 0.72, 0.92, 2);
        spot.name = 'stoneWallWasher';
        spot.position.set(...position);
        spot.target.position.set(...target);
        this.scene.add(spot);
        this.scene.add(spot.target);
        this.envObjects.push(spot, spot.target);
    }

    _addDisplayPlatform() {
        const woodTexture = this._createWoodTexture();
        const platform = new THREE.Mesh(
            new THREE.BoxGeometry(4.7, 0.16, 2.4),
            new THREE.MeshPhysicalMaterial({
                color: 0x6a3e29,
                map: woodTexture,
                roughness: 0.32,
                metalness: 0.02,
                clearcoat: 0.42,
                clearcoatRoughness: 0.22,
                envMapIntensity: 1.35,
            })
        );
        platform.position.set(0, -0.08, 0);
        platform.castShadow = true;
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
        base.castShadow = true;
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

        const contactShadow = this._createContactShadowPlane();
        contactShadow.position.set(-0.08, 0.018, 0.12);
        this.scene.add(contactShadow);
        this.envObjects.push(contactShadow);

        const supportMaterial = new THREE.MeshStandardMaterial({
            color: 0x6f4329,
            map: woodTexture.clone(),
            roughness: 0.48,
            metalness: 0.03,
        });
        [-1.55, 0, 1.55].forEach((x) => {
            const support = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.42, 2.0),
                supportMaterial.clone()
            );
            support.position.set(x, -0.47, 0);
            support.castShadow = true;
            support.receiveShadow = true;
            support.name = 'displayPlatformSupport';
            this.scene.add(support);
            this.envObjects.push(support);
        });
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

    _createPolishedStoneFloorTexture() {
        return this._createCanvasTexture(512, 512, (ctx, width, height) => {
            ctx.fillStyle = '#20211f';
            ctx.fillRect(0, 0, width, height);
            const tile = 128;
            for (let row = 0; row < 4; row += 1) {
                for (let col = 0; col < 4; col += 1) {
                    const shade = 36 + ((row * 13 + col * 7) % 13);
                    ctx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade})`;
                    ctx.fillRect(col * tile + 3, row * tile + 3, tile - 6, tile - 6);
                    ctx.fillStyle = 'rgba(255,255,255,0.045)';
                    ctx.fillRect(col * tile + 10, row * tile + 10, tile - 22, 2);
                    ctx.fillStyle = 'rgba(0,0,0,0.11)';
                    ctx.fillRect(col * tile + 8, row * tile + tile - 18, tile - 18, 4);
                }
            }
            for (let i = 0; i < 140; i += 1) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const alpha = Math.random() * 0.08;
                ctx.fillStyle = `rgba(255,255,255,${alpha})`;
                ctx.fillRect(x, y, Math.random() * 22 + 4, 1);
            }
            ctx.strokeStyle = '#0c0d0d';
            ctx.lineWidth = 4;
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
        }, [3.25, 2.9]);
    }

    _createStackedStoneTexture() {
        return this._createCanvasTexture(1024, 512, (ctx, width, height) => {
            ctx.fillStyle = '#747169';
            ctx.fillRect(0, 0, width, height);
            const courseH = 42;
            for (let row = 0; row < height / courseH + 1; row += 1) {
                let x = row % 2 === 0 ? -70 : -18;
                while (x < width) {
                    const blockW = 82 + ((row * 29 + Math.floor(x) * 7) % 84);
                    const y = row * courseH + 3;
                    const shade = 145 + ((row * 19 + Math.floor(x) * 3) % 44);
                    ctx.fillStyle = `rgb(${shade}, ${shade - 2}, ${shade - 12})`;
                    ctx.fillRect(x + 3, y, blockW - 6, courseH - 7);
                    ctx.fillStyle = 'rgba(255,255,255,0.11)';
                    ctx.fillRect(x + 6, y + 4, blockW - 12, 2);
                    ctx.fillStyle = 'rgba(0,0,0,0.18)';
                    ctx.fillRect(x + 5, y + courseH - 13, blockW - 10, 4);
                    for (let n = 0; n < 6; n += 1) {
                        ctx.fillStyle = n % 2 === 0
                            ? 'rgba(255,255,255,0.035)'
                            : 'rgba(0,0,0,0.05)';
                        ctx.fillRect(
                            x + 8 + Math.random() * Math.max(blockW - 18, 1),
                            y + 8 + Math.random() * Math.max(courseH - 20, 1),
                            18 + Math.random() * 36,
                            1
                        );
                    }
                    x += blockW;
                }
            }
            ctx.strokeStyle = 'rgba(15,15,14,0.7)';
            ctx.lineWidth = 3;
            for (let y = 0; y < height; y += courseH) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y + ((y / courseH) % 2));
                ctx.stroke();
            }
        }, [2.35, 2.15]);
    }

    _createWoodTexture() {
        return this._createCanvasTexture(512, 512, (ctx, width, height) => {
            ctx.fillStyle = '#74472d';
            ctx.fillRect(0, 0, width, height);
            for (let y = 0; y < height; y += 12) {
                const wave = Math.sin(y * 0.08) * 9;
                ctx.strokeStyle = y % 36 === 0
                    ? 'rgba(38, 15, 7, 0.34)'
                    : 'rgba(255, 182, 112, 0.15)';
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

    _createContactShadowPlane() {
        const texture = this._createCanvasTexture(512, 256, (ctx, width, height) => {
            ctx.clearRect(0, 0, width, height);

            const drawBlob = (x, y, rx, ry, alpha) => {
                ctx.save();
                ctx.translate(x, y);
                ctx.scale(rx, ry);
                const gradient = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 1);
                gradient.addColorStop(0, `rgba(0,0,0,${alpha})`);
                gradient.addColorStop(0.42, `rgba(0,0,0,${alpha * 0.64})`);
                gradient.addColorStop(0.78, `rgba(0,0,0,${alpha * 0.2})`);
                gradient.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(0, 0, 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            };

            drawBlob(width * 0.28, height * 0.58, width * 0.2, height * 0.16, 0.46);
            drawBlob(width * 0.52, height * 0.55, width * 0.31, height * 0.2, 0.52);
            drawBlob(width * 0.72, height * 0.56, width * 0.19, height * 0.18, 0.43);
            drawBlob(width * 0.46, height * 0.66, width * 0.42, height * 0.16, 0.25);
            drawBlob(width * 0.3, height * 0.42, width * 0.23, height * 0.08, 0.18);
        });
        const shadow = new THREE.Mesh(
            new THREE.PlaneGeometry(4.2, 1.55),
            new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0.66,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -2,
            })
        );
        shadow.name = 'softContactShadow';
        shadow.rotation.x = -Math.PI / 2;
        shadow.renderOrder = 3;
        return shadow;
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

        const addDisc = ({ position, rotation, radius, color, intensity }) => {
            const mat = new THREE.MeshBasicMaterial({
                color: new THREE.Color(color).multiplyScalar(intensity),
                side: THREE.DoubleSide,
                toneMapped: false,
            });
            const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 72), mat);
            mesh.position.set(...position);
            mesh.rotation.set(...rotation);
            reflectionScene.add(mesh);
        };

        const addReflectionDotGrid = ({
            origin,
            columns,
            rows,
            spacing,
            radius,
            color,
            intensity,
        }) => {
            for (let row = 0; row < rows; row += 1) {
                for (let col = 0; col < columns; col += 1) {
                    const x = origin[0] + (col - (columns - 1) * 0.5) * spacing[0];
                    const z = origin[2] + row * spacing[1];
                    const softFalloff = 1 - Math.abs(col - (columns - 1) * 0.5) / columns;
                    addDisc({
                        position: [x, origin[1], z],
                        rotation: [-Math.PI / 2, 0, 0],
                        radius: radius * (row % 2 === 0 ? 1 : 0.86),
                        color,
                        intensity: intensity * (0.72 + softFalloff * 0.36),
                    });
                }
            }
        };

        addDisc({
            position: [-1.7, 4.8, 1.55],
            rotation: [-Math.PI / 2, 0, 0],
            radius: 0.88,
            color: 0xfff7e8,
            intensity: 1.7,
        });
        addDisc({
            position: [0.35, 4.9, 0.15],
            rotation: [-Math.PI / 2, 0, 0],
            radius: 0.62,
            color: 0xffffff,
            intensity: 1.65,
        });
        addDisc({
            position: [2.65, 4.65, -1.85],
            rotation: [-Math.PI / 2, 0, 0],
            radius: 0.72,
            color: 0xeaf5ff,
            intensity: 1.4,
        });
        addReflectionDotGrid({
            origin: [-0.25, 4.72, 0.55],
            columns: 7,
            rows: 4,
            spacing: [0.28, 0.26],
            radius: 0.078,
            color: 0xffffff,
            intensity: 17,
        });
        addReflectionDotGrid({
            origin: [0.65, 4.58, -0.35],
            columns: 5,
            rows: 3,
            spacing: [0.24, 0.24],
            radius: 0.064,
            color: 0xfff2d5,
            intensity: 12,
        });
        addDisc({
            position: [-4.1, 1.65, 0.4],
            rotation: [0, Math.PI / 2, 0],
            radius: 0.8,
            color: 0xffe8c5,
            intensity: 1.6,
        });
        addDisc({
            position: [4.3, 1.8, -0.5],
            rotation: [0, -Math.PI / 2, 0],
            radius: 0.72,
            color: 0xdce9ff,
            intensity: 1.4,
        });

        const envMap = this.pmremGenerator.fromScene(reflectionScene, 0.014).texture;
        this.scene.environment = envMap;
        this.scene.environmentIntensity = 1.02;

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
