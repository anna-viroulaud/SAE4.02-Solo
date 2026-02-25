// Spawns occasional bubbles under the water within the scanned room bounds
AFRAME.registerComponent('bubble-spawner', {
  schema: {
    interval: { type: 'int', default: 700 }, // ms between spawn checks
    burstChance: { type: 'number', default: 0.20 },
    burstCount: { type: 'int', default: 3 },
    maxBubbles: { type: 'int', default: 80 },
    lifetime: { type: 'int', default: 3200 },
    minRadius: { type: 'number', default: 0.008 },
    maxRadius: { type: 'number', default: 0.028 },
    padding: { type: 'number', default: 0.25 }, // meters to shrink spawn area inside detected room
    requireScan: { type: 'boolean', default: true } // only spawn after room-scanned
  },

  init: function () {
    this.bubbles = [];
    this.bounds = null; // {minX,maxX,minZ,maxZ,floorY,height}
    this._running = true;

    this._onRoom = (e) => { this._setBoundsFromRoom(e.detail); };
    this.el.sceneEl.addEventListener('room-scanned', this._onRoom);

    // If room already scanned globally
    if (window.FISH_ZONE && window.FISH_ZONE.scanned) {
      // try to derive bounds from global
      const rb = window.FISH_ZONE.roomBounds;
      if (rb) {
        this.bounds = {
          minX: rb.minX,
          maxX: rb.maxX,
          minZ: rb.minZ,
          maxZ: rb.maxZ,
          floorY: window.FISH_ZONE.floorY || 0,
          height: (window.FISH_ZONE.ceilingY || (window.FISH_ZONE.floorY + 2.5)) - (window.FISH_ZONE.floorY || 0)
        };
      }
    }

    this._tickHandle = setInterval(() => this._maybeSpawn(), this.data.interval);
  },

  _setBoundsFromRoom: function (roomData) {
    // roomData may contain bounds or center/width/depth
    if (roomData.bounds) {
      this.bounds = Object.assign({}, roomData.bounds);
      this.bounds.floorY = roomData.floorY || this.bounds.minY || 0;
      this.bounds.height = (roomData.height) || (this.bounds.maxY - this.bounds.minY) || 2.5;
    } else {
      const centerX = roomData.centerX || 0;
      const centerZ = roomData.centerZ || -2;
      const width = roomData.width || 4;
      const depth = roomData.depth || 4;
      const floorY = roomData.floorY || 0;
      const height = roomData.height || 2.5;
      this.bounds = {
        minX: centerX - width / 2,
        maxX: centerX + width / 2,
        minZ: centerZ - depth / 2,
        maxZ: centerZ + depth / 2,
        floorY: floorY,
        height: height
      };
    }
  },

  _maybeSpawn: function () {
    if (!this._running) return;
    // If we require a scan, don't spawn until scan completed
    if (this.data.requireScan && !(window.FISH_ZONE && window.FISH_ZONE.scanned)) return;
    if (!this.bounds) return; // wait for scan
    // limit total bubbles
    if (this.bubbles.length >= this.data.maxBubbles) return;

    // Random chance to spawn; occasional bursts
    const roll = Math.random();
    const doBurst = roll < this.data.burstChance;
    const count = doBurst ? Math.min(this.data.burstCount, this.data.maxBubbles - this.bubbles.length) : 1;

    for (let i = 0; i < count; i++) {
      this._spawnBubble();
    }
  },

  _spawnBubble: function () {
    if (!this.bounds) return;
    const THREE = AFRAME.THREE;
    const pad = Math.abs(this.data.padding || 0.25);
    const minX = this.bounds.minX + pad;
    const maxX = this.bounds.maxX - pad;
    const minZ = this.bounds.minZ + pad;
    const maxZ = this.bounds.maxZ - pad;
    const floorY = (this.bounds.floorY != null) ? this.bounds.floorY : 0;
    const maxY = floorY + Math.min(1.6, (this.bounds.height || 2.5) * 0.7);
    // Safety: if padding too large, fall back to a small centered area inside original bounds
    let xMin = minX, xMax = maxX, zMin = minZ, zMax = maxZ;
    if (xMax <= xMin) {
      const cx = (this.bounds.minX + this.bounds.maxX) / 2;
      xMin = cx - 0.25; xMax = cx + 0.25;
    }
    if (zMax <= zMin) {
      const cz = (this.bounds.minZ + this.bounds.maxZ) / 2;
      zMin = cz - 0.25; zMax = cz + 0.25;
    }

    const x = xMin + Math.random() * (xMax - xMin);
    const z = zMin + Math.random() * (zMax - zMin);
    const y = floorY + 0.05 + Math.random() * Math.max(0.05, (maxY - floorY - 0.05));

    const r = this.data.minRadius + Math.random() * (this.data.maxRadius - this.data.minRadius);

    const bubble = document.createElement('a-sphere');
    bubble.classList.add('bubble');
    bubble.setAttribute('radius', r);
    bubble.setAttribute('segments', '8');
    bubble.setAttribute('material', `color: #dff9ff; opacity: 0.85; transparent: true; metalness: 0.0; roughness: 0.9`);
    bubble.setAttribute('position', `${x} ${y} ${z}`);

    // Upward float animation + fade
    const rise = 0.6 + Math.random() * 0.6; // smaller rise for breathing-style bubbles
    const dur = Math.max(600, Math.min(this.data.lifetime, Math.floor(this.data.lifetime * (0.6 + Math.random() * 0.5))));

    bubble.setAttribute('animation__rise', `property: position; to: ${x} ${y + rise} ${z}; dur: ${dur}; easing: linear`);
    bubble.setAttribute('animation__fade', `property: material.opacity; to: 0.0; dur: ${dur}; easing: easeOutQuad`);

    // small horizontal drift
    const dx = (Math.random() - 0.5) * 0.06;
    const dz = (Math.random() - 0.5) * 0.06;
    bubble.object3D.position.set(x, y, z);

    // Attacher directement à la scène (coordonnées monde)
    this.el.sceneEl.appendChild(bubble);
    this.bubbles.push(bubble);

    // Cleanup after lifetime
    setTimeout(() => {
      const idx = this.bubbles.indexOf(bubble);
      if (idx !== -1) this.bubbles.splice(idx, 1);
      if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
    }, dur + 120);
  },

  remove: function () {
    this._running = false;
    clearInterval(this._tickHandle);
    this.el.sceneEl.removeEventListener('room-scanned', this._onRoom);
    // remove existing bubbles
    this.bubbles.forEach(b => { if (b.parentNode) b.parentNode.removeChild(b); });
    this.bubbles = [];
  }
});
