import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  query,
  where,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const container = document.getElementById('series-list');

  // Load floating menu
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const menuContainer = document.getElementById('floating-menu-container');
      if (menuContainer) {
        menuContainer.innerHTML = html;

        const items = menuContainer.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 100);
        });

        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        menuContainer.querySelectorAll('a').forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.toLowerCase() === currentPath) {
            link.classList.add('active');
          }
        });
      }
    });

  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert('You must be logged in to view your series.');
      window.location.href = 'login.html';
      return;
    }

    const q = query(collection(db, 'series'), where('createdBy', '==', user.uid)); // ✅ updated collection name
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      if (container) {
        container.innerHTML = '<p style="text-align: center; font-style: italic;">No series found.</p>';
      }
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const card = document.createElement('div');
      card.className = 'series-card';

      // 🔼 Add image if available
      const coverImage = data.coverImageURL
        ? `<img src="${data.coverImageURL}" alt="Series Cover" class="series-cover" />`
        : '';

      card.innerHTML = `
        ${coverImage}
        <h2>${data.title}</h2>
        <p>${data.description}</p>
        <div class="series-actions">
          <a href="edit-series.html?id=${id}" class="btn btn-edit">Edit Series</a>
          <a href="add-novel-to-series.html?id=${id}" class="btn btn-add-novel">Add Novel</a>
        </div>
      `;
      container.appendChild(card);
    });
  });
});
