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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const storage = getStorage(app);

  // === Load Floating Menu ===
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;

        const items = container.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 300); // 300ms between items
        });

        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href').toLowerCase() === currentPath) {
            link.classList.add('active');
          }
        });
      }
    });

  // === Auth Protection ===
  onAuthStateChanged(auth, user => {
    if (!user) {
      alert('You must be logged in to access this page.');
      window.location.href = 'login.html';
      return;
    }

    const uid = user.uid;
    const form = document.getElementById('verse-form');

    // === Cover Image Preview ===
    const imageInput = document.getElementById('cover');
    const preview = document.getElementById('cover-preview');

    if (imageInput && preview) {
      imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
          const url = URL.createObjectURL(file);
          preview.src = url;
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
        }
      });
    }

    // === Form Submit Handler ===
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('title').value.trim();
      const description = document.getElementById('description').value.trim();
      const file = imageInput.files[0];

      if (!title || !description || !file) {
        alert('Please complete all required fields.');
        return;
      }

      try {
        // ✅ Validate file before upload
        if (!(file instanceof File)) throw new Error('Invalid file.');

        // Upload cover image
        const storageRef = ref(storage, `verse-covers/${uid}/${Date.now()}-${file.name}`);
        await uploadBytes(storageRef, file);
        const coverURL = await getDownloadURL(storageRef);

        // Save verse to Firestore
        const verseData = {
          title,
          description,
          coverURL,
          authorId: uid,
          createdBy: uid,
          createdAt: serverTimestamp(),
          status: 'pending' // optional: can be changed to 'published' if you want auto-approved
        };

        const docId = `verse_${uid}_${Date.now()}`; 
        const verseRef = doc(db, "verses", docId);  // ✅ Authors can now freely create

        // ✅ Ensure we catch Firestore-specific errors
        await setDoc(verseRef, verseData);

        alert('Verse created successfully');
        form.reset();
        preview.style.display = 'none';

      } catch (error) {
        console.error('Error submitting verse:', error);

        // ✅ Provide more context to user
        if (error.code === 'permission-denied') {
          alert('You do not have permission to submit a verse.');
        } else if (error.message.includes('network')) {
          alert('Network error. Please check your connection and try again.');
        } else {
          alert('Submission failed. Please try again.');
        }
      }
    });
  });
});
