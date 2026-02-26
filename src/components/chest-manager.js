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
    console.log('💎 🚀🚀🚀 CHEST-MANAGER INIT CALLED! 🚀🚀🚀');
    console.log('💎 Component data:', this.data);
    console.log('💎 Component enabled?:', this.data.enabled);
    console.log('💎 Scene El:', this.el.sceneEl);
    
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
    
    console.log('💎 Weapon stats initialized:', window.WEAPON_STATS.current);

    // Écouter l'événement de scan
    this._onScan = (e) => {
      console.log('💎 room-scanned EVENT RECEIVED!', e.detail);
      this.spawnChest(e.detail);
    };
    this.el.sceneEl.addEventListener('room-scanned', this._onScan);
    console.log('💎 room-scanned listener added');

    // ATTENDRE que la scène soit chargée AVANT de créer l'UI
    console.log('💎 Waiting for scene to load before setting up UI...');
    const self = this;
    
    // Vérifier si la scène est déjà chargée
    if (this.el.sceneEl.hasLoaded) {
      console.log('💎 Scene already loaded, setting up UI now');
      this.setupWeaponUI();
    } else {
      // Sinon attendre l'événement 'loaded'
      this.el.sceneEl.addEventListener('loaded', function() {
        console.log('💎 ⭐⭐⭐ Scene loaded event fired! Setting up UI NOW...');
        self.setupWeaponUI();
      });
    }

    console.log('💎 ✅ Chest manager initialized');
    console.log('💎 ⏰ Setting up 1-second spawn timer...');
    
    // TEST IMMÉDIAT : Spawner le coffre après 1 seconde avec position fixe ÉVIDENTE
    setTimeout(() => {
      console.log('💎 ⏰⏰⏰ TIMEOUT TRIGGERED! (1 second passed)');
      console.log('💎 this:', this);
      console.log('💎 this.chestEntity:', this.chestEntity);
      console.log('💎 this.data.enabled:', this.data.enabled);
      
      if (!this.chestEntity && this.data.enabled) {
        console.warn('💎 🚨🚨🚨 SPAWNING CHEST NOW! 🚨🚨🚨');
        
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
        
        console.log('💎 Test position:', testPosition);
        console.log('💎 Calling spawnChest()...');
        this.spawnChest(testPosition);
      } else {
        console.error('💎 ❌❌❌ CANNOT SPAWN - Conditions not met!');
        console.error('💎 chestEntity already exists?:', !!this.chestEntity);
        console.error('💎 Component enabled?:', this.data.enabled);
      }
    }, 1000);  // 1 SECONDE seulement
    
    console.log('💎 Timer scheduled. Init() finished.');
  },

  spawnChest: function (roomData) {
    console.log('💎 🚀 spawnChest() CALLED!');
    console.log('💎 roomData:', roomData);
    console.log('💎 this.chestEntity exists?:', !!this.chestEntity);
    console.log('💎 this.data.enabled?:', this.data.enabled);
    
    if (this.chestEntity) {
      console.warn('💎 ⚠️ Chest already exists, aborting spawn');
      return;
    }
    
    if (!this.data.enabled) {
      console.warn('💎 ❌ Chest manager is DISABLED, aborting spawn');
      return;
    }

    try {
      const { minX, maxX, minZ, maxZ } = roomData.bounds;
      const floorY = roomData.floorY || 0;

      // Position SIMPLE : centre de la zone
      const x = (minX + maxX) / 2;
      const z = (minZ + maxZ) / 2;
      
      console.log(`💎 📍 Calculated position: x=${x.toFixed(2)}, y=${floorY.toFixed(2)}, z=${z.toFixed(2)}`);

      // Créer l'entité du coffre (visuel seulement)
      this.chestEntity = document.createElement('a-entity');
      this.chestEntity.setAttribute('gltf-model', 'assets/models/Chest.glb');
      this.chestEntity.setAttribute('position', `${x} ${floorY + 1.0} ${z}`);  // Augmenté à 1.0 pour être au niveau du sol
      this.chestEntity.setAttribute('scale', '0.5 0.5 0.5');  // Augmenté de 0.008 à 0.5 pour le nouveau modèle Chest.glb
      this.chestEntity.setAttribute('rotation', `0 0 0`);  // Pas de rotation
      this.chestEntity.classList.add('chest');
      this.chestEntity.setAttribute('visible', 'true');
      
      console.log('💎 📦 Chest entity created with gltf-model');
      
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
      
      console.log('💎 Hitbox créée avec structure comme les boutons');
      console.log('💎 Parent classList:', this.hitboxEntity.classList);
      console.log('💎 Enfant classList:', hitbox.classList);
      
      // Stocker une référence à this pour l'utiliser dans les événements
      const self = this;
      
      // Événement UNIQUEMENT sur la BOX (pas sur le parent) pour éviter la double détection
      const openPanel = function(evt) {
        // IMPORTANT : Empêcher la propagation pour éviter d'appeler 2 fois
        evt.stopPropagation();
        
        console.log('💎 ⭐⭐⭐ ========== COFFRE CLIQUÉ ! ==========');
        console.log('💎 Event type:', evt.type);
        console.log('💎 Target:', evt.target);
        console.log('💎 Current uiVisible BEFORE call:', self.uiVisible);
        
        try {
          self.toggleWeaponUI();
          console.log('💎 ✅ toggleWeaponUI called successfully');
          console.log('💎 Current uiVisible AFTER call:', self.uiVisible);
        } catch(e) {
          console.error('💎 ❌ Error calling toggleWeaponUI:', e);
        }
      };
      
      // UNIQUEMENT sur la BOX (pas le parent) pour éviter le double appel
      hitbox.addEventListener('click', openPanel);
      hitbox.addEventListener('triggerdown', openPanel); // Pour les contrôleurs VR
      
      // Hover effects pour feedback visuel
      this.hitboxEntity.addEventListener('mouseenter', function(evt) {
        console.log('👁️ Coffre visé !', evt);
        glow.setAttribute('material', 'color: #FFFFFF; opacity: 0.8');
        hitbox.setAttribute('material', 'color: #FFFF00; opacity: 0.7; transparent: true');
      });
      
      this.hitboxEntity.addEventListener('mouseleave', function(evt) {
        console.log('👁️ Coffre non visé', evt);
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
        console.log('💎 🔄 Forcing raycaster refresh for chest hitbox...');
        
        // Forcer le raycaster à se mettre à jour
        const hands = document.querySelectorAll('[raycaster]');
        console.log('💎 Found', hands.length, 'raycaster entities');
        
        hands.forEach((hand, index) => {
          const raycasterComp = hand.components.raycaster;
          if (raycasterComp) {
            if (raycasterComp.refreshObjects) {
              raycasterComp.refreshObjects();
              console.log(`💎 ✅ Raycaster #${index} refreshed`);
            }
            // Logguer les objets détectés
            if (raycasterComp.objects) {
              console.log(`💎 Raycaster #${index} currently tracking ${raycasterComp.objects.length} objects`);
            }
          }
        });
        
        // Vérifier que la hitbox a bien la classe clickable
        console.log('💎 Hitbox classList:', this.hitboxEntity.classList);
        console.log('💎 Hitbox has .clickable?', this.hitboxEntity.classList.contains('clickable'));
        console.log('💎 Hitbox child classList:', hitbox.classList);
        console.log('💎 Hitbox child has .clickable?', hitbox.classList.contains('clickable'));
        
      }, 500); // Augmenté à 500ms

      console.log(`💎 ✅ COFFRE SPAWNÉ !`);
      console.log(`💎 📍 Position: (${x.toFixed(2)}, ${floorY.toFixed(2)}, ${z.toFixed(2)})`);
      console.log(`💎 📦 Modèle scale: 0.02 (4x plus grand)`);
      console.log(`💎 ✨ Glow radius: 0.5m (doré, clignotant)`);
      console.log(`💎 🟢 Hitbox: 0.5m cube VERT semi-transparent`);
      console.log('💎 Hitbox size:', hitbox.getAttribute('width'), 'x', hitbox.getAttribute('height'), 'x', hitbox.getAttribute('depth'));
      console.log(`💎 🎯 REGARDEZ AUTOUR DE VOUS - vous devriez voir un CUBE VERT !`);
    } catch (e) {
      console.error('❌ chest-manager: ERREUR lors du spawn du coffre:', e);
    }
  },

  setupWeaponUI: function () {
    // Récupérer le panneau qui existe déjà dans le HTML
    console.log('🎨 ⭐⭐⭐ Setting up weapon selection panel...');
    
    // Attendre un peu pour être sûr que le DOM est complètement chargé
    setTimeout(() => {
      this.weaponPanel3D = document.querySelector('#weapon-panel-3d');
      
      if (!this.weaponPanel3D) {
        console.error('❌ #weapon-panel-3d not found in HTML!');
        console.log('🔍 Trying to find it in camera...');
        const camera = document.querySelector('#head');
        if (camera) {
          console.log('📷 Camera found, its children:', camera.children);
          this.weaponPanel3D = camera.querySelector('#weapon-panel-3d');
          if (this.weaponPanel3D) {
            console.log('✅ Found weapon panel inside camera!');
          }
        }
        if (!this.weaponPanel3D) {
          console.error('❌ Still not found! Aborting setup.');
          return;
        }
      }
      
      console.log('✅ ⭐⭐⭐ Weapon panel found in HTML!');
      console.log('📍 Panel position:', this.weaponPanel3D.getAttribute('position'));
      console.log('👁️ Panel initial visibility:', this.weaponPanel3D.getAttribute('visible'));
      console.log('🔍 Panel ID:', this.weaponPanel3D.id);
      console.log('🔍 Panel parent:', this.weaponPanel3D.parentNode);
      
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
          console.log('💎 Weapon button clicked:', btn.spearId);
          self.selectWeapon(btn.spearId);
        });
        console.log(`✅ Event listener added to ${btn.id}`);
      } else {
        console.warn(`⚠️ Button ${btn.id} not found`);
      }
    });
    
    // Event listener pour le bouton fermer
    const closeBtn = document.querySelector('#close-weapon-panel-3d');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        console.log('💎 Close button clicked');
        self.toggleWeaponUI();
      });
      console.log('✅ Event listener added to close button');
    }
    
    console.log('✅ ⭐⭐⭐ Weapon panel setup complete!');
    }, 100); // Fin du setTimeout
  },

  toggleWeaponUI: function () {
    console.log('🔄 ⭐⭐⭐ ========== toggleWeaponUI called! ==========');
    console.log('🔄 Current uiVisible state BEFORE toggle:', this.uiVisible);
    console.log('🔄 weaponPanel3D exists?', !!this.weaponPanel3D);
    console.log('🔄 weaponPanel3D element:', this.weaponPanel3D);
    
    if (!this.weaponPanel3D) {
      console.error('❌ weaponPanel3D not found!');
      return;
    }
    
    // Lire l'état actuel du panneau dans le DOM
    const currentVisibility = this.weaponPanel3D.getAttribute('visible');
    console.log('🔄 Panel current visibility in DOM:', currentVisibility);
    
    // Inverser l'état
    this.uiVisible = !this.uiVisible;
    console.log('🔄 NEW uiVisible state AFTER toggle:', this.uiVisible);
    
    // Changer la visibilité du panneau - IMPORTANT : A-Frame utilise des STRINGS pas des booleans !
    const visibilityString = this.uiVisible ? 'true' : 'false';
    console.log('🔄 Setting panel visible to STRING:', visibilityString);
    this.weaponPanel3D.setAttribute('visible', visibilityString);
    
    // VÉRIFIER que ça a bien été appliqué
    const newVisibility = this.weaponPanel3D.getAttribute('visible');
    console.log('🔄 Panel visibility AFTER setAttribute:', newVisibility);
    console.log('🔄 Panel position:', this.weaponPanel3D.getAttribute('position'));
    console.log('🔄 Panel parent:', this.weaponPanel3D.parentNode);
    
    console.log(`✅ ⭐⭐⭐ 3D Panel toggled! NEW Visible state: ${this.uiVisible}`);
    
    // Cacher/Afficher les boutons PLAY et HIGH SCORES quand le panneau est ouvert/fermé
    const playBtn = document.querySelector('#start-button-3d');
    const highScoresBtn = document.querySelector('#high-scores-btn-3d');
    
    if (this.uiVisible) {
      // Panneau ouvert : cacher les autres boutons
      if (playBtn) {
        playBtn.setAttribute('visible', 'false');
        console.log('👁️ PLAY button hidden');
      }
      if (highScoresBtn) {
        highScoresBtn.setAttribute('visible', 'false');
        console.log('👁️ HIGH SCORES button hidden');
      }
    } else {
      // Panneau fermé : réafficher les boutons (seulement si le jeu n'est pas en cours)
      if (playBtn && window.FISH_ZONE && window.FISH_ZONE.scanned) {
        playBtn.setAttribute('visible', 'true');
        console.log('👁️ PLAY button shown');
      }
      if (highScoresBtn && window.FISH_ZONE && window.FISH_ZONE.scanned) {
        highScoresBtn.setAttribute('visible', 'true');
        console.log('👁️ HIGH SCORES button shown');
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
    
    console.log(`💎 3D Weapon UI ${this.uiVisible ? 'OPENED 🔓' : 'CLOSED 🔒'}`);
  },

  selectWeapon: function (spearId) {
    if (spearId === this.currentSpear) {
      console.log('💎 Cette arme est déjà équipée');
      return;
    }

    const config = this.spearConfigs[spearId];
    if (!config) return;

    // Trouver la lance actuelle
    const spearEntity = document.querySelector('#spear');
    if (spearEntity) {
      console.log('⚔️ Changement d\'arme vers:', spearId);
      console.log('⚔️ Ancien modèle:', spearEntity.getAttribute('gltf-model'));
      console.log('⚔️ Nouveau modèle:', config.model);
      
      // IMPORTANT : Supprimer l'ancien modèle d'abord pour forcer le rechargement
      spearEntity.removeAttribute('gltf-model');
      console.log('⚔️ Ancien modèle supprimé');
      
      // Attendre un tick avant d'ajouter le nouveau modèle
      setTimeout(() => {
        console.log('⚔️ Application du nouveau modèle...');
        
        // Ajouter le nouveau modèle
        spearEntity.setAttribute('gltf-model', config.model);
        console.log('⚔️ Nouveau modèle appliqué:', spearEntity.getAttribute('gltf-model'));
        
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
        console.log('⚔️ Scale appliqué:', scaleValue);
        console.log('⚔️ Rotation appliquée:', rotationValue);
        
        // Ajuster la hitbox geometry proportionnellement à la taille
        const baseDepth = 0.6;
        const adjustedDepth = baseDepth * (scaleFactor / 0.5); // Normaliser par rapport à la taille basique
        spearEntity.setAttribute('geometry', {
          primitive: 'box',
          width: 0.05 * (scaleFactor / 0.5),
          height: 0.05 * (scaleFactor / 0.5),
          depth: adjustedDepth
        });
        console.log('⚔️ Geometry ajusté - depth:', adjustedDepth);
        
        // Ajuster le sphereRadius du dynamic-body
        const baseSphereRadius = 0.18;
        let adjustedRadius;
        
        if (spearId === 'spear-level2') {
          // Pour spear-level2, utiliser une valeur fixe TRÈS petite (0.01m = 1cm)
          adjustedRadius = 0.01;
          console.log('⚔️ Sphere radius FIXE pour level2 (1cm):', adjustedRadius);
        } else if (spearId === 'spear-level0') {
          // Pour spear-level0, rayon un peu plus petit pour mieux tenir en main
          adjustedRadius = baseSphereRadius * (scaleFactor / 0.5) * 0.8;
          console.log('⚔️ Sphere radius ajusté pour level0 (x0.8):', adjustedRadius);
        } else {
          // Pour les autres, proportionnel à la taille
          adjustedRadius = baseSphereRadius * (scaleFactor / 0.5);
        }
        
        spearEntity.setAttribute('dynamic-body', {
          mass: 1,
          shape: 'sphere',
          sphereRadius: adjustedRadius
        });
        console.log('⚔️ Sphere radius ajusté:', adjustedRadius);
        
        // Écouter l'événement de chargement du modèle
        spearEntity.addEventListener('model-loaded', function onModelLoaded() {
          console.log('⚔️ ✅ MODÈLE 3D CHARGÉ AVEC SUCCÈS !');
          spearEntity.removeEventListener('model-loaded', onModelLoaded);
        });
        
        spearEntity.addEventListener('model-error', function onModelError(e) {
          console.error('⚔️ ❌ ERREUR DE CHARGEMENT DU MODÈLE:', e);
        });
        
        // IMPORTANT : Forcer la visibilité de l'arme !
        spearEntity.setAttribute('visible', 'true');
        console.log('⚔️ Visibilité de l\'arme forcée à true');
        
        // Vérifier que l'entité est bien visible
        setTimeout(() => {
          const isVisible = spearEntity.getAttribute('visible');
          const hasModel = spearEntity.getAttribute('gltf-model');
          const object3D = spearEntity.object3D;
          console.log('⚔️ VÉRIFICATION - Visible?', isVisible, '| Modèle?', hasModel);
          console.log('⚔️ Object3D visible?', object3D ? object3D.visible : 'N/A');
          console.log('⚔️ Object3D children:', object3D ? object3D.children.length : 'N/A');
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

      console.log(`⚔️ Lance changée: ${config.name} (DMG: ${config.damage}x, SPEED: ${config.speed}x)`);

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

console.log('💎 ✅✅✅ chest-manager.js FILE LOADED AND COMPONENT REGISTERED! ✅✅✅');