import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
  doc, getDoc, collection, getDocs, query, where 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { initNotificationBadge } from './notifications.js';

const storage = getStorage();
const fallbackAuthorAvatar = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
const fallbackNovelCover = 'https://via.placeholder.com/150x220?text=No+Novel+Cover';
const fallbackSeriesCover = 'https://via.placeholder.com/300x400?text=No+Series+Cover';
const fallbackVerseCover = 'https://via.placeholder.com/300x400?text=No+Verse+Cover';

document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
  fetch('author-floating-menu.html')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response.text();
    })
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (!container) return;

      container.innerHTML = html;

      const menuItems = container.querySelectorAll('.floating-menu .menu-item');
      menuItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.2}s`;
        item.classList.add('show');
      });

      const currentPage = window.location.pathname.split('/').pop().toLowerCase();

      container.querySelectorAll('.floating-menu a').forEach(link => {
        const href = link.getAttribute('href').toLowerCase();
        if (href === currentPage) {
          link.classList.add('active');
        }
      });
    })
    .catch(error => console.error('Error loading floating menu:', error));

  // === Profile pic & pen name load ===
  const profilePicElement = document.getElementById('author-profile-pic');
  const penNameElement = document.getElementById('author-pen-name');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html'; // redirect if not logged in
      return;
    }

    try {
      // --- Load author info from 'authors' collection ---
      let authorData = null;

      const authorRef = doc(db, 'authors', user.uid);
      const authorSnap = await getDoc(authorRef);

      if (authorSnap.exists()) {
        authorData = authorSnap.data();
      } else {
        const q = query(collection(db, 'authors'), where('email', '==', user.email));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          authorData = querySnap.docs[0].data();
        }
      }

      if (authorData) {
        if (penNameElement) penNameElement.textContent = authorData.penName?.trim() || "Unknown Author";

        // ✅ Load author profile pic with Storage fallback
        if (profilePicElement) {
          let photoURL = fallbackAuthorAvatar;
          if (authorData.profilePicPath) {
            try {
              photoURL = await getDownloadURL(ref(storage, authorData.profilePicPath));
            } catch {
              photoURL = authorData.photoURL || authorData.profileImage || fallbackAuthorAvatar;
            }
          } else {
            photoURL = authorData.photoURL || authorData.profileImage || fallbackAuthorAvatar;
          }
          profilePicElement.src = photoURL;
        }
      } else {
        if (penNameElement) penNameElement.textContent = 'Unknown Author';
        if (profilePicElement) profilePicElement.src = fallbackAuthorAvatar;
      }

      // --- Load approved novels ---
      const novelsQuery = query(collection(db, 'novels'), where('submittedBy', '==', user.uid));
      const novelsSnap = await getDocs(novelsQuery);
      const novelsContainer = document.getElementById('author-novels-container');
      if (novelsContainer) {
        novelsContainer.innerHTML = '';
        for (const docSnap of novelsSnap.docs) {
          const novel = docSnap.data();
          const div = document.createElement('div');
          div.className = 'author-novel-item';

          // ✅ Novel cover image with Storage fallback
          let coverURL = fallbackNovelCover;
          if (novel.coverPath) {
            try {
              coverURL = await getDownloadURL(ref(storage, novel.coverPath));
            } catch {
              coverURL = novel.cover || novel.coverUrl || fallbackNovelCover;
            }
          } else {
            coverURL = novel.cover || novel.coverUrl || fallbackNovelCover;
          }

          div.innerHTML = `<img src="${coverURL}" alt="Novel Cover" /><h3>${novel.title}</h3>`;
          novelsContainer.appendChild(div);
        }
      }

      // --- Load series ---
      const seriesQuery = query(collection(db, 'series'), where('createdBy', '==', user.uid));
      const seriesSnap = await getDocs(seriesQuery);
      const seriesContainer = document.getElementById('author-series-container');
      if (seriesContainer) {
        seriesContainer.innerHTML = '';
        for (const docSnap of seriesSnap.docs) {
          const series = docSnap.data();
          const div = document.createElement('div');
          div.className = 'author-series-item';

          // ✅ Series cover image with Storage fallback
          let coverURL = fallbackSeriesCover;
          if (series.coverImagePath) {
            try {
              coverURL = await getDownloadURL(ref(storage, series.coverImagePath));
            } catch {
              coverURL = series.coverImage || fallbackSeriesCover;
            }
          } else {
            coverURL = series.coverImage || fallbackSeriesCover;
          }

          div.innerHTML = `<img src="${coverURL}" alt="Series Cover" /><h3>${series.title}</h3>`;
          seriesContainer.appendChild(div);
        }
      }

      // --- Load verses ---
      const versesQuery = query(collection(db, 'verses'), where('createdBy', '==', user.uid));
      const versesSnap = await getDocs(versesQuery);
      const versesContainer = document.getElementById('author-verses-container');
      if (versesContainer) {
        versesContainer.innerHTML = '';
        for (const docSnap of versesSnap.docs) {
          const verse = docSnap.data();
          const div = document.createElement('div');
          div.className = 'author-verse-item';

          // ✅ Verse cover image with Storage fallback
          let coverURL = fallbackVerseCover;
          if (verse.coverPath) {
            try {
              coverURL = await getDownloadURL(ref(storage, verse.coverPath));
            } catch {
              coverURL = fallbackVerseCover;
            }
          } else {
            coverURL = fallbackVerseCover;
          }

          div.innerHTML = `<img src="${coverURL}" alt="Verse Cover" /><h3>${verse.title}</h3>`;
          versesContainer.appendChild(div);
        }
      }

      // --- 🔔 Notifications (reusable) ---
      initNotificationBadge(user.uid, "dashboard-inbox-badge", ".card.inbox");

    } catch (error) {
      console.error('Error loading author data:', error);
    }
  });
});
