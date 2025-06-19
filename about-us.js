document.addEventListener('DOMContentLoaded', () => {
  fetch('floating-menu.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;

      requestAnimationFrame(() => {
        const currentPage = window.location.pathname.split('/').pop().toLowerCase().replace(/\s+/g, '-');

        document.querySelectorAll('.floating-menu a').forEach(link => {
          const href = link.getAttribute('href').toLowerCase().replace(/\s+/g, '-');
          if (href === currentPage) {
            link.classList.add('active');
          }
        });
      });
    });
});
