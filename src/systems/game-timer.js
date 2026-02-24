// Système de chronomètre et gestion de la fin de jeu (adapté depuis la branche score-challenge)
(function () {
  let gameActive = false;
  let timeRemaining = 60; // seconds
  let caughtFishes = [];
  let totalScore = 0;
  let timerInterval = null;
  let endGameSoundPlayed = false; // Flag to ensure end game sound plays only once

  function formatTime(sec) {
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  window.gameTimer = {
    startGame: function (duration = 60) {
      gameActive = true;
      timeRemaining = duration;
      caughtFishes = [];
      totalScore = 0;

      // hide AR and High Scores buttons during game
      const arOverlay = document.getElementById('ar-overlay');
      if (arOverlay) arOverlay.style.display = 'none';
      const highScoresBtn = document.getElementById('high-scores-btn');
      if (highScoresBtn) {
        highScoresBtn.style.display = 'none';
        highScoresBtn.style.pointerEvents = 'none';
      }
      // hide High Scores panel if open
      const highScoresPanel = document.getElementById('high-scores-panel');
      if (highScoresPanel) highScoresPanel.style.display = 'none';

      // show HTML timer
      const timerDisplay = document.getElementById('timer-display');
      if (timerDisplay) timerDisplay.style.display = 'block';

      // show 3D timer
      const timer3D = document.querySelector('#timer-3d');
      const timer3DWorld = document.querySelector('#timer-3d-world');
      if (timer3D) timer3D.setAttribute('visible', 'true');
      if (timer3DWorld) timer3DWorld.setAttribute('visible', 'true');

      // show bonus panel
      const bonusFish = document.querySelector('#bonus-fish-world');
      const bonusFishCam = document.querySelector('#bonus-fish');
      if (bonusFish) bonusFish.setAttribute('visible', 'true');
      if (bonusFishCam) bonusFishCam.setAttribute('visible', 'true');

      // show score display in VR
      const scoreDisplay = document.querySelector('#score-display-world');
      const scoreDisplayCam = document.querySelector('#score-display');
      if (scoreDisplay) scoreDisplay.setAttribute('visible', 'true');
      if (scoreDisplayCam) scoreDisplayCam.setAttribute('visible', 'true');
      // initialize score display value
      if (scoreDisplay) scoreDisplay.setAttribute('value', 'Fish: 0 | Points: 0');
      if (scoreDisplayCam) scoreDisplayCam.setAttribute('value', 'Fish: 0 | Points: 0');

      // show water and bubbles if present
      const waterSurface = document.querySelector('#water-surface');
      if (waterSurface) {
        waterSurface.setAttribute('visible', 'true');
        const animation = waterSurface.components && waterSurface.components.animation;
        if (animation && animation.beginAnimation) animation.beginAnimation();
      }
      const bubbles = document.querySelector('#bubbles');
      if (bubbles) bubbles.setAttribute('visible', 'true');

      // show spear
      const spear = document.querySelector('#spear');
      if (spear) spear.setAttribute('visible', 'true');

      // show all fish-target entities
      const fishTargets = document.querySelectorAll('.fish-target');
      fishTargets.forEach(f => f.setAttribute('visible', 'true'));

      // update displays and start tick
      this.updateTimerDisplay();
      timerInterval = setInterval(() => {
        timeRemaining--;
        this.updateTimerDisplay();
        if (timeRemaining <= 0) this.endGame();
      }, 1000);

      console.log('🎮 Game started! Duration:', duration, 'seconds');
    },

    updateTimerDisplay: function () {
      const t = formatTime(timeRemaining);
      const timerDisplay = document.getElementById('timer-display');
      if (timerDisplay) {
        timerDisplay.textContent = t;
        // Change to red when <= 15 seconds
        timerDisplay.style.color = timeRemaining <= 15 ? '#e74c3c' : '#FFD700';
        // Toggle warning class to enable pulse animation
        if (timeRemaining <= 15) timerDisplay.classList.add('warning'); else timerDisplay.classList.remove('warning');
      }
      const timerText3D = document.querySelector('#timer-text-world');
      const timerText3DCam = document.querySelector('#timer-text');
      if (timerText3D) {
        timerText3D.setAttribute('value', t);
        // also change 3D text color when <= 15s
        try { timerText3D.setAttribute('color', timeRemaining <= 15 ? '#e74c3c' : '#FFD700'); } catch (e) {}
      }
      if (timerText3DCam) {
        timerText3DCam.setAttribute('value', t);
        try { timerText3DCam.setAttribute('color', timeRemaining <= 15 ? '#e74c3c' : '#FFD700'); } catch (e) {}
      }
      
      // Play clock ticking sound at 15 seconds
      if (timeRemaining === 15) {
        try {
          const clockSound = document.querySelector('#clock-ticking');
          if (clockSound) {
            clockSound.currentTime = 0;
            clockSound.volume = 0.4;
            clockSound.play().catch(e => console.warn('Clock sound error:', e));
          }
        } catch (e) {}
      }
    },

    addCaughtFish: function (fishType, isCorrect, points) {
      caughtFishes.push({ type: fishType, isCorrect: isCorrect, points: points, timestamp: new Date().toLocaleTimeString() });
      totalScore += points;

      // Update HUD (both HTML overlay and 3D text) when a fish is caught
      try {
        const scoreDisplay = document.querySelector('#score-display-world');
        const scoreDisplayCam = document.querySelector('#score-display');
        if (scoreDisplay) {
          const count = caughtFishes.length;
          scoreDisplay.setAttribute('value', `Fish: ${count} | Points: ${totalScore}`);
        }
        if (scoreDisplayCam) {
          const count = caughtFishes.length;
          scoreDisplayCam.setAttribute('value', `Fish: ${count} | Points: ${totalScore}`);
        }
        const scoreDisplayHTML = document.getElementById('timer-display'); // reuse timer overlay for now
        if (scoreDisplayHTML) {
          // keep timer display separate; no change
        }
      } catch (e) { /* ignore HUD update errors */ }

      console.log(`🐟 Fish added: ${fishType} (${isCorrect ? 'CORRECT' : 'INCORRECT'}) ${points >= 0 ? '+' : ''}${points}pts - Total: ${totalScore}`);
    },

    endGame: function () {
      if (!gameActive) return; // Already ended, prevent multiple calls
      gameActive = false;
      if (timerInterval) clearInterval(timerInterval);
      console.log('🏁 Game ended!');
      this.showEndGameScreen();
    },

    showEndGameScreen: function () {
      // Save score to localStorage (seulement si score > 0 ou partie jouée)
      if (totalScore !== 0 || caughtFishes.length > 0) {
        this.saveScore(totalScore);
      }
      
      // Stop underwater loop if playing
      try {
        const underwaterLoop = document.querySelector('#underwater-loop');
        if (underwaterLoop) {
          underwaterLoop.pause();
          underwaterLoop.currentTime = 0;
        }
      } catch (e) {}
      
      // Play end game sound based on fish caught (only once)
      if (!endGameSoundPlayed) {
        endGameSoundPlayed = true;
        try {
          if (caughtFishes.length === 0) {
            // No fish caught - play explosion
            const explosionSound = document.querySelector('#explosion');
            if (explosionSound) {
              explosionSound.currentTime = 0;
              explosionSound.volume = 0.6;
              explosionSound.play().catch(e => console.warn('Explosion sound error:', e));
            }
          } else if (caughtFishes.length > 1) {
            // More than 1 fish caught - play win sound (random between 2 versions)
            const soundIndex = Math.random() < 0.5 ? 1 : 2;
            const winSound = document.querySelector(`#win-sound-${soundIndex}`);
            if (winSound) {
              winSound.currentTime = 0;
              winSound.volume = 0.5;
              winSound.play().catch(e => console.warn('Win sound error:', e));
            }
          }
        } catch (e) {
          console.warn('Error playing end game sound:', e);
        }
      }
      
      // hide timers and bonus
      const timer3D = document.querySelector('#timer-3d'); if (timer3D) timer3D.setAttribute('visible', 'false');
      const timer3DWorld = document.querySelector('#timer-3d-world'); if (timer3DWorld) timer3DWorld.setAttribute('visible', 'false');
      const bonusFish = document.querySelector('#bonus-fish'); if (bonusFish) bonusFish.setAttribute('visible', 'false');
      const bonusFishWorld = document.querySelector('#bonus-fish-world'); if (bonusFishWorld) bonusFishWorld.setAttribute('visible', 'false');
      const scoreDisplay = document.querySelector('#score-display'); if (scoreDisplay) scoreDisplay.setAttribute('visible', 'false');
      const scoreDisplayWorld = document.querySelector('#score-display-world'); if (scoreDisplayWorld) scoreDisplayWorld.setAttribute('visible', 'false');

      // hide AR button and High Scores button during end screen
      const arOverlay = document.getElementById('ar-overlay'); if (arOverlay) arOverlay.style.display = 'none';
      const highScoresBtn = document.getElementById('high-scores-btn'); 
      if (highScoresBtn) { 
        highScoresBtn.style.display = 'none'; 
        highScoresBtn.style.pointerEvents = 'none'; 
      }

      // show 3D end screen
      const endScreen3D = document.querySelector('#end-screen-3d'); if (endScreen3D) { endScreen3D.setAttribute('visible','true'); this.populateScoreTable3D(); }

      // show HTML end screen
      const endGameScreen = document.getElementById('end-game-screen'); if (endGameScreen) { this.populateScoreTable(); endGameScreen.style.display = 'flex'; }
    },

    saveScore: function (score) {
      try {
        // Récupérer les scores existants
        let scores = this.getHighScores();
        
        // Vérifier si ce score existe déjà (éviter les doublons de même valeur)
        const alreadyExists = scores.some(s => s.score === score);
        
        if (alreadyExists) {
          console.log('💾 Score', score, 'already in top 3, not adding duplicate');
          return;
        }
        
        // Créer le nouveau score
        const newScore = {
          score: score,
          date: new Date().toLocaleString('fr-FR'),
          timestamp: Date.now()
        };
        
        // Ajouter le nouveau score
        scores.push(newScore);
        
        // Trier par score décroissant
        scores.sort((a, b) => b.score - a.score);
        
        // Garder seulement les 3 meilleurs scores (avec valeurs différentes)
        const uniqueScores = [];
        const seenValues = new Set();
        for (const s of scores) {
          if (!seenValues.has(s.score)) {
            seenValues.add(s.score);
            uniqueScores.push(s);
            if (uniqueScores.length >= 3) break;
          }
        }
        
        // Sauvegarder
        localStorage.setItem('spearfisher-high-scores', JSON.stringify(uniqueScores));
        console.log('💾 Score saved:', score, '| Top 3:', uniqueScores.map(s => s.score).join(', '));
      } catch (e) {
        console.warn('Failed to save score:', e);
      }
    },

    getHighScores: function () {
      try {
        const stored = localStorage.getItem('spearfisher-high-scores');
        if (!stored) return [];
        
        const parsed = JSON.parse(stored);
        
        // Vérifier que c'est un tableau valide
        if (!Array.isArray(parsed)) {
          console.warn('High scores data corrupted, resetting...');
          localStorage.removeItem('spearfisher-high-scores');
          return [];
        }
        
        // Filtrer les scores valides et les trier
        const validScores = parsed.filter(s => 
          s && 
          typeof s.score === 'number' && 
          !isNaN(s.score) &&
          s.date
        );
        
        // Trier par score décroissant
        validScores.sort((a, b) => b.score - a.score);
        
        // Garder seulement les scores avec des valeurs DIFFÉRENTES (pas de doublons)
        const uniqueScores = [];
        const seenValues = new Set();
        for (const s of validScores) {
          if (!seenValues.has(s.score)) {
            seenValues.add(s.score);
            uniqueScores.push(s);
            if (uniqueScores.length >= 3) break;
          }
        }
        
        return uniqueScores;
      } catch (e) {
        console.warn('Error reading high scores, resetting:', e);
        localStorage.removeItem('spearfisher-high-scores');
        return [];
      }
    },

    populateScoreTable: function () {
      const tableBody = document.getElementById('score-table-body'); if (!tableBody) return;
      tableBody.innerHTML = '';
      console.log('📊 Populating score table - caughtFishes:', caughtFishes, 'length:', caughtFishes.length);
      // Check if we have fish caught
      if (!caughtFishes || caughtFishes.length === 0) {
        console.log('⚠️ No fishes to display in table');
        const r = document.createElement('tr'); r.innerHTML = `<td colspan="3" style="text-align:center;color:#999;">😢 No fish caught...</td>`; tableBody.appendChild(r); return;
      }
      console.log('✅ Displaying', caughtFishes.length, 'fishes in table');
      const groups = {};
      let calcTotal = 0;
      caughtFishes.forEach(f => {
        const key = `${f.type}_${f.isCorrect ? 'correct' : 'incorrect'}`;
        if (!groups[key]) groups[key] = { name: (f.type === 'piranha' ? '🐠 Piranha' : '🐟 Fish') + (f.isCorrect ? ' ✅' : ' ❌'), count: 0, points: 0, isCorrect: f.isCorrect };
        groups[key].count++; groups[key].points += f.points; calcTotal += f.points;
      });
      totalScore = calcTotal;
      Object.values(groups).forEach(g => {
        const row = document.createElement('tr'); row.className = g.isCorrect ? 'correct-row' : 'incorrect-row'; const pointsColor = g.points >= 0 ? '#00ff00' : '#ff0000'; row.innerHTML = `<td>${g.name}</td><td>x ${g.count}</td><td style="color:${pointsColor}">${g.points > 0 ? '+' : ''}${g.points} pts</td>`; tableBody.appendChild(row);
      });
      const totalRow = document.createElement('tr'); totalRow.className = 'total-row'; const totalColor = totalScore >= 0 ? '#FFD700' : '#ff6b6b'; totalRow.innerHTML = `<td><strong>TOTAL</strong></td><td></td><td style="color:${totalColor}"><strong>${totalScore > 0 ? '+' : ''}${totalScore} pts</strong></td>`; tableBody.appendChild(totalRow);
    },

    populateScoreTable3D: function () {
      const endScreen3D = document.querySelector('#end-screen-3d'); if (!endScreen3D) return;
      const old = document.querySelector('#dynamic-score-table-3d'); if (old) old.parentNode.removeChild(old);
      // Check if we have fish caught
      if (!caughtFishes || caughtFishes.length === 0) {
        const t = document.createElement('a-text'); t.setAttribute('id','score-list-3d'); t.setAttribute('value','No fish caught...'); t.setAttribute('align','center'); t.setAttribute('color','#999999'); t.setAttribute('width','1.8'); t.setAttribute('position','0 0 0'); endScreen3D.appendChild(t); return;
      }
      const tableContainer = document.createElement('a-entity'); tableContainer.setAttribute('id','dynamic-score-table-3d'); tableContainer.setAttribute('position','0 0.3 0.01');
      const fishGroups = {}; let calcTotal = 0; caughtFishes.forEach(f=>{ const key = `${f.type}_${f.isCorrect ? 'correct' : 'incorrect'}`; if(!fishGroups[key]) fishGroups[key] = { count:0, points:0, name: (f.type==='piranha'?'🐠 Piranha':'🐟 Poisson') + (f.isCorrect?' ✅':' ❌'), isCorrect: f.isCorrect }; fishGroups[key].count++; fishGroups[key].points += f.points; calcTotal += f.points; }); totalScore = calcTotal;
      // headers
      const headerBg = document.createElement('a-plane'); headerBg.setAttribute('color','#FFD700'); headerBg.setAttribute('opacity','0.2'); headerBg.setAttribute('width','1.1'); headerBg.setAttribute('height','0.08'); headerBg.setAttribute('position','0 0 -0.01'); tableContainer.appendChild(headerBg);
      const header1 = document.createElement('a-text'); header1.setAttribute('value','Fish Type'); header1.setAttribute('align','left'); header1.setAttribute('color','#FFD700'); header1.setAttribute('width','1'); header1.setAttribute('position','-0.52 0 0'); tableContainer.appendChild(header1);
      const header2 = document.createElement('a-text'); header2.setAttribute('value','Quantity'); header2.setAttribute('align','center'); header2.setAttribute('color','#FFD700'); header2.setAttribute('width','1'); header2.setAttribute('position','0 0 0'); tableContainer.appendChild(header2);
      const header3 = document.createElement('a-text'); header3.setAttribute('value','Points'); header3.setAttribute('align','right'); header3.setAttribute('color','#FFD700'); header3.setAttribute('width','1'); header3.setAttribute('position','0.52 0 0'); tableContainer.appendChild(header3);
      let yPosition = -0.12; Object.values(fishGroups).forEach(group => { const rowBg = document.createElement('a-plane'); rowBg.setAttribute('color', group.isCorrect ? '#00ff00' : '#ff0000'); rowBg.setAttribute('opacity','0.1'); rowBg.setAttribute('width','1.1'); rowBg.setAttribute('height','0.08'); rowBg.setAttribute('position',`0 ${yPosition} -0.01`); tableContainer.appendChild(rowBg); const col1 = document.createElement('a-text'); col1.setAttribute('value', group.name); col1.setAttribute('align','left'); col1.setAttribute('color','#ffffff'); col1.setAttribute('width','0.9'); col1.setAttribute('position',`-0.52 ${yPosition} 0`); tableContainer.appendChild(col1); const col2 = document.createElement('a-text'); col2.setAttribute('value', `x ${group.count}`); col2.setAttribute('align','center'); col2.setAttribute('color','#ffffff'); col2.setAttribute('width','1'); col2.setAttribute('position',`0 ${yPosition} 0`); tableContainer.appendChild(col2); const col3 = document.createElement('a-text'); const pointsColor = group.points >= 0 ? '#00ff00' : '#ff0000'; const sign = group.points > 0 ? '+' : ''; col3.setAttribute('value', `${sign}${group.points} pts`); col3.setAttribute('align','right'); col3.setAttribute('color', pointsColor); col3.setAttribute('width','1'); col3.setAttribute('position',`0.52 ${yPosition} 0`); tableContainer.appendChild(col3); yPosition -= 0.10; });
      // TOTAL
      yPosition -= 0.02; const totalBg = document.createElement('a-plane'); totalBg.setAttribute('color','#FFD700'); totalBg.setAttribute('opacity','0.25'); totalBg.setAttribute('width','1.1'); totalBg.setAttribute('height','0.09'); totalBg.setAttribute('position',`0 ${yPosition} -0.01`); tableContainer.appendChild(totalBg); const totalLabel = document.createElement('a-text'); totalLabel.setAttribute('value','TOTAL'); totalLabel.setAttribute('align','left'); totalLabel.setAttribute('color','#FFD700'); totalLabel.setAttribute('width','1'); totalLabel.setAttribute('position',`-0.52 ${yPosition} 0`); tableContainer.appendChild(totalLabel); const totalValue = document.createElement('a-text'); const totalColor = totalScore >= 0 ? '#FFD700' : '#ff6b6b'; const totalSign = totalScore > 0 ? '+' : ''; totalValue.setAttribute('value', `${totalSign}${totalScore} pts`); totalValue.setAttribute('align','right'); totalValue.setAttribute('color', totalColor); totalValue.setAttribute('width','1'); totalValue.setAttribute('position', `0.52 ${yPosition} 0`); tableContainer.appendChild(totalValue);
      endScreen3D.appendChild(tableContainer);
    },

    resetGame: function () {
      gameActive = false; if (timerInterval) clearInterval(timerInterval); timeRemaining = 60; caughtFishes = []; totalScore = 0; endGameSoundPlayed = false;
      
      // Stop and reset underwater loop to prevent it from playing in next game
      try {
        const underwaterLoop = document.querySelector('#underwater-loop');
        if (underwaterLoop) {
          underwaterLoop.pause();
          underwaterLoop.currentTime = 0;
        }
      } catch (e) {}
      
      const endGameScreen = document.getElementById('end-game-screen'); if (endGameScreen) endGameScreen.style.display = 'none';
      const endScreen3D = document.querySelector('#end-screen-3d'); if (endScreen3D) endScreen3D.setAttribute('visible','false');
      const timer3D = document.querySelector('#timer-3d'); if (timer3D) timer3D.setAttribute('visible','false');
      const timerDisplay = document.getElementById('timer-display'); if (timerDisplay) { timerDisplay.style.display = 'none'; timerDisplay.textContent = '1:00'; timerDisplay.style.color = '#FFD700'; }
      const timerText3D = document.querySelector('#timer-text'); if (timerText3D) { timerText3D.setAttribute('value','1:00'); timerText3D.setAttribute('color','#FFD700'); }
      const scoreDisplayReset = document.querySelector('#score-display-world'); if (scoreDisplayReset) scoreDisplayReset.setAttribute('value','Fish: 0 | Points: 0');
      const scoreDisplayResetCam = document.querySelector('#score-display'); if (scoreDisplayResetCam) scoreDisplayResetCam.setAttribute('value','Fish: 0 | Points: 0');
      const grabManager = document.querySelector('[grab-manager]'); if (grabManager && grabManager.components && grabManager.components['grab-manager']) { grabManager.components['grab-manager'].fishCaught = 0; grabManager.components['grab-manager'].points = 0; }
      const fishTargets = document.querySelectorAll('.fish-target'); fishTargets.forEach(f => { delete f.dataset.caught; f.setAttribute('visible', 'false'); });
      // show AR and High Scores buttons again when returning to menu
      const arOverlay = document.getElementById('ar-overlay'); if (arOverlay) arOverlay.style.display = 'flex';
      const highScoresBtn = document.getElementById('high-scores-btn'); 
      if (highScoresBtn) { 
        highScoresBtn.style.display = 'flex'; 
        highScoresBtn.style.pointerEvents = 'auto'; 
      }
      console.log('🔄 Game reset');
    },

    isGameActive: function () { return gameActive; },
    getCaughtFishes: function () { return caughtFishes; },
    getTotalScore: function () { return totalScore; },
    
    // Fonction pour effacer tous les scores (utile si scores corrompus)
    clearHighScores: function () {
      try {
        localStorage.removeItem('spearfisher-high-scores');
        console.log('🗑️ High scores cleared');
        return true;
      } catch (e) {
        console.warn('Failed to clear high scores:', e);
        return false;
      }
    }
  };

  console.log('✅ Game timer system loaded');
})();
