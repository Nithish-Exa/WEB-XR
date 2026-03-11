/**
 * environmentManager.ts
 * Babylon.js Environment Manager for High-End Visuals.
 * Supports Studio HDR and Realistic Outdoor environments.
 */

import {
    Scene,
    DirectionalLight,
    HemisphericLight,
    Vector3,
    MeshBuilder,
    GroundMesh,
    Light,
    CubeTexture,
    ShadowGenerator,
    BackgroundMaterial,
    Color3,
    CascadedShadowGenerator,
} from "@babylonjs/core";

export class EnvironmentManager {
    private _currentLights: Light[] = [];
    private _currentGround: GroundMesh | null = null;
    private _shadowGenerator: ShadowGenerator | CascadedShadowGenerator | null = null;

    constructor(private scene: Scene) {}

    /** Switch between Studio and Outdoor environments */
    public async setEnvironment(type: "studio" | "outdoor", isWebGPU: boolean = false): Promise<void> {
        this._clearEnv();

        // 1. Setup PBR IBL (Reflections)
        const hdrUrl = type === "studio" 
            ? "https://assets.babylonjs.com/environments/studio.env"
            : "https://assets.babylonjs.com/environments/environmentSpecular.env";
        
        const hdrTexture = new CubeTexture(hdrUrl, this.scene);
        this.scene.environmentTexture = hdrTexture;
        this.scene.environmentIntensity = type === "studio" ? 1.0 : 1.5;

        // 2. Setup Specific Lighting & Shadows
        if (type === "studio") {
            await this._setupStudio(isWebGPU);
        } else {
            await this._setupOutdoor(isWebGPU);
        }

        // Add all compatible meshes in the scene to the new shadow generator
        this.updateShadowCasters();
    }

    private async _setupStudio(isWebGPU: boolean): Promise<void> {
        // Soft Overhead Studio Light
        const dirLight = new DirectionalLight("studioDir", new Vector3(-1, -2, -1).normalize(), this.scene);
        dirLight.position = new Vector3(5, 10, 5);
        dirLight.intensity = 2.0;
        this._currentLights.push(dirLight);

        // Fill Light
        const fillLight = new HemisphericLight("studioHemi", new Vector3(0, 1, 0), this.scene);
        fillLight.intensity = 0.5;
        this._currentLights.push(fillLight);

        // High Quality Shadows (Soft PCF Filter)
        const shadowRes = isWebGPU ? 1024 : 512;
        const sg = new ShadowGenerator(shadowRes, dirLight);
        sg.useBlurExponentialShadowMap = true;
        sg.usePercentageCloserFiltering = true; // High quality soft shadows
        sg.filteringQuality = ShadowGenerator.QUALITY_HIGH;
        sg.blurKernel = 32;
        sg.setDarkness(0.4);
        this._shadowGenerator = sg;

        // Dark Studio Floor
        this._currentGround = MeshBuilder.CreateGround("studioGround", { width: 50, height: 50 }, this.scene);
        this._currentGround.receiveShadows = true;
        
        const groundMat = new BackgroundMaterial("studioGroundMat", this.scene);
        groundMat.primaryColor = new Color3(0.05, 0.05, 0.05);
        groundMat.shadowLevel = 0.5;
        this._currentGround.material = groundMat;
    }

    private async _setupOutdoor(isWebGPU: boolean): Promise<void> {
        // Sun Light
        const sun = new DirectionalLight("sun", new Vector3(-1, -1, -0.5).normalize(), this.scene);
        sun.position = new Vector3(20, 40, 20);
        sun.intensity = 3.5;
        this._currentLights.push(sun);

        // Sky Ambient Light
        const sky = new HemisphericLight("outdoorSky", new Vector3(0, 1, 0), this.scene);
        sky.groundColor = new Color3(0.1, 0.2, 0.1);
        sky.intensity = 0.8;
        this._currentLights.push(sky);

        // Realistic Cascaded Shadows for Outdoor (if supported, fallback to SG)
        const shadowRes = isWebGPU ? 2048 : 512;
        try {
            const csg = new CascadedShadowGenerator(shadowRes, sun);
            csg.stabilizeCascades = true;
            csg.lambda = 0.5;
            csg.setDarkness(0.5);
            csg.usePercentageCloserFiltering = true;
            this._shadowGenerator = csg;
        } catch {
            this._shadowGenerator = new ShadowGenerator(shadowRes, sun);
            this._shadowGenerator.useBlurExponentialShadowMap = true;
        }

        // Outdoor Ground
        this._currentGround = MeshBuilder.CreateGround("outdoorGround", { width: 200, height: 200 }, this.scene);
        this._currentGround.receiveShadows = true;
        
        const groundMat = new BackgroundMaterial("outdoorGroundMat", this.scene);
        groundMat.primaryColor = new Color3(0.2, 0.25, 0.2); // Grass-like tint
        groundMat.shadowLevel = 0.6;
        this._currentGround.material = groundMat;
    }

    /** Ensure all meshes cast shadows */
    public updateShadowCasters(): void {
        if (!this._shadowGenerator) return;
        const sg = this._shadowGenerator;
        
        this.scene.meshes.forEach(m => {
            if (m !== this._currentGround && m.isVisible && m.isEnabled()) {
                sg.addShadowCaster(m);
            }
        });
    }

    private _clearEnv(): void {
        this._currentLights.forEach(l => l.dispose());
        this._currentLights = [];
        if (this._currentGround) {
            this._currentGround.dispose();
            this._currentGround = null;
        }
        if (this._shadowGenerator) {
            this._shadowGenerator.dispose();
            this._shadowGenerator = null;
        }
    }
}
