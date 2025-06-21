document.addEventListener('DOMContentLoaded', () => {
  fetch('floating-menu.html')
    .then(response => response.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (!container) return;

      container.innerHTML = html;

      const menuItems = container.querySelectorAll('.floating-menu .menu-item');
      menuItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.2}s`;
        item.classList.add('show'); // Optional: add this class if you want to use JS-driven show animation
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
});
