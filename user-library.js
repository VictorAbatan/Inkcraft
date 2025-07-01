import { app, db } from './firebase-config.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      container.innerHTML = html;

      // ✅ Highlight active page
      const currentPage = window.location.pathname.split('/').pop();
      container.querySelectorAll('.floating-menu a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
          link.classList.add('active');
        }
      });

      // ✅ Logout handling
      const logoutBtn = container.querySelector('#logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await signOut(auth);
          window.location.href = 'login.html';
        });
      }
    });

  // Wait for auth state
  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert("You must be logged in to view your library.");
      window.location.href = 'login.html';
      return;
    }

    try {
      const libraryRef = collection(db, 'users', user.uid, 'library');
      const librarySnap = await getDocs(libraryRef);

      const grid = document.getElementById('libraryGrid');
      const emptyMessage = document.getElementById('emptyMessage');

      if (librarySnap.empty) {
        emptyMessage.style.display = 'block';
        return;
      }

      emptyMessage.style.display = 'none';

      let index = 0;
      for (const docSnap of librarySnap.docs) {
        const novelId = docSnap.id;
        const novelRef = doc(db, 'novels', novelId);
        const novelSnap = await getDoc(novelRef);

        if (novelSnap.exists()) {
          const novel = novelSnap.data();
          const card = document.createElement('div');
          card.className = 'novel-card';
          card.style.animationDelay = `${index * 100}ms`;
          card.innerHTML = `
            <img src="${novel.cover || novel.coverUrl || 'default-cover.jpg'}" alt="Cover" />
            <h3>${novel.title || 'Untitled'}</h3>
            <a href="novel-details.html?novelId=${novelId}">View Details</a>
          `;
          grid.appendChild(card);
          index++;
        }
      }
    } catch (err) {
      console.error('Error loading library:', err);
      document.getElementById('emptyMessage').textContent = 'Failed to load your library.';
      document.getElementById('emptyMessage').style.display = 'block';
    }
  });
});
