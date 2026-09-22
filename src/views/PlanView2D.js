/**
 * PlanView2D — Visão planta 2D (horizontal e vertical) com Canvas overlay.
 *
 * Renderiza paredes, janelas, portas e objetos como retângulos 2D.
 * Suporta: multi-seleção (shift+click, rubber-band), mover, redimensionar,
 *          adicionar paredes/elementos, agrupar/desagrupar.
 *
 * Modos:
 *   'horizontal' — planta (eixo XZ, vista de cima)
 *   'vertical'   — elevação (eixo XY, vista lateral)
 */
let _groupIdSeq = 0;

export default class PlanView2D {
  constructor({ scene, camera, renderer, editableMeshes, trailer, computed, D, editor, persistFn }) {
    const THREE = window.THREE;
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.editableMeshes = editableMeshes;
    this.trailer = trailer;
    this.computed = computed;
    this.D = D;
    this.editor = editor;
    this.persistFn = persistFn || null;

    this.mode = 'horizontal';
    this.viewSide = 'front';
    this.active = false;
    this.tool = 'select';

    this.canvas = null;
    this.ctx = null;
    this.container = null;

    this.scale = 150;
    this.offsetX = 0;
    this.offsetY = 0;
    this.width = 800;
    this.height = 600;

    this.selected = [];
    this.groups = [];
    this._hoverElement = null;
    this.dragging = false;
    this.dragStart = null;
    this.dragObjStart = null;
    this.resizeHandle = null;
    this.resizeStart = null;

    this._rubberBand = null;
    this._rubberBandStart = null;

    this.elements = [];
    this._toolbarRects = [];

    this._initDOM();
    this._initEvents();
  }

  _initDOM() {
    this.container = document.createElement('div');
    this.container.id = 'plan2d-overlay';
    this.container.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:90;display:none;overflow:hidden;background:#f8f6f2;user-select:none;-webkit-user-select:none;touch-action:none;';
    const canvasWrap = document.getElementById('canvas-wrap');
    if (canvasWrap) canvasWrap.appendChild(this.container);

    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._resizeCanvas();
  }

  _resizeCanvas() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 800;
    this.height = rect.height || 600;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _initEvents() {
    this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
    this.canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    this.canvas.addEventListener('dblclick', (e) => this._onDblClick(e));

    window.addEventListener('resize', () => {
      if (this.active) { this._resizeCanvas(); this.render(); }
    });
  }

  activate(mode = 'horizontal') {
    this.mode = mode;
    this.active = true;
    this.container.style.display = 'block';
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.display = 'none';
    }
    requestAnimationFrame(() => {
      this._resizeCanvas();
      this._syncFromScene();
      this._centerView();
      this.render();
    });
  }

  deactivate() {
    this.active = false;
    this.container.style.display = 'none';
    this.selected = [];
    this._hoverElement = null;
    this._rubberBand = null;
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.style.display = '';
    }
  }

  setTool(tool) {
    this.tool = tool;
    if (this.canvas) this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  }

  setMode(mode) {
    this.mode = mode;
    if (this.active) {
      this._syncFromScene();
      this._centerView();
      this.render();
    }
  }

  setViewSide(side) {
    if (!['front', 'back', 'left', 'right'].includes(side)) return;
    this.viewSide = side;
    if (this.active && this.mode === 'vertical') {
      this._syncFromScene();
      this._centerView();
      this.render();
    }
  }

  /* ──────────── SELECTION ──────────── */

  isSelected(el) {
    return this.selected.includes(el);
  }

  _setSelected(els) {
    this.selected = els;
    if (this.editor) {
      if (els.length === 1) this.editor.selectObject(els[0].obj);
      else if (els.length === 0) this.editor.deselectObject();
    }
  }

  _addToSelection(el) {
    if (!this.isSelected(el)) {
      this.selected.push(el);
    }
  }

  _toggleSelection(el) {
    const idx = this.selected.indexOf(el);
    if (idx >= 0) this.selected.splice(idx, 1);
    else this.selected.push(el);
  }

  selectAll() {
    this._setSelected([...this.elements]);
    this.render();
  }

  deselectAll() {
    this._setSelected([]);
    this.render();
  }

  /* ──────────── GROUPS ──────────── */

  _getElementGroupId(el) {
    for (const g of this.groups) {
      if (g.elements.includes(el)) return g.id;
    }
    return null;
  }

  groupSelected() {
    if (this.selected.length < 2) return;
    const newGroupId = ++_groupIdSeq;
    const groupColor = this._groupIdToColor(newGroupId);
    const members = [...this.selected];
    for (const el of members) {
      const existingGroupId = this._getElementGroupId(el);
      if (existingGroupId !== null) {
        const old = this.groups.find(g => g.id === existingGroupId);
        if (old) old.elements = old.elements.filter(e => e !== el);
      }
      el.groupId = newGroupId;
      el.groupColor = groupColor;
    }
    this.groups = this.groups.filter(g => g.elements.length > 0);
    this.groups.push({ id: newGroupId, name: 'Grupo ' + newGroupId, elements: members, color: groupColor });
    this.render();
    if (this.persistFn) this.persistFn('plan2d group');
  }

  ungroupSelected() {
    const toUngroup = new Set();
    for (const el of this.selected) {
      if (el.groupId != null) toUngroup.add(el.groupId);
    }
    for (const gid of toUngroup) {
      const g = this.groups.find(gr => gr.id === gid);
      if (g) {
        for (const el of g.elements) {
          el.groupId = null;
          el.groupColor = null;
        }
        this.groups = this.groups.filter(gr => gr.id !== gid);
      }
    }
    this.render();
  }

  _groupIdToColor(id) {
    const hue = (id * 137.508) % 360;
    return `hsl(${hue}, 70%, 55%)`;
  }

  _getGroupBounds(groupId) {
    const g = this.groups.find(gr => gr.id === groupId);
    if (!g || g.elements.length === 0) return null;
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const el of g.elements) {
      if (el.x < minX) minX = el.x;
      if (el.z < minZ) minZ = el.z;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.z + el.h > maxZ) maxZ = el.z + el.h;
    }
    this.render();
    if (this.persistFn) this.persistFn('plan2d ungroup');
  }

  /* ──────────── SCENE SYNC ──────────── */

  _syncFromScene() {
    this.elements = [];
    if (!this.trailer) return;
    const THREE = this.THREE;

    this.trailer.traverse((obj) => {
      if (!obj.isMesh) return;
      if (!obj.visible) return;
      const ud = obj.userData;
      if (!ud || (!ud.editable && !ud.kind)) return;

      obj.updateWorldMatrix(true, false);
      const bbox = new THREE.Box3().setFromObject(obj);
      if (bbox.isEmpty()) return;

      const el = {
        obj,
        name: ud.name || ud.pieceName || obj.name || 'objeto',
        kind: ud.kind || 'unknown',
        category: ud.category || 'acessorios',
        bbox,
        color: this._getColorForKind(ud.kind, ud.category),
        groupId: ud.groupId || null,
        groupColor: ud.groupId ? this._groupIdToColor(ud.groupId) : null,
      };

      if (this.mode === 'horizontal') {
        el.x = bbox.min.x;
        el.z = bbox.min.z;
        el.w = bbox.max.x - bbox.min.x;
        el.h = bbox.max.z - bbox.min.z;
      } else {
        switch (this.viewSide) {
          case 'front':
          case 'back':
            el.x = bbox.min.x;
            el.z = bbox.min.y;
            el.w = bbox.max.x - bbox.min.x;
            el.h = bbox.max.y - bbox.min.y;
            break;
          case 'left':
          case 'right':
            el.x = bbox.min.z;
            el.z = bbox.min.y;
            el.w = bbox.max.z - bbox.min.z;
            el.h = bbox.max.y - bbox.min.y;
            break;
        }
      }

      el._3dPos = { x: obj.position.x, y: obj.position.y, z: obj.position.z };
      el._3dSize = { x: bbox.max.x - bbox.min.x, y: bbox.max.y - bbox.min.y, z: bbox.max.z - bbox.min.z };

      this.elements.push(el);
    });

    this.groups = [];
    const groupMap = new Map();
    for (const el of this.elements) {
      if (el.groupId != null) {
        if (!groupMap.has(el.groupId)) {
          groupMap.set(el.groupId, {
            id: el.groupId,
            name: 'Grupo ' + el.groupId,
            elements: [],
            color: el.groupColor,
          });
        }
        groupMap.get(el.groupId).elements.push(el);
      }
    }
    this.groups = [...groupMap.values()];

    const order = { projeto: 0, paredes: 1, 'paredes-int': 2, telhado: 3, acessorios: 4 };
    this.elements.sort((a, b) => (order[a.category] || 5) - (order[b.category] || 5));
  }

  _getColorForKind(kind, category) {
    if (kind === 'project-box' || kind === 'project-part') return '#8B7355';
    if (category === 'projeto') return '#c9a86c';
    if (category === 'paredes' || category === 'paredes-int') return '#d4b483';
    if (category === 'telhado') return '#a0a0a0';
    if (category === 'encanamento') return '#4a90d9';
    if (category === 'eletrica') return '#e0c040';
    if (kind === 'janela' || kind === 'window') return '#b8d4e8';
    if (kind === 'porta' || kind === 'door') return '#c08060';
    if (kind === 'colchao' || kind === 'mattress') return '#d08080';
    return '#b8b0a0';
  }

  _viewFlipX() {
    return (this.mode === 'vertical' && (this.viewSide === 'back' || this.viewSide === 'right')) ? -1 : 1;
  }

  _worldToScreen(wx, wz) {
    const cx = this.width / 2 + this.offsetX;
    const cy = this.height / 2 + this.offsetY;
    return { x: cx + wx * this.scale * this._viewFlipX(), y: cy + wz * this.scale };
  }

  _screenToWorld(sx, sy) {
    const cx = this.width / 2 + this.offsetX;
    const cy = this.height / 2 + this.offsetY;
    return { x: (sx - cx) / this.scale * this._viewFlipX(), z: (sy - cy) / this.scale };
  }

  _centerView() {
    this.offsetX = 0;
    this.offsetY = 0;

    if (this.elements.length === 0) {
      const dim = this.D;
      if (this.mode === 'horizontal') {
        this.scale = Math.min(this.width / ((dim.BODY_W || 1.9) + 1), this.height / ((dim.Lt || 2.9) + 1)) * 0.8;
      } else {
        this.scale = Math.min(this.width / ((dim.BODY_W || 1.9) + 1), this.height / ((dim.WALL_H || 1.85) + 1)) * 0.8;
      }
      return;
    }

    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const el of this.elements) {
      if (el.x < minX) minX = el.x;
      if (el.z < minZ) minZ = el.z;
      if (el.x + el.w > maxX) maxX = el.x + el.w;
      if (el.z + el.h > maxZ) maxZ = el.z + el.h;
    }

    const rangeX = maxX - minX;
    const rangeZ = maxZ - minZ;
    if (rangeX > 0 && rangeZ > 0) {
      this.scale = Math.min((this.width - 80) / rangeX, (this.height - 80) / rangeZ) * 0.85;
    }

    this.offsetX = -((minX + maxX) / 2) * this.scale * this._viewFlipX();
    this.offsetY = -((minZ + maxZ) / 2) * this.scale;
  }

  /* ──────────── RENDER ──────────── */

  render() {
    if (!this.active || !this.ctx) return;
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);
    this._drawBackground(ctx, w, h);
    this._drawGrid(ctx, w, h);
    this._drawRuler(ctx, w, h);
    this._drawOriginAxes(ctx);
    this._drawGroupBoundaries(ctx);
    this._drawElements(ctx);
    this._drawSelectionOverlay(ctx);
    this._drawDimensionLines(ctx);
    this._drawRubberBand(ctx);
    this._drawToolbar(ctx);
    this._drawStatusBar(ctx);
  }

  _drawBackground(ctx, w, h) {
    ctx.fillStyle = '#f8f6f2';
    ctx.fillRect(0, 0, w, h);
  }

  _drawGrid(ctx, w, h) {
    const gridM = this._gridStepM();
    const sW = this._screenToWorld(0, 0);
    const eW = this._screenToWorld(w, h);

    ctx.strokeStyle = '#e5e2da';
    ctx.lineWidth = 0.5;
    const fx = Math.floor(sW.x / gridM) * gridM;
    const fz = Math.floor(sW.z / gridM) * gridM;
    for (let gx = fx; gx <= eW.x; gx += gridM) {
      const s = this._worldToScreen(gx, 0);
      ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, h); ctx.stroke();
    }
    for (let gz = fz; gz <= eW.z; gz += gridM) {
      const s = this._worldToScreen(0, gz);
      ctx.beginPath(); ctx.moveTo(0, s.y); ctx.lineTo(w, s.y); ctx.stroke();
    }

    const majorM = gridM * 5;
    ctx.strokeStyle = '#ccc8b8';
    ctx.lineWidth = 1;
    const fmx = Math.floor(sW.x / majorM) * majorM;
    const fmz = Math.floor(sW.z / majorM) * majorM;
    for (let gx = fmx; gx <= eW.x; gx += majorM) {
      const s = this._worldToScreen(gx, 0);
      ctx.beginPath(); ctx.moveTo(s.x, 0); ctx.lineTo(s.x, h); ctx.stroke();
    }
    for (let gz = fmz; gz <= eW.z; gz += majorM) {
      const s = this._worldToScreen(0, gz);
      ctx.beginPath(); ctx.moveTo(0, s.y); ctx.lineTo(w, s.y); ctx.stroke();
    }
  }

  _gridStepM() {
    if (this.scale > 250) return 0.1;
    if (this.scale > 120) return 0.25;
    if (this.scale > 60) return 0.5;
    return 1.0;
  }

  _drawRuler(ctx, w, h) {
    const gridM = this._gridStepM();
    const sW = this._screenToWorld(0, 0);
    const eW = this._screenToWorld(w, h);

    ctx.fillStyle = 'rgba(248,246,242,0.92)';
    ctx.fillRect(0, 0, w, 24);
    ctx.fillRect(0, 0, 24, h);
    ctx.strokeStyle = '#aaa';
    ctx.fillStyle = '#666';
    ctx.font = '9px ui-monospace, monospace';
    ctx.textBaseline = 'top';

    const fx = Math.floor(sW.x / gridM) * gridM;
    ctx.textAlign = 'center';
    for (let gx = fx; gx <= eW.x; gx += gridM) {
      if (Math.abs(gx) < 0.001) continue;
      const s = this._worldToScreen(gx, 0);
      ctx.beginPath(); ctx.moveTo(s.x, 20); ctx.lineTo(s.x, 24); ctx.stroke();
      const label = Math.abs(gx) >= 1 ? gx.toFixed(1) : Math.round(gx * 100) + 'cm';
      ctx.fillText(label, s.x, 5);
    }

    const fz = Math.floor(sW.z / gridM) * gridM;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let gz = fz; gz <= eW.z; gz += gridM) {
      if (Math.abs(gz) < 0.001) continue;
      const s = this._worldToScreen(0, gz);
      ctx.beginPath(); ctx.moveTo(20, s.y); ctx.lineTo(24, s.y); ctx.stroke();
      const label = Math.abs(gz) >= 1 ? gz.toFixed(1) : Math.round(gz * 100) + 'cm';
      ctx.fillText(label, 18, s.y);
    }

    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(24, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 24); ctx.lineTo(w, 24); ctx.stroke();
  }

  _drawOriginAxes(ctx) {
    const o = this._worldToScreen(0, 0);
    const len = 30;
    let xLabel = 'X', yLabel = 'Y';

    if (this.mode === 'horizontal') {
      xLabel = 'X'; yLabel = 'Z';
    } else {
      switch (this.viewSide) {
        case 'front':  xLabel = 'X'; yLabel = 'Y'; break;
        case 'back':   xLabel = '−X'; yLabel = 'Y'; break;
        case 'left':   xLabel = 'Z'; yLabel = 'Y'; break;
        case 'right':  xLabel = '−Z'; yLabel = 'Y'; break;
      }
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#e5484d';
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + len, o.y); ctx.stroke();
    ctx.fillStyle = '#e5484d';
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(xLabel, o.x + len + 3, o.y);

    ctx.strokeStyle = this.mode === 'horizontal' ? '#26a269' : '#2f6df6';
    ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.y + len); ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(yLabel, o.x, o.y + len + 3);
  }

  _drawGroupBoundaries(ctx) {
    for (const g of this.groups) {
      const bounds = this._getGroupBounds(g.id);
      if (!bounds) continue;
      const s0 = this._worldToScreen(bounds.minX, bounds.minZ);
      const s1 = this._worldToScreen(bounds.maxX, bounds.maxZ);
      const pad = 6;
      const x = Math.min(s0.x, s1.x) - pad;
      const y = Math.min(s0.y, s1.y) - pad;
      const w = Math.abs(s1.x - s0.x) + pad * 2;
      const h = Math.abs(s1.y - s0.y) + pad * 2;

      const anySelected = g.elements.some(el => this.isSelected(el));
      ctx.strokeStyle = g.color || '#888';
      ctx.lineWidth = anySelected ? 2.5 : 1.5;
      ctx.setLineDash(anySelected ? [] : [8, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      ctx.fillStyle = g.color || '#888';
      ctx.globalAlpha = 0.06;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;

      ctx.font = 'bold 10px ui-sans-serif, sans-serif';
      ctx.fillStyle = g.color || '#888';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(g.name, x + 4, y - 3);
    }
  }

  _drawElements(ctx) {
    for (const el of this.elements) {
      const s0 = this._worldToScreen(el.x, el.z);
      const s1 = this._worldToScreen(el.x + el.w, el.z + el.h);
      const sx = Math.min(s0.x, s1.x);
      const sy = Math.min(s0.y, s1.y);
      const sw = Math.abs(s1.x - s0.x);
      const sh = Math.abs(s1.y - s0.y);
      const isSel = this.isSelected(el);
      const isHov = this._hoverElement === el;

      ctx.fillStyle = el.color || '#b8b0a0';
      ctx.globalAlpha = isSel ? 0.55 : (isHov ? 0.45 : 0.3);
      ctx.fillRect(sx, sy, sw, sh);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isSel ? '#2f6df6' : (isHov ? '#3584e4' : '#666');
      ctx.lineWidth = isSel ? 2.5 : (isHov ? 2 : 1.2);

      if (el.kind === 'janela' || el.kind === 'porta') {
        ctx.setLineDash([6, 3]);
      }
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);

      if (isSel && this.selected.length === 1) this._drawResizeHandles(ctx, sx, sy, sw, sh);

      if (sw > 32 && sh > 22) {
        ctx.fillStyle = '#333';
        ctx.font = 'bold 10px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const maxC = Math.floor(sw / 6);
        const lbl = el.name.length > maxC ? el.name.slice(0, maxC) + '..' : el.name;
        ctx.fillText(lbl, sx + sw / 2, sy + sh / 2 - 5);

        ctx.font = '8px ui-monospace, monospace';
        ctx.fillStyle = '#777';
        ctx.fillText(this._dimText(el), sx + sw / 2, sy + sh / 2 + 8);
      }
    }
  }

  _dimText(el) {
    const wMm = Math.round(el.w * 1000);
    if (wMm >= 1000) return (wMm / 1000).toFixed(2) + ' m';
    return wMm + ' mm';
  }

  _drawResizeHandles(ctx, x, y, w, h) {
    const hs = 5;
    ctx.fillStyle = '#2f6df6';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    const pts = [
      [x, y], [x + w, y], [x, y + h], [x + w, y + h],
      [x + w / 2, y], [x + w / 2, y + h],
      [x, y + h / 2], [x + w, y + h / 2],
    ];
    for (const [px, py] of pts) {
      ctx.fillRect(px - hs, py - hs, hs * 2, hs * 2);
      ctx.strokeRect(px - hs, py - hs, hs * 2, hs * 2);
    }
  }

  _drawSelectionOverlay(ctx) {
    if (this.selected.length === 0) return;

    if (this.selected.length === 1) {
      const el = this.selected[0];
      const s0 = this._worldToScreen(el.x, el.z);
      const s1 = this._worldToScreen(el.x + el.w, el.z + el.h);
      const sx = Math.min(s0.x, s1.x);
      const sy = Math.min(s0.y, s1.y);
      const sw = Math.abs(s1.x - s0.x);
      const sh = Math.abs(s1.y - s0.y);

      ctx.strokeStyle = '#2f6df6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(sx - 3, sy - 3, sw + 6, sh + 6);
      ctx.setLineDash([]);

      ctx.fillStyle = '#2f6df6';
      ctx.font = 'bold 11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(el.name, sx, sy - 5);
    } else {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
      for (const el of this.selected) {
        if (el.x < minX) minX = el.x;
        if (el.z < minZ) minZ = el.z;
        if (el.x + el.w > maxX) maxX = el.x + el.w;
        if (el.z + el.h > maxZ) maxZ = el.z + el.h;
      }
      const s0 = this._worldToScreen(minX, minZ);
      const s1 = this._worldToScreen(maxX, maxZ);
      const sx = Math.min(s0.x, s1.x);
      const sy = Math.min(s0.y, s1.y);
      const sw = Math.abs(s1.x - s0.x);
      const sh = Math.abs(s1.y - s0.y);
      const pad = 4;

      ctx.strokeStyle = '#2f6df6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(sx - pad, sy - pad, sw + pad * 2, sh + pad * 2);
      ctx.setLineDash([]);

      ctx.fillStyle = '#2f6df6';
      ctx.font = 'bold 11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(this.selected.length + ' selecionados', sx - pad, sy - pad - 4);
    }
  }

  _drawDimensionLines(ctx) {
    if (this.selected.length !== 1) return;
    const el = this.selected[0];
    const s0 = this._worldToScreen(el.x, el.z);
    const s1 = this._worldToScreen(el.x + el.w, el.z + el.h);
    const sx = Math.min(s0.x, s1.x);
    const sy = Math.min(s0.y, s1.y);
    const sw = Math.abs(s1.x - s0.x);
    const sh = Math.abs(s1.y - s0.y);

    ctx.strokeStyle = '#2f6df6';
    ctx.fillStyle = '#2f6df6';
    ctx.lineWidth = 1;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';

    const wMm = Math.round(el.w * 1000);
    const hMm = Math.round(el.h * 1000);
    const wLabel = wMm >= 1000 ? (wMm / 1000).toFixed(3) + ' m' : wMm + ' mm';
    const hLabel = hMm >= 1000 ? (hMm / 1000).toFixed(3) + ' m' : hMm + ' mm';

    const off = 12;

    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(sx, sy - off); ctx.lineTo(sx + sw, sy - off); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(sx, sy - off - 4); ctx.lineTo(sx, sy - off + 4);
    ctx.moveTo(sx + sw, sy - off - 4); ctx.lineTo(sx + sw, sy - off + 4);
    ctx.stroke();
    ctx.textBaseline = 'bottom';
    ctx.fillText(wLabel, sx + sw / 2, sy - off - 2);

    ctx.save();
    ctx.translate(sx - off, sy + sh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(hLabel, 0, 0);
    ctx.restore();
  }

  _drawRubberBand(ctx) {
    if (!this._rubberBand) return;
    const rb = this._rubberBand;
    const x = Math.min(rb.sx, rb.ex);
    const y = Math.min(rb.sy, rb.ey);
    const w = Math.abs(rb.ex - rb.sx);
    const h = Math.abs(rb.ey - rb.sy);

    ctx.strokeStyle = '#3584e4';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(53, 132, 228, 0.08)';
    ctx.fillRect(x, y, w, h);
  }

  _drawToolbar(ctx) {
    const barH = this.mode === 'vertical' ? 62 : 38;
    const y = this.height - barH;

    ctx.fillStyle = 'rgba(250,250,250,0.94)';
    ctx.fillRect(0, y, this.width, barH);
    ctx.strokeStyle = '#d5d0cc';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke();

    const tools = [
      { id: 'select', label: 'Selectar' },
      { id: 'wall', label: '+ Parede' },
      { id: 'window', label: '+ Janela' },
      { id: 'door', label: '+ Porta' },
      { id: 'resize', label: 'Redim.' },
      { id: 'group', label: 'Agrupar' },
      { id: 'ungroup', label: 'Desagrupar' },
    ];

    let tx = 10;
    const rects = [];
    for (const t of tools) {
      const tw = ctx.measureText(t.label).width + 18;
      const isActive = this.tool === t.id;
      ctx.fillStyle = isActive ? '#3584e4' : '#f0f0f0';
      ctx.strokeStyle = isActive ? '#3584e4' : '#d5d0cc';
      ctx.lineWidth = 1;
      this._roundRect(ctx, tx, y + 6, tw, 26, 5);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = isActive ? '#fff' : '#444';
      ctx.font = '11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.label, tx + tw / 2, y + 19);
      rects.push({ x: tx, y: y + 6, w: tw, h: 26, tool: t.id });
      tx += tw + 5;
    }

    if (this.mode === 'vertical') {
      tx += 10;
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, y + 4); ctx.lineTo(tx, y + 34); ctx.stroke();
      tx += 10;

      const views = [
        { id: 'front', label: 'Frontal' },
        { id: 'back', label: 'Traseira' },
        { id: 'left', label: 'Esquerda' },
        { id: 'right', label: 'Direita' },
      ];
      for (const v of views) {
        const tw = ctx.measureText(v.label).width + 18;
        const isActive = this.viewSide === v.id;
        ctx.fillStyle = isActive ? '#26a269' : '#f0f0f0';
        ctx.strokeStyle = isActive ? '#26a269' : '#d5d0cc';
        ctx.lineWidth = 1;
        this._roundRect(ctx, tx, y + 32, tw, 24, 5);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = isActive ? '#fff' : '#444';
        ctx.font = '11px ui-sans-serif, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(v.label, tx + tw / 2, y + 44);
        rects.push({ x: tx, y: y + 32, w: tw, h: 24, viewSide: v.id });
        tx += tw + 5;
      }
    }

    this._toolbarRects = rects;

    ctx.fillStyle = '#888';
    ctx.font = '11px ui-sans-serif, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const modeLabel = this.mode === 'horizontal' ? 'Planta (XZ)' : 'Elevação (XY)';
    const sideLabel = this.mode === 'vertical' ? ' — ' + this._viewSideLabel() : '';
    ctx.fillText(modeLabel + sideLabel + '  ·  Scroll = zoom  ·  Shift+clique = multi', this.width - 12, y + 19);
  }

  _viewSideLabel() {
    return { front: 'Frontal', back: 'Traseira', left: 'Lateral Esq.', right: 'Lateral Dir.' }[this.viewSide] || 'Frontal';
  }

  _drawStatusBar(ctx) {
    const barH = 22;
    ctx.fillStyle = 'rgba(45,51,61,0.88)';
    ctx.fillRect(0, 0, this.width, barH);
    ctx.fillStyle = '#ccc';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const zoom = (this.scale / 100).toFixed(1);

    let info;
    if (this.selected.length === 0) {
      info = `${this.elements.length} objetos  |  zoom ${zoom}x`;
    } else if (this.selected.length === 1) {
      const el = this.selected[0];
      info = `${el.name}  |  ${this._dimText(el)}  |  ${el.kind}`;
    } else {
      info = `${this.selected.length} selecionados`;
    }
    if (this.groups.length > 0) info += `  |  ${this.groups.length} grupo(s)`;
    ctx.fillText(info, 8, 11);

    ctx.textAlign = 'right';
    const rightLabel = this.mode === 'horizontal' ? 'PLANTA 2D' : 'ELEVAÇÃO 2D — ' + this._viewSideLabel();
    ctx.fillText(rightLabel, this.width - 8, 11);
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ──────────── INTERACTION ──────────── */

  _getResizeHandle(ptrX, ptrY) {
    if (this.selected.length !== 1) return null;
    const el = this.selected[0];
    const s0 = this._worldToScreen(el.x, el.z);
    const s1 = this._worldToScreen(el.x + el.w, el.z + el.h);
    const rx = Math.min(s0.x, s1.x);
    const ry = Math.min(s0.y, s1.y);
    const rw = Math.abs(s1.x - s0.x);
    const rh = Math.abs(s1.y - s0.y);
    const hs = 7;
    const handles = [
      { id: 'nw', x: rx, y: ry }, { id: 'ne', x: rx + rw, y: ry },
      { id: 'sw', x: rx, y: ry + rh }, { id: 'se', x: rx + rw, y: ry + rh },
      { id: 'n', x: rx + rw / 2, y: ry }, { id: 's', x: rx + rw / 2, y: ry + rh },
      { id: 'w', x: rx, y: ry + rh / 2 }, { id: 'e', x: rx + rw, y: ry + rh / 2 },
    ];
    for (const h of handles) {
      if (Math.abs(ptrX - h.x) < hs && Math.abs(ptrY - h.y) < hs) return h.id;
    }
    return null;
  }

  _hitTest(sx, sy) {
    const wp = this._screenToWorld(sx, sy);
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (wp.x >= el.x && wp.x <= el.x + el.w && wp.z >= el.z && wp.z <= el.z + el.h) return el;
    }
    return null;
  }

  _hitTestRect(x1, z1, x2, z2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);
    const hits = [];
    for (const el of this.elements) {
      const elMaxX = el.x + el.w;
      const elMaxZ = el.z + el.h;
      if (el.x < maxX && elMaxX > minX && el.z < maxZ && elMaxZ > minZ) hits.push(el);
    }
    return hits;
  }

  _onPointerDown(e) {
    if (e.button !== 0) return;
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    for (const r of this._toolbarRects) {
      if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) {
        if (r.viewSide) { this.setViewSide(r.viewSide); return; }
        if (r.tool === 'group') { this.groupSelected(); return; }
        if (r.tool === 'ungroup') { this.ungroupSelected(); return; }
        this.setTool(r.tool);
        this.render();
        return;
      }
    }

    if (this.tool === 'select' || this.tool === 'resize') {
      const handle = this._getResizeHandle(sx, sy);
      if (handle && this.selected.length === 1) {
        this.resizeHandle = handle;
        const el0 = this.selected[0];
        this.resizeStart = {
          sx, sy, el: el0,
          x: el0.x, z: el0.z, w: el0.w, h: el0.h,
          origScale: { x: el0.obj.scale.x, y: el0.obj.scale.y, z: el0.obj.scale.z },
          origSize: { ...el0._3dSize },
          origPos: { x: el0.obj.position.x, y: el0.obj.position.y, z: el0.obj.position.z },
        };
        this.dragging = true;
        return;
      }

      const hit = this._hitTest(sx, sy);
      if (hit) {
        if (e.shiftKey) {
          this._toggleSelection(hit);
        } else if (!this.isSelected(hit)) {
          this._setSelected([hit]);
        }
        this.dragging = true;
        this.dragStart = { sx, sy };
        this.dragObjStart = this.selected.map(el => ({
          el, x: el.x, z: el.z,
          _origPos: { x: el.obj.position.x, y: el.obj.position.y, z: el.obj.position.z }
        }));
        this.render();
        return;
      }

      if (!e.shiftKey) {
        this._setSelected([]);
        this.render();
        return;
      }

      this._rubberBandStart = { sx, sy };
      this._rubberBand = { sx, sy, ex: sx, ey: sy };
      this.dragging = true;
      return;
    }

    if (this.tool === 'wall' || this.tool === 'window' || this.tool === 'door') {
      const wp = this._screenToWorld(sx, sy);
      this.dragging = true;
      this.dragStart = { sx, sy };
      this.dragObjStart = { x: wp.x, z: wp.z };
    }
  }

  _onPointerMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (this.dragging && this.tool === 'select' && this.selected.length > 0 && this.dragStart && !this._rubberBand) {
      const rawDx = (sx - this.dragStart.sx) / this.scale;
      const rawDz = (sy - this.dragStart.sy) / this.scale;
      for (const ds of this.dragObjStart) {
        const flipX = this._viewFlipX();
        ds.el.x = ds.x + rawDx * flipX;
        ds.el.z = ds.z + rawDz;
        const pos = ds.el.obj.position;
        if (this.mode === 'horizontal') {
          pos.x = ds.el.x + ds.el.w / 2;
          pos.z = ds.el.z + ds.el.h / 2;
        } else {
          const flipX = (this.viewSide === 'back' || this.viewSide === 'right') ? -1 : 1;
          const horizAxis = (this.viewSide === 'left' || this.viewSide === 'right') ? 'z' : 'x';
          pos[horizAxis] = ds._origPos[horizAxis] + rawDx * flipX;
          pos.y = ds._origPos.y + rawDz;
        }
      }
      this.render();
      return;
    }

    if (this.dragging && this.resizeHandle && this.selected.length === 1 && this.resizeStart) {
      const dx = (sx - this.resizeStart.sx) / this.scale;
      const dz = (sy - this.resizeStart.sy) / this.scale;
      const rs = this.resizeStart;
      const h = this.resizeHandle;
      let nw = rs.w, nh = rs.h;

      if (h.includes('e')) nw = Math.max(0.01, rs.w + dx);
      if (h.includes('w')) nw = Math.max(0.01, rs.w - dx);
      if (h.includes('s')) nh = Math.max(0.01, rs.h + dz);
      if (h.includes('n')) nh = Math.max(0.01, rs.h - dz);

      const el = this.selected[0];
      const ratioW = nw / rs.w;
      const ratioH = nh / rs.h;
      const pos = el.obj.position;

      if (this.mode === 'horizontal') {
        el.obj.scale.x = rs.origScale.x * ratioW;
        el.obj.scale.z = rs.origScale.z * ratioH;
        pos.x = rs.origPos.x + (ratioW - 1) * rs.origSize.x * rs.origScale.x * (h.includes('w') ? -0.5 : 0.5);
        pos.z = rs.origPos.z + (ratioH - 1) * rs.origSize.z * rs.origScale.z * (h.includes('n') ? -0.5 : 0.5);
      } else {
        const horizAxis = (this.viewSide === 'left' || this.viewSide === 'right') ? 'z' : 'x';
        const flipX = (this.viewSide === 'back' || this.viewSide === 'right') ? -1 : 1;
        const sizeH = horizAxis === 'x' ? rs.origSize.x : rs.origSize.z;
        el.obj.scale[horizAxis] = rs.origScale[horizAxis] * ratioW;
        el.obj.scale.y = rs.origScale.y * ratioH;
        pos[horizAxis] = rs.origPos[horizAxis] + (ratioW - 1) * sizeH * rs.origScale[horizAxis] * (h.includes('w') ? flipX * -0.5 : flipX * 0.5);
        pos.y = rs.origPos.y + (ratioH - 1) * rs.origSize.y * rs.origScale.y * (h.includes('n') ? -0.5 : 0.5);
      }

      el.w = nw;
      el.h = nh;
      this.render();
      return;
    }

    if (this.dragging && this._rubberBand) {
      this._rubberBand.ex = sx;
      this._rubberBand.ey = sy;
      this.render();
      return;
    }

    if (this.dragging && (this.tool === 'wall' || this.tool === 'window' || this.tool === 'door')) {
      this.render();
      const ctx2 = this.ctx;
      const s0 = this._worldToScreen(this.dragObjStart.x, this.dragObjStart.z);
      ctx2.strokeStyle = '#2f6df6';
      ctx2.lineWidth = 1.5;
      ctx2.setLineDash([5, 4]);
      ctx2.strokeRect(s0.x, s0.y, sx - s0.x, sy - s0.y);
      ctx2.setLineDash([]);
      return;
    }

    if (this.tool === 'select' || this.tool === 'resize') {
      const handle = this._getResizeHandle(sx, sy);
      if (handle) {
        const cur = { nw: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', se: 'nwse-resize', n: 'ns-resize', s: 'ns-resize', w: 'ew-resize', e: 'ew-resize' };
        this.canvas.style.cursor = cur[handle] || 'crosshair';
      } else {
        const hit = this._hitTest(sx, sy);
        const prev = this._hoverElement;
        this._hoverElement = hit;
        this.canvas.style.cursor = hit ? 'pointer' : 'default';
        if (prev !== hit) this.render();
      }
    }
  }

  _onPointerUp(e) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (this.dragging && this._rubberBand) {
      const rb = this._rubberBand;
      const wp1 = this._screenToWorld(rb.sx, rb.sy);
      const wp2 = this._screenToWorld(rb.ex, rb.ey);
      const hits = this._hitTestRect(wp1.x, wp1.z, wp2.x, wp2.z);
      if (e.shiftKey) {
        for (const h of hits) this._addToSelection(h);
      } else {
        this._setSelected(hits);
      }
      this._rubberBand = null;
      this._rubberBandStart = null;
      this.dragging = false;
      this.render();
      return;
    }

    if (this.dragging && this.dragStart && (this.tool === 'wall' || this.tool === 'window' || this.tool === 'door')) {
      const wp = this._screenToWorld(sx, sy);
      const w = Math.abs(wp.x - this.dragObjStart.x);
      const h = Math.abs(wp.z - this.dragObjStart.z);
      if (w > 0.02 || h > 0.02) {
        const minX = Math.min(this.dragObjStart.x, wp.x);
        const minZ = Math.min(this.dragObjStart.z, wp.z);
        const newEl = this._createElement(this.tool, minX, minZ, w, h);
        if (newEl) {
          this.elements.push(newEl);
          this._setSelected([newEl]);
        }
      }
    }

    this.dragging = false;
    this.dragStart = null;
    this.dragObjStart = null;
    this.resizeHandle = null;
    this.resizeStart = null;
    this._rubberBand = null;
    this._rubberBandStart = null;
    this.render();
    if (this.persistFn) this.persistFn('plan2d edit');
  }

  _onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const wp = this._screenToWorld(mx, my);

    this.scale = Math.max(15, Math.min(1000, this.scale * factor));

    const ns = this._worldToScreen(wp.x, wp.z);
    this.offsetX += mx - ns.x;
    this.offsetY += my - ns.y;
    this.render();
  }

  _onDblClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const hit = this._hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      this._setSelected([hit]);
      this.render();
    }
  }

  _createElement(type, x, z, w, h) {
    const THREE = this.THREE;
    if (!THREE) return null;

    const floorY = this.computed ? this.computed.FLOOR_Y : 0.36;
    let wallH = this.D.WALL_H || 1.85;
    let thick = this.D.wth || 0.05;
    let name = 'Nova Parede';
    let color = 0xd4b483;
    let kind = 'parede';
    let cat = 'paredes';
    let boxW, boxH, boxD;

    if (this.mode === 'horizontal') {
      if (type === 'wall') {
        boxW = w; boxH = wallH; boxD = thick;
        name = 'Parede ' + Math.round(w * 1000) + 'mm';
      } else if (type === 'window') {
        boxW = w; boxH = 0.05; boxD = h;
        name = 'Janela ' + Math.round(w * 1000) + 'mm';
        color = 0xb8d4e8; kind = 'janela'; cat = 'acessorios';
      } else {
        boxW = w; boxH = this.D.DOOR_H || 1.6; boxD = h;
        name = 'Porta ' + Math.round(w * 1000) + 'mm';
        color = 0xc08060; kind = 'porta'; cat = 'acessorios';
      }
    } else {
      if (type === 'wall') {
        boxW = thick; boxH = h; boxD = w;
        if (this.viewSide === 'left' || this.viewSide === 'right') {
          boxW = w; boxH = h; boxD = thick;
        }
        name = 'Parede ' + Math.round(w * 1000) + 'mm';
      } else if (type === 'window') {
        boxW = 0.05; boxH = h; boxD = w;
        if (this.viewSide === 'left' || this.viewSide === 'right') {
          boxW = w; boxH = h; boxD = 0.05;
        }
        name = 'Janela ' + Math.round(w * 1000) + 'mm';
        color = 0xb8d4e8; kind = 'janela'; cat = 'acessorios';
      } else {
        const doorD = this.D.DOOR_D || 0.05;
        boxW = doorD; boxH = h; boxD = w;
        if (this.viewSide === 'left' || this.viewSide === 'right') {
          boxW = w; boxH = h; boxD = doorD;
        }
        name = 'Porta ' + Math.round(w * 1000) + 'mm';
        color = 0xc08060; kind = 'porta'; cat = 'acessorios';
      }
    }

    const geo = new THREE.BoxGeometry(boxW, boxH, boxD);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;

    if (this.mode === 'horizontal') {
      mesh.position.set(x + w / 2, floorY + boxH / 2, z + boxD / 2);
    } else {
      const horizAxis = (this.viewSide === 'left' || this.viewSide === 'right') ? 'z' : 'x';
      const flipX = (this.viewSide === 'back' || this.viewSide === 'right') ? -1 : 1;
      const posX = horizAxis === 'x' ? (x + w / 2) * flipX : 0;
      const posZ = horizAxis === 'z' ? (x + w / 2) * flipX : 0;
      mesh.position.set(posX, z + h / 2, posZ);
    }

    mesh.userData.editable = true;
    mesh.userData.kind = kind;
    mesh.userData.name = name;
    mesh.userData.category = cat;

    if (this.trailer) this.trailer.add(mesh);
    if (this.editor) this.editor.addEditable(mesh, name, cat, kind);
    if (this.editableMeshes) this.editableMeshes.push(mesh);

    return {
      obj: mesh, name, kind, category: cat,
      color: this._getColorForKind(kind, cat),
      x, z, w, h,
      bbox: new THREE.Box3().setFromObject(mesh),
      _3dPos: { ...mesh.position },
      _3dSize: { x: boxW, y: boxH, z: boxD },
      groupId: null, groupColor: null,
    };
  }

  deleteSelected() {
    if (this.selected.length === 0) return;
    const toDelete = [...this.selected];
    for (const el of toDelete) {
      const idx = this.elements.indexOf(el);
      if (idx >= 0) this.elements.splice(idx, 1);
      if (el.obj && el.obj.parent) el.obj.parent.remove(el.obj);
      const eidx = this.editableMeshes ? this.editableMeshes.indexOf(el.obj) : -1;
      if (eidx >= 0) this.editableMeshes.splice(eidx, 1);
    }
    for (const el of toDelete) {
      const gid = el.groupId;
      if (gid != null) {
        const g = this.groups.find(gr => gr.id === gid);
        if (g) g.elements = g.elements.filter(e => e !== el);
      }
    }
    this.groups = this.groups.filter(g => g.elements.length > 0);
    this._setSelected([]);
    this.render();
    if (this.persistFn) this.persistFn('plan2d delete');
  }

  refresh() {
    this._syncFromScene();
    this.render();
  }

  /* ──────────── PUBLIC ADJUSTMENT API ──────────── */

  moveElement(element, deltaX, deltaZ) {
    if (!this.active) return false;
    element.x += deltaX;
    element.z += deltaZ;
    const pos = element.obj.position;
    if (this.mode === 'horizontal') {
      pos.x = element.x + element.w / 2;
      pos.z = element.z + element.h / 2;
    } else {
      const horizAxis = (this.viewSide === 'left' || this.viewSide === 'right') ? 'z' : 'x';
      const flipX = (this.viewSide === 'back' || this.viewSide === 'right') ? -1 : 1;
      pos[horizAxis] = pos[horizAxis] + deltaX * flipX;
      pos.y = pos.y + deltaZ;
    }
    this.render();
    if (this.persistFn) this.persistFn('plan2d move');
    return true;
  }

  resizeElement(element, handle, deltaX, deltaY) {
    if (!this.active || !this.selected.includes(element)) return false;
    this.resizeStart = {
      sx: 0, sy: 0, el: element,
      x: element.x, z: element.z, w: element.w, h: element.h,
      origScale: { x: element.obj.scale.x, y: element.obj.scale.y, z: element.obj.scale.z },
      origPos: { x: element.obj.position.x, y: element.obj.position.y, z: element.obj.position.z }
    };
    const dx = deltaX / this.scale;
    const dy = deltaY / this.scale;
    let nw = element.w, nh = element.h;

    if (handle.includes('e')) nw = Math.max(0.01, element.w + dx);
    if (handle.includes('w')) nw = Math.max(0.01, element.w - dx);
    if (handle.includes('s')) nh = Math.max(0.01, element.h + dy);
    if (handle.includes('n')) nh = Math.max(0.01, element.h - dy);

    const ratioW = nw / element.w;
    const ratioH = nh / element.h;
    const pos = element.obj.position;

    if (this.mode === 'horizontal') {
      element.obj.scale.x = this.resizeStart.origScale.x * ratioW;
      element.obj.scale.z = this.resizeStart.origScale.z * ratioH;
      pos.x = element.x + nw / 2;
      pos.z = element.z + nh / 2;
    } else {
      const horizAxis = (this.viewSide === 'left' || this.viewSide === 'right') ? 'z' : 'x';
      element.obj.scale[horizAxis] = this.resizeStart.origScale[horizAxis] * ratioW;
      element.obj.scale.y = this.resizeStart.origScale.y * ratioH;
      pos[horizAxis] = pos[horizAxis] + (ratioW - 1) * this.resizeStart.origScale[horizAxis] * 0.5;
      pos.y = pos.y + (ratioH - 1) * this.resizeStart.origScale.y * 0.5;
    }

    element.w = nw;
    element.h = nh;
    this.render();
    if (this.persistFn) this.persistFn('plan2d resize');
    return true;
  }

  createElement2D(type, worldX, worldZ, widthMeters, heightMeters) {
    if (!this.active) return null;
    const wp = this.mode === 'horizontal'
      ? { x: worldX, z: worldZ }
      : this._screenToWorld(worldX, worldZ);
    const x = this.mode === 'horizontal'
      ? (wp.x - (this.mode === 'horizontal' ? widthMeters : 0) / 2)
      : wp.x;
    const z = this.mode === 'horizontal'
      ? wp.z
      : wp.z;
    const newEl = this._createElement(type, x, z, widthMeters || 1, heightMeters || 1);
    if (newEl) {
      this.elements.push(newEl);
      this._setSelected([newEl]);
      this.render();
      if (this.persistFn) this.persistFn('plan2d create');
    }
    return newEl;
  }

  syncFrom2D() {
    if (!this.active) return false;
    this._syncFromScene();
    this.render();
    if (this.persistFn) this.persistFn('plan2d sync');
    return true;
  }

  validateSync() {
    const expectedPos = {};
    const issues = [];

    for (const el of this.elements) {
      if (!el.obj || !el.obj.parent) continue;

      el.obj.updateWorldMatrix(true, false);
      const bbox = new THREE.Box3().setFromObject(el.obj);

      if (Math.abs(bbox.min.x - el.x) > 0.001 ||
          Math.abs(bbox.min.z - el.z) > 0.001) {
        issues.push({ element: el.name, issue: 'position mismatch' });
      }

      const expectedW = bbox.max.x - bbox.min.x;
      const expectedH = this.mode === 'horizontal'
        ? bbox.max.z - bbox.min.z
        : bbox.max.y - bbox.min.y;

      if (Math.abs(expectedW - el.w) > 0.001 ||
          Math.abs(expectedH - el.h) > 0.001) {
        issues.push({ element: el.name, issue: 'size mismatch' });
      }
    }

    return { valid: issues.length === 0, issues };
  }

  batchEditStart() {
    this._batchEditing = true;
  }

  batchEditEnd() {
    this._batchEditing = false;
    if (this.persistFn) this.persistFn('plan2d batch edit');
  }

  screenToWorld(screenX, screenY) {
    if (!this.active) return null;
    return this._screenToWorld(screenX, screenY);
  }

  worldToScreen(worldX, worldZ) {
    if (!this.active) return null;
    return this._worldToScreen(worldX, worldZ);
  }
}
