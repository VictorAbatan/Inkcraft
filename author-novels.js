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
  const novelContainer = document.getElementById('novels-container'); // ✅ fixed ID

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("Please log in to view your novels.");
      window.location.href = 'login.html';
      return;
    }

    try {
      // 🔍 Fetch novels created by this author
      const novelQuery = query(collection(db, 'novels'), where("authorId", "==", user.uid));
      const novelSnapshot = await getDocs(novelQuery);

      novelContainer.innerHTML = '';

      if (novelSnapshot.empty) {
        novelContainer.innerHTML = "<p>You haven't created any novels yet.</p>";
        return;
      }

      novelSnapshot.forEach(doc => {
        const novel = doc.data();
        const id = doc.id;

        const card = document.createElement('div');
        card.className = 'novel-card';

        card.innerHTML = `
          <img src="${novel.coverUrl || 'default-novel-cover.jpg'}" alt="Cover of ${novel.title}" class="novel-cover cover-click" data-id="${id}" />
          <div class="novel-details">
            <h3 class="title-click" data-id="${id}">${novel.title || 'Untitled Novel'}</h3>
            <p><strong>Description:</strong> ${novel.synopsis ? novel.synopsis.substring(0, 150) + (novel.synopsis.length > 150 ? '...' : '') : 'No synopsis available.'}</p>
          </div>
        `;

        // 📌 Clicking cover or title → Chapter upload page instead of novel details
        card.querySelectorAll('.cover-click, .title-click').forEach(el => {
          el.addEventListener('click', () => {
            window.location.href = `chapter-upload.html?novelId=${id}`;
          });
        });

        novelContainer.appendChild(card);
      });

    } catch (error) {
      console.error("Error loading novels:", error);
      novelContainer.innerHTML = "<p>Something went wrong while loading your novels.</p>";
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
