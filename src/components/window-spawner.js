// ============================================
// COMPOSANT WINDOW-SPAWNER : Faire apparaître les poissons depuis les fenêtres/murs
// ============================================

AFRAME.registerComponent('window-spawner', {
  schema: {
    enabled: { type: 'boolean', default: true },
    spawnInterval: { type: 'number', default: 8000 }, // Intervalle entre chaque apparition (ms) - AUGMENTÉ pour moins de poissons
    maxFish: { type: 'number', default: 8 } // RÉDUIT de 15 à 8
  },

  init: function () {
    this.windowPositions = []; // Positions des "fenêtres" (plans verticaux)
    this.spawnPoints = []; // Points de spawn calculés
    this.isReady = false;
    this.fishCount = 0;
    this.spawnTimer = null;
    
    // Écouter l'événement de scan de pièce
    this.el.sceneEl.addEventListener('room-scanned', (e) => {
      this.onRoomScanned(e.detail);
    });
    
    console.log('🪟 Window spawner initialisé');
  },

  onRoomScanned: function (data) {
    console.log('🪟 Analyse des fenêtres pour créer des points de spawn...');
    
    // Récupérer UNIQUEMENT les fenêtres (pas les murs pleins)
    const windowPlanes = data.windowPlanes || [];
    const wallPlanes = windowPlanes; // Utiliser les fenêtres au lieu de tous les murs
    
    if (wallPlanes.length === 0) {
      console.warn('⚠️ Aucun mur détecté, utilisation de positions par défaut');
      this.createDefaultSpawnPoints(data);
      return;
    }
    
    // Pour chaque mur, créer des points de spawn
    wallPlanes.forEach((wall, index) => {
      const planeData = wall.data;
      const pose = planeData.pose;
      const polygon = planeData.polygon;
      
      if (!polygon || polygon.length < 3) return;
      
      // Transformer les vertices du polygone en coordonnées monde
      const matrix = new THREE.Matrix4();
      matrix.fromArray(pose.transform.matrix);
      
      const worldVertices = polygon.map(v => {
        const vec = new THREE.Vector3(v.x, v.y, v.z);
        vec.applyMatrix4(matrix);
        return vec;
      });
      
      // Calculer le centre du mur
      const center = new THREE.Vector3(0, 0, 0);
      worldVertices.forEach(v => center.add(v));
      center.divideScalar(worldVertices.length);
      
      // Calculer la normale du mur (direction vers l'intérieur)
      const normal = this.calculateWallNormal(worldVertices, data.centerX, data.centerZ);
      
      // Calculer la largeur et hauteur du mur
      const bounds = this.calculateWallBounds(worldVertices);
      
      // Créer plusieurs points de spawn le long du mur
      const numPoints = Math.max(2, Math.floor(bounds.width / 0.5)); // Un point tous les 50cm
      
      for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1); // De 0 à 1
        const spawnPoint = {
          position: new THREE.Vector3(
            center.x + (worldVertices[0].x - center.x) * (t - 0.5) * 2,
            center.y,
            center.z + (worldVertices[0].z - center.z) * (t - 0.5) * 2
          ),
          normal: normal.clone(),
          wallIndex: index,
          bounds: bounds
        };
        
        this.spawnPoints.push(spawnPoint);
      }
    });
    
    console.log(`✅ ${this.spawnPoints.length} points de spawn créés depuis ${wallPlanes.length} fenêtres`);
    
    // Visualisation désactivée (trop moche)
    
    this.isReady = true;
  },
  
  createDefaultSpawnPoints: function (data) {
    // Points de spawn par défaut si aucun mur n'est détecté
    const centerX = data.centerX || 0;
    const centerZ = data.centerZ || -2;
    const width = data.width || 4;
    const depth = data.depth || 4;
    const height = data.height || 2.5;
    const floorY = data.floorY || 0;
    
    // Créer des points sur les 4 bords de la pièce
    const positions = [
      { x: centerX - width/2, z: centerZ, normal: new THREE.Vector3(1, 0, 0) }, // Gauche
      { x: centerX + width/2, z: centerZ, normal: new THREE.Vector3(-1, 0, 0) }, // Droite
      { x: centerX, z: centerZ - depth/2, normal: new THREE.Vector3(0, 0, 1) }, // Arrière
      { x: centerX, z: centerZ + depth/2, normal: new THREE.Vector3(0, 0, -1) }  // Avant
    ];
    
    positions.forEach((pos, index) => {
      this.spawnPoints.push({
        position: new THREE.Vector3(pos.x, floorY + height/2, pos.z),
        normal: pos.normal,
        wallIndex: index,
        bounds: { width: 1, height: height }
      });
    });
    
    console.log(`✅ ${this.spawnPoints.length} points de spawn par défaut créés`);
    this.isReady = true;
  },
  
  calculateWallNormal: function (vertices, roomCenterX, roomCenterZ) {
    // Calculer la normale du mur pointant vers l'intérieur de la pièce
    if (vertices.length < 2) return new THREE.Vector3(0, 0, 1);
    
    // Prendre deux points du mur pour calculer un vecteur tangent
    const v1 = vertices[0];
    const v2 = vertices[1];
    const tangent = new THREE.Vector3().subVectors(v2, v1).normalize();
    
    // La normale est perpendiculaire au mur (rotation de 90° dans le plan XZ)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    
    // Vérifier que la normale pointe vers l'intérieur
    const wallCenter = new THREE.Vector3();
    vertices.forEach(v => wallCenter.add(v));
    wallCenter.divideScalar(vertices.length);
    
    const toCenter = new THREE.Vector3(
      roomCenterX - wallCenter.x,
      0,
      roomCenterZ - wallCenter.z
    ).normalize();
    
    // Si la normale pointe dans la mauvaise direction, l'inverser
    if (normal.dot(toCenter) < 0) {
      normal.negate();
    }
    
    return normal;
  },
  
  calculateWallBounds: function (vertices) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    vertices.forEach(v => {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z);
    });
    
    return {
      width: Math.max(maxX - minX, maxZ - minZ),
      height: maxY - minY,
      minY: minY,
      maxY: maxY
    };
  },
  
  visualizeSpawnPoints: function () {
    // Créer des marqueurs visuels pour les points de spawn
    this.spawnPoints.forEach((point, index) => {
      const marker = document.createElement('a-sphere');
      marker.setAttribute('radius', 0.05);
      marker.setAttribute('color', '#00ff00');
      marker.setAttribute('position', `${point.position.x} ${point.position.y} ${point.position.z}`);
      marker.setAttribute('material', 'emissive: #00ff00; emissiveIntensity: 0.5');
      this.el.sceneEl.appendChild(marker);
      
      // Flèche pour montrer la direction
      const arrow = document.createElement('a-cone');
      arrow.setAttribute('radius-bottom', 0.03);
      arrow.setAttribute('radius-top', 0);
      arrow.setAttribute('height', 0.15);
      arrow.setAttribute('color', '#ffff00');
      
      const arrowPos = point.position.clone().add(
        point.normal.clone().multiplyScalar(0.15)
      );
      arrow.setAttribute('position', `${arrowPos.x} ${arrowPos.y} ${arrowPos.z}`);
      
      // Orienter la flèche dans la direction de la normale
      const angle = Math.atan2(point.normal.x, point.normal.z);
      arrow.setAttribute('rotation', `0 ${THREE.MathUtils.radToDeg(angle)} 90`);
      
      this.el.sceneEl.appendChild(arrow);
    });
    
    console.log('📍 Points de spawn visualisés (sphères vertes + flèches jaunes)');
  },
  
  // Public API: démarrer le spawn (appelé depuis game-manager après l'eau qui monte)
  startSpawning: function () {
    if (!this.isReady || !this.data.enabled) {
      console.warn('⚠️ Window spawner pas prêt ou désactivé');
      return;
    }
    
    console.log('🐟 Démarrage du spawn automatique depuis les fenêtres');
    
    // Spawn initial de quelques poissons
    const initialCount = Math.min(5, this.data.maxFish);
    for (let i = 0; i < initialCount; i++) {
      setTimeout(() => {
        this.spawnFishFromWindow();
      }, i * 800); // Décalage de 800ms entre chaque poisson
    }
    
    // Spawn périodique après l'initialisation
    this.spawnTimer = setInterval(() => {
      if (this.fishCount < this.data.maxFish) {
        this.spawnFishFromWindow();
      }
    }, this.data.spawnInterval);
  },
  
  spawnFishFromWindow: function () {
    if (this.spawnPoints.length === 0) {
      console.warn('⚠️ Aucun point de spawn disponible');
      return;
    }
    
    // Choisir un point de spawn aléatoire
    const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
    
    // Créer le poisson
    const fish = document.createElement('a-entity');
    
    // Choisir un modèle de poisson
    const models = ['#thon', '#piranha', '#goldfish', '#thon_bleu'];
    const chosen = models[Math.floor(Math.random() * models.length)];
    fish.setAttribute('gltf-model', chosen);
    
    // Échelle
    const baseScale = (0.6 + Math.random() * 0.6) / 72.0;
    const modelScaleAdjust = {
      '#goldfish': 0.5,
      '#thon': 0.5
    };
    const adjust = modelScaleAdjust[chosen] || 4.0;
    const finalScale = baseScale * adjust;
    fish.setAttribute('scale', `${finalScale} ${finalScale} ${finalScale}`);
    
    // Position de départ (plus loin à l'extérieur du mur pour bien voir l'entrée)
    const startPos = spawnPoint.position.clone().sub(
      spawnPoint.normal.clone().multiplyScalar(1.2)
    );
    
    // Ajouter une variation verticale aléatoire
    const yVariation = (Math.random() - 0.5) * Math.min(spawnPoint.bounds.height * 0.8, 1.5);
    startPos.y += yVariation;
    
    fish.setAttribute('position', `${startPos.x} ${startPos.y} ${startPos.z}`);
    
    // Rotation pour orienter le poisson vers l'intérieur
    const angle = Math.atan2(spawnPoint.normal.x, spawnPoint.normal.z);
    fish.setAttribute('rotation', `0 ${THREE.MathUtils.radToDeg(angle) + 180} 0`);
    
    // Marquer comme poisson
    fish.classList.add('fish');
    fish.classList.add('fish-target');
    fish.setAttribute('grabbable', '');
    
    const typeName = chosen.replace('#', '');
    fish.setAttribute('data-fish-type', typeName);
    
    // Ajouter le composant de mouvement en mode FLOW (continue dans la direction de la fenêtre)
    const baseSpeed = 0.00001 + Math.random() * 0.00002;
    fish.setAttribute('fish-movement', {
      speed: baseSpeed, 
      bounds: 2,
      mode: 'flow',
      directionX: spawnPoint.normal.x,
      directionY: 0,
      directionZ: spawnPoint.normal.z
    });
    
    // Animation d'entrée : le poisson "nage" depuis la fenêtre (plus lente pour mieux voir)
    fish.setAttribute('animation__entry', {
      property: 'position',
      to: `${startPos.x + spawnPoint.normal.x * 0.8} ${startPos.y} ${startPos.z + spawnPoint.normal.z * 0.8}`,
      dur: 3500,
      easing: 'easeOutQuad'
    });
    
    // Après l'animation, le mode 'flow' prendra le relais automatiquement
    
    // Ajouter directement à la scène (coordonnées monde)
    this.el.sceneEl.appendChild(fish);
    
    this.fishCount++;
    
    // Écouter la suppression du poisson
    fish.addEventListener('removed', () => {
      this.fishCount--;
    });
    
    console.log(`🐟 Poisson spawné depuis fenêtre #${spawnPoint.wallIndex} (${this.fishCount}/${this.data.maxFish})`);
  },
  
  // Méthode pour arrêter le spawn et nettoyer les poissons
  stopSpawning: function () {
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = null;
    }
    
    // Supprimer tous les poissons existants
    const container = document.querySelector('#fish-container') || this.el.sceneEl;
    const allFish = container.querySelectorAll('.fish-target');
    allFish.forEach(fish => {
      if (fish.parentNode) {
        fish.parentNode.removeChild(fish);
      }
    });
    
    this.fishCount = 0;
    console.log('🛑 Window spawner arrêté et poissons supprimés');
  },
  
  remove: function () {
    this.stopSpawning();
  }
});
