/**
 * uiManager.js
 * Minimal dark-themed HTML/CSS overlay control panel.
 */

export class UIManager {
    constructor() {
        this.panel = null;
        this.callbacks = {};
        this.webgpuAvailable = false;
        this.currentRenderer = 'webgl';
        this.currentEnv = 'studio';
    }

    /** Initialize panel */
    init(container, options = {}) {
        this.webgpuAvailable = options.webgpuAvailable || false;

        this.panel = document.createElement('div');
        this.panel.id = 'ui-panel';
        this.panel.innerHTML = this._buildHTML();
        document.body.appendChild(this.panel);

        this._injectStyles();
        this._bindEvents();
    }

    _buildHTML() {
        return `
      <div class="ui-header">
        <span class="ui-title">⚙ Controls</span>
        <button class="ui-collapse-btn" id="ui-collapse">−</button>
      </div>
      <div class="ui-body" id="ui-body">
        <!-- Renderer -->
        <div class="ui-group">
          <div class="ui-label">Renderer</div>
          <div class="ui-btn-group">
            <button class="ui-btn active" id="btn-webgl" data-renderer="webgl">WebGL</button>
            <button class="ui-btn ${this.webgpuAvailable ? '' : 'disabled'}" id="btn-webgpu" data-renderer="webgpu"
              ${this.webgpuAvailable ? '' : 'disabled title="WebGPU not supported in this browser"'}>
              WebGPU
            </button>
          </div>
        </div>
        <!-- Environment -->
        <div class="ui-group">
          <div class="ui-label">Environment</div>
          <div class="ui-radio-group">
            <label class="ui-radio">
              <input type="radio" name="env" value="studio" checked />
              <span class="ui-radio-mark"></span>
              Studio
            </label>
            <label class="ui-radio">
              <input type="radio" name="env" value="outdoor" />
              <span class="ui-radio-mark"></span>
              Outdoor
            </label>
          </div>
        </div>
        <!-- Rotation -->
        <div class="ui-group">
          <div class="ui-label">Auto Rotate</div>
          <label class="ui-switch">
            <input type="checkbox" id="chk-rotate" />
            <span class="ui-slider"></span>
          </label>
        </div>
      </div>
    `;
    }

    _injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
      #ui-panel {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 100;
        width: 220px;
        background: rgba(15, 15, 20, 0.92);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        color: #e0e0e0;
        font-family: 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        transition: width 0.3s ease;
      }
      .ui-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .ui-title {
        font-weight: 600;
        font-size: 13px;
        letter-spacing: 0.5px;
        color: #00d4ff;
      }
      .ui-collapse-btn {
        background: none;
        border: none;
        color: rgba(255,255,255,0.4);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 2px 6px;
        border-radius: 4px;
        transition: all 0.2s;
      }
      .ui-collapse-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }
      .ui-body { padding: 8px 14px 14px; }
      .ui-body.collapsed { display: none; }
      .ui-group { margin-bottom: 14px; }
      .ui-group:last-child { margin-bottom: 0; }
      .ui-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: rgba(255,255,255,0.35);
        margin-bottom: 8px;
        font-weight: 600;
      }
      .ui-btn-group { display: flex; gap: 6px; }
      .ui-btn {
        flex: 1;
        padding: 7px 0;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.03);
        color: rgba(255,255,255,0.6);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
        text-align: center;
      }
      .ui-btn:hover:not(.disabled) {
        background: rgba(0,212,255,0.1);
        border-color: rgba(0,212,255,0.3);
        color: #fff;
      }
      .ui-btn.active {
        background: rgba(0,212,255,0.15);
        border-color: #00d4ff;
        color: #00d4ff;
        font-weight: 600;
      }
      .ui-btn.disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      /* Radio */
      .ui-radio-group { display: flex; flex-direction: column; gap: 6px; }
      .ui-radio {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 12px;
        color: rgba(255,255,255,0.7);
      }
      .ui-radio input { display: none; }
      .ui-radio-mark {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.2);
        position: relative;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .ui-radio input:checked + .ui-radio-mark {
        border-color: #00d4ff;
      }
      .ui-radio input:checked + .ui-radio-mark::after {
        content: '';
        position: absolute;
        top: 2px; left: 2px;
        width: 6px; height: 6px;
        background: #00d4ff;
        border-radius: 50%;
      }
      /* Toggle Switch */
      .ui-switch {
        position: relative;
        display: inline-block;
        width: 40px;
        height: 22px;
      }
      .ui-switch input { opacity: 0; width: 0; height: 0; }
      .ui-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background: rgba(255,255,255,0.1);
        border-radius: 22px;
        transition: 0.3s;
      }
      .ui-slider::before {
        content: '';
        position: absolute;
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background: rgba(255,255,255,0.5);
        border-radius: 50%;
        transition: 0.3s;
      }
      .ui-switch input:checked + .ui-slider {
        background: rgba(0,212,255,0.3);
      }
      .ui-switch input:checked + .ui-slider::before {
        transform: translateX(18px);
        background: #00d4ff;
      }
    `;
        document.head.appendChild(style);
    }

    _bindEvents() {
        // Collapse
        document.getElementById('ui-collapse').addEventListener('click', () => {
            const body = document.getElementById('ui-body');
            const btn = document.getElementById('ui-collapse');
            body.classList.toggle('collapsed');
            btn.textContent = body.classList.contains('collapsed') ? '+' : '−';
        });

        // Renderer buttons
        document.querySelectorAll('[data-renderer]').forEach((btn) => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('disabled')) return;
                const type = btn.dataset.renderer;
                if (type === this.currentRenderer) return;
                this.currentRenderer = type;
                document.querySelectorAll('[data-renderer]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (this.callbacks.onRendererChange) this.callbacks.onRendererChange(type);
            });
        });

        // Environment
        document.querySelectorAll('input[name="env"]').forEach((radio) => {
            radio.addEventListener('change', () => {
                this.currentEnv = radio.value;
                if (this.callbacks.onEnvironmentChange) this.callbacks.onEnvironmentChange(radio.value);
            });
        });

        // Rotation
        document.getElementById('chk-rotate').addEventListener('change', (e) => {
            if (this.callbacks.onRotateChange) this.callbacks.onRotateChange(e.target.checked);
        });

        if (window.innerWidth <= 600) {
            document.getElementById('ui-body').classList.add('collapsed');
            document.getElementById('ui-collapse').textContent = '+';
        }
    }

    /** Register callbacks */
    on(event, fn) {
        this.callbacks[event] = fn;
    }

    /** Update active renderer button */
    setRendererActive(type) {
        this.currentRenderer = type;
        document.querySelectorAll('[data-renderer]').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.renderer === type);
        });
    }

    /** Hide panel (e.g., in VR) */
    hide() {
        if (this.panel) this.panel.style.display = 'none';
    }

    show() {
        if (this.panel) this.panel.style.display = '';
    }
}
