import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const form = document.getElementById('settings-form');
  const emailInput = document.getElementById('email');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const message = document.getElementById('message');

  let currentUser = null;

  // Load dark mode preference from localStorage
  const savedDarkMode = localStorage.getItem('inkcraft-dark-mode');
  if (savedDarkMode === 'enabled') {
    document.body.classList.add('dark-mode');
    if (darkModeToggle) darkModeToggle.checked = true;
  }

  // Toggle dark mode on checkbox change
  if (darkModeToggle) {
    darkModeToggle.addEventListener('change', () => {
      if (darkModeToggle.checked) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('inkcraft-dark-mode', 'enabled');
      } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('inkcraft-dark-mode', 'disabled');
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      alert("Please log in.");
      window.location.href = 'login.html';
      return;
    }

    currentUser = user;
    emailInput.value = user.email;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    message.textContent = 'Settings saved.';
    message.style.color = 'lightgreen';
  });

  // Floating menu loading
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;

        const items = container.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 300);
        });

        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href')?.toLowerCase() === currentPath) {
            link.classList.add('active');
          }
        });
      }
    })
    .catch(err => console.error("Failed to load floating menu:", err));
});
