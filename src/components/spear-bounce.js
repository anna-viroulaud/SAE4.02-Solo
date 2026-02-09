AFRAME.registerComponent('spear-bounce', {
  schema: {
    restitution: { type: 'number', default: 0.7 }, // bounce factor (0..1)
    minSpeed: { type: 'number', default: 0.12 } // ignore tiny impacts
  },

  init: function () {
    this._onCollide = this._onCollide.bind(this);
    this.el.addEventListener('collide', this._onCollide);
  },

  _onCollide: function (evt) {
    try {
      const body = this.el.body;
      if (!body) return;

      // Only apply custom bounce when colliding with a static body (walls/floor)
      const otherBody = evt && evt.detail && evt.detail.body;
      if (!otherBody) return;
      const otherEl = otherBody.el || null;

      // treat mass === 0 as static (wall/ground)
      const isStatic = (otherBody.mass === 0) || (otherEl && (otherEl.hasAttribute && otherEl.hasAttribute('static-body')));
      if (!isStatic) return; // let normal dynamic collisions behave normally

      const contact = evt.detail.contact;
      if (!contact) return;

      // contact.ni is the contact normal (CANNON.Vec3) on body i
      const ni = contact.ni || contact.ni;
      const THREE = AFRAME.THREE;
      const normal = new THREE.Vector3(ni.x, ni.y, ni.z).normalize();

      // current linear velocity
      const vx = (body.velocity && body.velocity.x) || 0;
      const vy = (body.velocity && body.velocity.y) || 0;
      const vz = (body.velocity && body.velocity.z) || 0;
      const vel = new THREE.Vector3(vx, vy, vz);

      if (vel.length() < this.data.minSpeed) return;

      // Reflect velocity around normal: v' = v - 2*(v·n)*n
      const dot = vel.dot(normal);
      const reflected = vel.clone().sub(normal.clone().multiplyScalar(2 * dot));

      // Apply restitution (bounciness) and slight damping to avoid perpetual motion
      reflected.multiplyScalar(this.data.restitution);

      // Safety clamp to keep speeds reasonable
      const maxSpeed = 8.0;
      if (reflected.length() > maxSpeed) reflected.setLength(maxSpeed);

      // Set new velocity on the physics body
      if (typeof body.velocity.set === 'function') {
        body.velocity.set(reflected.x, reflected.y, reflected.z);
      } else {
        body.velocity.x = reflected.x; body.velocity.y = reflected.y; body.velocity.z = reflected.z;
      }

      // optionally reduce damping to allow bounce to feel lively
      try {
        if (typeof body.linearDamping !== 'undefined') body.linearDamping = 0.08;
        if (typeof body.angularDamping !== 'undefined') body.angularDamping = 0.3;
      } catch (e) { /* ignore */ }

    } catch (e) {
      console.warn('spear-bounce error', e);
    }
  },

  remove: function () {
    this.el.removeEventListener('collide', this._onCollide);
  }
});
