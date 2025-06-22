import { app } from './firebase-config.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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
          const container = document.getElementById('floating-menu-container');
          if (container) {
            container.appendChild(menu);
          } else {
            document.body.appendChild(menu); // fallback
          }

          requestAnimationFrame(() => {
            menu.classList.add('animated');
          });

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

  // === Login Form Validation + Firebase Sign-in ===
  const form = document.querySelector('form');
  if (form) {
    const emailInput = form.querySelector('input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');
    if (emailInput && !emailInput.id) emailInput.id = 'email';
    if (passInput && !passInput.id) passInput.id = 'password';
    form.id = 'login-form';

    form.addEventListener('submit', async e => {
      e.preventDefault();

      const email = document.getElementById('email');
      const password = document.getElementById('password');

      if (!email.value.trim() || !password.value.trim()) {
        alert('Please fill in all fields.');
        return;
      }

      try {
        const auth = getAuth(app);
        const userCredential = await signInWithEmailAndPassword(auth, email.value.trim(), password.value.trim());
        const user = userCredential.user;

        // ✅ Check if user is admin
        const tokenResult = await getIdTokenResult(user);
        const isAdmin = tokenResult.claims.admin === true;

        alert('Login successful!');
        console.log('User logged in:', user);

        // Redirect based on role
        if (isAdmin) {
          window.location.href = 'admin-dashboard.html';
        } else {
          window.location.href = 'Inkcraftmain.html';
        }
      } catch (error) {
        console.error('Login error:', error.message);
        alert('Login failed: ' + error.message);
      }
    });
  }
});
