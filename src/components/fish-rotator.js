// Composant pour faire tourner les modèles de poisson affichés dans le panneau BONUS
AFRAME.registerComponent('fish-rotator', {
  schema: { interval: { type: 'number', default: 10000 } },

  init: function () {
    // list of models to rotate in the bonus panel: include all available fish
    this.fishModels = [
      // reduce goldfish for HUD clarity
      { type: 'goldfish', model: '#goldfish', position: '0.05 0.02 0', rotation: '0 90 0', scale: '0.004 0.004 0.004' },
      // slightly smaller piranha
      { type: 'piranha', model: '#piranha', position: '0 -0.02 0', rotation: '0 90 0', scale: '0.008 0.008 0.008' },
      // thon reduced
      { type: 'thon', model: '#thon', position: '0 0 0', rotation: '0 90 0', scale: '0.006 0.006 0.006' },
      // thon_bleu slightly enlarged
      { type: 'thon_bleu', model: '#thon_bleu', position: '0 0 0', rotation: '0 90 0', scale: '0.012 0.012 0.012' },
      // starfish intentionally excluded from bonus rotation (not considered a target fish)
    ];
    this.currentIndex = 0;
    if (this.el.sceneEl.hasLoaded) this.startRotation(); else this.el.sceneEl.addEventListener('loaded', () => this.startRotation());
  },

  startRotation: function () {
    const self = this;
    this.intervalId = setInterval(() => { self.nextFish(); }, this.data.interval);
    // initialize first
    this.applyCurrent();
  },

  getCurrentFish: function () { return this.fishModels[this.currentIndex].type; },
  getCurrentFishModel: function () { return this.fishModels[this.currentIndex].model; },

  applyCurrent: function () {
    const d = this.fishModels[this.currentIndex];
    this.el.removeAttribute('gltf-model');
    setTimeout(() => {
      this.el.setAttribute('gltf-model', d.model);
      this.el.setAttribute('position', d.position);
      this.el.setAttribute('rotation', d.rotation);
      this.el.setAttribute('scale', d.scale);
    }, 50);
  },

  nextFish: function () {
    this.currentIndex = (this.currentIndex + 1) % this.fishModels.length;
    this.applyCurrent();
  },

  remove: function () { if (this.intervalId) clearInterval(this.intervalId); }
});
