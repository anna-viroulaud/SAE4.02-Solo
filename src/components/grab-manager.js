// Simple grab system: spear follows hand position without reparenting
AFRAME.registerComponent('grab-manager', {
  schema: {
    throwPower: { type: 'number', default: 0.6 },
    launchDistance: { type: 'number', default: 0.12 }, // meters to shoot forward on release
    launchDuration: { type: 'number', default: 350 }, // ms for the straight-line launch (longer => smoother)
    physicsLaunch: { type: 'boolean', default: true }, // prefer physics-based launch when available
    maxLaunchDistance: { type: 'number', default: 0.6 }, // safety cap
    maxLaunchSpeed: { type: 'number', default: 0.6 }, // m/s cap (reduced to keep spear nearby and slow)
    autoStopMs: { type: 'number', default: 280 }, // ms after launch to force stop
    tetherRadius: { type: 'number', default: 0.6 }, // max distance from launch origin
    tetherForce: { type: 'number', default: 0.6 }, // corrective force magnitude (gentler)
    tetherDuration: { type: 'number', default: 1400 }, // ms to keep tether active
    hitRadius: { type: 'number', default: 0.28 } // radius used for spear-fish hit detection
  },

  // water motion helpers
  startWaterMotion: function (el, forwardVec) {
    const THREE = AFRAME.THREE;
    const amplitude = 0.01; // meters (smaller sway)
    const freq = 2.5; // Hz (slower)
    const duration = 1600; // ms total sway (a bit longer)
    const start = performance.now();

    let last = start;
    const step = (now) => {
      const t = now - start;
      const dt = (now - last) / 1000;
      last = now;
      if (!el) return;

      // Compute lateral axes perpendicular to forward
      const f = forwardVec.clone();
      if (f.length() === 0) f.set(0,0,-1);
      const up = new THREE.Vector3(0,1,0);
      let right = new THREE.Vector3().crossVectors(f, up).normalize();
      if (right.length() < 0.001) right = new THREE.Vector3(1,0,0);
      const lateral = new THREE.Vector3().crossVectors(right, f).normalize();

      // sinusoidal offset in lateral+right plane
      const phase = t * 0.001 * Math.PI * 2 * freq;
      const sway = right.clone().multiplyScalar(Math.sin(phase) * amplitude)
        .add(lateral.clone().multiplyScalar(Math.cos(phase*0.7) * amplitude * 0.6));

      // If physics body exists, nudge velocity and apply damping
      try {
        if (el.body) {
          // small force along sway
          if (typeof el.body.applyForce === 'function') {
            const force = new THREE.Vector3(sway.x, sway.y, sway.z).multiplyScalar(2.5);
            // CANNON expects Vec3; physics plugin often wraps
            try { el.body.applyForce(force, el.body.position); } catch (e) { /* ignore */ }
          }
          // apply gentle damping
          if (el.body.velocity && typeof el.body.velocity.scale === 'function') {
            el.body.velocity.scale(0.98);
          } else if (el.body.velocity) {
            el.body.velocity.x *= 0.98; el.body.velocity.y *= 0.98; el.body.velocity.z *= 0.98;
          }
        } else {
          // Non-physics: move position slightly around current trajectory
          const worldPos = new THREE.Vector3();
          el.object3D.getWorldPosition(worldPos);
          const parent = el.object3D.parent;
          const targetWorld = worldPos.clone().add(sway);
          if (parent) {
            const local = parent.worldToLocal(targetWorld.clone());
            el.object3D.position.lerp(local, 0.3);
          } else {
            el.object3D.position.lerp(targetWorld, 0.3);
          }
        }
      } catch (e) { /* ignore errors during sway */ }

      if (t < duration) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  },

  init: function () {
    this.grabRadius = 0.4; // meters
    this.grabbedSpear = null;
    this.grabbingHand = null;
    this.offset = new AFRAME.THREE.Vector3(0, 0, -0.2);
    this.collisionRadius = (this.data && this.data.hitRadius) ? this.data.hitRadius : 0.18; // Distance for spear-fish collision
    
    const scene = this.el.sceneEl;
    
    // Wait for scene load
    // Attach listeners when scene is loaded; also support late controller connections
    scene.addEventListener('loaded', () => {
      this.attachToHands();
    });

    // If controllers connect after load, attach to them as well
    scene.addEventListener('controllerconnected', (ev) => {
      try {
        const hand = ev.detail && ev.detail.component ? ev.target : ev.target;
        if (hand) this.attachToHand(hand);
      } catch (e) {}
    });

    // Fallback: poll for hands for a short time (useful in some browsers/platforms)
    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      this.attachToHands();
      if (tries > 6) clearInterval(poll);
    }, 1000);
  },

  attachToHands: function () {
    const scene = this.el.sceneEl;
    if (!scene) return;
    const hands = scene.querySelectorAll('a-entity[hand-controls], a-entity[oculus-touch-controls]');
    // console.log('grab-manager: attachToHands check, found', hands.length);
    hands.forEach(h => this.attachToHand(h));
  },

  attachToHand: function (hand) {
    if (!hand || hand._grabAttached) return;
    try {
      const downHandler = () => this.tryGrab(hand);
      const upHandler = () => this.tryRelease(hand);
      hand.addEventListener('triggerdown', downHandler);
      hand.addEventListener('triggerup', upHandler);
      // also support grip events as alternative input
      hand.addEventListener('gripdown', downHandler);
      hand.addEventListener('gripup', upHandler);
      // mark attached so we don't double-add
      hand._grabAttached = true;
      hand._grabHandlers = { downHandler, upHandler };
      console.log('🎣 grab-manager: attached handlers to hand', hand.id || hand);
    } catch (e) {
      console.warn('grab-manager: failed to attach to hand', e);
    }
  },

  tryGrab: function (hand) {
    if (this.grabbedSpear) return; // Already holding something
    
    const THREE = AFRAME.THREE;
    const handPos = new THREE.Vector3();
    hand.object3D.getWorldPosition(handPos);
    
    // Find nearest weapon (spear) or nearest fish if weapon not present
    const scene = this.el.sceneEl;
    // Prefer weapons
    const weapons = Array.from(scene.querySelectorAll('[weapon], .weapon, #spear'));
    const fishes = Array.from(scene.querySelectorAll('.fish, .fish-target'));
    
    let nearest = null;
    let minDist = Infinity;
    
    const candidates = weapons.length ? weapons : fishes;
    candidates.forEach((fish) => {
      const fishPos = new THREE.Vector3();
      if (!fish.object3D) return;
      fish.object3D.getWorldPosition(fishPos);
      const dist = handPos.distanceTo(fishPos);
      if (dist < minDist) {
        minDist = dist;
        nearest = fish;
      }
    });
    
    if (nearest && minDist < this.grabRadius) {
      this.grabbedSpear = nearest;
      this.grabbingHand = hand;
      // While held, make the body kinematic so we can place it precisely
      if (this.grabbedSpear.removeAttribute) this.grabbedSpear.removeAttribute('dynamic-body');
      if (this.grabbedSpear.setAttribute) this.grabbedSpear.setAttribute('kinematic-body', '');
      // initialize hand velocity tracking
      this.lastHandPos = null;
      this.lastHandTime = null;
      this.lastHandVel = new THREE.Vector3(0, 0, 0);
      console.log('🎣 Grabbed object with hand:', hand.id, 'distance:', minDist.toFixed(2));
    } else {
      console.log('❌ No object in range. Distance:', minDist.toFixed(2));
    }
  },

  tryRelease: function (hand) {
    if (this.grabbingHand === hand && this.grabbedSpear) {
      console.log('📤 Released spear');
      const el = this.grabbedSpear;
      // remove kinematic so physics can take over
      if (el.removeAttribute) el.removeAttribute('kinematic-body');

      // clear grab state so tick no longer manipulates the spear
      this.grabbedSpear = null;
      this.grabbingHand = null;
      this.lastHandPos = null;
      this.lastHandTime = null;

      // Try physics-based launch if available and preferred
      if (this.data.physicsLaunch) {
        // Ensure the entity has a dynamic body
        if (el.setAttribute) el.setAttribute('dynamic-body', 'mass:1; shape: box');
        // record launch origin and small delay to let physics create the body
        const launchOrigin = new AFRAME.THREE.Vector3();
        el.object3D.getWorldPosition(launchOrigin);
        setTimeout(() => {
          // compute forward direction in world space
          const forwardLocal = new AFRAME.THREE.Vector3(0, 0, -1);
          const worldQuat = new AFRAME.THREE.Quaternion();
          el.object3D.getWorldQuaternion(worldQuat);
          const forward = forwardLocal.applyQuaternion(worldQuat).normalize();

          // softer launch: prefer last hand velocity (reduced), otherwise gentle forward speed
          let speedVec = new AFRAME.THREE.Vector3();
          if (this.lastHandVel && this.lastHandVel.length() > 0.02) {
            speedVec.copy(this.lastHandVel).multiplyScalar(0.6 * this.data.throwPower);
          } else {
            // gentle forward speed when hand movement low
            speedVec.copy(forward).multiplyScalar(1.2 * this.data.throwPower);
          }

          // Clamp speed to avoid flying away
          const maxSpeed = Math.max(0.1, this.data.maxLaunchSpeed);
          const speedLen = speedVec.length();
          if (speedLen > maxSpeed) {
            speedVec.multiplyScalar(maxSpeed / speedLen);
          }

          // Apply velocity or impulse to physics body
          if (el.body && el.body.velocity && typeof el.body.velocity.set === 'function') {
            el.body.velocity.set(speedVec.x, speedVec.y, speedVec.z);
          } else if (el.body && typeof el.body.applyImpulse === 'function') {
            const mass = (el.body.mass || 1);
            // much smaller impulse for a gentle launch
            const impulse = speedVec.clone().multiplyScalar(mass * 0.02);
            el.body.applyImpulse(new AFRAME.THREE.Vector3(impulse.x, impulse.y, impulse.z), el.body.position);
          } else {
            // final fallback: scripted short launch then enable physics
            this.launchSpear(el);
          }

          // Start a soft tether to keep spear near launchOrigin
          try {
            const tetherStart = performance.now();
            const tetherDur = Math.max(200, this.data.tetherDuration);
            const tetherRadius = Math.max(0.05, this.data.tetherRadius);
            const tetherForce = Math.max(0.1, this.data.tetherForce);

            const tetherStep = (now) => {
              if (!el || !el.body) return;
              const curPos = new AFRAME.THREE.Vector3();
              el.object3D.getWorldPosition(curPos);
              const disp = curPos.clone().sub(launchOrigin);
              const dist = disp.length();
              if (dist > tetherRadius) {
                const dir = launchOrigin.clone().sub(curPos).normalize();
                // apply a gentle corrective force toward origin
                try {
                  if (el.body && typeof el.body.applyForce === 'function') {
                    const f = dir.clone().multiplyScalar(tetherForce * 0.15);
                    el.body.applyForce(f, el.body.position);
                  } else if (el.body && el.body.velocity) {
                    // small velocity nudge instead of overriding
                    const nx = (el.body.velocity.x || 0) + dir.x * 0.08;
                    const ny = (el.body.velocity.y || 0) + dir.y * 0.08;
                    const nz = (el.body.velocity.z || 0) + dir.z * 0.08;
                    if (typeof el.body.velocity.set === 'function') {
                      el.body.velocity.set(nx, ny, nz);
                    } else {
                      el.body.velocity.x = nx; el.body.velocity.y = ny; el.body.velocity.z = nz;
                    }
                  }
                } catch (e) { /* ignore */ }
              }
              // Enforce spawn-zone bounds each tether tick
              try { if (this.enforceEntityInsideSpawnZone) this.enforceEntityInsideSpawnZone(el); } catch(e) {}

              if (now - tetherStart < tetherDur) requestAnimationFrame(tetherStep);
            };
            requestAnimationFrame(tetherStep);
          } catch (e) { /* ignore tether errors */ }

          // gentle slow-down after short time so spear stays nearby but still moves
          const autoMs = Math.max(50, this.data.autoStopMs);
          setTimeout(() => {
            try {
              if (el.body) {
                // reduce linear speed to a fraction rather than zeroing
                if (el.body.velocity && typeof el.body.velocity.set === 'function') {
                  const vx = (el.body.velocity.x || 0) * 0.45;
                  const vy = (el.body.velocity.y || 0) * 0.45;
                  const vz = (el.body.velocity.z || 0) * 0.45;
                  el.body.velocity.set(vx, vy, vz);
                } else if (el.body.velocity) {
                  el.body.velocity.x *= 0.45; el.body.velocity.y *= 0.45; el.body.velocity.z *= 0.45;
                }
                // reduce angular speed slightly
                if (el.body.angularVelocity && typeof el.body.angularVelocity.set === 'function') {
                  el.body.angularVelocity.set(0,0,0);
                }
                // reduce damping so it still drifts slowly
                el.body.linearDamping = 0.35;
                el.body.angularDamping = 0.35;
              }
            } catch (e) { /* ignore */ }
          }, autoMs);

          // attach collision listener to detect fish hits
          const onCollide = (evt) => {
            try {
              const other = (evt && (evt.detail && evt.detail.body && evt.detail.body.el)) || (evt && evt.detail && evt.detail.target) || evt.detail && evt.detail.el;
              const otherEl = other && other.el ? other.el : other;
              if (otherEl && otherEl.classList && otherEl.classList.contains('fish-target')) {
                // delegate to central handler which updates score/HUD and removes fish
                this.processCaughtFish(otherEl, el);
                el.removeEventListener('collide', onCollide);
              }
            } catch (e) { console.warn('collide handler error', e); }
          };
          if (el.addEventListener) el.addEventListener('collide', onCollide);
          // start water sway motion (gentle)
          try {
            const forwardLocal = new AFRAME.THREE.Vector3(0,0,-1);
            const worldQuat = new AFRAME.THREE.Quaternion();
            el.object3D.getWorldQuaternion(worldQuat);
            const forward = forwardLocal.applyQuaternion(worldQuat).normalize();
            this.startWaterMotion(el, forward);
          } catch(e) {}
        }, 50);
      } else {
        // physicsLaunch disabled: fallback to short scripted launch
        this.launchSpear(el);
        // scripted launch: also apply water sway after enabling physics
        try {
          setTimeout(() => {
            const forwardLocal = new AFRAME.THREE.Vector3(0,0,-1);
            const worldQuat = new AFRAME.THREE.Quaternion();
            el.object3D.getWorldQuaternion(worldQuat);
            const forward = forwardLocal.applyQuaternion(worldQuat).normalize();
            this.startWaterMotion(el, forward);
            // record origin and start a short tether for scripted launch as well
            try {
              const launchOrigin = new AFRAME.THREE.Vector3();
              el.object3D.getWorldPosition(launchOrigin);
              const tetherStart = performance.now();
              const tetherDur = Math.max(200, this.data.tetherDuration);
              const tetherRadius = Math.max(0.05, this.data.tetherRadius);
              const tetherForce = Math.max(0.1, this.data.tetherForce);
              const tetherStep = (now) => {
                if (!el) return;
                const curPos = new AFRAME.THREE.Vector3();
                el.object3D.getWorldPosition(curPos);
                const disp = curPos.clone().sub(launchOrigin);
                const dist = disp.length();
                if (dist > tetherRadius) {
                  const dir = launchOrigin.clone().sub(curPos).normalize();
                  try {
                    if (el.body && typeof el.body.applyForce === 'function') {
                      const f = dir.clone().multiplyScalar(tetherForce);
                      el.body.applyForce(f, el.body.position);
                    } else {
                      // non-physics fallback: slowly lerp position back
                      const target = curPos.clone().add(dir.multiplyScalar(0.02));
                      const parent = el.object3D.parent;
                      if (parent) {
                        const local = parent.worldToLocal(target.clone());
                        el.object3D.position.lerp(local, 0.25);
                      } else {
                        el.object3D.position.lerp(target, 0.25);
                      }
                    }
                  } catch(e) {}
                  // Enforce spawn-zone bounds during scripted tether
                  try { if (this.enforceEntityInsideSpawnZone) this.enforceEntityInsideSpawnZone(el); } catch(e) {}
                }
                if (now - tetherStart < tetherDur) requestAnimationFrame(tetherStep);
              };
              requestAnimationFrame(tetherStep);
            } catch(e) {}
          }, 30);
        } catch(e) {}
      }
    }
  },

  launchSpear: function (el) {
    if (!el) return;
    const THREE = AFRAME.THREE;
    const startPos = new THREE.Vector3();
    el.object3D.getWorldPosition(startPos);

    // compute forward direction: local -Z axis in world space
    const forwardLocal = new THREE.Vector3(0, 0, -1);
    const worldQuat = new THREE.Quaternion();
    el.object3D.getWorldQuaternion(worldQuat);
    const forward = forwardLocal.clone().applyQuaternion(worldQuat).normalize();

    const distance = this.data.launchDistance;
    const targetPos = startPos.clone().add(forward.clone().multiplyScalar(distance));
    const duration = Math.max(10, this.data.launchDuration);
    const startTime = performance.now();

    let stopped = false;

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const currentPos = startPos.clone().lerp(targetPos, t);
      // Clamp scripted launch to spawn zone
      const clampedPos = (this.clampToSpawnZone) ? this.clampToSpawnZone(currentPos) : currentPos;

      // set world position respecting parent transform
      const parentObj = el.object3D.parent;
      if (parentObj) {
        const localPos = parentObj.worldToLocal(clampedPos.clone());
        el.object3D.position.copy(localPos);
      } else {
        el.object3D.position.copy(clampedPos);
      }

      // compute spear tip and check collision
      const spearPos = new THREE.Vector3();
      el.object3D.getWorldPosition(spearPos);
      const spearQuat = new THREE.Quaternion();
      el.object3D.getWorldQuaternion(spearQuat);
      const tipOffset = new THREE.Vector3(0, 0, 0.18).applyQuaternion(spearQuat);
      const tipPos = spearPos.clone().add(tipOffset);

      const scene = this.el.sceneEl;
      const fishTargets = Array.from(scene.querySelectorAll('.fish-target'));
      for (let fish of fishTargets) {
        if (!fish.object3D) continue;
        const fishPos = new THREE.Vector3();
        fish.object3D.getWorldPosition(fishPos);
        const dist = tipPos.distanceTo(fishPos);
        if (dist < this.collisionRadius) {
          // delegate catch handling (scripted launch)
          this.processCaughtFish(fish, el);
          stopped = true;
          break;
        }
      }

      if (!stopped && t < 1) {
        requestAnimationFrame(step);
      } else {
        // enable physics so the spear falls naturally (if physics system present)
        if (el.setAttribute) el.setAttribute('dynamic-body', 'mass:1');
        // auto-stop shortly after scripted launch to keep spear near
        setTimeout(() => {
          try {
            if (el.body) {
              if (el.body.velocity && typeof el.body.velocity.set === 'function') {
                el.body.velocity.set(0,0,0);
              }
              el.body.linearDamping = 1;
              el.body.angularDamping = 1;
            }
          } catch(e) { /* ignore */ }
        }, Math.max(50, this.data.autoStopMs));
      }
    };

    requestAnimationFrame(step);
  },

  // Clamp a world position inside the spawn-zone bounding box if present.
  // Returns a new Vector3 (clamped world position) or the original if no box.
  clampToSpawnZone: function (worldPos) {
    const THREE = AFRAME.THREE;
    try {
      const boxEl = document.querySelector('#spawn-zone-bounds');
      if (!boxEl || !boxEl.object3D) return worldPos;

      // Ensure matrixWorld is up to date
      boxEl.object3D.updateMatrixWorld(true);

      // Transform world pos into box local space
      const inv = new THREE.Matrix4().copy(boxEl.object3D.matrixWorld).invert();
      const local = worldPos.clone().applyMatrix4(inv);

      // Read box dimensions (A-Frame stores them as attributes on a-box)
      const width = parseFloat(boxEl.getAttribute('width')) || (boxEl.object3D.scale.x || 1);
      const height = parseFloat(boxEl.getAttribute('height')) || (boxEl.object3D.scale.y || 1);
      const depth = parseFloat(boxEl.getAttribute('depth')) || (boxEl.object3D.scale.z || 1);
      const halfW = width / 2; const halfH = height / 2; const halfD = depth / 2;

      // Clamp in local box space
      local.x = Math.max(-halfW, Math.min(halfW, local.x));
      local.y = Math.max(-halfH, Math.min(halfH, local.y));
      local.z = Math.max(-halfD, Math.min(halfD, local.z));

      // Transform back to world
      const clampedWorld = local.applyMatrix4(boxEl.object3D.matrixWorld);
      return clampedWorld;
    } catch (e) { return worldPos; }
  },

  // Ensure an entity stays inside the spawn zone: move its object3D or physics body to the clamped position.
  enforceEntityInsideSpawnZone: function (el) {
    if (!el) return;
    const THREE = AFRAME.THREE;
    try {
      const worldPos = new THREE.Vector3();
      el.object3D.getWorldPosition(worldPos);
      const clamped = this.clampToSpawnZone(worldPos);
      // If unchanged, nothing to do
      if (clamped.distanceTo(worldPos) < 0.001) return;

      // Apply clamped position: prefer physics body if present
      if (el.body) {
        try {
          if (el.body.position && typeof el.body.position.set === 'function') {
            el.body.position.set(clamped.x, clamped.y, clamped.z);
          } else if (el.body.position) {
            el.body.position.x = clamped.x; el.body.position.y = clamped.y; el.body.position.z = clamped.z;
          }
          // zero velocity to avoid re-exit
          if (el.body.velocity && typeof el.body.velocity.set === 'function') el.body.velocity.set(0,0,0);
          else if (el.body.velocity) { el.body.velocity.x = 0; el.body.velocity.y = 0; el.body.velocity.z = 0; }
        } catch (e) { /* ignore physics set errors */ }
      }

      // fallback to set object3D position
      try {
        const parent = el.object3D.parent;
        if (parent) {
          const local = parent.worldToLocal(clamped.clone());
          el.object3D.position.copy(local);
        } else {
          el.object3D.position.copy(clamped);
        }
      } catch (e) {}
    } catch (e) {}
  },

  tick: function () {
    if (!this.grabbedSpear || !this.grabbingHand) return;

    const THREE = AFRAME.THREE;

    // Vérifier que l'arme est toujours kinematic (empêche les fuites)
    try {
      if (this.grabbedSpear.body) {
        // S'assurer que le body reste kinematic pendant qu'on tient l'arme
        if (this.grabbedSpear.body.type !== 2) { // 2 = KINEMATIC in CANNON.js
          this.grabbedSpear.body.type = 2;
          this.grabbedSpear.body.mass = 0;
          this.grabbedSpear.body.updateMassProperties();
        }
        // Réinitialiser la vélocité pour éviter les dérives
        if (this.grabbedSpear.body.velocity) {
          if (typeof this.grabbedSpear.body.velocity.set === 'function') {
            this.grabbedSpear.body.velocity.set(0, 0, 0);
          } else {
            this.grabbedSpear.body.velocity.x = 0;
            this.grabbedSpear.body.velocity.y = 0;
            this.grabbedSpear.body.velocity.z = 0;
          }
        }
        if (this.grabbedSpear.body.angularVelocity) {
          if (typeof this.grabbedSpear.body.angularVelocity.set === 'function') {
            this.grabbedSpear.body.angularVelocity.set(0, 0, 0);
          } else {
            this.grabbedSpear.body.angularVelocity.x = 0;
            this.grabbedSpear.body.angularVelocity.y = 0;
            this.grabbedSpear.body.angularVelocity.z = 0;
          }
        }
      }
    } catch (e) { /* ignore */ }

    // Get hand world position and rotation
    const handPos = new THREE.Vector3();
    const handQuat = new THREE.Quaternion();
    this.grabbingHand.object3D.getWorldPosition(handPos);
    this.grabbingHand.object3D.getWorldQuaternion(handQuat);

    // Compute hand velocity using last recorded position/time
    const now = performance.now();
    if (this.lastHandPos && this.lastHandTime) {
      const dt = (now - this.lastHandTime) / 1000;
      if (dt > 0) {
        const vel = handPos.clone().sub(this.lastHandPos).divideScalar(dt);
        this.lastHandVel = vel;
      }
    }
    // update last hand pos/time for next tick
    this.lastHandPos = handPos.clone();
    this.lastHandTime = now;

    // Vérifier l'orientation de la main avec le vecteur UP
    const handUp = new THREE.Vector3(0, 1, 0).applyQuaternion(handQuat);
    const isFlipped = handUp.y < 0;

    // Ajuster l'offset en fonction de la rotation (garde la main sur le manche)
    let currentOffset = this.offset.clone();
    if (isFlipped) {
      currentOffset.set(0, 0, 0.2);
    }

    // Apply offset in hand's local space
    const offsetWorld = currentOffset.clone().applyQuaternion(handQuat);
    const targetPos = handPos.clone().add(offsetWorld);

    // Clamp the target position to the spawn zone (prevents weapon leaving detection area)
    const clampedTarget = this.clampToSpawnZone ? this.clampToSpawnZone(targetPos) : targetPos;

    // Compute desired rotation: base on hand then flip on Y
    const baseRotation = handQuat.clone();
    const flipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    baseRotation.multiply(flipY);
    if (isFlipped) {
      const flipX = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
      baseRotation.multiply(flipX);
    }

    // If the grabbed entity has a physics body, update the body transform
    const spear = this.grabbedSpear;
    try {
      if (spear.body) {
        // many physics engines expose position.set(x,y,z)
        if (spear.body.position && typeof spear.body.position.set === 'function') {
          spear.body.position.set(clampedTarget.x, clampedTarget.y, clampedTarget.z);
        } else if (spear.body.position) {
          spear.body.position.x = clampedTarget.x; spear.body.position.y = clampedTarget.y; spear.body.position.z = clampedTarget.z;
        }

        // quaternion may be different shape (CANNON has .set), try setting if available
        if (spear.body.quaternion && typeof spear.body.quaternion.set === 'function') {
          spear.body.quaternion.set(baseRotation.x, baseRotation.y, baseRotation.z, baseRotation.w);
        } else if (spear.body.quaternion) {
          spear.body.quaternion.x = baseRotation.x; spear.body.quaternion.y = baseRotation.y; spear.body.quaternion.z = baseRotation.z; spear.body.quaternion.w = baseRotation.w;
        } else {
          // fallback to updating object3D
          spear.object3D.position.copy(clampedTarget);
          spear.object3D.quaternion.copy(baseRotation);
        }
      } else {
        // No physics body: update object3D directly
        spear.object3D.position.copy(clampedTarget);
        spear.object3D.quaternion.copy(baseRotation);
      }
    } catch (e) {
      // fallback: set object3D transforms
      try { spear.object3D.position.copy(targetPos); spear.object3D.quaternion.copy(baseRotation); } catch (err) {}
    }

    // Check collision with fish targets
    this.checkFishCollision();
  },
  
  checkFishCollision: function () {
    if (!this.grabbedSpear) return;
    
    const THREE = AFRAME.THREE;
    const spearPos = new THREE.Vector3();
    this.grabbedSpear.object3D.getWorldPosition(spearPos);
    
    // Get spear tip position (forward from spear center)
    const spearQuat = new THREE.Quaternion();
    this.grabbedSpear.object3D.getWorldQuaternion(spearQuat);
    const forward = new THREE.Vector3(0, 0, 0.2).applyQuaternion(spearQuat);
    const tipPos = spearPos.clone().add(forward);
    
    // Check all fish targets
    const scene = this.el.sceneEl;
    const fishTargets = Array.from(scene.querySelectorAll('.fish-target'));
    
    fishTargets.forEach((fish) => {
      const fishPos = new THREE.Vector3();
      fish.object3D.getWorldPosition(fishPos);
      const distance = tipPos.distanceTo(fishPos);
      
      if (distance < this.collisionRadius) {
        // process catch from spear tip collision
        this.processCaughtFish(fish, this.grabbedSpear);
      }
    });
  },

  processCaughtFish: function (otherEl, spearEl) {
    if (!otherEl) return;
    try {
      // prevent double-handling
      if (otherEl._caught) return; otherEl._caught = true;

      // Determine fish type
      const caughtFishType = otherEl.getAttribute('data-fish-type') || otherEl.getAttribute('data-fish') || null;

      // Determine current bonus fish shown in UI (if any)
      let bonusFishType = null;
      const bonusFishEntity = document.querySelector('#fish-3d-world') || document.querySelector('#fish-3d');
      if (bonusFishEntity) {
        const rot = bonusFishEntity.components && bonusFishEntity.components['fish-rotator'];
        if (rot && rot.getCurrentFish) bonusFishType = rot.getCurrentFish();
        else {
          const m = bonusFishEntity.getAttribute('gltf-model');
          if (typeof m === 'string') bonusFishType = m.replace('#','');
        }
      }

      const isCorrect = (caughtFishType && bonusFishType && caughtFishType === bonusFishType) || false;
      const pointsEarned = isCorrect ? 10 : -5;

      // record to game timer
      if (window.gameTimer && window.gameTimer.isGameActive && window.gameTimer.isGameActive()) {
        window.gameTimer.addCaughtFish(caughtFishType || 'unknown', isCorrect, pointsEarned);
      }

      // update visible score display
      try {
        const scoreDisplay = document.querySelector('#score-display-world') || document.querySelector('#score-display');
        if (scoreDisplay && window.gameTimer) {
          const count = (window.gameTimer.getCaughtFishes && window.gameTimer.getCaughtFishes().length) || 0;
          const points = (window.gameTimer.getTotalScore && window.gameTimer.getTotalScore()) || 0;
          scoreDisplay.setAttribute('value', `Fish: ${count} | Points: ${points}`);
        }
      } catch (e) {}

      // advance bonus fish if correct
      try {
        if (isCorrect && bonusFishEntity && bonusFishEntity.components && bonusFishEntity.components['fish-rotator'] && bonusFishEntity.components['fish-rotator'].nextFish) {
          bonusFishEntity.components['fish-rotator'].nextFish();
        }
      } catch (e) {}

      // Play spear thrust sound (random from 3 sounds)
      try {
        const soundIndex = Math.floor(Math.random() * 3) + 1;
        const sound = document.querySelector(`#spear-thrust-${soundIndex}`);
        if (sound) {
          sound.currentTime = 0;
          sound.volume = 0.6;
          sound.play().catch(e => console.warn('Sound play error:', e));
        }
      } catch (e) {}

      // hide and remove the fish
      otherEl.setAttribute('visible', 'false');
      setTimeout(() => { if (otherEl.parentNode) otherEl.parentNode.removeChild(otherEl); }, 80);

      // gentle slow-down on spear if physics body present
      try {
        if (spearEl && spearEl.body && spearEl.body.velocity && typeof spearEl.body.velocity.set === 'function') {
          const vx = (spearEl.body.velocity.x || 0) * 0.25;
          const vy = (spearEl.body.velocity.y || 0) * 0.25;
          const vz = (spearEl.body.velocity.z || 0) * 0.25;
          spearEl.body.velocity.set(vx, vy, vz);
        } else if (spearEl && spearEl.body && spearEl.body.velocity) {
          spearEl.body.velocity.x *= 0.25; spearEl.body.velocity.y *= 0.25; spearEl.body.velocity.z *= 0.25;
        }
      } catch (e) {}

    } catch (e) { console.warn('processCaughtFish error', e); }
  }
});
