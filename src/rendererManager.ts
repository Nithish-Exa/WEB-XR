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
            engine = new WebGPUEngine(canvas);
            await (engine as WebGPUEngine).initAsync();
        } else {
            console.warn("WebGPU not supported on this browser, falling back to WebGL.");
            engine = new Engine(canvas, true);
        }
    } else {
        engine = new Engine(canvas, true);
    }

    return { engine, canvas };
}
