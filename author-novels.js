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
      // Query approved novels
      const approvedQuery = query(collection(db, 'novels'), where("submittedBy", "==", user.uid));
      const approvedSnapshot = await getDocs(approvedQuery);

      // Query pending novels
      const pendingQuery = query(collection(db, 'pending_novels'), where("submittedBy", "==", user.uid));
      const pendingSnapshot = await getDocs(pendingQuery);

      novelsContainer.innerHTML = '';

      // Merge and deduplicate based on ID (last one wins)
      const novelMap = new Map();

      pendingSnapshot.forEach(doc => {
        novelMap.set(doc.id, { id: doc.id, data: doc.data() });
      });

      approvedSnapshot.forEach(doc => {
        novelMap.set(doc.id, { id: doc.id, data: doc.data() }); // Overwrites if duplicate
      });

      const allDocs = Array.from(novelMap.values());

      if (allDocs.length === 0) {
        novelsContainer.innerHTML = "<p>You haven't submitted any novels yet.</p>";
        return;
      }

      allDocs.forEach(({ id, data: novel }) => {
        const card = document.createElement('div');
        card.className = 'novel-card';

        // Determine status badge
        let statusBadge = '';
        if (novel.status === 'pending') {
          statusBadge = `<span class="badge pending">Pending</span>`;
        } else if (novel.status === 'published' || novel.status === 'approved') {
          statusBadge = `<span class="badge approved">Approved</span>`;
        }

        // Action buttons only if approved/published
        let actionButtons = '';
        if (novel.status === 'published' || novel.status === 'approved') {
          actionButtons = `
            <div class="novel-actions">
              <a href="edit-novel.html?novelId=${id}" class="edit-btn">Edit Book</a>
              <a href="chapter-upload.html?novelId=${id}" class="chapter-btn">Add Chapter</a>
            </div>
          `;
        }

        // Genre display: try array or fallback
        const genreDisplay = Array.isArray(novel.genres) ? novel.genres.join(', ') : (novel.genre || '—');

        card.innerHTML = `
          <img src="${novel.coverUrl || 'default-cover.jpg'}" alt="Cover of ${novel.title}" />
          <div class="novel-details">
            <h3>${novel.title}</h3>
            ${statusBadge}
            <p><strong>Genre:</strong> ${genreDisplay}</p>
            <p><strong>Tags:</strong> ${Array.isArray(novel.tags) ? novel.tags.join(', ') : '—'}</p>
            ${actionButtons}
          </div>
        `;

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
