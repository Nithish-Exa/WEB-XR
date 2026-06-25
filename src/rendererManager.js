/**
 * rendererManager.js
 * Factory for creating WebGL / WebGPU renderers with production settings.
 */

import * as THREE from 'three';

/** Detect WebGPU availability */
export async function isWebGPUAvailable() {
    if (!navigator.gpu) return false;
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    } catch {
        return false;
    }
}

/**
 * Create a renderer of the requested type.
 * @param {'webgl'|'webgpu'} type
 * @param {HTMLElement} container
 * @returns {Promise<THREE.WebGLRenderer>}
 */
export async function createRenderer(type, container) {
    let renderer;

    if (type === 'webgpu') {
        try {
            // Import the full WebGPU-enabled Three.js bundle
            const THREE_GPU = await import('three/webgpu');

            renderer = new THREE_GPU.WebGPURenderer({ antialias: true });
            await renderer.init();

            renderer._rendererType = 'webgpu';
        } catch (err) {
            console.error('WebGPU renderer critical failure:', err);
            renderer = createWebGLRenderer();
        }
    } else {
        renderer = createWebGLRenderer();
    }

    applyProductionSettings(renderer);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);
    return renderer;
}

function createWebGLRenderer() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile, // Disable on mobile to save bandwidth
        powerPreference: 'high-performance',
        alpha: false,
    });
    renderer._rendererType = 'webgl';
    return renderer;
}

/** Apply production-quality settings to a renderer */
function applyProductionSettings(renderer) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    // Hard cap mobile to 1.0 to avoid 3K/4K scaling crashes
    const pr = Math.min(window.devicePixelRatio, isMobile ? 1.0 : 2);
    renderer.setPixelRatio(pr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    if ('useLegacyLights' in renderer) {
        renderer.useLegacyLights = false;
    }

    if (renderer.shadowMap) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.VSMShadowMap;
    }
}

/** Enable XR on a renderer */
export function enableXR(renderer) {
    if (renderer.xr) {
        renderer.xr.enabled = true;
        // setReferenceSpaceType is missing in experimental WebGPURenderer
        if (typeof renderer.xr.setReferenceSpaceType === 'function') {
            renderer.xr.setReferenceSpaceType('local-floor');
        }
    }
}

/** Dispose a renderer and remove its canvas */
export function disposeRenderer(renderer) {
    if (!renderer) return;
    renderer.setAnimationLoop(null);
    if (renderer.xr) renderer.xr.enabled = false;
    renderer.dispose();
    if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
}

/** Get the type string */
export function getRendererType(renderer) {
    return renderer?._rendererType || 'webgl';
}
