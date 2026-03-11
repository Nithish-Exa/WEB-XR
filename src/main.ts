/**
 * main.ts
 * Application entry point — wires managers and handles the 120fps render loop.
 */

import { SceneManager } from "./sceneManager";
import { EnvironmentManager } from "./environmentManager";
import { createRenderer } from "./rendererManager";
import { setupUI, AppState } from "./uiManager";
import { StatsManager } from "./statsManager";

class App {
    private sceneManager!: SceneManager;
    private envManager!: EnvironmentManager;
    private statsManager: StatsManager = new StatsManager();
    private state: AppState = {
        renderer: "webgl",
        environment: "studio",
        xrSupported: false
    };

    constructor() {}

    public async init(): Promise<void> {
        const container = document.getElementById("app") || document.body;

        // 1. Initial Renderer Setup
        const { engine } = await createRenderer(this.state.renderer, container);
        
        // 2. Initialize Managers
        this.sceneManager = new SceneManager(engine);
        this.envManager = new EnvironmentManager(this.sceneManager.scene);
        this.statsManager.init();

        // 3. XR Support Detection
        this.state.xrSupported = navigator.xr ? await navigator.xr.isSessionSupported("immersive-vr") : false;

        // 4. Initial Environment & Model
        await this.envManager.setEnvironment(this.state.environment, engine.description === "WebGPU");
        await this.sceneManager.loadModel("/models/RTR-310-op-v4.glb", (msg) => {
            console.log(msg);
            // Optional: update a loading UI here
        });

        // Ensure shadow casters are updated after model load
        this.envManager.updateShadowCasters();

        // 5. Setup UI
        this._updateUI();

        // 6. Hide loading screen
        const loadingScreen = document.getElementById("loading-screen");
        if (loadingScreen) {
            loadingScreen.style.opacity = "0";
            loadingScreen.style.transition = "opacity 0.5s ease-out";
            setTimeout(() => loadingScreen.remove(), 500);
        }

        // 7. 120fps Optimized Render Loop
        engine.runRenderLoop(() => {
            this.sceneManager.update();
            this.sceneManager.scene.render();
            if (this.statsManager) this.statsManager.update(engine);
        });

        // Resize handler
        window.addEventListener("resize", () => this.sceneManager.resize());
    }

    private _updateUI(): void {
        setupUI(
            this.state,
            (r) => this._switchRenderer(r),
            (e) => this._switchEnvironment(e),
            () => this.sceneManager.setupXR()
        );
    }

    private async _switchRenderer(type: "webgl" | "webgpu"): Promise<void> {
        if (this.state.renderer === type) return;
        
        // Save current camera target/alpha/beta if needed
        const prevCamera = {
            alpha: this.sceneManager.camera.alpha,
            beta: this.sceneManager.camera.beta,
            radius: this.sceneManager.camera.radius,
            target: this.sceneManager.camera.target.clone()
        };

        this.state.renderer = type;
        
        // Dispose old engine and canvas
        const oldEngine = this.sceneManager.scene.getEngine();
        const oldCanvas = oldEngine.getRenderingCanvas();
        oldEngine.dispose();
        if (oldCanvas) oldCanvas.remove();

        // Re-initialize with new engine
        await this.init();

        // Restore camera
        this.sceneManager.camera.alpha = prevCamera.alpha;
        this.sceneManager.camera.beta = prevCamera.beta;
        this.sceneManager.camera.radius = prevCamera.radius;
        this.sceneManager.camera.setTarget(prevCamera.target);
    }

    private async _switchEnvironment(type: "studio" | "outdoor"): Promise<void> {
        this.state.environment = type;
        const isWebGPU = this.sceneManager.scene.getEngine().description === "WebGPU";
        await this.envManager.setEnvironment(type, isWebGPU);
        this._updateUI();
    }
}

// Global initialization
const app = new App();
app.init().catch(console.error);
