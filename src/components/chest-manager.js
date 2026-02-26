// Gestion du coffre d'armes et de la sélection de lance
AFRAME.registerComponent('chest-manager', {
  schema: {
    enabled: { type: 'boolean', default: true }
  },

  // Configuration des différentes lances
  spearConfigs: {
    'spear-model': {
      name: 'Spear',
      model: '#spear-model',
      damage: 1.0,
      speed: 1.0,
      description: 'Basic weapon'
    },
    'spear-level0': {
      name: 'Axe',
      model: 'assets/models/low-poly_stylized_axe.glb',
      damage: 1.2,
      speed: 1.1,
      description: 'Fast and powerful'
    },
    'spear-level2': {
      name: 'Cleaver',
      model: 'assets/models/stylized_low-poly_cleaver.glb',
      damage: 1.5,
      speed: 1.2,
      description: 'Sharp damage'
    },
    'spear-level3': {
      name: 'Dagger',
      model: 'assets/models/stylized_low-poly_dagger.glb',
      damage: 2.0,
      speed: 1.5,
      description: 'Best weapon'
    }
  },

  init: function () {
    
    this.chestEntity = null;
    this.currentSpear = 'spear-model'; // Lance par défaut
    this.uiVisible = false;

    // Initialiser les stats de l'arme par défaut
    if (!window.WEAPON_STATS) window.WEAPON_STATS = {};
    window.WEAPON_STATS.current = {
      id: 'spear-model',
      damage: 1.0,
      speed: 1.0,
      name: 'Lance Basique'
    };
    

    // Écouter l'événement de scan
    this._onScan = (e) => {
      this.spawnChest(e.detail);
    };
    this.el.sceneEl.addEventListener('room-scanned', this._onScan);

    // ATTENDRE que la scène soit chargée AVANT de créer l'UI
    const self = this;
    
    // Vérifier si la scène est déjà chargée
    if (this.el.sceneEl.hasLoaded) {
      this.setupWeaponUI();
    } else {
      // Sinon attendre l'événement 'loaded'
      this.el.sceneEl.addEventListener('loaded', function() {
        self.setupWeaponUI();
      });
    }

    
    // TEST IMMÉDIAT : Spawner le coffre après 1 seconde avec position fixe ÉVIDENTE
    setTimeout(() => {
      
      if (!this.chestEntity && this.data.enabled) {
        
        // Position FIXE, SIMPLE, ÉVIDENTE : devant vous à -2 mètres
        const testPosition = {
          bounds: {
            minX: -1,
            maxX: 1,
            minZ: -2.5,
            maxZ: -1.5,
          },
          floorY: -1  // 1 mètre sous la caméra (au sol)
        };
        
        this.spawnChest(testPosition);
      } else {
      }
    }, 1000);  // 1 SECONDE seulement
    
  },

  spawnChest: function (roomData) {
    
    if (this.chestEntity) {
      return;
    }
    
    if (!this.data.enabled) {
      return;
    }

    try {
      const { minX, maxX, minZ, maxZ } = roomData.bounds;
      const floorY = roomData.floorY || 0;

      // Position SIMPLE : centre de la zone
      const x = (minX + maxX) / 2;
      const z = (minZ + maxZ) / 2;
      

      // Créer l'entité du coffre (visuel seulement)
      this.chestEntity = document.createElement('a-entity');
      this.chestEntity.setAttribute('gltf-model', 'assets/models/Chest.glb');
      this.chestEntity.setAttribute('position', `${x} ${floorY + 1.0} ${z}`);  // Augmenté à 1.0 pour être au niveau du sol
      this.chestEntity.setAttribute('scale', '0.5 0.5 0.5');  // Augmenté de 0.008 à 0.5 pour le nouveau modèle Chest.glb
      this.chestEntity.setAttribute('rotation', `0 0 0`);  // Pas de rotation
      this.chestEntity.classList.add('chest');
      this.chestEntity.setAttribute('visible', 'true');
      
      
      // Glow effect PLUS GRAND pour être ultra visible
      const glow = document.createElement('a-circle');
      glow.setAttribute('radius', '0.5');  // Augmenté de 0.15 à 0.5
      glow.setAttribute('rotation', '-90 0 0');
      glow.setAttribute('position', '0 0.01 0');
      glow.setAttribute('material', 'color: #FFD700; opacity: 0.6; transparent: true; shader: flat');
      glow.setAttribute('animation', {
        property: 'material.opacity',
        from: 0.4,
        to: 0.8,
        dur: 1500,
        dir: 'alternate',
        loop: true,
        easing: 'easeInOutQuad'
      });
      this.chestEntity.appendChild(glow);

      // Ajouter le coffre visuel à la scène
      this.el.sceneEl.appendChild(this.chestEntity);

      // CRÉER LE HITBOX COMME ENTITÉ SÉPARÉE (comme les boutons!)
      // Position absolue dans le monde, PAS enfant du coffre miniature
      this.hitboxEntity = document.createElement('a-entity');
      this.hitboxEntity.classList.add('clickable');
      this.hitboxEntity.classList.add('chest-hitbox');
      this.hitboxEntity.classList.add('chest'); // Aussi classe "chest" pour être caché avec le visuel
      this.hitboxEntity.setAttribute('position', `${x} ${floorY + 1.0} ${z}`); // Position absolue - aligné avec le coffre
      
      const hitbox = document.createElement('a-box');
      hitbox.classList.add('clickable');
      hitbox.setAttribute('width', '0.8'); // PLUS GRAND ! (était 0.5)
      hitbox.setAttribute('height', '0.8'); // PLUS GRAND !
      hitbox.setAttribute('depth', '0.8'); // PLUS GRAND !
      hitbox.setAttribute('position', '0 0 0'); // Position relative par rapport au parent
      // Hitbox complètement invisible
      hitbox.setAttribute('visible', 'false');
      
      
      // Stocker une référence à this pour l'utiliser dans les événements
      const self = this;
      
      // Événement UNIQUEMENT sur la BOX (pas sur le parent) pour éviter la double détection
      const openPanel = function(evt) {
        // IMPORTANT : Empêcher la propagation pour éviter d'appeler 2 fois
        evt.stopPropagation();
        
        
        try {
          self.toggleWeaponUI();
        } catch(e) {
        }
      };
      
      // UNIQUEMENT sur la BOX (pas le parent) pour éviter le double appel
      hitbox.addEventListener('click', openPanel);
      hitbox.addEventListener('triggerdown', openPanel); // Pour les contrôleurs VR
      
      // Hover effects pour feedback visuel
      this.hitboxEntity.addEventListener('mouseenter', function(evt) {
        glow.setAttribute('material', 'color: #FFFFFF; opacity: 0.8');
        hitbox.setAttribute('material', 'color: #FFFF00; opacity: 0.7; transparent: true');
      });
      
      this.hitboxEntity.addEventListener('mouseleave', function(evt) {
        glow.setAttribute('material', 'color: #FFD700; opacity: 0.3');
        hitbox.setAttribute('material', 'color: #00FF00; opacity: 0.5; transparent: true');
      });
      
      // Ajouter le box au parent
      this.hitboxEntity.appendChild(hitbox);
      
      // Ajouter le hitbox à la scène (séparé du coffre)
      this.el.sceneEl.appendChild(this.hitboxEntity);

      // IMPORTANT : Forcer la mise à jour du raycaster après avoir ajouté le hitbox
      // Attendre que l'élément soit complètement chargé
      setTimeout(() => {
        
        // Forcer le raycaster à se mettre à jour
        const hands = document.querySelectorAll('[raycaster]');
        
        hands.forEach((hand, index) => {
          const raycasterComp = hand.components.raycaster;
          if (raycasterComp) {
            if (raycasterComp.refreshObjects) {
              raycasterComp.refreshObjects();
            }
            // Logguer les objets détectés
            if (raycasterComp.objects) {
            }
          }
        });
        
        // Vérifier que la hitbox a bien la classe clickable
        
      }, 500); // Augmenté à 500ms

    } catch (e) {
    }
  },

  setupWeaponUI: function () {
    // Récupérer le panneau qui existe déjà dans le HTML
    
    // Attendre un peu pour être sûr que le DOM est complètement chargé
    setTimeout(() => {
      this.weaponPanel3D = document.querySelector('#weapon-panel-3d');
      
      if (!this.weaponPanel3D) {
        const camera = document.querySelector('#head');
        if (camera) {
          this.weaponPanel3D = camera.querySelector('#weapon-panel-3d');
          if (this.weaponPanel3D) {
          }
        }
        if (!this.weaponPanel3D) {
          return;
        }
      }
      
      
      const self = this;
    
    // Event listeners pour chaque bouton d'arme
    const weaponButtons = [
      { id: 'weapon-btn-spear-model', spearId: 'spear-model' },
      { id: 'weapon-btn-spear-level0', spearId: 'spear-level0' },
      { id: 'weapon-btn-spear-level2', spearId: 'spear-level2' },
      { id: 'weapon-btn-spear-level3', spearId: 'spear-level3' }
    ];
    
    weaponButtons.forEach(btn => {
      const btnElement = document.querySelector(`#${btn.id}`);
      if (btnElement) {
        btnElement.addEventListener('click', function() {
          self.selectWeapon(btn.spearId);
        });
      } else {
      }
    });
    
    // Event listener pour le bouton fermer
    const closeBtn = document.querySelector('#close-weapon-panel-3d');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        self.toggleWeaponUI();
      });
    }
    
    }, 100); // Fin du setTimeout
  },

  toggleWeaponUI: function () {
    
    if (!this.weaponPanel3D) {
      return;
    }
    
    // Lire l'état actuel du panneau dans le DOM
    const currentVisibility = this.weaponPanel3D.getAttribute('visible');
    
    // Inverser l'état
    this.uiVisible = !this.uiVisible;
    
    // Changer la visibilité du panneau - IMPORTANT : A-Frame utilise des STRINGS pas des booleans !
    const visibilityString = this.uiVisible ? 'true' : 'false';
    this.weaponPanel3D.setAttribute('visible', visibilityString);
    
    // VÉRIFIER que ça a bien été appliqué
    const newVisibility = this.weaponPanel3D.getAttribute('visible');
    
    
    // Cacher/Afficher les boutons PLAY et HIGH SCORES quand le panneau est ouvert/fermé
    const playBtn = document.querySelector('#start-button-3d');
    const highScoresBtn = document.querySelector('#high-scores-btn-3d');
    
    // Vérifier si le jeu est en cours
    const gameIsActive = window.gameTimer && window.gameTimer.isGameActive && window.gameTimer.isGameActive();
    
    if (this.uiVisible) {
      // Panneau ouvert : cacher les autres boutons
      if (playBtn) {
        playBtn.setAttribute('visible', 'false');
      }
      if (highScoresBtn) {
        highScoresBtn.setAttribute('visible', 'false');
      }
    } else {
      // Panneau fermé : réafficher les boutons UNIQUEMENT si le jeu n'est PAS actif
      // (c'est-à-dire au menu principal avant de commencer, pas pendant le jeu)
      if (!gameIsActive) {
        if (playBtn && window.FISH_ZONE && window.FISH_ZONE.scanned) {
          playBtn.setAttribute('visible', 'true');
        }
        if (highScoresBtn && window.FISH_ZONE && window.FISH_ZONE.scanned) {
          highScoresBtn.setAttribute('visible', 'true');
        }
      }
    }
    
    // Mettre en évidence l'arme actuellement sélectionnée
    if (this.uiVisible) {
      const weaponButtons = [
        { id: 'weapon-btn-spear-model', spearId: 'spear-model' },
        { id: 'weapon-btn-spear-level0', spearId: 'spear-level0' },
        { id: 'weapon-btn-spear-level2', spearId: 'spear-level2' },
        { id: 'weapon-btn-spear-level3', spearId: 'spear-level3' }
      ];
      
      weaponButtons.forEach(btn => {
        const btnElement = document.querySelector(`#${btn.id}`);
        if (btnElement) {
          const box = btnElement.querySelector('a-box');
          if (box) {
            if (btn.spearId === this.currentSpear) {
              box.setAttribute('color', '#4a7c0f'); // Vert pour arme sélectionnée
            } else {
              box.setAttribute('color', '#2c3e50'); // Gris pour les autres
            }
          }
        }
      });
    }
    
  },

  selectWeapon: function (spearId) {
    if (spearId === this.currentSpear) {
      return;
    }

    const config = this.spearConfigs[spearId];
    if (!config) return;

    // Trouver la lance actuelle
    const spearEntity = document.querySelector('#spear');
    if (spearEntity) {
      
      // IMPORTANT : Supprimer l'ancien modèle d'abord pour forcer le rechargement
      spearEntity.removeAttribute('gltf-model');
      
      // Attendre un tick avant d'ajouter le nouveau modèle
      setTimeout(() => {
        
        // Ajouter le nouveau modèle
        spearEntity.setAttribute('gltf-model', config.model);
        
        // Appliquer le bon scale selon l'arme
        let scaleValue = '0.04 0.04 0.04'; // Par défaut pour spear-level3 (augmenté de 0.016 à 0.04)
        let scaleFactor = 0.04;
        let rotationValue = '0 90 0'; // Rotation par défaut
        
        if (spearId === 'spear-model') {
          scaleValue = '0.35 0.35 0.35'; // Lance basique (réduite)
          scaleFactor = 0.35;
          rotationValue = '0 90 0'; // Orientation originale qui fonctionne
        } else if (spearId === 'spear-level0') {
          scaleValue = '0.45 0.45 0.45'; // Hache - augmentée
          scaleFactor = 0.45;
          rotationValue = '0 90 0'; // Même orientation que spear
        } else if (spearId === 'spear-level2') {
          scaleValue = '0.45 0.45 0.45'; // Couperet - augmenté
          scaleFactor = 0.45;
          rotationValue = '0 90 0'; // Même orientation que spear
        } else if (spearId === 'spear-level3') {
          scaleValue = '0.35 0.35 0.35'; // Dague - même taille que spear
          scaleFactor = 0.35;
          rotationValue = '0 90 0'; // Même orientation que spear
        }
        
        spearEntity.setAttribute('scale', scaleValue);
        spearEntity.setAttribute('rotation', rotationValue);
        
        // Ajuster la hitbox geometry proportionnellement à la taille
        const baseDepth = 0.6;
        const adjustedDepth = baseDepth * (scaleFactor / 0.5); // Normaliser par rapport à la taille basique
        spearEntity.setAttribute('geometry', {
          primitive: 'box',
          width: 0.05 * (scaleFactor / 0.5),
          height: 0.05 * (scaleFactor / 0.5),
          depth: adjustedDepth
        });
        
        // Ajuster le sphereRadius du dynamic-body
        const baseSphereRadius = 0.18;
        let adjustedRadius;
        
        if (spearId === 'spear-level2') {
          // Pour spear-level2, utiliser une valeur fixe TRÈS petite (0.01m = 1cm)
          adjustedRadius = 0.01;
        } else if (spearId === 'spear-level0') {
          // Pour spear-level0, rayon un peu plus petit pour mieux tenir en main
          adjustedRadius = baseSphereRadius * (scaleFactor / 0.5) * 0.8;
        } else {
          // Pour les autres, proportionnel à la taille
          adjustedRadius = baseSphereRadius * (scaleFactor / 0.5);
        }
        
        spearEntity.setAttribute('dynamic-body', {
          mass: 1,
          shape: 'sphere',
          sphereRadius: adjustedRadius
        });
        
        // Écouter l'événement de chargement du modèle
        spearEntity.addEventListener('model-loaded', function onModelLoaded() {
          spearEntity.removeEventListener('model-loaded', onModelLoaded);
        });
        
        spearEntity.addEventListener('model-error', function onModelError(e) {
        });
        
        // IMPORTANT : Forcer la visibilité de l'arme !
        spearEntity.setAttribute('visible', 'true');
        
        // Vérifier que l'entité est bien visible
        setTimeout(() => {
          const isVisible = spearEntity.getAttribute('visible');
          const hasModel = spearEntity.getAttribute('gltf-model');
          const object3D = spearEntity.object3D;
        }, 200);
      }, 50);
      
      // Sauvegarder les stats de l'arme pour utilisation dans grab-manager
      if (!window.WEAPON_STATS) window.WEAPON_STATS = {};
      window.WEAPON_STATS.current = {
        id: spearId,
        damage: config.damage,
        speed: config.speed,
        name: config.name
      };

      this.currentSpear = spearId;


      // Jouer un son de confirmation
      const buttonSound = document.querySelector('#button-press');
      if (buttonSound) buttonSound.components.sound.playSound();

      // Fermer l'UI après sélection
      setTimeout(() => this.toggleWeaponUI(), 300);
    }
  },

  remove: function () {
    this.el.sceneEl.removeEventListener('room-scanned', this._onScan);
    if (this.chestEntity && this.chestEntity.parentNode) {
      this.chestEntity.parentNode.removeChild(this.chestEntity);
    }
    if (this.hitboxEntity && this.hitboxEntity.parentNode) {
      this.hitboxEntity.parentNode.removeChild(this.hitboxEntity);
    }
  }
});

