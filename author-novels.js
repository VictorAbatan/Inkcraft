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

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("Please log in to view your novels.");
      window.location.href = 'login.html';
      return;
    }

    try {
      const q = query(collection(db, 'novels'), where("submittedBy", "==", user.uid));
      const snapshot = await getDocs(q);
      novelsContainer.innerHTML = '';

      if (snapshot.empty) {
        novelsContainer.innerHTML = "<p>You haven't submitted any novels yet.</p>";
        return;
      }

      snapshot.forEach(doc => {
        const novel = doc.data();
        const id = doc.id;

        const card = document.createElement('div');
        card.className = 'novel-card';

        // Status badge
        let statusBadge = '';
        if (novel.status === 'pending') {
          statusBadge = `<span class="badge pending">Pending</span>`;
        } else if (novel.status === 'published') {
          statusBadge = `<span class="badge approved">Approved</span>`;
        }

        // Action buttons (only when approved)
        let actionButtons = '';
        if (novel.status === 'published') {
          actionButtons = `
            <div class="novel-actions">
              <button class="edit-btn" data-id="${id}">Edit Book</button>
              <button class="chapter-btn" data-id="${id}">Add Chapter</button>
            </div>
          `;
        }

        card.innerHTML = `
          <img src="${novel.coverUrl || 'default-cover.jpg'}" alt="Cover of ${novel.title}" />
          <div class="novel-details">
            <h3>${novel.title}</h3>
            ${statusBadge}
            <p><strong>Genre:</strong> ${novel.genre}</p>
            <p><strong>Tags:</strong> ${Array.isArray(novel.tags) ? novel.tags.join(', ') : '—'}</p>
            ${actionButtons}
          </div>
        `;

        // Add chapter button behavior
        card.querySelectorAll('.chapter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            window.location.href = `chapter-upload.html?novelId=${id}`;
          });
        });

        // Edit book button behavior
        card.querySelectorAll('.edit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            // 🔧 Future: open edit-novel.html
            window.location.href = `edit-novel.html?novelId=${id}`;
          });
        });

        novelsContainer.appendChild(card);
      });

    } catch (error) {
      console.error("Error loading novels:", error);
      novelsContainer.innerHTML = "<p>Something went wrong while loading your novels.</p>";
    }
  });

  // 📌 Load Floating Menu
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
