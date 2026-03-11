import { Scene, AbstractEngine } from "@babylonjs/core";

export function updateStats(engine: AbstractEngine, scene: Scene) {
    const statsOverlay = document.getElementById("stats-overlay");
    if (!statsOverlay) return;

    const fps = engine.getFps().toFixed(1);
    const activeIndices = scene.getActiveIndices();

    // Check if XR is active by checking the active camera
    const activeCamera = scene.activeCamera;
    const isXRActive = activeCamera && (
        activeCamera.name.toLowerCase().includes("xr") || 
        activeCamera.name.toLowerCase().includes("vr")
    );
    
    const xrStatus = isXRActive ? "🟢 Active" : "🔴 Inactive";

    statsOverlay.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px; color: #fff;">Performance Logs</div>
        <div>FPS: <span style="color: #fff;">${fps}</span></div>
        <div>Active Indices: <span style="color: #fff;">${activeIndices.toLocaleString()}</span></div>
        <div style="margin-top: 5px; border-top: 1px solid #444; padding-top: 5px;">
            WebXR VR: <span style="${isXRActive ? 'color: #0f0' : 'color: #f44'}">${xrStatus}</span>
        </div>
    `;
}
