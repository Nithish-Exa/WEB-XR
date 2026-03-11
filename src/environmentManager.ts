import { Scene, DirectionalLight, HemisphericLight, Vector3, MeshBuilder, GroundMesh, Light, CubeTexture, ShadowGenerator, BackgroundMaterial, Color3 } from "@babylonjs/core";

let currentLights: Light[] = [];
let currentGround: GroundMesh | null = null;
let shadowGenerator: ShadowGenerator | null = null;

export function setEnvironment(scene: Scene, type: "studio" | "outdoor") {
    // Clear old environment
    currentLights.forEach(l => l.dispose());
    currentLights = [];
    
    if (currentGround) {
        currentGround.dispose();
        currentGround = null;
    }

    if (shadowGenerator) {
        shadowGenerator.dispose();
        shadowGenerator = null;
    }

    // 1. Setup HDR Environment (IBL) - This is CRITICAL for PBR realism/reflections
    // Using a default Babylon studio environment for high-quality reflections
    const hdrTexture = new CubeTexture("https://assets.babylonjs.com/environments/studio.env", scene);
    scene.environmentTexture = hdrTexture;
    scene.environmentIntensity = 1.0;

    if (type === "studio") {
        // Studio environment: Directional light + shadow ground
        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1).normalize(), scene);
        dirLight.position = new Vector3(3, 6, 3); // Slightly closer for better shadow precision at lower res
        dirLight.intensity = 2.5;
        currentLights.push(dirLight);

        // Setup Shadows - Optimized for mobile (512 res + 16 blur)
        shadowGenerator = new ShadowGenerator(512, dirLight);
        shadowGenerator.useBlurExponentialShadowMap = true;
        shadowGenerator.blurKernel = 16;
        shadowGenerator.setDarkness(0.5);

        // Ground for shadows only (BackgroundMaterial)
        currentGround = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
        currentGround.position.y = -0.01;
        currentGround.receiveShadows = true;

        const groundMat = new BackgroundMaterial("groundMat", scene);
        groundMat.reflectionTexture = null;
        groundMat.primaryColor = new Color3(0.04, 0.04, 0.05); // Slightly darker
        groundMat.alpha = 0.9;
        groundMat.shadowLevel = 0.6;
        currentGround.material = groundMat;

        // Add all scene meshes to shadow generator
        // Optimization: Only add meshes that are likely meant to cast shadows
        scene.meshes.forEach(m => {
            if (m !== currentGround && m.isVisible && m.isEnabled() && shadowGenerator) {
                shadowGenerator.addShadowCaster(m);
            }
        });

    } else {
        // Outdoor environment
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 0.8;
        currentLights.push(hemiLight);
        
        scene.environmentIntensity = 1.5; // Brighter outdoors
    }
}
