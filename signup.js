import { app } from './firebase-config.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  sendEmailVerification 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

  // === Password toggle logic (🙈 / 🙉) ===
  document.querySelectorAll('.password-container').forEach(container => {
    const input = container.querySelector('input');
    const toggleBtn = container.querySelector('.toggle-password');

    if (input && toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (input.type === "password") {
          input.type = "text";
          toggleBtn.textContent = "🙉";
        } else {
          input.type = "password";
          toggleBtn.textContent = "🙈";
        }
      });
    }
  });

  // === Custom Inkcraft alert ===
  function showAlert(message, type = "info") {
    const alertBox = document.createElement("div");
    alertBox.className = `inkcraft-alert ${type}`;
    alertBox.textContent = message;
    document.body.appendChild(alertBox);

    setTimeout(() => {
      alertBox.classList.add("show");
    }, 100);

    // Auto close after 4 seconds
    setTimeout(() => {
      alertBox.classList.remove("show");
      setTimeout(() => alertBox.remove(), 500);
    }, 4000);
  }

  // Handle sign-up form submission
  const form = document.getElementById('signup-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('signup-username').value.trim();
      const email = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value.trim();
      const confirmPassword = document.getElementById('signup-confirm-password').value.trim();

      if (!username || !email || !password || !confirmPassword) {
        showAlert("Please fill in all fields.", "error");
        return;
      }

      if (password !== confirmPassword) {
        showAlert("Passwords do not match.", "error");
        return;
      }

      try {
        const auth = getAuth(app);
        const db = getFirestore(app);

        // Create user account
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile document
        await setDoc(doc(db, "users", user.uid), {
          username,
          email,
          createdAt: new Date().toISOString(),
          profileImage: null
        });

        console.log("User signed up and profile created:", user);

        // ✅ Send verification email
        await sendEmailVerification(user, {
          handleCodeInApp: true,
          url: "https://inkcraft-6c0f6.firebaseapp.com/login.html"
        });

        showAlert(`Welcome to Inkcraft! A verification email has been sent to ${email}. Please verify your account.`, "success");

        // Redirect to login page
        setTimeout(() => {
          window.location.href = "login.html";
        }, 2500);

      } catch (error) {
        console.error("Signup error:", error.message);
        showAlert("Signup failed: " + error.message, "error");
      }
    });
  }
});
