import { app } from './firebase-config.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword 
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
          toggleBtn.textContent = "🙉"; // monkey with hands over ears
        } else {
          input.type = "password";
          toggleBtn.textContent = "🙈"; // monkey with hands over eyes
        }
      });
    }
  });

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
        alert("Please fill in all fields.");
        return;
      }

      if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
      }

      try {
        const auth = getAuth(app);
        const db = getFirestore(app);

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile document
        await setDoc(doc(db, "users", user.uid), {
          username,
          email,
          createdAt: new Date().toISOString(),
          profileImage: null // placeholder for now
        });

        alert("Sign-up successful!");
        console.log("User signed up and profile created:", user);

        // Redirect to login or dashboard
        window.location.href = "login.html";
      } catch (error) {
        console.error("Signup error:", error.message);
        alert("Signup failed: " + error.message);
      }
    });
  }
});
