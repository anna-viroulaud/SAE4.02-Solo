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
    
  },

  clearCorals: function () {
    this.placed.forEach(c => { if (c.parentNode) c.parentNode.removeChild(c); });
    this.placed = [];
  },

  placeCorals: function (roomData) {
    try {
      const scene = this.el.sceneEl;
      const rd = scene && scene.components && scene.components['room-detection'];


      // First: place on yellow-marked visuals (planeMeshes) if available
      // Place exactly one starfish per yellow-marked visual (if any)
      // Also place corals on red-marked visuals (prefer red surfaces over floor scatter)
      let foundRed = false;
      if (rd && rd.planeMeshes && rd.planeMeshes.length > 0) {
        // iterate for placement
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
          }
        }
      }

      // Now scatter environment decorations on the floor
      const { minX, maxX, minZ, maxZ } = roomData.bounds;
      const floorArea = (maxX - minX) * (maxZ - minZ);
      const numDecor = Math.max(this.data.maxOnFloor, Math.floor(floorArea * this.data.densityFloor));
      
      
      // Apply safety margin to prevent decorations from spawning too close to edges
      const safetyMargin = 0.7; // Marge réduite pour zone plus petite et sécurisée
      const safeMinX = minX + safetyMargin;
      const safeMaxX = maxX - safetyMargin;
      const safeMinZ = minZ + safetyMargin;
      const safeMaxZ = maxZ - safetyMargin;
      
      // Vérifier qu'on a un espace valide
      if (safeMaxX <= safeMinX || safeMaxZ <= safeMinZ) {
        return;
      }
      
      for (let i = 0; i < numDecor; i++) {
        // Spawn within safe bounds
        const x = safeMinX + Math.random() * (safeMaxX - safeMinX);
        const z = safeMinZ + Math.random() * (safeMaxZ - safeMinZ);
        const pos = new AFRAME.THREE.Vector3(x, roomData.floorY, z); // Position de base au niveau du sol
        
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
    ent.setAttribute('gltf-model', 'assets/models/Starfish.glb');
    
    // Original starfish scale (much smaller)
    const base = this.data.scaleMin + Math.random() * (this.data.scaleMax - this.data.scaleMin);
    let s = Math.max(0.005, base * 0.0467);
    
    ent.setAttribute('scale', `${s} ${s} ${s}`);
    
    // Ajuster légèrement au-dessus de la surface
    posVec3.y += 0.01; // 1cm au-dessus de la surface détectée
    
    // Valider la position
    if (!isFinite(posVec3.x) || !isFinite(posVec3.y) || !isFinite(posVec3.z)) {
      return;
    }
    
    
    ent.setAttribute('position', `${posVec3.x.toFixed(3)} ${posVec3.y.toFixed(3)} ${posVec3.z.toFixed(3)}`);
    
    const ry = Math.random() * 360;
    ent.setAttribute('rotation', `0 ${ry.toFixed(1)} 0`);
    ent.classList.add('coral');

    // Attacher directement à la scène (coordonnées monde)
    this.el.sceneEl.appendChild(ent);
    this.placed.push(ent);
    
  },

  _spawnCoralAt: function (posVec3, modelId, scaleMultiplier, yOffset) {
    // Create entity using the environment decoration asset (for floor placement)
    const ent = document.createElement('a-entity');
    const model = modelId || '#coral-red';
    ent.setAttribute('gltf-model', model);
    
    // Random uniform scale with model-specific multiplier
    const base = this.data.scaleMin + Math.random() * (this.data.scaleMax - this.data.scaleMin);
    const multiplier = scaleMultiplier !== undefined ? scaleMultiplier : 1.0;
    let s = Math.max(0.005, base * multiplier);
    
    // Apply model-specific Y offset (for corals that need to be placed higher)
    const modelYOffset = yOffset !== undefined ? yOffset : 0;
    
    ent.setAttribute('scale', `${s} ${s} ${s}`);
    
    // Appliquer l'offset Y directement à la position (légèrement au-dessus du sol)
    posVec3.y += 0.02 + modelYOffset; // 2cm au-dessus du sol + offset spécifique au modèle
    
    // Vérifier que la position finale est valide
    if (!isFinite(posVec3.x) || !isFinite(posVec3.y) || !isFinite(posVec3.z)) {
      return;
    }
    
    
    ent.setAttribute('position', `${posVec3.x.toFixed(3)} ${posVec3.y.toFixed(3)} ${posVec3.z.toFixed(3)}`);
    
    // Random rotation on Y axis for variety
    const ry = Math.random() * 360;
    ent.setAttribute('rotation', `0 ${ry.toFixed(1)} 0`);
    ent.classList.add('environment-decor');

    // Attacher directement à la scène (coordonnées monde)
    this.el.sceneEl.appendChild(ent);
    this.placed.push(ent);
    
  },

  remove: function () {
    this.clearCorals();
    this.el.sceneEl.removeEventListener('room-scanned', this._onScan);
    this.el.sceneEl.removeEventListener('room-reset', this._onReset);
  }
});
