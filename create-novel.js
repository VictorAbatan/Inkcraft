import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);

  const form = document.getElementById('create-novel-form');
  const coverInput = document.getElementById('cover');
  const coverPreview = document.getElementById('cover-preview');
  const submitBtn = document.getElementById('submit-btn');

  // Ensure a message box exists
  let messageBox = document.getElementById('submission-message');
  if (!messageBox) {
    messageBox = document.createElement('div');
    messageBox.id = 'submission-message';
    messageBox.style.cssText = 'margin-top: 1rem; color: lightgreen; display: none;';
    form.appendChild(messageBox);
  }

  // Show preview of cover image
  coverInput.addEventListener('change', () => {
    const file = coverInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        coverPreview.src = e.target.result;
        coverPreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  // Enable the submit button only when form is valid
  form.addEventListener('input', () => {
    const requiredFields = ['title', 'genre', 'synopsis'];
    const isValid = requiredFields.every(id => document.getElementById(id).value.trim()) &&
      coverInput.files.length > 0;
    submitBtn.disabled = !isValid;
  });

  // Track authenticated user
  let currentUser = null;

  onAuthStateChanged(auth, user => {
    if (!user) {
      alert("You must be logged in to submit a novel.");
      window.location.href = 'login.html';
      return;
    }
    currentUser = user;
  });

  // Submit handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) {
      alert("You must be logged in.");
      return;
    }

    const title = document.getElementById('title').value.trim();
    const genre = document.getElementById('genre').value;
    const tags = document.getElementById('tags').value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
    const synopsis = document.getElementById('synopsis').value.trim();
    const coverFile = coverInput.files[0];
    const coverUrl = coverPreview.src;

    const novelData = {
      title,
      genre,
      tags,
      synopsis,
      coverUrl,
      status: 'pending',
      submittedBy: currentUser.uid,
      submittedAt: serverTimestamp()
    };

    const novelId = `novel_${Date.now()}`;

    try {
      // <-- UPDATED collection name here:
      await setDoc(doc(db, 'pending_novels', novelId), novelData);

      form.reset();
      coverPreview.style.display = 'none';
      submitBtn.disabled = true;
      messageBox.textContent = '✅ Novel submitted! Await admin approval.';
      messageBox.style.display = 'block';
    } catch (error) {
      console.error("Error submitting novel:", error);
      alert("Something went wrong while submitting.");
    }
  });

  // Load floating menu
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
          if (link.getAttribute('href').toLowerCase() === currentPath) {
            link.classList.add('active');
          }
        });
      }
    });
});
