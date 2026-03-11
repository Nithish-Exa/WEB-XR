import { AbstractEngine, Scene } from "@babylonjs/core";

/**
 * statsManager.ts
 * Performance overlay for monitoring 120fps targets with detailed metrics.
 */

export class StatsManager {
    private _statsDiv: HTMLDivElement | null = null;
    private _lastUpdate = 0;
    private _fields: Record<string, HTMLElement> = {};

    init() {
        // Find or create the overlay
        let existing = document.getElementById("stats-overlay");
        if (existing) {
            existing.innerHTML = ""; // Clear it
            this._statsDiv = existing as HTMLDivElement;
        } else {
            this._statsDiv = document.createElement("div");
            this._statsDiv.id = "stats-overlay";
            document.body.appendChild(this._statsDiv);
        }

        this._statsDiv.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            padding: 12px 16px;
            background: rgba(15, 15, 20, 0.85);
            color: #e0e0e0;
            font-family: 'Segoe UI', monospace;
            font-size: 13px;
            border-radius: 8px;
            z-index: 1000;
            pointer-events: none;
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            min-width: 180px;
            display: block; /* Ensure it's visible */
        `;

        const metrics = [
            { id: 'fps', label: 'FPS' },
            { id: 'timing', label: 'Frame Time' },
            { id: 'drawCalls', label: 'Draw Calls' },
            { id: 'polys', label: 'Polycount' },
            { id: 'geoms', label: 'Geometries' },
            { id: 'textures', label: 'Textures/Mats' }
        ];

        this._statsDiv.innerHTML = metrics.map(m => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: #888;">${m.label}:</span>
                <span id="stat-${m.id}" style="font-weight: bold; color: #00d4ff;">--</span>
            </div>
        `).join('');

        metrics.forEach(m => {
            const el = document.getElementById(`stat-${m.id}`);
            if (el) this._fields[m.id] = el;
        });
    }

    update(engine: AbstractEngine) {
        const now = performance.now();
        if (now - this._lastUpdate > 300) {
            const fpsValue = engine.getFps();
            const fps = fpsValue.toFixed(0);
            const scene = engine.scenes[0] as Scene;
            
            if (this._fields['fps']) {
                this._fields['fps'].innerText = fps;
                this._fields['fps'].style.color = fpsValue >= 110 ? "#00ff88" : (fpsValue >= 60 ? "#00d4ff" : "#ff4444");
            }

            if (this._fields['timing']) {
                const time = (1000 / fpsValue).toFixed(2);
                this._fields['timing'].innerText = `${time} ms`;
            }

            if (scene) {
                if (this._fields['drawCalls']) {
                    // In Babylon, we can get active meshes as a proxy for draw calls if instrumentation is off
                    this._fields['drawCalls'].innerText = scene.getActiveMeshes().length.toString();
                }

                if (this._fields['polys']) {
                    let totalPolys = 0;
                    scene.meshes.forEach(m => {
                        if (m.isEnabled() && m.isVisible) {
                            totalPolys += (m.getTotalIndices() || 0) / 3;
                        }
                    });
                    this._fields['polys'].innerText = this._formatNum(Math.round(totalPolys));
                }

                if (this._fields['geoms']) {
                    this._fields['geoms'].innerText = scene.geometries.length.toString();
                }

                if (this._fields['textures']) {
                    const texCount = scene.textures.length;
                    const matCount = scene.materials.length;
                    this._fields['textures'].innerText = `${texCount} / ${matCount}`;
                }
            }
            
            this._lastUpdate = now;
        }
    }

    private _formatNum(n: number) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n.toString();
    }

    hide() {
        if (this._statsDiv) this._statsDiv.style.display = "none";
    }

    show() {
        if (this._statsDiv) this._statsDiv.style.display = "block";
    }
}
