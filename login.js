document.addEventListener('DOMContentLoaded', () => {
  // === Floating Menu Loader ===
  const loadFloatingMenu = () => {
    fetch('floating-menu.html')
      .then(res => res.text())
      .then(html => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const menu = temp.firstElementChild;
        if (menu) {
          // Append into the placeholder container
          const container = document.getElementById('floating-menu-container');
          if (container) {
            container.appendChild(menu);
          } else {
            document.body.appendChild(menu); // fallback
          }

          // Animate after next frame
          requestAnimationFrame(() => {
            menu.classList.add('animated');
          });

          // === Highlight Current Page Menu Item ===
          const currentPath = window.location.pathname.split('/').pop();
          const items = menu.querySelectorAll('.menu-item');
          items.forEach(item => {
            const href = item.getAttribute('href');
            if (href === currentPath) {
              item.classList.add('active');
            }
          });
        }
      })
      .catch(err => {
        console.error('Failed to load floating menu:', err);
      });
  };

  loadFloatingMenu();

  // === Login Form Validation ===
  const form = document.querySelector('form');
  if (form) {
    const emailInput = form.querySelector('input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');
    if (emailInput && !emailInput.id) emailInput.id = 'email';
    if (passInput && !passInput.id) passInput.id = 'password';
    form.id = 'login-form';

    form.addEventListener('submit', e => {
      const email = document.getElementById('email');
      const password = document.getElementById('password');

      if (!email.value.trim() || !password.value.trim()) {
        alert('Please fill in all fields.');
        e.preventDefault();
      }
    });
  }
});
