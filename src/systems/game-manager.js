// Game manager system: handles UI buttons and AR session entry
(function () {
  // Wait until DOM ready
  function initARButton() {
    const arButton = document.getElementById('ar-button');
    const scene = document.querySelector('a-scene');
    if (!arButton || !scene) return;

    arButton.addEventListener('click', async function () {
      if (!navigator.xr) {
        alert('WebXR non supporté sur ce navigateur');
        return;
      }

      const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!isArSupported) {
        alert('Mode AR non supporté. Utilisez un Quest 3 ou un appareil compatible.');
        return;
      }

      try {
        scene.enterAR();
        arButton.style.display = 'none';

        scene.addEventListener('exit-vr', function onExitAR() {
          arButton.style.display = 'block';
          scene.removeEventListener('exit-vr', onExitAR);
        });

        console.log('Mode AR activé - passthrough actif !');
      } catch (err) {
        console.error('Erreur lors du lancement AR:', err);
        alert('Erreur: ' + err.message);
      }
    });

    // Hide or disable button if AR not supported
    scene.addEventListener('loaded', async function () {
      if (navigator.xr) {
        const isArSupported = await navigator.xr.isSessionSupported('immersive-ar');
        if (!isArSupported) {
          arButton.textContent = 'AR non disponible';
          arButton.disabled = true;
        }
      } else {
        arButton.textContent = 'WebXR non supporté';
        arButton.disabled = true;
      }
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initARButton, 0);
  } else {
    document.addEventListener('DOMContentLoaded', initARButton);
  }
  // Setup simple game UI handlers (start/restart/quit)
  function initGameUI() {
    const start3D = document.querySelector('#start-button-3d-world');
    const scene = document.querySelector('a-scene');
    if (start3D) {
      // Ensure hidden by default (will be shown after room-scanned)
      start3D.setAttribute('visible', 'false');
      start3D.addEventListener('click', () => {
        // Play button sound
        try {
          const buttonSound = document.querySelector('#button-press');
          if (buttonSound) {
            buttonSound.currentTime = 0;
            buttonSound.volume = 0.5;
            buttonSound.play().catch(e => console.warn('Sound play error:', e));
          }
        } catch (e) {}
        
        start3D.setAttribute('visible', 'false');
        
        // Hide high scores button and AR button when game starts
        const highScores3DBtn = document.querySelector('#high-scores-btn-3d-world');
        if (highScores3DBtn) highScores3DBtn.setAttribute('visible', 'false');
        const highScoresBtnHTML = document.getElementById('high-scores-btn');
        if (highScoresBtnHTML) {
          highScoresBtnHTML.style.display = 'none';
          highScoresBtnHTML.style.pointerEvents = 'none';
        }
        const arOverlay = document.getElementById('ar-overlay');
        if (arOverlay) arOverlay.style.display = 'none';
        
        try {
          // 1) reveal the weapon
          const spear = document.querySelector('#spear');
          if (spear) spear.setAttribute('visible', 'true');

          // 2) reveal water and start its rise animation; when complete -> spawn fishes and start game timer
          const water = document.querySelector('#water-surface');
          const scene = document.querySelector('a-scene');
          if (water) {
            // Play underwater loop and ocean wave sounds BEFORE starting the rise
            try {
              const underwaterLoop = document.querySelector('#underwater-loop');
              if (underwaterLoop) {
                underwaterLoop.currentTime = 0;
                underwaterLoop.volume = 0.3;
                underwaterLoop.play().catch(e => console.warn('Underwater loop error:', e));
              }
              const oceanWave = document.querySelector('#ocean-wave');
              if (oceanWave) {
                oceanWave.currentTime = 0;
                oceanWave.volume = 0.5;
                oceanWave.play().catch(e => console.warn('Ocean wave error:', e));
              }
            } catch (e) {
              console.warn('Error playing water sounds:', e);
            }
            
            // Prefer the water-adapter API to start the rise so it only runs once
            const adapter = water.components && water.components['water-adapter'];
            try {
              if (adapter && adapter.startRise) {
                adapter.startRise();
              } else {
                // fallback: ensure water visible and apply a named animation
                water.setAttribute('visible', 'true');
                const anim = water.getAttribute('animation');
                if (anim) {
                  water.removeAttribute('animation__rise');
                  water.setAttribute('animation__rise', anim);
                } else {
                  water.setAttribute('animation__rise', 'property: position; to: 0 2.5 -2; dur: 10000; easing: easeInOutQuad');
                }
              }
            } catch (e) { console.warn('game-manager: startRise failed', e); }

            const onAnim = (ev) => {
              try { water.removeEventListener('animationcomplete', onAnim); } catch (e) {}
              // spawn fishes (use fish-spawner API) then start timer
              try {
                const spawner = document.querySelector('[fish-spawner]');
                if (spawner && spawner.components && spawner.components['fish-spawner'] && spawner.components['fish-spawner'].startSpawn) {
                  spawner.components['fish-spawner'].startSpawn();
                }
              } catch (e) { console.warn('game-manager: spawn after rise failed', e); }

              try { if (window.gameTimer && window.gameTimer.startGame) window.gameTimer.startGame(60); } catch (e) {}
            };

            // listen for animationcomplete
            water.addEventListener('animationcomplete', onAnim);
          } else {
            // If no water entity, just spawn and start
            try {
              const spawner = document.querySelector('[fish-spawner]');
              if (spawner && spawner.components && spawner.components['fish-spawner'] && spawner.components['fish-spawner'].startSpawn) spawner.components['fish-spawner'].startSpawn();
            } catch (e) {}
            try { if (window.gameTimer && window.gameTimer.startGame) window.gameTimer.startGame(60); } catch (e) {}
          }
        } catch (e) { console.warn('start button handler error', e); }
      });

      // Show the start button only after the room scan completes
      if (scene) {
        scene.addEventListener('room-scanned', (ev) => {
          // Small delay to allow visuals/UI to settle
          setTimeout(() => {
            // Show UI panels container
            const uiContainer = document.querySelector('#ui-panels-container');
            if (uiContainer) uiContainer.setAttribute('visible', 'true');
            
            start3D.setAttribute('visible', 'true');
            // Also show high scores button
            const highScores3D = document.querySelector('#high-scores-btn-3d-world');
            if (highScores3D) highScores3D.setAttribute('visible', 'true');
          }, 300);
        }, { once: true });
        
        // FALLBACK: If no room scan happens within 10 seconds, show buttons anyway
        // This ensures buttons are visible even without WebXR/AR
        setTimeout(() => {
          if (!window.FISH_ZONE || !window.FISH_ZONE.scanned) {
            console.warn('game-manager: No room scan detected - showing buttons anyway (fallback)');
            const uiContainer = document.querySelector('#ui-panels-container');
            if (uiContainer) uiContainer.setAttribute('visible', 'true');
            
            start3D.setAttribute('visible', 'true');
            const highScores3D = document.querySelector('#high-scores-btn-3d-world');
            if (highScores3D) highScores3D.setAttribute('visible', 'true');
          }
        }, 10000);
      }
    }

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', () => { 
      // Play button sound
      try {
        const buttonSound = document.querySelector('#button-press');
        if (buttonSound) {
          buttonSound.currentTime = 0;
          buttonSound.volume = 0.5;
          buttonSound.play().catch(e => console.warn('Sound play error:', e));
        }
      } catch (e) {}
      
      if (window.gameTimer && window.gameTimer.resetGame) { window.gameTimer.resetGame(); window.gameTimer.startGame(60); } 
    });
    const btnQuit = document.getElementById('btn-quit');
    if (btnQuit) btnQuit.addEventListener('click', () => { 
      // Play button sound
      try {
        const buttonSound = document.querySelector('#button-press');
        if (buttonSound) {
          buttonSound.currentTime = 0;
          buttonSound.volume = 0.5;
          buttonSound.play().catch(e => console.warn('Sound play error:', e));
        }
      } catch (e) {}
      
      if (window.gameTimer && window.gameTimer.resetGame) window.gameTimer.resetGame();
      // Show high scores buttons again on quit
      const highScores3DBtn = document.querySelector('#high-scores-btn-3d-world');
      if (highScores3DBtn && window.FISH_ZONE && window.FISH_ZONE.scanned) highScores3DBtn.setAttribute('visible', 'true');
      const highScoresBtnHTML = document.getElementById('high-scores-btn');
      if (highScoresBtnHTML) highScoresBtnHTML.style.display = 'flex';
    });

    const btnRestart3D = document.querySelector('#btn-restart-3d');
    if (btnRestart3D) btnRestart3D.addEventListener('click', () => { if (window.gameTimer && window.gameTimer.resetGame) { window.gameTimer.resetGame(); window.gameTimer.startGame(60); } });
    const btnQuit3D = document.querySelector('#btn-quit-3d');
    if (btnQuit3D) btnQuit3D.addEventListener('click', () => { 
      if (window.gameTimer && window.gameTimer.resetGame) window.gameTimer.resetGame();
      // Show high scores buttons again on quit
      const highScores3DBtn = document.querySelector('#high-scores-btn-3d-world');
      if (highScores3DBtn && window.FISH_ZONE && window.FISH_ZONE.scanned) highScores3DBtn.setAttribute('visible', 'true');
      const highScoresBtnHTML = document.getElementById('high-scores-btn');
      if (highScoresBtnHTML) highScoresBtnHTML.style.display = 'flex';
    });

    // High Scores button
    const highScoresBtn = document.getElementById('high-scores-btn');
    const highScoresPanel = document.getElementById('high-scores-panel');
    const closeHighScores = document.getElementById('close-high-scores');
    
    // Helper function to hide/show buttons when panel is open/closed
    function hideButtons() {
      // Hide HTML button
      if (highScoresBtn) highScoresBtn.style.display = 'none';
      // Hide 3D buttons
      const start3DBtn = document.querySelector('#start-button-3d-world');
      const highScores3DBtn = document.querySelector('#high-scores-btn-3d-world');
      if (start3DBtn) start3DBtn.setAttribute('visible', 'false');
      if (highScores3DBtn) highScores3DBtn.setAttribute('visible', 'false');
    }
    
    function showButtons() {
      // Show HTML button
      if (highScoresBtn) highScoresBtn.style.display = 'flex';
      // Show 3D buttons (only if room was scanned)
      if (window.FISH_ZONE && window.FISH_ZONE.scanned) {
        const start3DBtn = document.querySelector('#start-button-3d-world');
        const highScores3DBtn = document.querySelector('#high-scores-btn-3d-world');
        if (start3DBtn) start3DBtn.setAttribute('visible', 'true');
        if (highScores3DBtn) highScores3DBtn.setAttribute('visible', 'true');
      }
    }
    
    if (highScoresBtn) {
      highScoresBtn.addEventListener('click', () => {
        // Play button sound
        try {
          const buttonSound = document.querySelector('#button-press');
          if (buttonSound) {
            buttonSound.currentTime = 0;
            buttonSound.volume = 0.5;
            buttonSound.play().catch(e => console.warn('Sound play error:', e));
          }
        } catch (e) {}
        
        // Only open if game is not active and end screen is not shown
        if (window.gameTimer && window.gameTimer.isGameActive && window.gameTimer.isGameActive()) {
          console.log('Cannot open High Scores during game');
          return;
        }
        const endGameScreen = document.getElementById('end-game-screen');
        if (endGameScreen && endGameScreen.style.display === 'flex') {
          console.log('Cannot open High Scores during end screen');
          return;
        }
        if (highScoresPanel) {
          highScoresPanel.style.display = 'flex';
          hideButtons();
          displayHighScores();
        }
      });
    }
    
    if (closeHighScores) {
      closeHighScores.addEventListener('click', () => {
        // Play button sound
        try {
          const buttonSound = document.querySelector('#button-press');
          if (buttonSound) {
            buttonSound.currentTime = 0;
            buttonSound.volume = 0.5;
            buttonSound.play().catch(e => console.warn('Sound play error:', e));
          }
        } catch (e) {}
        
        if (highScoresPanel) {
          highScoresPanel.style.display = 'none';
          showButtons();
        }
      });
    }
    
    // Close panel when clicking outside
    if (highScoresPanel) {
      highScoresPanel.addEventListener('click', (e) => {
        if (e.target === highScoresPanel) {
          highScoresPanel.style.display = 'none';
          showButtons();
        }
      });
    }

    function displayHighScores() {
      const list = document.getElementById('high-scores-list');
      if (!list || !window.gameTimer) return;
      
      const scores = window.gameTimer.getHighScores();
      const top3 = scores.slice(0, 3);
      
      if (top3.length === 0) {
        list.innerHTML = '<div class="no-scores">Aucun score enregistré pour le moment.<br>Jouez une partie pour commencer !</div>';
        return;
      }
      
      let html = '';
      top3.forEach((entry, index) => {
        const medal = ['🥇', '🥈', '🥉'][index];
        const rank = index + 1;
        html += `
          <div class="score-entry rank-${rank}">
            <div class="score-rank">${medal} ${rank}.</div>
            <div class="score-details">
              <div class="score-points">${entry.score} points</div>
              <div class="score-date">${entry.date}</div>
            </div>
          </div>
        `;
      });
      
      list.innerHTML = html;
    }

    // High Scores 3D button for VR
    const highScoresBtn3D = document.querySelector('#high-scores-btn-3d-world');
    const highScoresPanel3D = document.querySelector('#high-scores-panel-3d');
    const closeHighScores3D = document.querySelector('#close-high-scores-3d');
    
    if (highScoresBtn3D) {
      highScoresBtn3D.addEventListener('click', () => {
        // Only open if game is not active and end screen is not shown
        if (window.gameTimer && window.gameTimer.isGameActive && window.gameTimer.isGameActive()) {
          console.log('Cannot open High Scores 3D during game');
          return;
        }
        const endScreen3D = document.querySelector('#end-screen-3d');
        if (endScreen3D && endScreen3D.getAttribute('visible') === 'true') {
          console.log('Cannot open High Scores 3D during end screen');
          return;
        }
        if (highScoresPanel3D) {
          highScoresPanel3D.setAttribute('visible', 'true');
          hideButtons();
          displayHighScores3D();
        }
      });
    }
    
    if (closeHighScores3D) {
      closeHighScores3D.addEventListener('click', () => {
        if (highScoresPanel3D) {
          highScoresPanel3D.setAttribute('visible', 'false');
          showButtons();
        }
      });
    }
    
    function displayHighScores3D() {
      const list = document.querySelector('#high-scores-list-3d');
      if (!list || !window.gameTimer) return;
      
      // Clear existing content
      while (list.firstChild) list.removeChild(list.firstChild);
      
      const scores = window.gameTimer.getHighScores();
      const top3 = scores.slice(0, 3);
      
      if (top3.length === 0) {
        const noScoresText = document.createElement('a-text');
        noScoresText.setAttribute('value', 'Aucun score enregistré.\nJouez une partie !');
        noScoresText.setAttribute('align', 'center');
        noScoresText.setAttribute('color', '#999999');
        noScoresText.setAttribute('width', '1.2');
        noScoresText.setAttribute('position', '0 0 0');
        list.appendChild(noScoresText);
        return;
      }
      
      const medals = ['🥇', '🥈', '🥉'];
      let yPos = 0;
      
      top3.forEach((entry, index) => {
        // Background for each entry
        const bg = document.createElement('a-plane');
        bg.setAttribute('color', index === 0 ? '#FFD700' : '#4a90e2');
        bg.setAttribute('opacity', index === 0 ? '0.15' : '0.1');
        bg.setAttribute('width', '0.7');
        bg.setAttribute('height', '0.08');
        bg.setAttribute('position', `0 ${yPos} -0.005`);
        list.appendChild(bg);
        
        // Rank and medal
        const rankText = document.createElement('a-text');
        rankText.setAttribute('value', `${medals[index]} ${index + 1}.`);
        rankText.setAttribute('align', 'left');
        rankText.setAttribute('color', index === 0 ? '#FFD700' : '#ffffff');
        rankText.setAttribute('width', '1');
        rankText.setAttribute('position', `-0.32 ${yPos} 0`);
        list.appendChild(rankText);
        
        // Score
        const scoreText = document.createElement('a-text');
        scoreText.setAttribute('value', `${entry.score} pts`);
        scoreText.setAttribute('align', 'center');
        scoreText.setAttribute('color', index === 0 ? '#FFD700' : '#4a90e2');
        scoreText.setAttribute('width', '1');
        scoreText.setAttribute('position', `0.05 ${yPos} 0`);
        list.appendChild(scoreText);
        
        // Date (smaller)
        const dateText = document.createElement('a-text');
        dateText.setAttribute('value', entry.date.split(' ')[0] || entry.date);
        dateText.setAttribute('align', 'right');
        dateText.setAttribute('color', '#888888');
        dateText.setAttribute('width', '0.7');
        dateText.setAttribute('position', `0.32 ${yPos} 0`);
        list.appendChild(dateText);
        
        yPos -= 0.1;
      });
    }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') initGameUI(); else document.addEventListener('DOMContentLoaded', initGameUI);
})();
