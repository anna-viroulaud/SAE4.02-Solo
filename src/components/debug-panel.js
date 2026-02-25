// Debug Panel Component - Affiche les logs console directement en VR
AFRAME.registerComponent('debug-panel', {
  schema: {
    enabled: { type: 'boolean', default: true },
    maxLines: { type: 'number', default: 12 },
    width: { type: 'number', default: 1.2 },
    height: { type: 'number', default: 0.8 },
    position: { type: 'vec3', default: { x: -0.8, y: 0.3, z: -1.5 } },
    followCamera: { type: 'boolean', default: false }
  },

  init: function () {
    if (!this.data.enabled) return;

    this.logs = [];
    this.panelEntity = null;
    this.textEntity = null;

    // Créer le panneau
    this.createPanel();

    // Intercepter les console.log, warn, error
    this.interceptConsole();

    console.log('🐛 Debug panel initialized');
  },

  createPanel: function () {
    // Conteneur principal
    this.panelEntity = document.createElement('a-entity');
    this.panelEntity.setAttribute('position', this.data.position);
    
    // Si le panneau doit suivre la caméra
    if (this.data.followCamera) {
      this.panelEntity.setAttribute('look-at-camera', '');
    }

    // Fond noir semi-transparent
    const background = document.createElement('a-plane');
    background.setAttribute('width', this.data.width);
    background.setAttribute('height', this.data.height);
    background.setAttribute('color', '#000000');
    background.setAttribute('opacity', '0.85');
    background.setAttribute('material', 'transparent: true; shader: flat');
    this.panelEntity.appendChild(background);

    // Bordure
    const border = document.createElement('a-plane');
    border.setAttribute('width', this.data.width + 0.02);
    border.setAttribute('height', this.data.height + 0.02);
    border.setAttribute('color', '#00FF00');
    border.setAttribute('position', '0 0 -0.001');
    border.setAttribute('material', 'shader: flat');
    this.panelEntity.appendChild(border);

    // Titre
    const title = document.createElement('a-text');
    title.setAttribute('value', '🐛 DEBUG CONSOLE');
    title.setAttribute('align', 'center');
    title.setAttribute('width', this.data.width);
    title.setAttribute('position', `0 ${this.data.height / 2 - 0.05} 0.01`);
    title.setAttribute('color', '#00FF00');
    title.setAttribute('font', 'roboto');
    this.panelEntity.appendChild(title);

    // Zone de texte pour les logs
    this.textEntity = document.createElement('a-text');
    this.textEntity.setAttribute('value', 'En attente de logs...');
    this.textEntity.setAttribute('align', 'left');
    this.textEntity.setAttribute('width', this.data.width - 0.1);
    this.textEntity.setAttribute('position', `${-this.data.width / 2 + 0.05} ${this.data.height / 2 - 0.15} 0.01`);
    this.textEntity.setAttribute('color', '#FFFFFF');
    this.textEntity.setAttribute('font', 'monoid');
    this.textEntity.setAttribute('wrap-count', '60');
    this.textEntity.setAttribute('baseline', 'top');
    this.panelEntity.appendChild(this.textEntity);

    // Bouton pour clear les logs
    const clearBtn = document.createElement('a-plane');
    clearBtn.setAttribute('width', '0.3');
    clearBtn.setAttribute('height', '0.08');
    clearBtn.setAttribute('color', '#FF0000');
    clearBtn.setAttribute('position', `${this.data.width / 2 - 0.17} ${-this.data.height / 2 + 0.05} 0.01`);
    clearBtn.classList.add('clickable');
    
    const clearText = document.createElement('a-text');
    clearText.setAttribute('value', 'CLEAR');
    clearText.setAttribute('align', 'center');
    clearText.setAttribute('width', '0.25');
    clearText.setAttribute('position', '0 0 0.01');
    clearText.setAttribute('color', '#FFFFFF');
    clearBtn.appendChild(clearText);
    
    const self = this;
    clearBtn.addEventListener('click', function() {
      self.clearLogs();
    });
    
    this.panelEntity.appendChild(clearBtn);

    // Ajouter à la scène
    this.el.sceneEl.appendChild(this.panelEntity);
  },

  interceptConsole: function () {
    const self = this;

    // Sauvegarder les fonctions originales
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Intercepter console.log
    console.log = function (...args) {
      originalLog.apply(console, args);
      self.addLog('LOG', args.join(' '), '#FFFFFF');
    };

    // Intercepter console.warn
    console.warn = function (...args) {
      originalWarn.apply(console, args);
      self.addLog('WARN', args.join(' '), '#FFA500');
    };

    // Intercepter console.error
    console.error = function (...args) {
      originalError.apply(console, args);
      self.addLog('ERROR', args.join(' '), '#FF0000');
    };

    // Intercepter les erreurs non catchées
    window.addEventListener('error', function (event) {
      self.addLog('ERROR', `${event.message} at ${event.filename}:${event.lineno}`, '#FF0000');
    });
  },

  addLog: function (type, message, color) {
    const timestamp = new Date().toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    // Limiter la longueur du message
    const shortMessage = message.length > 80 ? message.substring(0, 77) + '...' : message;

    const logEntry = {
      timestamp: timestamp,
      type: type,
      message: shortMessage,
      color: color
    };

    this.logs.push(logEntry);

    // Garder seulement les N derniers logs
    if (this.logs.length > this.data.maxLines) {
      this.logs.shift();
    }

    this.updateDisplay();
  },

  updateDisplay: function () {
    if (!this.textEntity) return;

    // Construire le texte avec les derniers logs
    let displayText = '';
    
    this.logs.forEach(log => {
      const prefix = log.type === 'ERROR' ? '❌' : log.type === 'WARN' ? '⚠️' : 'ℹ️';
      displayText += `${prefix} [${log.timestamp}] ${log.message}\n`;
    });

    if (displayText === '') {
      displayText = 'Aucun log récent...';
    }

    this.textEntity.setAttribute('value', displayText);
  },

  clearLogs: function () {
    this.logs = [];
    this.textEntity.setAttribute('value', 'Logs effacés. En attente de nouveaux logs...');
    console.log('🐛 Debug panel cleared');
  },

  tick: function () {
    // Si le panneau doit suivre la caméra
    if (this.data.followCamera && this.panelEntity) {
      const camera = this.el.sceneEl.camera;
      if (camera) {
        const cameraPos = camera.el.object3D.position;
        const cameraRot = camera.el.object3D.rotation;
        
        // Positionner le panneau devant la caméra avec un offset
        const offset = new THREE.Vector3(
          this.data.position.x,
          this.data.position.y,
          this.data.position.z
        );
        
        offset.applyQuaternion(camera.el.object3D.quaternion);
        
        this.panelEntity.object3D.position.copy(cameraPos).add(offset);
        this.panelEntity.object3D.rotation.y = cameraRot.y;
      }
    }
  },

  remove: function () {
    if (this.panelEntity) {
      this.panelEntity.parentNode.removeChild(this.panelEntity);
    }
  }
});

console.log('🐛 debug-panel component registered');
