/**
 * sceneManager.ts
 * Babylon.js Scene Manager for High-Performance Realistic Rendering.
 * Targets 120fps on mobile with ACES Filmic Tone Mapping and PBR.
 */

import {
    Scene,
    ArcRotateCamera,
    Vector3,
    SceneLoader,
    AbstractEngine,
    DefaultRenderingPipeline,
    ImageProcessingConfiguration,
    PBRMaterial,
    Mesh,
    AbstractMesh,
    WebXRDefaultExperience,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export class SceneManager {
    public scene: Scene;
    public camera!: ArcRotateCamera;
    public pipeline!: DefaultRenderingPipeline;
    public xr: WebXRDefaultExperience | null = null;
    private _model: AbstractMesh | null = null;

    constructor(private engine: AbstractEngine) {
        this.scene = new Scene(engine);
        this._setupScene();
    }

    private _setupScene(): void {
        // High-performance optimizations
        this.scene.autoClear = true;
        this.scene.autoClearDepthAndStencil = true;
        this.scene.skipPointerMovePicking = true; // Massive performance win for mobile
        this.scene.blockMaterialDirtyMechanism = true; // Optimization: manually manage material dirty flags if needed

        // Camera Setup
        this.camera = new ArcRotateCamera(
            "camera",
            Math.PI / 2,
            Math.PI / 2.5,
            5,
            Vector3.Zero(),
            this.scene
        );
        this.camera.lowerRadiusLimit = 2;
        this.camera.upperRadiusLimit = 20;
        this.camera.wheelPrecision = 50;
        this.camera.attachControl(this.engine.getRenderingCanvas()!, true);

        // Advanced Rendering Pipeline (Realistic Look)
        this.pipeline = new DefaultRenderingPipeline("default", true, this.scene, [this.camera]);

        // 1. Color Grading & Tone Mapping (ACES Filmic)
        this.pipeline.imageProcessingEnabled = true;
        this.pipeline.imageProcessing.toneMappingEnabled = true;
        this.pipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        this.pipeline.imageProcessing.exposure = 1.0;
        this.pipeline.imageProcessing.contrast = 1.2;

        // 2. High Quality Bloom (Soft Lighting)
        this.pipeline.bloomEnabled = true;
        this.pipeline.bloomThreshold = 0.95;
        this.pipeline.bloomWeight = 0.2;
        this.pipeline.bloomKernel = 64; // High quality blur

        // 3. Chromatic Aberration & Grain (Cinematic)
        this.pipeline.chromaticAberrationEnabled = true;
        this.pipeline.chromaticAberration.aberrationAmount = 2.0;
        this.pipeline.grainEnabled = true;
        this.pipeline.grain.intensity = 5;

        // Default Environment
        this.scene.environmentIntensity = 1.0;
    }

    /** Load motorcycle GLB model */
    public async loadModel(url: string, onProgress?: (msg: string) => void): Promise<void> {
        if (onProgress) onProgress("Loading Model...");

        const result = await SceneLoader.ImportMeshAsync("", url, "", this.scene);
        this._model = result.meshes[0];

        // Frame the model
        const bounds = this.scene.getWorldExtends();
        const center = bounds.min.add(bounds.max).scale(0.5);
        this.camera.setTarget(center);

        // Apply PBR optimizations
        this.scene.meshes.forEach((mesh) => {
            if (mesh.material instanceof PBRMaterial) {
                mesh.material.realTimeFiltering = true; // High quality reflections
                mesh.material.usePhysicalLightFalloff = true;

                // Freeze materials for 120fps stability once loaded
                mesh.material.freeze();
            }
            // Freeze world matrix for static objects (unless it's the root moving)
            if (mesh !== this._model && mesh instanceof Mesh) {
                mesh.freezeWorldMatrix();
            }
        });

        if (onProgress) onProgress("Model Ready");
    }

    public setAutoRotate(enabled: boolean): void {
        this.camera.useAutoRotationBehavior = enabled;
        if (enabled && this.camera.autoRotationBehavior) {
            this.camera.autoRotationBehavior.idleRotationSpeed = 0.5;
        }
    }

    /** Setup XR with Turbo performance settings */
    public async setupXR(): Promise<void> {
        try {
            this.xr = await this.scene.createDefaultXRExperienceAsync({
                uiOptions: {
                    sessionMode: "immersive-vr",
                    referenceSpaceType: "local-floor",
                },
                disableDefaultUI: true,
            });

            this.xr.baseExperience.onStateChangedObservable.add((state) => {
                if (state === 2) { // Entering XR
                    // Disable expensive Post-FX in VR to maintain 120Hz/90Hz
                    this.pipeline.bloomEnabled = false;
                    this.engine.setHardwareScalingLevel(1.0);
                } else if (state === 0) { // Exiting XR
                    this.pipeline.bloomEnabled = true;
                    this.engine.setHardwareScalingLevel(1.0 / window.devicePixelRatio);
                }
            });

        } catch (e) {
            console.warn("XR not available:", e);
        }
    }

    public update(): void {
        // Any per-frame logic (animations, raycasts)
    }

    public resize(): void {
        this.engine.resize();
    }
}
