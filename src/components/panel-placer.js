// Places UI panels on detected walls in the scanned room (optional - panels stay on camera by default)
AFRAME.registerComponent('panel-placer', {
  schema: {
    enabled: { type: 'boolean', default: false }, // disabled by default - panels stay on camera
    preferredHeight: { type: 'number', default: 1.5 }, // hauteur préférée sur le mur (niveau des yeux)
    panelDistance: { type: 'number', default: 0.05 }, // distance du panneau par rapport au mur
    maxPanelsPerWall: { type: 'int', default: 2 }
  },

  init: function () {
    this.placedPanels = [];
    this.availableWalls = [];
    this.panelsOnWalls = false;

    this._onScan = (e) => {
      if (this.data.enabled) {
        this.placePanels(e.detail);
      }
    };
    this._onReset = () => this.resetPanelsToCamera();

    this.el.sceneEl.addEventListener('room-scanned', this._onScan);
    this.el.sceneEl.addEventListener('room-reset', this._onReset);

    // Don't auto-place on init - keep panels on camera
    console.log('panel-placer: initialized (disabled by default - panels stay on camera)');
  },

  resetPanelsToCamera: function () {
    console.log('panel-placer: resetting panels to camera');

    const camera = document.querySelector('#head');
    if (!camera) return;

    // Panneaux à remettre sur la caméra avec leurs positions originales
    const panelsInfo = [
      { id: 'bonus-fish', position: '-0.15 0.2 -0.7', scale: '0.8 0.8 0.8' },
      { id: 'score-display', position: '-0.15 0.0 -0.7' },
      { id: 'timer-3d', position: '0.25 0.25 -0.7', scale: '0.6 0.6 0.6' },
      { id: 'start-button-3d', position: '0 -0.1 -0.7' },
      { id: 'high-scores-btn-3d', position: '0 -0.25 -0.7' }
    ];

    panelsInfo.forEach(info => {
      const panel = document.getElementById(info.id);
      if (panel && panel.parentNode !== camera) {
        // Détacher du world-anchor
        if (panel.parentNode) {
          panel.parentNode.removeChild(panel);
        }
        // Rattacher à la caméra
        camera.appendChild(panel);
        // Restaurer position originale
        panel.setAttribute('position', info.position);
        if (info.scale) {
          panel.setAttribute('scale', info.scale);
        }
        // Réinitialiser la rotation
        panel.setAttribute('rotation', '0 0 0');
      }
    });

    this.placedPanels = [];
    this.panelsOnWalls = false;
  },

  clearPanels: function () {
    // Reset panels to camera instead of removing them
    this.resetPanelsToCamera();
  },

  placePanels: function (roomData) {
    try {
      console.log('panel-placer: placePanels called (enabled:', this.data.enabled, ')');

      if (!this.data.enabled) {
        console.log('panel-placer: disabled - panels stay on camera');
        return;
      }

      if (!roomData.wallPlanes || roomData.wallPlanes.length === 0) {
        console.warn('panel-placer: No walls detected, panels will stay camera-attached');
        return;
      }

      this.availableWalls = roomData.wallPlanes;
      console.log(`panel-placer: ${this.availableWalls.length} walls detected`);

      // Obtenir la position de la caméra pour placer les panneaux face au joueur
      const camera = document.querySelector('#head');
      if (!camera) {
        console.warn('panel-placer: Camera not found');
        return;
      }

      const cameraWorldPos = new AFRAME.THREE.Vector3();
      camera.object3D.getWorldPosition(cameraWorldPos);

      // Panneaux à placer (retirés de la caméra)
      const panelsToPlace = [
        { id: 'bonus-fish', priority: 1, width: 0.4, height: 0.3 },
        { id: 'score-display', priority: 2, width: 0.3, height: 0.15 },
        { id: 'timer-3d', priority: 3, width: 0.3, height: 0.15 },
        { id: 'start-button-3d', priority: 4, width: 0.5, height: 0.15 },
        { id: 'high-scores-btn-3d', priority: 5, width: 0.6, height: 0.12 }
      ];

      // Analyser les murs et calculer leur centre et normale
      const sortedWalls = this.availableWalls.map(wallInfo => {
        const planeData = wallInfo.data;
        const bounds = planeData.bounds;

        // Centre du mur
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const centerZ = (bounds.minZ + bounds.maxZ) / 2;
        const wallCenter = new AFRAME.THREE.Vector3(centerX, centerY, centerZ);

        // Distance à la caméra
        const distance = cameraWorldPos.distanceTo(wallCenter);

        // Calculer la normale du mur (perpendiculaire à sa surface)
        // Pour un mur vertical, utiliser les coins pour calculer la direction
        const wallDirX = bounds.maxX - bounds.minX;
        const wallDirZ = bounds.maxZ - bounds.minZ;

        // La normale est perpendiculaire à la direction du mur
        let normal = new AFRAME.THREE.Vector3(-wallDirZ, 0, wallDirX).normalize();

        // S'assurer que la normale pointe vers la caméra
        const toCamera = new AFRAME.THREE.Vector3().subVectors(cameraWorldPos, wallCenter);
        if (normal.dot(toCamera) < 0) {
          normal.negate();
        }

        return {
          wallInfo: wallInfo,
          center: wallCenter,
          normal: normal,
          distance: distance,
          bounds: bounds
        };
      }).filter(w => w !== null).sort((a, b) => a.distance - b.distance);

      if (sortedWalls.length === 0) {
        console.warn('panel-placer: No valid walls found');
        return;
      }

      // Placer chaque panneau sur le mur le plus approprié
      let wallIndex = 0;
      panelsToPlace.forEach(panelInfo => {
        const panelEl = document.getElementById(panelInfo.id);
        if (!panelEl) {
          console.warn(`panel-placer: Panel ${panelInfo.id} not found`);
          return;
        }

        // Choisir le mur (rotation entre les murs disponibles)
        const wallData = sortedWalls[wallIndex % sortedWalls.length];
        wallIndex++;

        // Détacher le panneau de la caméra
        if (panelEl.parentNode === camera) {
          camera.removeChild(panelEl);
        }

        // Placer le panneau sur le mur
        this._placePanel(panelEl, wallData, roomData.floorY, panelInfo);
      });

      this.panelsOnWalls = true;
      console.log('panel-placer: All panels placed on walls');

    } catch (e) {
      console.error('panel-placer: placement failed', e);
    }
  },

  // Public method to enable wall placement
  enableWallPlacement: function () {
    this.data.enabled = true;
    console.log('panel-placer: wall placement enabled');

    // If room is already scanned, place panels now
    if (window.FISH_ZONE && window.FISH_ZONE.scanned && window.FISH_ZONE.wallPlanes) {
      const detail = {
        bounds: window.FISH_ZONE.roomBounds,
        floorY: window.FISH_ZONE.floorY,
        wallPlanes: window.FISH_ZONE.wallPlanes
      };
      this.placePanels(detail);
    }
  },

  // Public method to disable wall placement and reset to camera
  disableWallPlacement: function () {
    this.data.enabled = false;
    this.resetPanelsToCamera();
    console.log('panel-placer: wall placement disabled, panels back on camera');
  },

  _placePanel: function (panelEl, wallData, floorY, panelInfo) {
    try {
      const THREE = AFRAME.THREE;

      // Centre du mur et normale
      const wallCenter = wallData.center;
      const wallNormal = wallData.normal;

      // Position du panneau : légèrement décalé du mur vers l'intérieur de la pièce
      const panelPos = wallCenter.clone().add(
        wallNormal.clone().multiplyScalar(this.data.panelDistance)
      );

      // Ajuster la hauteur (niveau des yeux, mais respecter les limites du mur)
      const minWallY = wallData.bounds.minY;
      const maxWallY = wallData.bounds.maxY;
      const targetHeight = this.data.preferredHeight;

      // Clamper la hauteur entre les limites du mur
      panelPos.y = Math.max(minWallY + 0.2, Math.min(maxWallY - 0.2, targetHeight));

      // Orienter le panneau pour qu'il fasse face à l'intérieur de la pièce
      panelEl.object3D.position.copy(panelPos);

      // Calculer la rotation pour que le panneau soit parallèle au mur et face à la caméra
      const camera = document.querySelector('#head');
      const cameraWorldPos = new THREE.Vector3();
      camera.object3D.getWorldPosition(cameraWorldPos);

      // Le panneau doit regarder vers la caméra
      panelEl.object3D.lookAt(cameraWorldPos);

      // Forcer le panneau à rester vertical (pas de rotation sur X et Z)
      const currentRotation = panelEl.object3D.rotation;
      panelEl.object3D.rotation.set(0, currentRotation.y, 0);

      // Attacher directement à la scène (coordonnées monde)
      this.el.sceneEl.appendChild(panelEl);

      // Rendre visible si ce n'était pas déjà le cas
      panelEl.setAttribute('visible', 'true');

      this.placedPanels.push(panelEl);

      console.log(`panel-placer: Placed ${panelInfo.id} on wall at`, panelPos.toArray());

    } catch (e) {
      console.error('panel-placer: _placePanel failed', e);
    }
  },

  remove: function () {
    this.clearPanels();
    this.el.sceneEl.removeEventListener('room-scanned', this._onScan);
    this.el.sceneEl.removeEventListener('room-reset', this._onReset);
  }
});
