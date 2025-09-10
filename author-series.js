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
  console.log('[DEBUG] DOMContentLoaded fired');

  const auth = getAuth(app);
  const container = document.getElementById('series-list');
  console.log('[DEBUG] series-list container:', container);

  // Load floating menu
  fetch('author-floating-menu.html')
    .then(res => {
      console.log('[DEBUG] Fetching author-floating-menu.html, status:', res.status);
      return res.text();
    })
    .then(html => {
      const menuContainer = document.getElementById('floating-menu-container');
      console.log('[DEBUG] floating-menu-container:', menuContainer);
      if (menuContainer) {
        menuContainer.innerHTML = html;
        console.log('[DEBUG] Floating menu injected');

        const items = menuContainer.querySelectorAll('.menu-item');
        console.log('[DEBUG] Floating menu items found:', items.length);
        items.forEach((item, index) => {
          setTimeout(() => {
            item.classList.add('show');
            console.log(`[DEBUG] Menu item ${index} shown`);
          }, index * 100);
        });

        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        console.log('[DEBUG] Current path:', currentPath);
        menuContainer.querySelectorAll('a').forEach(link => {
          const href = link.getAttribute('href');
          if (href && href.toLowerCase() === currentPath) {
            link.classList.add('active');
            console.log('[DEBUG] Active link set:', href);
          }
        });
      }
    })
    .catch(err => console.error('[ERROR] Fetch menu failed:', err));

  onAuthStateChanged(auth, async user => {
    console.log('[DEBUG] onAuthStateChanged fired. User:', user);

    if (!user) {
      alert('You must be logged in to view your series.');
      window.location.href = 'login.html';
      return;
    }

    try {
      console.log('[DEBUG] Querying series for user:', user.uid);
      const q = query(collection(db, 'series'), where('createdBy', '==', user.uid));
      const snapshot = await getDocs(q);
      console.log('[DEBUG] Query snapshot size:', snapshot.size);

      if (snapshot.empty) {
        console.log('[DEBUG] No series found for this user');
        if (container) {
          container.innerHTML = '<p style="text-align: center; font-style: italic;">No series found.</p>';
        }
        return;
      }

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const id = docSnap.id;
        console.log('[DEBUG] Rendering series doc:', id, data);

        const card = document.createElement('div');
        card.className = 'series-card';

        const coverImage = data.coverImageURL
          ? `<img src="${data.coverImageURL}" alt="Series Cover" class="series-cover" />`
          : '';

        card.innerHTML = `
          ${coverImage}
          <div class="card-content">
            <h2>${data.title}</h2>
            <p class="series-description">${data.description}</p>
            <span class="read-more">Read more</span>
          </div>
          <div class="series-actions">
            <a href="edit-series.html?id=${id}" class="btn btn-edit">Edit</a>
            <a href="add-novel-to-series.html?id=${id}" class="btn btn-add-novel">Add Novel</a>
            <a href="series-novels.html?id=${id}" class="btn btn-view">View Novels</a>
          </div>
        `;
        container.appendChild(card);

        // ✅ Scoped Read more / Read less toggle
        const desc = card.querySelector('.series-description');
        const toggle = card.querySelector('.read-more');

        if (desc && toggle) {
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const expanded = desc.classList.toggle('expanded');
            toggle.textContent = expanded ? 'Read less' : 'Read more';
            console.log('[DEBUG] Toggled description for series:', id, 'Expanded:', expanded);
          });
        }
      });
    } catch (err) {
      console.error('[ERROR] Firestore query failed:', err);
    }
  });
});
