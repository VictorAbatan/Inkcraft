document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('music-container');
  if (!container) return;

  // Load universal-music HTML snippet
  fetch('universal-music.html')
    .then(res => res.text())
    .then(html => {
      container.innerHTML = html;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'universal-music.css';
      document.head.appendChild(link);
      initMusicSystem();
    })
    .catch(err => console.error('Failed to load universal music:', err));
});

function initMusicSystem() {
  const audio = document.getElementById('bg-music');
  const toggleBtn = document.getElementById('music-toggle');
  if (!audio || !toggleBtn) return;

  // Playlist — update these with your downloaded MP3 file paths
  const playlist = [
    'space-ambient-351305.mp3',
    'ambient-background-347405.mp3',
    'space-ambient-cinematic-351304.mp3'
  ];

  let current = 0;
  let next = 1;
  let isPlaying = false;

  // Create second audio object for crossfade
  const audioNext = new Audio();
  audioNext.preload = 'auto';

  audio.src = playlist[current];
  audioNext.src = playlist[next];
  audio.loop = false;
  audioNext.loop = false;
  audio.volume = 0.5;
  audioNext.volume = 0;

  // When current is near end, start crossfade
  audio.addEventListener('timeupdate', () => {
    if (audio.duration - audio.currentTime < 5 && !audioNext.isFading) {
      crossfade();
    }
  });

  // Start audio on first user interaction
  const startAudio = () => {
    if (!isPlaying) {
      audio.play().then(() => {
        fadeVolume(audio, 0, 0.5, 2000);
        toggleBtn.classList.add('playing');
        isPlaying = true;
      }).catch(err => console.warn('Audio play blocked:', err));
    }
    document.removeEventListener('click', startAudio);
  };
  document.addEventListener('click', startAudio);

  // Toggle play / pause
  toggleBtn.addEventListener('click', () => {
    if (!isPlaying) {
      audio.play();
      fadeVolume(audio, 0, 0.5, 2000);
      toggleBtn.textContent = '🔊';
      toggleBtn.classList.remove('muted');
      toggleBtn.classList.add('playing');
      isPlaying = true;
    } else {
      fadeVolume(audio, audio.volume, 0, 2000, () => audio.pause());
      fadeVolume(audioNext, audioNext.volume, 0, 2000, () => audioNext.pause());
      toggleBtn.textContent = '🔇';
      toggleBtn.classList.add('muted');
      toggleBtn.classList.remove('playing');
      isPlaying = false;
    }
  });

  function crossfade() {
    audioNext.isFading = true;
    next = (current + 1) % playlist.length;
    audioNext.src = playlist[next];
    audioNext.currentTime = 0;
    audioNext.play();

    fadeVolume(audioNext, 0, 0.5, 5000);
    fadeVolume(audio, audio.volume, 0, 5000, () => {
      audio.pause();
      // Swap roles
      const temp = audio.src;
      audio.src = audioNext.src;
      audioNext.src = temp;
      audio.volume = 0.5;
      current = next;
      audioNext.isFading = false;
    });
  }
}

// Fade helper
function fadeVolume(audioObj, from, to, duration, callback) {
  const steps = 30;
  const stepTime = duration / steps;
  let count = 0;
  const delta = (to - from) / steps;
  audioObj.volume = from;

  const interval = setInterval(() => {
    count++;
    audioObj.volume = Math.min(Math.max(audioObj.volume + delta, 0), 1);
    if (count >= steps) {
      clearInterval(interval);
      if (callback) callback();
    }
  }, stepTime);
}
