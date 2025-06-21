import { app } from './firebase-config.js';
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.addEventListener('DOMContentLoaded', () => {
  // Dynamically load the floating menu
  fetch('floating-menu.html')
    .then(response => response.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;

        // Animate items after they are rendered
        const menuItems = container.querySelectorAll('.floating-menu .menu-item');
        menuItems.forEach((item, index) => {
          setTimeout(() => {
            item.classList.add('show');
          }, index * 100);
        });

        // Highlight the active link
        const currentPage = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('.floating-menu a').forEach(link => {
          const href = link.getAttribute('href').toLowerCase();
          if (href === currentPage) {
            link.classList.add('active');
          }
        });
      } else {
        console.warn('Floating menu container not found.');
      }
    })
    .catch(error => console.error('Error loading floating menu:', error));

  // Handle sign-up form submission
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = form.querySelector('input[type="email"]').value.trim();
      const password = form.querySelector('input[type="password"]').value.trim();

      if (!email || !password) {
        alert("Please fill in both email and password.");
        return;
      }

      try {
        const auth = getAuth(app);
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        alert("Sign-up successful!");
        console.log("User signed up:", user);

        // Redirect to login or dashboard
        window.location.href = "login.html";
      } catch (error) {
        console.error("Signup error:", error.message);
        alert("Signup failed: " + error.message);
      }
    });
  }
});
