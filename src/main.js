/**
 * main.js
 * Application entry point — wires all managers, animation loop, renderer switching.
 */

import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import {
    createRenderer,
    disposeRenderer,
    enableXR,
    getRendererType,
    isWebGPUAvailable,
} from './rendererManager.js';
import { SceneManager } from './sceneManager.js';
import { EnvironmentManager } from './environmentManager.js';
import { UIManager } from './uiManager.js';
import { StatsManager } from './statsManager.js';

class App {
    constructor() {
        this.container = document.getElementById('app');
        this.renderer = null;
        this.vrButton = null;
        this.sceneManager = new SceneManager();
        this.envManager = new EnvironmentManager(this.sceneManager.scene);
        this.uiManager = new UIManager();
        this.statsManager = new StatsManager();
        this.clock = new THREE.Clock();
        this.rendererType = 'webgl';
        this.isXRPresenting = false;
    }

    async init() {
        // Detect WebGPU
        const webgpuOk = await isWebGPUAvailable();

        // Create renderer
        this.renderer = await createRenderer('webgl', this.container);
        enableXR(this.renderer);
        this.rendererType = 'webgl';

        // Resize
        this._onResize();
        window.addEventListener('resize', () => this._onResize());

        // Controls
        this.sceneManager.setupControls(this.renderer);

        // UI
        this.uiManager.init(this.container, { webgpuAvailable: webgpuOk });
        this.uiManager.on('onRendererChange', (type) => this._switchRenderer(type));
        this.uiManager.on('onEnvironmentChange', (type) => this._switchEnvironment(type));
        this.uiManager.on('onRotateChange', (val) => this.sceneManager.setAutoRotate(val));

        // Stats
        this.statsManager.init();

        // VR Button
        this._addVRButton();

        // XR session events
        if (this.renderer.xr.addEventListener) {
            this.renderer.xr.addEventListener('sessionstart', () => {
                this.isXRPresenting = true;
                this.uiManager.hide();
                this.statsManager.hide();

                // Advanced VR Performance: Request Fixed Foveated Rendering
                const session = this.renderer.xr.getSession();
                if (session) {
                    if (session.requestFixedFoveation) session.requestFixedFoveation(1.0);
                    if (session.updateTargetFrameRate) session.updateTargetFrameRate(90);
                }

                // Optimization: Disable tonemapping in VR to save GPU fill-rate
                this.renderer.toneMapping = THREE.NoToneMapping;

                // Reduce pixel ratio for VR perf
                this.renderer.setPixelRatio(1);

                // Offset spawn position so user starts in front of the bike
                if (this.sceneManager.xrRig) {
                    this.sceneManager.xrRig.position.set(0, 0, 2.5);
                }
                // Setup XR controllers
                this.sceneManager.setupXRControllers(this.renderer);
            });
            this.renderer.xr.addEventListener('sessionend', () => {
                this.isXRPresenting = false;
                this.uiManager.show();
                this.statsManager.show();
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                // Restore tonemapping for Desktop
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

                // Reset spawn position
                if (this.sceneManager.xrRig) {
                    this.sceneManager.xrRig.position.set(0, 0, 0);
                }
            });
        }

        // Load environment
        await this.envManager.setEnvironment('studio', this.renderer);

        // Load model
        try {
            await this.sceneManager.loadModel((progress) => {
                const bar = document.getElementById('progress-bar');
                if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
            });
        } catch (err) {
            console.warn('Model failed to load:', err);
            // Add a placeholder so the scene isn't empty
            const geo = new THREE.BoxGeometry(1, 1, 1);
            const mat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const placeholder = new THREE.Mesh(geo, mat);
            placeholder.name = 'placeholder';
            this.sceneManager.scene.add(placeholder);
        }

        // Hide loading screen
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            const bar = document.getElementById('progress-bar');
            if (bar) bar.style.width = '100%';
            setTimeout(() => loadingScreen.classList.add('hidden'), 300);
            setTimeout(() => loadingScreen.remove(), 1000);
        }

        // Start loop
        this.renderer.setAnimationLoop((time, frame) => this._animate(time, frame));
    }

    _animate(_time, _frame) {
        const delta = this.clock.getDelta();

        // XR controller interaction
        if (this.isXRPresenting) {
            this.sceneManager.updateXRInteraction();
        }

        this.sceneManager.update(delta);
        this.statsManager.update(this.renderer);
        this.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    }

    _onResize() {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.sceneManager.resize(w, h);
        if (this.renderer) {
            this.renderer.setSize(w, h);
        }
    }

    _addVRButton() {
        // Remove old VR button if present
        if (this.vrButton && this.vrButton.parentNode) {
            this.vrButton.parentNode.removeChild(this.vrButton);
        }
        this.vrButton = VRButton.createButton(this.renderer);
        this.vrButton.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      padding: 12px 28px;
      background: rgba(0, 212, 255, 0.15);
      border: 1px solid #00d4ff;
      color: #00d4ff;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 1px;
      border-radius: 8px;
      cursor: pointer;
      backdrop-filter: blur(8px);
    `;
        document.body.appendChild(this.vrButton);
    }

    async _switchRenderer(type) {
        if (type === this.rendererType) return;

        // Save state
        const cameraState = this.sceneManager.getCameraState();

        // Stop loop and dispose
        // IMPORTANT: Dispose environment first to avoid WebGPU dangling listener errors
        this.envManager.dispose();
        disposeRenderer(this.renderer);

        // Create new renderer
        this.renderer = await createRenderer(type, this.container);
        this.rendererType = getRendererType(this.renderer);
        enableXR(this.renderer);

        // Resize
        this._onResize();

        // Restore controls and camera
        this.sceneManager.setupControls(this.renderer);
        this.sceneManager.restoreCameraState(cameraState);

        // Re-generate environment map for new renderer
        await this.envManager.setEnvironment(
            this.uiManager.currentEnv,
            this.renderer
        );

        // VR button
        this._addVRButton();

        // XR events
        // XR events
        // XR events
        if (this.renderer.xr.addEventListener) {
            this.renderer.xr.addEventListener('sessionstart', () => {
                this.isXRPresenting = true;
                this.uiManager.hide();
                this.statsManager.hide();

                // Advanced VR Performance: Request Fixed Foveated Rendering
                const session = this.renderer.xr.getSession();
                if (session) {
                    if (session.requestFixedFoveation) session.requestFixedFoveation(1.0);
                    if (session.updateTargetFrameRate) session.updateTargetFrameRate(90);
                }

                this.renderer.toneMapping = THREE.NoToneMapping;
                this.renderer.setPixelRatio(1);

                // Offset spawn position so user starts in front of the bike
                if (this.sceneManager.xrRig) {
                    this.sceneManager.xrRig.position.set(0, 0, 2.5);
                }
                this.sceneManager.setupXRControllers(this.renderer);
            });
            this.renderer.xr.addEventListener('sessionend', () => {
                this.isXRPresenting = false;
                this.uiManager.show();
                this.statsManager.show();
                this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

                // Restore tonemapping for Desktop
                this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

                // Reset spawn position
                if (this.sceneManager.xrRig) {
                    this.sceneManager.xrRig.position.set(0, 0, 0);
                }
            });
        }

        // Update UI
        this.uiManager.setRendererActive(this.rendererType);

        // Restart loop
        this.renderer.setAnimationLoop((time, frame) => this._animate(time, frame));
    }

    async _switchEnvironment(type) {
        await this.envManager.setEnvironment(type, this.renderer);
    }
}

// Boot
const app = new App();
app.init().catch((err) => {
    console.error('App initialization failed:', err);
});
