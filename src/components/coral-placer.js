// Places coral models on yellow-marked visuals (tables) and environment decorations on the floor inside the scanned room
AFRAME.registerComponent('coral-placer', {
  schema: {
    maxOnMarkers: { type: 'int', default: 3 },
    maxOnFloor: { type: 'int', default: 15 }, // increased for more environment decoration
    densityFloor: { type: 'number', default: 0.75 }, // decorations per m²
    scaleMin: { type: 'number', default: 0.35 },
    scaleMax: { type: 'number', default: 0.65 },
    floorPadding: { type: 'number', default: 0.35 }
  },

  // Available environment decoration models (for floor placement only)
  envModels: [
    { id: '#coral-red', scaleMultiplier: 0.668, yOffset: 0.15, weight: 1.5 },     // augmenté x2, placé plus haut
    { id: '#grass', scaleMultiplier: 0.8, yOffset: 0, weight: 2.0 },              // augmenté x2
    { id: '#rock', scaleMultiplier: 0.532, yOffset: 0, weight: 1.0 },             // augmenté x2
    { id: '#rocks', scaleMultiplier: 0.668, yOffset: 0, weight: 1.0 },            // augmenté x2
    { id: '#vine', scaleMultiplier: 0.1165, yOffset: 0, weight: 1.2 },            // inchangé
    { id: '#underwater-coral', scaleMultiplier: 0.4, yOffset: 0.15, weight: 1.5 } // placé plus haut
  ],

  init: function () {
    this.placed = [];
    this._onScan = (e) => this.placeCorals(e.detail);
    this._onReset = () => this.clearCorals();
    this.el.sceneEl.addEventListener('room-scanned', this._onScan);
    this.el.sceneEl.addEventListener('room-reset', this._onReset);

    // If already scanned
    if (window.FISH_ZONE && window.FISH_ZONE.scanned) {
      // attempt to place after a short delay to allow other components to prepare
      setTimeout(() => {
        const detail = {
          bounds: window.FISH_ZONE.roomBounds,
          floorY: window.FISH_ZONE.floorY,
          height: window.FISH_ZONE.ceilingY ? (window.FISH_ZONE.ceilingY - window.FISH_ZONE.floorY) : 2.5
        };
        this.placeCorals(detail);
      }, 200);
    }
    // Fallback: if no room-scanned within 7s, place corals using a sensible default for quick testing
    this._fallbackTimer = setTimeout(() => {
      if (this.placed.length === 0 && !(window.FISH_ZONE && window.FISH_ZONE.scanned)) {
        const testData = {
          bounds: { minX: -2, maxX: 2, minZ: -4, maxZ: 0 },
          floorY: 0,
          height: 2.4
        };
        console.warn('coral-placer: no scan received — using fallback placement for testing');
        this.placeCorals(testData);
      }
    }, 7000);
  },

  clearCorals: function () {
    this.placed.forEach(c => { if (c.parentNode) c.parentNode.removeChild(c); });
    this.placed = [];
  },

  placeCorals: function (roomData) {
    try {
      const scene = this.el.sceneEl;
      const rd = scene && scene.components && scene.components['room-detection'];

      console.log('coral-placer: placeCorals called; planeMeshes:', rd && rd.planeMeshes ? rd.planeMeshes.length : 0);

      // First: place on yellow-marked visuals (planeMeshes) if available
      // Place exactly one starfish per yellow-marked visual (if any)
      // Also place corals on red-marked visuals (prefer red surfaces over floor scatter)
      let foundRed = false;
      if (rd && rd.planeMeshes && rd.planeMeshes.length > 0) {
        for (let mesh of rd.planeMeshes) {
          try {
            let matDbg = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            const hexDbg = matDbg && matDbg.color && typeof matDbg.color.getHex === 'function' ? matDbg.color.getHex() : (matDbg && matDbg.color ? (matDbg.color & 0xffffff) : null);
            console.log('coral-placer: planeMesh material hex=', hexDbg, 'mesh type=', mesh.type);
          } catch (e) { console.log('coral-placer: planeMesh debug error', e); }
        }

        // iterate again for placement
        for (let mesh of rd.planeMeshes) {
          if (!mesh || !mesh.material) continue;
          let mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if (!mat || !mat.color) continue;
          const hex = (typeof mat.color.getHex === 'function') ? mat.color.getHex() : (mat.color & 0xffffff);

          // Yellow -> starfish (original behavior: only on yellow surfaces)
          if (hex === 0xffdd00 || hex === 0xffff00) {
            const pos = new AFRAME.THREE.Vector3();
            mesh.getWorldPosition(pos);
            pos.y += 0.04; // offset above surface

            const near = this.placed.some(c => {
              try { const p = c.object3D.getWorldPosition(new AFRAME.THREE.Vector3()); return p.distanceTo(pos) < 0.18; }
              catch (e) { return false; }
            });
            if (!near) this._spawnStarfishAt(pos);
          }

          // Red surfaces detected but coral spawning is disabled.
          if (hex === 0xff0000) {
            const pos = new AFRAME.THREE.Vector3();
            mesh.getWorldPosition(pos);
            pos.y += 0.06; // slightly above red surface
            console.log('coral-placer: red surface detected but coral spawns are disabled; skipping coral for this mesh');
          }
        }
      }

      // Now scatter environment decorations on the floor
      const { minX, maxX, minZ, maxZ } = roomData.bounds;
      const floorArea = (maxX - minX) * (maxZ - minZ);
      const numDecor = Math.max(this.data.maxOnFloor, Math.floor(floorArea * this.data.densityFloor));
      
      console.log(`coral-placer: scattering ${numDecor} environment decorations on floor area ${floorArea.toFixed(2)}m²`);
      
      // Apply safety margin to prevent decorations from spawning too close to edges
      const safetyMargin = 0.3;
      const safeMinX = minX + safetyMargin;
      const safeMaxX = maxX - safetyMargin;
      const safeMinZ = minZ + safetyMargin;
      const safeMaxZ = maxZ - safetyMargin;
      
      for (let i = 0; i < numDecor; i++) {
        // Spawn within safe bounds
        const x = safeMinX + Math.random() * (safeMaxX - safeMinX);
        const z = safeMinZ + Math.random() * (safeMaxZ - safeMinZ);
        const pos = new AFRAME.THREE.Vector3(x, roomData.floorY + 0.08, z); // lifted higher above floor
        
        // Check distance from existing decorations to avoid overlap
        const tooClose = this.placed.some(c => {
          try {
            const p = c.object3D.getWorldPosition(new AFRAME.THREE.Vector3());
            return p.distanceTo(pos) < 0.25; // minimum spacing
          } catch (e) { return false; }
        });
        
        if (!tooClose) {
          // Pick a random model from the environment models array
          const randomModel = this._pickRandomModel();
          this._spawnCoralAt(pos, randomModel.id, randomModel.scaleMultiplier, randomModel.yOffset);
        }
      }
    } catch (e) {
      console.warn('coral-placer: placement failed', e);
    }
  },

  _pickRandomModel: function () {
    // Weighted random selection
    const totalWeight = this.envModels.reduce((sum, m) => sum + m.weight, 0);
    let rand = Math.random() * totalWeight;
    
    for (let model of this.envModels) {
      rand -= model.weight;
      if (rand <= 0) return model;
    }
    
    return this.envModels[0]; // fallback
  },

  _spawnStarfishAt: function (posVec3) {
    // Create starfish entity (original behavior for yellow surfaces only)
    const ent = document.createElement('a-entity');
    console.log('coral-placer: _spawnStarfishAt pos=', posVec3.toArray());
    ent.setAttribute('gltf-model', '#starfish');
    
    // Original starfish scale (much smaller)
    const base = this.data.scaleMin + Math.random() * (this.data.scaleMax - this.data.scaleMin);
    let s = Math.max(0.005, base * 0.0467);
    
    ent.setAttribute('scale', `${s} ${s} ${s}`);
    
    // Clamp X/Z to remain well inside detected room bounds
    try {
      const rb = (window.FISH_ZONE && window.FISH_ZONE.roomBounds) ? window.FISH_ZONE.roomBounds : null;
      if (rb) {
        const pad = Math.max(0, this.data.floorPadding) + 0.05;
        const sizeMargin = Math.max(0.05, s * 0.4);
        const minX = rb.minX + sizeMargin;
        const maxX = rb.maxX - sizeMargin;
        const minZ = rb.minZ + sizeMargin;
        const maxZ = rb.maxZ - sizeMargin;
        if (isFinite(minX) && isFinite(maxX) && minX < maxX) posVec3.x = Math.min(Math.max(posVec3.x, minX), maxX);
        if (isFinite(minZ) && isFinite(maxZ) && minZ < maxZ) posVec3.z = Math.min(Math.max(posVec3.z, minZ), maxZ);
        if (rb.minY != null && rb.maxY != null) {
          const floorY = rb.minY;
          posVec3.y = Math.max(posVec3.y, floorY + 0.02);
        }
      }
    } catch (e) {
      // ignore clamping errors
    }
    
    ent.setAttribute('position', `${posVec3.x.toFixed(3)} ${posVec3.y.toFixed(3)} ${posVec3.z.toFixed(3)}`);
    
    const ry = Math.random() * 360;
    ent.setAttribute('rotation', `0 ${ry.toFixed(1)} 0`);
    ent.classList.add('coral');

    const parent = document.querySelector('#world-anchor') || this.el.sceneEl;
    parent.appendChild(ent);
    this.placed.push(ent);
  },

  _spawnCoralAt: function (posVec3, modelId, scaleMultiplier, yOffset) {
    // Create entity using the environment decoration asset (for floor placement)
    const ent = document.createElement('a-entity');
    const model = modelId || '#coral-red';
    console.log('coral-placer: _spawnCoralAt model=', model, 'pos=', posVec3.toArray());
    ent.setAttribute('gltf-model', model);
    
    // Random uniform scale with model-specific multiplier
    const base = this.data.scaleMin + Math.random() * (this.data.scaleMax - this.data.scaleMin);
    const multiplier = scaleMultiplier !== undefined ? scaleMultiplier : 1.0;
    let s = Math.max(0.005, base * multiplier);
    
    // Apply model-specific Y offset (for corals that need to be placed higher)
    const modelYOffset = yOffset !== undefined ? yOffset : 0;
    
    ent.setAttribute('scale', `${s} ${s} ${s}`);
    
    // Clamp X/Z to remain well inside detected room bounds with larger safety margins
    try {
      const rb = (window.FISH_ZONE && window.FISH_ZONE.roomBounds) ? window.FISH_ZONE.roomBounds : null;
      if (rb) {
        // Larger safety margin based on model scale to ensure decorations stay inside
        const basePadding = 0.35;
        const sizeMargin = Math.max(0.15, s * 1.2); // More conservative margin
        const minX = rb.minX + basePadding + sizeMargin;
        const maxX = rb.maxX - basePadding - sizeMargin;
        const minZ = rb.minZ + basePadding + sizeMargin;
        const maxZ = rb.maxZ - basePadding - sizeMargin;
        
        if (isFinite(minX) && isFinite(maxX) && minX < maxX) {
          posVec3.x = Math.min(Math.max(posVec3.x, minX), maxX);
        }
        if (isFinite(minZ) && isFinite(maxZ) && minZ < maxZ) {
          posVec3.z = Math.min(Math.max(posVec3.z, minZ), maxZ);
        }
        
        // Adjust Y to be clearly above floor + model-specific offset
        if (rb.minY != null && rb.maxY != null) {
          const floorY = rb.minY;
          posVec3.y = Math.max(posVec3.y, floorY + 0.08 + modelYOffset); // Higher above floor + model offset
        } else {
          posVec3.y += modelYOffset; // Apply offset even without room bounds
        }
      }
    } catch (e) {
      console.warn('coral-placer: clamping error', e);
    }
    
    ent.setAttribute('position', `${posVec3.x.toFixed(3)} ${posVec3.y.toFixed(3)} ${posVec3.z.toFixed(3)}`);
    
    // Random rotation on Y axis for variety
    const ry = Math.random() * 360;
    ent.setAttribute('rotation', `0 ${ry.toFixed(1)} 0`);
    ent.classList.add('environment-decor');

    const parent = document.querySelector('#world-anchor') || this.el.sceneEl;
    parent.appendChild(ent);
    this.placed.push(ent);
  },

  remove: function () {
    this.clearCorals();
    this.el.sceneEl.removeEventListener('room-scanned', this._onScan);
    this.el.sceneEl.removeEventListener('room-reset', this._onReset);
    clearTimeout(this._fallbackTimer);
  }
});
