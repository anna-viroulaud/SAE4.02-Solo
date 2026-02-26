// Main application script - Bubble effects, landing page, and end-game handlers

// Bubble animation system
(function () {
  const container = document.querySelector('.bubbles-container');
  if (!container) return;

  function createBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    const size = Math.random() * 60 + 20;
    bubble.style.width = size + 'px';
    bubble.style.height = size + 'px';
    bubble.style.left = Math.random() * 100 + '%';
    bubble.style.animationDuration = Math.random() * 3 + 4 + 's';
    bubble.style.animationDelay = Math.random() * 2 + 's';
    container.appendChild(bubble);
    setTimeout(() => bubble.remove(), 8000);
  }

  for (let i = 0; i < 15; i++) createBubble();
  setInterval(createBubble, 1500);
})();

// Landing page handlers
(function () {
  const landingPage = document.getElementById('landing-page');
  const playBtn = document.getElementById('play-btn');
  const quitBtn = document.getElementById('quit-btn');
  const scene = document.querySelector('a-scene');

  // Hide scene initially
  if (scene) scene.style.display = 'none';

  // Function to start the game
  function startGame() {
    // Hide landing page with animation
    if (landingPage) {
      landingPage.style.opacity = '0';
      setTimeout(() => {
        landingPage.style.display = 'none';
        // Show scene
        if (scene) scene.style.display = 'block';
        
        // Launch WebXR after a short delay
        setTimeout(() => {
          // Trigger AR/XR mode entry
          if (scene.xrSession) {
            scene.xrSession.end();
          } else {
            scene.enterAR();
          }
        }, 500);
      }, 300);
    }
  }

  // PLAY button - Launch game in XR
  if (playBtn) {
    playBtn.addEventListener('click', () => startGame());
  }

  // QUIT button - Close application
  if (quitBtn) {
    quitBtn.addEventListener('click', () => {
      window.close();
    });
  }
})();

// End-game overlay buttons
(function () {
  const restart = document.getElementById('btn-restart');
  const quit = document.getElementById('btn-quit');
  const endScreen = document.getElementById('end-game-screen');
  
  if (restart) {
    restart.addEventListener('click', () => {
      try {
        if (window.gameTimer && window.gameTimer.resetGame) window.gameTimer.resetGame();
        // small delay then start a fresh game (120s = 2 minutes)
        setTimeout(() => { 
          try { 
            if (window.gameTimer && window.gameTimer.startGame) window.gameTimer.startGame(120); 
          } catch(e){} 
        }, 200);
      } catch (e) {}
    });
  }
  
  if (quit) {
    quit.addEventListener('click', () => {
      try {
        if (window.gameTimer && window.gameTimer.resetGame) window.gameTimer.resetGame();
      } catch (e) {}
      // Reload page as a simple quit action to return to the launcher state
      try { 
        window.location.reload(); 
      } catch (e) { 
        if (endScreen) endScreen.style.display = 'none'; 
      }
    });
  }
})();
