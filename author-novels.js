import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const novelsContainer = document.getElementById('novels-container');

  // 👤 Auth state change
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("Please log in to view your novels.");
      window.location.href = 'login.html';
      return;
    }

    try {
    const q = query(
  collection(db, 'novels'),
  where("submittedBy", "==", user.uid)
);


      const snapshot = await getDocs(q);

      novelsContainer.innerHTML = '';

      if (snapshot.empty) {
        novelsContainer.innerHTML = "<p>You don't have any approved novels yet.</p>";
        return;
      }

      snapshot.forEach(doc => {
        const novel = doc.data();
        const card = document.createElement('div');
        card.className = 'novel-card';
        card.innerHTML = `
          <img src="${novel.coverUrl}" alt="Cover of ${novel.title}" />
          <div class="novel-details">
            <h3>${novel.title}</h3>
            <p><strong>Genre:</strong> ${novel.genre}</p>
            <p><strong>Tags:</strong> ${Array.isArray(novel.tags) ? novel.tags.join(', ') : '—'}</p>
            <p><strong>Status:</strong> ${novel.status || 'N/A'}</p>
          </div>
        `;
        novelsContainer.appendChild(card);
      });

    } catch (error) {
      console.error("Error loading novels:", error);
      novelsContainer.innerHTML = "<p>Something went wrong while loading your novels.</p>";
    }
  });

  // 📌 Floating Menu Loader
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
    })
    .catch(err => {
      console.error("Failed to load floating menu:", err);
    });
});
