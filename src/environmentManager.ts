import { Scene, DirectionalLight, HemisphericLight, Vector3, MeshBuilder, GroundMesh, Light } from "@babylonjs/core";

let currentLights: Light[] = [];
let currentGround: GroundMesh | null = null;

export function setEnvironment(scene: Scene, type: "studio" | "outdoor") {
    // Clear old environment
    currentLights.forEach(l => l.dispose());
    currentLights = [];
    
    if (currentGround) {
        currentGround.dispose();
        currentGround = null;
    }

    if (type === "studio") {
        // Studio environment: Directional light + ground plane
        const dirLight = new DirectionalLight("dirLight", new Vector3(-1, -2, -1), scene);
        dirLight.intensity = 1.0;
        currentLights.push(dirLight);

        currentGround = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
        currentGround.position.y = -0.05; // Slightly below model
    } else {
        // Outdoor environment: Hemispheric sunlight
        const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
        hemiLight.intensity = 1.2;
        currentLights.push(hemiLight);
    }
}
