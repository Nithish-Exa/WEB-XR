# WebXR Bike Viewer

Production-ready WebXR VR website built with Three.js — displays a GLB bike model with WebGL/WebGPU renderer toggle, studio and outdoor environments, VR support, and real-time performance stats.

## Quick Start

```bash
npm install
npm run dev
```

Open https://localhost:5173 in your browser (accept the self-signed certificate warning).

## Features

- **WebGL ↔ WebGPU** renderer toggle (with automatic fallback)
- **Studio / Outdoor** environment switching
- **WebXR VR** mode with controller support
- **Real-time stats** — FPS, draw calls, triangles, renderer type, XR status
- **Auto-rotation** toggle
- **Production settings** — ACES tone mapping, PCF shadows, sRGB output
- **OrbitControls** on desktop, XR raycasting in VR

## Adding Your Model

Place your GLB file at:

```
public/models/RTR-310-op-v4.glb
```

## Adding HDR Environments (Optional)

Place HDR files at:

```
public/hdr/studio.hdr
public/hdr/outdoor.hdr
```

If not provided, the app uses procedural environments (room geometry + gradient sky).

## Testing in VR

1. Start the dev server: `npm run dev`
2. Note the **Network** URL shown in terminal (e.g., `https://192.168.1.x:5173`)
3. On your Quest headset, open the browser and navigate to that URL
4. Accept the self-signed certificate warning
5. Tap the **ENTER VR** button at the bottom of the page
6. Use controllers to interact — ray highlights bike parts on hover

> **Tip**: Both the headset and your dev machine must be on the same Wi-Fi network.

## Production Build

```bash
npm run build
```

Output goes to `dist/`. Serve with any static file server.

```bash
npm run preview
```

## Project Structure

```
index.html              — HTML entry with loading screen
src/
  main.js               — App entry, wiring, animation loop
  rendererManager.js    — WebGL/WebGPU factory, XR enable, disposal
  sceneManager.js       — Scene, camera, model loading, controls, XR interaction
  environmentManager.js — Studio room / outdoor sky environments
  uiManager.js          — Dark UI control panel
  statsManager.js       — Performance stats overlay
public/
  models/               — GLB model files
  hdr/                  — HDR environment maps
vite.config.js          — Vite config with HTTPS
```

## Requirements

- Node.js 18+
- Modern browser with WebGL2 support
- For WebGPU: Chrome 113+ or Edge 113+ with WebGPU flag enabled
- For VR: WebXR-compatible headset (Meta Quest 2/3/Pro)
