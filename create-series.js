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

// === Wait for DOM ===
document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const storage = getStorage(app); // ✅ Initialize storage

  // === Load Author Floating Menu ===
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;

        const items = container.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 100);
        });

        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href').toLowerCase() === currentPath) {
            link.classList.add('active');
          }
        });
      }
    });

  // === Auth Check ===
  onAuthStateChanged(auth, user => {
    if (!user) {
      alert('You must be logged in to create a series.');
      window.location.href = 'login.html';
      return;
    }

    const uid = user.uid;
    const form = document.getElementById('series-form');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('series-title').value.trim();
        const description = document.getElementById('series-description').value.trim();
        const coverFile = document.getElementById('series-cover').files[0];

        if (!title || !description) {
          alert('Please fill in all required fields.');
          return;
        }

        try {
          let coverUrl = '';

          if (coverFile) {
            const storageRef = ref(storage, `series_covers/${uid}_${Date.now()}_${coverFile.name}`);
            await uploadBytes(storageRef, coverFile);
            coverUrl = await getDownloadURL(storageRef);
          }

          const seriesData = {
            title,
            description,
            createdBy: uid,
            ownerId: uid, // ✅ Required for Firestore update permissions
            createdAt: serverTimestamp(),
            novels: [],
            coverImageURL: coverUrl || '' // ✅ updated field name
          };

          const docId = `${uid}_${Date.now()}`;
          const seriesRef = doc(db, `series/${docId}`); // ✅ corrected collection path
          await setDoc(seriesRef, seriesData);

          alert('Series created successfully! You can now add novels to it.');
          form.reset();
        } catch (error) {
          console.error('Error creating series:', error);
          alert('Something went wrong. Please try again.');
        }
      });
    }
  });
});
