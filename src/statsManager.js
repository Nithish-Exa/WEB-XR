/**
 * statsManager.js
 * Performance statistics overlay — FPS, draw calls, triangles, etc.
 */

export class StatsManager {
    constructor() {
        this.panel = null;
        this.fields = {};
        this.lastTime = performance.now();
        this.frames = 0;
        this.fps = 0;
    }

    init() {
        this.panel = document.createElement('div');
        this.panel.id = 'stats-panel';
        this.panel.innerHTML = this._buildHTML();
        document.body.appendChild(this.panel);
        this._injectStyles();
    }

    _buildHTML() {
        const rows = [
            ['fps', 'FPS', '—'],
            ['frameTime', 'Frame', '— ms'],
            ['drawCalls', 'Draw Calls', '—'],
            ['triangles', 'Triangles', '—'],
            ['geometries', 'Geometries', '—'],
            ['textures', 'Textures', '—'],
            ['renderer', 'Renderer', '—'],
            ['xr', 'XR Active', 'No'],
        ];

        return `
      <div class="stats-header">
        <span class="stats-title">📊 Stats</span>
        <button class="stats-toggle" id="stats-toggle">−</button>
      </div>
      <div class="stats-body" id="stats-body">
        ${rows
                .map(
                    ([id, label, def]) =>
                        `<div class="stats-row"><span class="stats-label">${label}</span><span class="stats-value" id="stat-${id}">${def}</span></div>`
                )
                .join('')}
      </div>
    `;
    }

    _injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
      #stats-panel {
        position: fixed;
        bottom: 80px;
        right: 16px;
        z-index: 100;
        width: 200px;
        background: rgba(15, 15, 20, 0.92);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        color: #e0e0e0;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 12px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      }
      .stats-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .stats-title {
        font-weight: 600;
        font-size: 12px;
        color: #00d4ff;
        letter-spacing: 0.5px;
      }
      .stats-toggle {
        background: none;
        border: none;
        color: rgba(255,255,255,0.4);
        cursor: pointer;
        font-size: 14px;
        padding: 2px 6px;
        border-radius: 4px;
      }
      .stats-toggle:hover { color: #fff; background: rgba(255,255,255,0.1); }
      .stats-body { padding: 6px 12px 10px; }
      .stats-body.collapsed { display: none; }
      .stats-row {
        display: flex;
        justify-content: space-between;
        padding: 3px 0;
        border-bottom: 1px solid rgba(255,255,255,0.03);
      }
      .stats-row:last-child { border: none; }
      .stats-label {
        color: rgba(255,255,255,0.4);
        font-size: 11px;
      }
      .stats-value {
        color: #fff;
        font-size: 11px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
    `;
        document.head.appendChild(style);

        // Collapse toggle
        document.getElementById('stats-toggle').addEventListener('click', () => {
            const body = document.getElementById('stats-body');
            const btn = document.getElementById('stats-toggle');
            body.classList.toggle('collapsed');
            btn.textContent = body.classList.contains('collapsed') ? '+' : '−';
        });

        document.getElementById('stats-body').classList.add('collapsed');
        document.getElementById('stats-toggle').textContent = '+';
    }

    /** Call every frame */
    update(renderer) {
        this.frames++;
        const now = performance.now();
        const delta = now - this.lastTime;

        // Update FPS every 500ms
        if (delta >= 500) {
            this.fps = Math.round((this.frames * 1000) / delta);
            this.frames = 0;
            this.lastTime = now;

            this._set('fps', this.fps);
            this._set('frameTime', (delta / this.fps).toFixed(1) + ' ms');
        }

        // Renderer info
        if (renderer && renderer.info) {
            const info = renderer.info;
            this._set('drawCalls', info.render?.calls ?? '—');
            this._set('triangles', this._formatNum(info.render?.triangles ?? 0));
            this._set('geometries', info.memory?.geometries ?? '—');
            this._set('textures', info.memory?.textures ?? '—');
        }

        // Renderer type
        this._set('renderer', renderer?._rendererType?.toUpperCase() || 'WebGL');

        // XR
        const xrActive = renderer?.xr?.isPresenting ?? false;
        this._set('xr', xrActive ? 'Yes' : 'No');
    }

    _set(id, val) {
        const el = document.getElementById(`stat-${id}`);
        if (el) el.textContent = val;
    }

    _formatNum(n) {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
        return n;
    }

    hide() {
        if (this.panel) this.panel.style.display = 'none';
    }

    show() {
        if (this.panel) this.panel.style.display = '';
    }
}
