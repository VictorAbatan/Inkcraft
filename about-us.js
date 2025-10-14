document.addEventListener('DOMContentLoaded', () => {
  // === Floating Menu Loader ===
  fetch('floating-menu.html')
    .then(response => response.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (!container) return;

      container.innerHTML = html;

      const menuItems = container.querySelectorAll('.floating-menu .menu-item');
      menuItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.2}s`;
        item.classList.add('show'); // Optional JS-driven show animation
      });

      const currentPage = window.location.pathname.split('/').pop().toLowerCase().replace(/\s+/g, '-');

      container.querySelectorAll('.floating-menu a').forEach(link => {
        const href = link.getAttribute('href').toLowerCase().replace(/\s+/g, '-');
        if (href === currentPage) {
          link.classList.add('active');
        }
      });
    })
    .catch(error => console.error('Error loading floating menu:', error));

  // === Read More / Read Less Toggle for Author Bios ===
  const authorCards = document.querySelectorAll('.author-card');
  authorCards.forEach(card => {
    const bio = card.querySelector('.bio');
    const button = card.querySelector('.read-more-btn');

    if (!bio || !button) return;

    button.addEventListener('click', () => {
      card.classList.toggle('expanded');
      const expanded = card.classList.contains('expanded');
      button.textContent = expanded ? 'Read Less' : 'Read More';
    });
  });
});
