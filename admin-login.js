import { app } from './firebase-config.js';
import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const message = document.getElementById('login-message');

  const auth = getAuth(app);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const tokenResult = await userCredential.user.getIdTokenResult();

    if (tokenResult.claims.admin) {
      message.textContent = 'Login successful!';
      window.location.href = 'admin-dashboard.html';
    } else {
      message.textContent = 'Access denied. Not an admin.';
    }
  } catch (error) {
    console.error(error);
    message.textContent = 'Login failed: ' + error.message;
  }
});
