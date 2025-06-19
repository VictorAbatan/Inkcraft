document.addEventListener('DOMContentLoaded', () => {
  // Dynamically load the floating menu
  fetch('floating-menu.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;

      // Highlight the current page's menu item
      const currentPage = window.location.pathname.split('/').pop();
      document.querySelectorAll('.floating-menu a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
          link.classList.add('active');
        }
      });
    });
});
