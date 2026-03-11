import { Scene, SceneLoader, AbstractEngine, DefaultRenderingPipeline, ImageProcessingConfiguration } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";

export async function setupScene(engine: AbstractEngine): Promise<Scene> {
    const scene = new Scene(engine);
    
    // Performance Optimization: Disable pointer picking on move
    scene.skipPointerMovePicking = true;

    return scene;
}

export async function loadModel(scene: Scene, modelUrl: string): Promise<void> {
    await SceneLoader.ImportMeshAsync("", modelUrl, "", scene);
    
    // Automatically frame the model
    scene.createDefaultCameraOrLight(true, true, true);
    
    const activeCamera = scene.activeCamera;
    if (activeCamera) {
        activeCamera.attachControl(scene.getEngine().getRenderingCanvas()!, true);
        if ('wheelPrecision' in activeCamera) {
             (activeCamera as any).wheelPrecision = 50;
        }

        // Attach Rendering Pipeline to the newly created camera
        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [activeCamera]);
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.exposure = 1.0;
        defaultPipeline.imageProcessing.contrast = 1.1;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.bloomThreshold = 0.9;
        defaultPipeline.bloomWeight = 0.2;
        defaultPipeline.bloomKernel = 16;
    }

    // Remove the default light
    scene.lights.slice().forEach(light => {
        if (light.name === "default light") {
            light.dispose();
        }
    });
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
