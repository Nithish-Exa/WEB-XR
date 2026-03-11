import { Engine, WebGPUEngine, AbstractEngine } from "@babylonjs/core";

export async function createRenderer(
    type: "webgl" | "webgpu", 
    container: HTMLElement
): Promise<{ engine: AbstractEngine; canvas: HTMLCanvasElement }> {
    // DO NOT REUSE CANVAS: dispose old element in main.ts and create a new one
    const canvas = document.createElement("canvas");
    canvas.id = "renderCanvas";
    container.appendChild(canvas);

    let engine: AbstractEngine;

    if (type === "webgpu") {
        const webgpuSupported = await WebGPUEngine.IsSupportedAsync;
        if (webgpuSupported) {
            engine = new WebGPUEngine(canvas, {
                antialias: true,
                powerPreference: "high-performance"
            });
            await (engine as WebGPUEngine).initAsync();
        } else {
            engine = new Engine(canvas, true, { 
                powerPreference: "high-performance",
                stencil: true // Keep stencil for pipeline safety
            });
        }
    } else {
        engine = new Engine(canvas, true, { 
            powerPreference: "high-performance",
            stencil: true
        });
    }

    engine.enableOfflineSupport = false;

    // Performance Optimization: Limit hardware scaling ratio on high-DPI displays (like mobiles)
    if (window.devicePixelRatio > 1.2) {
        // Lowering to 1.2x cap for even better performance on WebGL
        engine.setHardwareScalingLevel(window.devicePixelRatio / 1.2);
    }

    return { engine, canvas };
}
