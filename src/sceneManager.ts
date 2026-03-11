import { Scene, SceneLoader, AbstractEngine } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";

export async function setupScene(engine: AbstractEngine): Promise<Scene> {
    const scene = new Scene(engine);
    return scene;
}

export async function loadModel(scene: Scene, modelUrl: string): Promise<void> {
    await SceneLoader.ImportMeshAsync("", modelUrl, "", scene);
    
    // Automatically frame the model WITHOUT normalizing scale
    scene.createDefaultCameraOrLight(true, true, true);
    
    // Remove the default light created by createDefaultCameraOrLight
    // as we rely on environmentManager for lighting
    scene.lights.slice().forEach(light => {
        if (light.name === "default light") {
            light.dispose();
        }
    });

    // Ensure camera controls are attached and adjust precision for large models
    const bjsCamera = scene.activeCamera;
    if (bjsCamera) {
        bjsCamera.attachControl(scene.getEngine().getRenderingCanvas()!, true);
        if ('wheelPrecision' in bjsCamera) {
             (bjsCamera as any).wheelPrecision = 50;
        }
    }
}

export async function setupXRControllers(scene: Scene): Promise<WebXRDefaultExperience | null> {
    try {
        const isSupported = navigator.xr ? await navigator.xr.isSessionSupported("immersive-vr") : false;
        if (!isSupported) {
            console.warn("WebXR immersive-vr is not supported in this browser.");
            return null;
        }

        const xr = await scene.createDefaultXRExperienceAsync({
            uiOptions: {
                sessionMode: "immersive-vr",
                referenceSpaceType: "local-floor"
            },
            disableDefaultUI: true
        });
        
        return xr;
    } catch (e) {
        console.error("Failed to setup XR:", e);
        return null;
    }
}
