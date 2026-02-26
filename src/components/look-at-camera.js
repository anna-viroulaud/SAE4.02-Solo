// Component to make entities always face the camera (billboard effect)
AFRAME.registerComponent('look-at-camera', {
  schema: {
    lockY: { type: 'boolean', default: true } // Keep panels upright (only rotate on Y axis)
  },

  init: function () {
    this.camera = null;
    this.target = new AFRAME.THREE.Vector3();
  },

  tick: function () {
    if (!this.camera) {
      this.camera = document.querySelector('#head');
      if (!this.camera) return;
    }

    // Get camera world position
    this.camera.object3D.getWorldPosition(this.target);

    // Make this entity look at the camera
    if (this.data.lockY) {
      // Keep the panel upright - only rotate on Y axis
      const currentPos = this.el.object3D.position;
      this.target.y = currentPos.y; // Keep same Y to stay upright
    }

    this.el.object3D.lookAt(this.target);
  }
});
