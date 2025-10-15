import { app } from './firebase-config.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  getIdTokenResult,
  sendPasswordResetEmail
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

  // === Inkcraft Custom Alert with Slide + Loading ===
  function showInkcraftAlert(message, type = 'info') {
    // Remove existing alert
    const oldAlert = document.querySelector('.inkcraft-alert');
    if (oldAlert) oldAlert.remove();

    // Create alert
    const alertBox = document.createElement('div');
    alertBox.className = `inkcraft-alert ${type}`;
    alertBox.innerHTML = `
      <span class="alert-message">${message}</span>
      ${type === 'loading' ? '<div class="loading-bar"></div>' : ''}
    `;
    document.body.appendChild(alertBox);

    // Slide in
    requestAnimationFrame(() => alertBox.classList.add('show'));

    return alertBox;
  }

  // === Login Form Validation + Firebase Sign-in ===
  const form = document.querySelector('form');
  if (form) {
    const emailInput = form.querySelector('input[type="email"]');
    const passInput = form.querySelector('input[type="password"]');
    if (emailInput && !emailInput.id) emailInput.id = 'email';
    if (passInput && !passInput.id) passInput.id = 'password';
    form.id = 'login-form';

    // === Password Toggle 🙈 / 🙉 ===
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.classList.add('toggle-eye');
    toggleBtn.textContent = '🙈';
    passInput.parentElement.classList.add('password-container');
    passInput.parentElement.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', () => {
      if (passInput.type === 'password') {
        passInput.type = 'text';
        toggleBtn.textContent = '🙉';
      } else {
        passInput.type = 'password';
        toggleBtn.textContent = '🙈';
      }
    });

    // === Forgot Password Link ===
    const forgotLink = document.getElementById('forgot-password-link');
    if (forgotLink) {
      forgotLink.addEventListener('click', async e => {
        e.preventDefault();

        if (!emailInput) {
          showInkcraftAlert("Email input not found!", "error");
          return;
        }

        const emailVal = emailInput.value.trim();
        if (!emailVal) {
          showInkcraftAlert("Please enter your email first to reset your password.", "warning");
          return;
        }

        try {
          const auth = getAuth(app);
          console.log("Attempting password reset for:", emailVal);
          await sendPasswordResetEmail(auth, emailVal);
          showInkcraftAlert("Password reset email sent! Check your inbox or spam folder.", "success");
        } catch (err) {
          console.error("Password reset error:", err);
          if (err.code === 'auth/user-not-found') {
            showInkcraftAlert("No account found with this email.", "error");
          } else if (err.code === 'auth/invalid-email') {
            showInkcraftAlert("Invalid email address.", "error");
          } else {
            showInkcraftAlert("Failed to send reset email: " + err.message, "error");
          }
        }
      });
    }

    // === Login Submission ===
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const email = document.getElementById('email');
      const password = document.getElementById('password');

      if (!email.value.trim() || !password.value.trim()) {
        showInkcraftAlert('Please fill in all fields.', 'warning');
        return;
      }

      const auth = getAuth(app);
      const alert = showInkcraftAlert('Logging in...', 'loading'); // show loading alert

      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email.value.trim(),
          password.value.trim()
        );
        const user = userCredential.user;

        // ✅ Check if user is admin
        const tokenResult = await getIdTokenResult(user);
        const isAdmin = tokenResult.claims.admin === true;

        // Change alert to success (green transition)
        alert.classList.remove('loading');
        alert.classList.add('success');
        alert.innerHTML = `<span class="alert-message">Login successful!</span>`;

        // Smooth fade and slide out after short delay
        setTimeout(() => {
          alert.classList.remove('show');
          setTimeout(() => alert.remove(), 400);
        }, 1200);

        console.log('User logged in:', user);

        // Redirect
        setTimeout(() => {
          if (isAdmin) {
            window.location.href = 'admin-dashboard.html';
          } else {
            window.location.href = 'Inkcraftmain.html';
          }
        }, 1500);
      } catch (error) {
        console.error('Login error:', error.message);
        alert.classList.remove('loading');
        alert.classList.add('error');
        alert.innerHTML = `<span class="alert-message">Login failed: ${error.message}</span>`;
        setTimeout(() => {
          alert.classList.remove('show');
          setTimeout(() => alert.remove(), 400);
        }, 2000);
      }
    });
  }
});
