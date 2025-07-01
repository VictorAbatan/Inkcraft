import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

// === Wait for DOM ===
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
  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert('You must be logged in to edit a series.');
      window.location.href = 'login.html';
      return;
    }

    const uid = user.uid;
    const params = new URLSearchParams(window.location.search);
    const seriesId = params.get('id');
    const form = document.getElementById('edit-series-form');
    const titleInput = document.getElementById('series-title');
    const descInput = document.getElementById('series-description');
    const coverInput = document.getElementById('series-cover');
    const previewImg = document.getElementById('cover-preview');

    if (!seriesId) {
      alert('No series ID found in URL.');
      return;
    }

    // === Load Series Data ===
    try {
      const seriesRef = doc(db, `series/${seriesId}`);
      const seriesSnap = await getDoc(seriesRef);

      if (!seriesSnap.exists()) {
        alert('Series not found.');
        return;
      }

      const series = seriesSnap.data();

      if (series.createdBy !== uid) {
        alert('You do not have permission to edit this series.');
        return;
      }

      titleInput.value = series.title || '';
      descInput.value = series.description || '';

      if (series.coverImageURL) {
        previewImg.src = series.coverImageURL;
        previewImg.style.display = 'block';
      }
    } catch (error) {
      console.error('Error loading series:', error);
      alert('Failed to load series data.');
    }

    // === Submit Handler ===
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const title = titleInput.value.trim();
      const description = descInput.value.trim();
      const newCover = coverInput.files[0];

      if (!title || !description) {
        alert('Please fill in all fields.');
        return;
      }

      try {
        const seriesRef = doc(db, `series/${seriesId}`);
        const updateData = { title, description };

        if (newCover) {
          const coverPath = `series_covers/${uid}_${Date.now()}_${newCover.name}`;
          const storageRef = ref(storage, coverPath);
          await uploadBytes(storageRef, newCover);
          const coverURL = await getDownloadURL(storageRef);
          updateData.coverImageURL = coverURL;
        }

        await updateDoc(seriesRef, updateData);
        alert('Series updated successfully!');
        form.reset();
      } catch (err) {
        console.error('Error updating series:', err);
        alert('Something went wrong. Please try again.');
      }
    });
  });
});
