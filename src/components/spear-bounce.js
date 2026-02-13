AFRAME.registerComponent('spear-bounce', {
  schema: {
    restitution: { type: 'number', default: 0.5 },
    damping: { type: 'number', default: 0.7 }
  },

  init: function () {
    this._onCollide = this._onCollide.bind(this);
    this.el.addEventListener('collide', this._onCollide);
    
    // Store original position/rotation for reset functionality
    this.originalPosition = new AFRAME.THREE.Vector3();
    this.originalRotation = new AFRAME.THREE.Euler();
    setTimeout(() => {
      this.el.object3D.getWorldPosition(this.originalPosition);
      this.originalRotation.copy(this.el.object3D.rotation);
    }, 100);
    
    // Apply physics properties to the body
    setTimeout(() => {
      if (this.el.body) {
        this.el.body.linearDamping = this.data.damping;
        this.el.body.angularDamping = this.data.damping;
        // Set material restitution for bouncing
        if (this.el.body.material) {
          this.el.body.material.restitution = this.data.restitution;
        }
      }
    }, 200);
    
    // Create visible hitbox helper
    try {
      const radiusAttr = this.el.getAttribute('hitRadius') || this.el.getAttribute('data-hit-radius') || '0.18';
      const radius = parseFloat(radiusAttr);
      if (!this.el.querySelector('#spear-hitbox-visual')) {
        const sphere = document.createElement('a-sphere');
        sphere.setAttribute('id', 'spear-hitbox-visual');
        sphere.setAttribute('radius', radius);
        sphere.setAttribute('material', 'color: #ffff00; opacity: 0; wireframe: true; side: double');
        sphere.setAttribute('position', '0 0 0.18');
        sphere.setAttribute('visible', 'true');
        this.el.appendChild(sphere);
      }
      this._hitboxRadius = radius;
    } catch (e) { this._hitboxRadius = 0.18; }
  },

  _onCollide: function (evt) {
    // Physics engine handles collision response automatically
    // We just need to ensure materials are set correctly
    try {
      const body = this.el.body;
      if (!body) return;

      const otherBody = evt && evt.detail && evt.detail.body;
      if (!otherBody) return;

      // Detect collision with ceiling and cancel bounce
      const otherEl = otherBody.el;
      if (otherEl) {
        const isCeiling = otherEl.id === 'physics-ceiling' || 
                         (otherEl.hasAttribute('data-collider-type') && 
                          otherEl.getAttribute('data-collider-type') === 'ceiling');
        
        if (isCeiling) {
          // Cancel upward velocity when hitting ceiling so it falls back down
          if (body.velocity) {
            const vx = body.velocity.x || 0;
            const vy = body.velocity.y || 0;
            const vz = body.velocity.z || 0;
            
            // If moving upward, reverse to downward with no bounce
            if (vy > 0) {
              if (typeof body.velocity.set === 'function') {
                body.velocity.set(vx * 0.3, -0.8, vz * 0.3); // Fall down immediately
              } else {
                body.velocity.x = vx * 0.3;
                body.velocity.y = -0.8; // Fall down
                body.velocity.z = vz * 0.3;
              }
            }
          }
          return; // Don't apply normal bounce for ceiling
        }
        
        // For other boundaries, ensure proper restitution
        if (otherEl.classList.contains('room-boundary')) {
          if (otherBody.material && typeof otherBody.material.restitution === 'undefined') {
            otherBody.material.restitution = 0.3; // Walls are slightly bouncy
          }
        }
      }
    } catch (e) {
      console.warn('spear-bounce collision error', e);
    }
  },

  tick: function () {
    // Just keep hitbox visual updated
    try {
      const visual = this.el.querySelector('#spear-hitbox-visual');
      if (visual) {
        visual.setAttribute('position', `0 0 ${this._hitboxRadius || 0.18}`);
        const r = this._hitboxRadius || 0.18;
        if (parseFloat(visual.getAttribute('radius')) !== r) visual.setAttribute('radius', r);
      }
    } catch (e) {}
  },

  resetToOriginal: function () {
    // Public method to reset spear to original position
    try {
      if (this.el.body && this.el.body.position && typeof this.el.body.position.set === 'function') {
        this.el.body.position.set(this.originalPosition.x, this.originalPosition.y, this.originalPosition.z);
        if (this.el.body.velocity && typeof this.el.body.velocity.set === 'function') this.el.body.velocity.set(0,0,0);
        if (this.el.body.angularVelocity && typeof this.el.body.angularVelocity.set === 'function') this.el.body.angularVelocity.set(0,0,0);
      }
      const parent = this.el.object3D.parent;
      if (parent) {
        const local = parent.worldToLocal(this.originalPosition.clone());
        this.el.object3D.position.copy(local);
      } else {
        this.el.object3D.position.copy(this.originalPosition);
      }
      this.el.object3D.rotation.copy(this.originalRotation);
      this.el.object3D.updateMatrixWorld(true);
    } catch (e) { console.warn('reset spear error', e); }
  },

  remove: function () {
    this.el.removeEventListener('collide', this._onCollide);
  }
});
