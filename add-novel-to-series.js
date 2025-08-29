import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDocs,
  collection,
  query,
  where,
  updateDoc,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// === Wait for DOM ===
document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const seriesId = new URLSearchParams(window.location.search).get('id');
  const novelSelect = document.getElementById('novel-select');
  const form = document.getElementById('add-novel-form');

  // === Load Floating Menu ===
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;
        container.querySelectorAll('.menu-item').forEach((item, i) => {
          setTimeout(() => item.classList.add('show'), i * 100);
        });

        const path = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href').toLowerCase() === path) {
            link.classList.add('active');
          }
        });
      }
    });

  if (!seriesId) {
    alert('No series ID provided.');
    return;
  }

  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert('Please log in first.');
      window.location.href = 'login.html';
      return;
    }

    try {
      // Load all novels created by this user that are approved or published
      const novelsQuery = query(
        collection(db, 'novels'),
        where('authorId', '==', user.uid) // ✅ fixed from submittedBy → authorId
      );

      const snapshot = await getDocs(novelsQuery);
      const approvedNovels = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        // Accept both 'approved' and 'published' status
        if (data.status === 'approved' || data.status === 'published') {
          approvedNovels.push({ id: doc.id, title: data.title });
        }
      });

      if (approvedNovels.length === 0) {
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = 'No approved novels available.';
        novelSelect.appendChild(option);
        novelSelect.disabled = true;
        // Disable submit button if no novels
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        return;
      }

      approvedNovels.forEach(novel => {
        const option = document.createElement('option');
        option.value = novel.id;
        option.textContent = novel.title;
        novelSelect.appendChild(option);
      });

      // === Submit handler ===
      form.addEventListener('submit', async e => {
        e.preventDefault();

        const novelId = novelSelect.value;
        if (!novelId) {
          alert('Please select a novel.');
          return;
        }

        try {
          const seriesRef = doc(db, `series/${seriesId}`);
          await updateDoc(seriesRef, {
            novels: arrayUnion(novelId)
          });

          alert('Novel added to series successfully!');
          form.reset();
        } catch (err) {
          console.error('Error adding novel:', err);
          alert('Could not add novel. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error loading novels:', error);
      alert('Something went wrong.');
    }
  });
});
