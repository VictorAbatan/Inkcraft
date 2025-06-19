document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu dynamically
  fetch('floating-menu.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;

      // ✅ Add animation class after injecting the menu
      const menu = document.querySelector('.floating-menu');
      if (menu) {
        menu.classList.add('animated');
      }

      // ✅ Normalize and highlight the current page's menu link
      const currentPage = decodeURIComponent(window.location.pathname.split('/').pop().toLowerCase());
      document.querySelectorAll('.floating-menu a').forEach(link => {
        const href = link.getAttribute('href').toLowerCase();
        if (href === currentPage) {
          link.classList.add('active');
        }
      });
    });

  // === ICON CAROUSEL LOGIC ===
  const carousel = document.querySelector('.icon-carousel');
  const track = document.querySelector('.icon-track');
  let cards = Array.from(track?.children || []);
  if (!carousel || cards.length === 0) return;

  const style = getComputedStyle(track);
  const gap = parseInt(style.gap) || 0;
  const cardWidth = cards[0].offsetWidth + gap;

  const prependClones = cards.map(c => c.cloneNode(true));
  const appendClones = cards.map(c => c.cloneNode(true));
  prependClones.reverse().forEach(c => track.insertBefore(c, track.firstChild));
  appendClones.forEach(c => track.appendChild(c));

  cards = Array.from(track.children);
  let totalReal = cards.length - prependClones.length - appendClones.length;
  let offset = prependClones.length;
  let currentIndex = offset;
  let isTransitioning = false;

  carousel.scrollLeft = currentIndex * cardWidth;
  updateActive();

  function updateActive() {
    cards.forEach((c, i) => c.classList.toggle('active-slide', i === currentIndex));
  }

  function slideTo(newIndex) {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex = newIndex;
    carousel.scrollTo({ left: currentIndex * cardWidth, behavior: 'smooth' });

    setTimeout(() => {
      if (currentIndex < offset) {
        currentIndex += totalReal;
        carousel.scrollLeft = currentIndex * cardWidth;
      } else if (currentIndex >= offset + totalReal) {
        currentIndex -= totalReal;
        carousel.scrollLeft = currentIndex * cardWidth;
      }
      updateActive();
      isTransitioning = false;
    }, 600);
  }

  setInterval(() => slideTo(currentIndex + 1), 5000);

  document.querySelector('.nav-arrow.left')?.addEventListener('click', () => slideTo(currentIndex - 1));
  document.querySelector('.nav-arrow.right')?.addEventListener('click', () => slideTo(currentIndex + 1));

  let startX = 0, dragging = false;
  carousel.addEventListener('touchstart', e => {
    if (isTransitioning) return;
    startX = e.touches[0].clientX;
    dragging = true;
  });
  carousel.addEventListener('touchend', e => {
    if (!dragging) return;
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 50) {
      slideTo(diff > 0 ? currentIndex - 1 : currentIndex + 1);
    }
    dragging = false;
  });
});
