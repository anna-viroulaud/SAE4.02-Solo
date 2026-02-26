// ============================================
// SHIMS DE COMPATIBILITÉ POUR THREE.JS ET CANNON.JS
// Ces patches corrigent les incompatibilités entre versions
// ============================================

// ============================================
// SHIM 1: THREE.Geometry
// Recrée THREE.Geometry pour les anciens addons qui en dépendent
// ============================================
(function () {
  try {
    if (window.AFRAME && AFRAME.THREE && !AFRAME.THREE.Geometry) {
      const THREE = AFRAME.THREE;
      // ES6 class extends BufferGeometry to avoid calling super as a function
      class Geometry extends THREE.BufferGeometry {
        constructor() {
          super();
          this.vertices = [];
        }

        static fromBufferGeometry(bufferGeometry) {
          const g = new Geometry();
          const pos = bufferGeometry.attributes && bufferGeometry.attributes.position;
          if (pos && pos.array) {
            const a = pos.array;
            for (let i = 0; i < a.length; i += 3) {
              g.vertices.push(new THREE.Vector3(a[i], a[i + 1], a[i + 2]));
            }
          }
          return g;
        }
        // instance method expected by older plugins: tmp.fromBufferGeometry(...)
        fromBufferGeometry(bufferGeometry) {
          this.vertices.length = 0;
          const pos = bufferGeometry.attributes && bufferGeometry.attributes.position;
          if (pos && pos.array) {
            const a = pos.array;
            for (let i = 0; i < a.length; i += 3) {
              this.vertices.push(new THREE.Vector3(a[i], a[i + 1], a[i + 2]));
            }
          }
          return this;
        }
      }
      THREE.Geometry = Geometry;
    }
  } catch (e) {
  }
})();

// ============================================
// SHIM 2: Box3.getCenter
// Assure qu'un Vector3 est créé si la cible est manquante
// ============================================
(function () {
  try {
    if (window.AFRAME && AFRAME.THREE && AFRAME.THREE.Box3) {
      const THREE = AFRAME.THREE;
      const proto = THREE.Box3.prototype;
      if (proto && typeof proto.getCenter === 'function') {
        const origGetCenter = proto.getCenter;
        proto.getCenter = function (target) {
          if (target === undefined || target === null) target = new THREE.Vector3();
          return origGetCenter.call(this, target);
        };
      }
    }
  } catch (e) {
  }
})();

// ============================================
// SHIM 3: Quaternion.inverse()
// Fournit la méthode inverse() pour THREE et CANNON Quaternion
// Attend que CANNON soit chargé
// ============================================
window.addEventListener('load', function() {
  setTimeout(function() {
    try {
      // THREE.Quaternion: alias inverse -> invert()
      if (window.AFRAME && AFRAME.THREE && AFRAME.THREE.Quaternion) {
        const Q = AFRAME.THREE.Quaternion.prototype;
        if (!Q.inverse) {
          Q.inverse = Q.invert || function () { return this.conjugate(); };
        }
      }

      // CANNON.Quaternion: provide inverse() returning a new quaternion
      if (window.CANNON && CANNON.Quaternion) {
        if (!CANNON.Quaternion.prototype.inverse) {
          CANNON.Quaternion.prototype.inverse = function () {
            return new CANNON.Quaternion(-this.x, -this.y, -this.z, this.w);
          };
        }
      } else {
      }
    } catch (e) {
    }
  }, 100);
});

// CLEANUP: Supprimer d'éventuels éléments résiduels laissés par une session précédente
window.addEventListener('load', function() {
  setTimeout(function() {
    try {
      // Supprimer les visualisations de zone (spawn-zone-bounds)
      const oldBoxes = document.querySelectorAll('#spawn-zone-bounds');
      oldBoxes.forEach(el => el.parentNode && el.parentNode.removeChild(el));

      // Supprimer les poissons résiduels
      const oldFishes = document.querySelectorAll('.fish');
      oldFishes.forEach(f => f.parentNode && f.parentNode.removeChild(f));

      // Supprimer d'anciennes bulles statiques ou dynamiques
      const oldBubbles = document.querySelectorAll('#bubbles, .bubble');
      oldBubbles.forEach(b => b.parentNode && b.parentNode.removeChild(b));

      // Réinitialiser la variable globale si présente
      if (window && window.FISH_ZONE) {
        window.FISH_ZONE.roomBounds = null;
        window.FISH_ZONE.orientedBox = null;
        window.FISH_ZONE.floorY = 0;
        window.FISH_ZONE.ceilingY = 2.5;
        window.FISH_ZONE.scanned = false;
        window.FISH_ZONE.obstacles = [];
        window.FISH_ZONE.wallPlanes = [];
      }

    } catch (e) {
    }
  }, 200);
});
