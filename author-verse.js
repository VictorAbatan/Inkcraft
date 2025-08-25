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
  const container = document.getElementById('verse-list');

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

  // Load verses for logged-in author
  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert('You must be logged in to view your verses.');
      window.location.href = 'login.html';
      return;
    }

    const q = query(collection(db, 'verses'), where('createdBy', '==', user.uid));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      container.innerHTML = `<p style="text-align:center; font-style:italic;">No verses created yet.</p>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const card = document.createElement('div');
      card.className = 'verse-card';

      // ✅ Fixed: match create-verse.js field name
      const coverImage = data.coverURL
        ? `<img src="${data.coverURL}" alt="${data.title} cover" class="verse-cover" />`
        : `<div class="verse-cover placeholder">No Image</div>`;

      card.innerHTML = `
        <div class="card-content">
          <h2>${data.title}</h2>
          ${coverImage}
          <p>${data.description || 'No description available.'}</p>
        </div>
        <div class="verse-actions">
          <a href="add-to-verse.html?verseId=${id}" class="btn btn-add">Add Content</a>
          <a href="edit-verse.html?id=${id}" class="btn btn-edit">Edit</a>
          <a href="verse-contents.html?id=${id}" class="btn btn-view">View Content</a>
        </div>
      `;

      container.appendChild(card);
    });
  });
});
