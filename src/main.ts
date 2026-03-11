import { AbstractEngine } from "@babylonjs/core";
import { createRenderer } from "./rendererManager";
import { setupScene, loadModel, setupXRControllers } from "./sceneManager";
import { setEnvironment } from "./environmentManager";
import { setupUI, AppState } from "./uiManager";
import { updateStats } from "./statsManager";

const state: AppState = {
    renderer: "webgl",
    environment: "studio",
};

let currentEngine: AbstractEngine | null = null;
let xrExperience: any = null; // Store XR experience globally for easy access

async function init() {
    const appContainer = document.getElementById("app")!;
    const loadingScreen = document.getElementById("loading-screen")!;

    loadingScreen.style.display = "flex";
    loadingScreen.innerHTML = `
        <div class="spinner"></div>
        <div>Loading WebXR Engine...</div>
    `;

    // 6. Proper engine disposal when switching renderer
    if (currentEngine) {
        currentEngine.stopRenderLoop();
        currentEngine.dispose();
        const oldCanvas = document.getElementById("renderCanvas");
        if (oldCanvas) {
            oldCanvas.remove();
        }
        currentEngine = null;
    }

    try {
        // 1. Initialize renderer
        const { engine } = await createRenderer(state.renderer, appContainer);
        currentEngine = engine;

        // 8. Engine resize
        window.addEventListener("resize", () => {
            if (currentEngine) currentEngine.resize();
        });

        // 2. Initialize scene
        const scene = await setupScene(engine);

        // 3. Load model (do not normalize model scale)
        loadingScreen.innerHTML = `
            <div class="spinner"></div>
            <div>Loading GLB Model...</div>
        `;
        await loadModel(scene, "models/RTR-310-op-v4.glb");

        // Initialize environment
        setEnvironment(scene, state.environment);

        // 4. XR support
        xrExperience = await setupXRControllers(scene);
        state.xrSupported = xrExperience !== null;

        // UI Binding function
        function bindUI() {
            setupUI(state,
                async (newRenderer: "webgl" | "webgpu") => {
                    if (state.renderer === newRenderer) return;
                    state.renderer = newRenderer;
                    await init(); // Rebuild everything when renderer changes
                },
                (newEnv: "studio" | "outdoor") => {
                    if (state.environment === newEnv) return;
                    state.environment = newEnv;
                    setEnvironment(scene, state.environment);
                    bindUI(); // Refresh UI state
                },
                async () => {
                    if (xrExperience) {
                        try {
                            await xrExperience.baseExperience.enterXRAsync("immersive-vr", "local-floor");
                        } catch (e) {
                            console.error("Error entering XR:", e);
                        }
                    }
                }
            );
        }
        bindUI();

        loadingScreen.style.display = "none";

        // 5. Start render loop
        engine.runRenderLoop(() => {
            scene.render();
            updateStats(engine, scene);
        });

    } catch (e) {
        console.error("Initialization error:", e);
        loadingScreen.innerHTML = `
            <div style="color: #ff4444; text-align: center;">
                <h2>Error Starting Viewer</h2>
                <p>${e}</p>
            </div>
        `;
    }
}

// Start application
init();
