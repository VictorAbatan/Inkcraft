// === UNIVERSAL MUSIC SYSTEM WITH PERSISTENT IFRAME ===

// 🔹 Suppress favicon 404 messages globally
(function() {
  const originalError = console.error;
  console.error = function(...args) {
    if (args && args[0] && typeof args[0] === 'string' && args[0].includes('favicon.ico')) {
      return; // ignore favicon 404
    }
    originalError.apply(console, args);
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('music-container');
  if (!container) return;

  // Load universal-music HTML snippet
  fetch('universal-music.html')
    .then(res => res.text())
    .then(html => {
      container.innerHTML = html;

      // Append CSS if not already added
      if (!document.querySelector('link[href="universal-music.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'universal-music.css';
        document.head.appendChild(link);
      }

      initMusicSystem();
    })
    .catch(err => console.error('Failed to load universal music:', err));
});

function initMusicSystem() {
  const toggleBtn = document.getElementById('music-toggle');
  if (!toggleBtn) return;

  // === 🔹 Persistent iframe setup ===
  let iframe = document.getElementById('music-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'music-iframe';
    iframe.src = 'universal-music-player.html';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }

  // === 🔹 Send commands to iframe via postMessage ===
  function sendCommand(cmd, data = {}) {
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ cmd, ...data }, '*');
    }
  }

  // Toggle play/pause
  toggleBtn.addEventListener('click', () => {
    sendCommand('toggle');
  });

  // Receive state updates from iframe
  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.cmd) return;

    if (msg.cmd === 'stateUpdate') {
      if (msg.isPlaying) {
        toggleBtn.textContent = '🔊';
        toggleBtn.classList.remove('muted');
        toggleBtn.classList.add('playing');
      } else {
        toggleBtn.textContent = '🔇';
        toggleBtn.classList.add('muted');
        toggleBtn.classList.remove('playing');
      }
    }
  });

  // Request current state immediately on load
  sendCommand('getState');
}
