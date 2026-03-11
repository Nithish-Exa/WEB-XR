import { Engine, WebGPUEngine, AbstractEngine } from "@babylonjs/core";

/**
 * rendererManager.ts
 * Factory for creating WebGL / WebGPU engines.
 * Optimized for 120fps mobile performance.
 */

export async function createRenderer(
    type: "webgl" | "webgpu", 
    container: HTMLElement
): Promise<{ engine: AbstractEngine; canvas: HTMLCanvasElement }> {
    const canvas = document.createElement("canvas");
    canvas.id = "renderCanvas";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none"; // Required for Babylon touch inputs
    container.appendChild(canvas);

    let engine: AbstractEngine;

    // Define a type for the options to ensure type safety for powerPreference
    const options: any = {
        antialias: true,
        powerPreference: "high-performance",
        stencil: true,
        preserveDrawingBuffer: false, // Performance win
        audioEngine: false // Disable audio for extra CPU cycles
    };

    if (type === "webgpu") {
        const webgpuSupported = await WebGPUEngine.IsSupportedAsync;
        if (webgpuSupported) {
            engine = new WebGPUEngine(canvas, options);
            await (engine as WebGPUEngine).initAsync();
        } else {
            engine = new Engine(canvas, true, options);
        }
    } else {
        engine = new Engine(canvas, true, options);
    }

    engine.enableOfflineSupport = false;

    // 120fps Optimization: Dynamic Hardware Scaling
    // We start at 1.0 (native) and will dynamically scale in main.js if needed.
    // For now, cap high-DPI devices to 1.5x max to prevent 4K rendering on small screens.
    const maxRatio = window.devicePixelRatio > 2 ? 1.5 : window.devicePixelRatio;
    engine.setHardwareScalingLevel(1.0 / maxRatio);

    return { engine, canvas };
}
