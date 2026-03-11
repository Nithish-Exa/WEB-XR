export type AppState = {
    renderer: "webgl" | "webgpu";
    environment: "studio" | "outdoor";
    xrSupported?: boolean;
};

export function setupUI(
    state: AppState, 
    onRendererChange: (r: "webgl" | "webgpu") => void, 
    onEnvironmentChange: (e: "studio" | "outdoor") => void,
    onEnterVR: () => void
) {
    const uiLayer = document.getElementById("ui-layer");
    if (!uiLayer) return;
    uiLayer.innerHTML = ""; // clear previous

    // Renderer Switcher
    const rendererGroup = document.createElement("div");
    rendererGroup.className = "ui-group";
    
    const rendererLabel = document.createElement("div");
    rendererLabel.className = "ui-label";
    rendererLabel.innerText = "Renderer Engine";
    rendererGroup.appendChild(rendererLabel);

    const btnWebGL = document.createElement("button");
    btnWebGL.innerText = "WebGL 2.0";
    btnWebGL.className = state.renderer === "webgl" ? "active" : "";
    btnWebGL.onclick = () => onRendererChange("webgl");
    rendererGroup.appendChild(btnWebGL);

    const btnWebGPU = document.createElement("button");
    btnWebGPU.innerText = "WebGPU";
    btnWebGPU.className = state.renderer === "webgpu" ? "active" : "";
    btnWebGPU.onclick = () => onRendererChange("webgpu");
    rendererGroup.appendChild(btnWebGPU);

    uiLayer.appendChild(rendererGroup);

    // Separator
    uiLayer.appendChild(document.createElement("hr"));

    // Environment Switcher
    const envGroup = document.createElement("div");
    envGroup.className = "ui-group";

    const envLabel = document.createElement("div");
    envLabel.className = "ui-label";
    envLabel.innerText = "Environment";
    envGroup.appendChild(envLabel);

    const btnStudio = document.createElement("button");
    btnStudio.innerText = "Studio Light";
    btnStudio.className = state.environment === "studio" ? "active" : "";
    btnStudio.onclick = () => onEnvironmentChange("studio");
    envGroup.appendChild(btnStudio);

    const btnOutdoor = document.createElement("button");
    btnOutdoor.innerText = "Outdoor Sun";
    btnOutdoor.className = state.environment === "outdoor" ? "active" : "";
    btnOutdoor.onclick = () => onEnvironmentChange("outdoor");
    envGroup.appendChild(btnOutdoor);

    uiLayer.appendChild(envGroup);

    // VR Toggle
    if (state.xrSupported) {
        uiLayer.appendChild(document.createElement("hr"));
        
        const xrGroup = document.createElement("div");
        xrGroup.className = "ui-group";

        const xrLabel = document.createElement("div");
        xrLabel.className = "ui-label";
        xrLabel.innerText = "Virtual Reality";
        xrGroup.appendChild(xrLabel);

        const btnVR = document.createElement("button");
        btnVR.innerText = "ENTER VR";
        btnVR.className = "vr-button";
        btnVR.style.backgroundColor = "#ff0055"; // Distinct color for VR
        btnVR.style.fontWeight = "bold";
        btnVR.onclick = () => onEnterVR();
        xrGroup.appendChild(btnVR);

        uiLayer.appendChild(xrGroup);
    }
}
