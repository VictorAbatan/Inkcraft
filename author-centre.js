import { auth, db } from './firebase-config.js';
import { 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
  doc, getDoc, collection, getDocs, query, where, onSnapshot, writeBatch 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
        console.log("Firestore author doc exists with UID:", user.uid);
        authorData = authorSnap.data();
      } else {
        console.warn(`No author doc found for UID ${user.uid}. Trying fallback by email...`);

        // ✅ fallback: try query by email for old docs
        const q = query(collection(db, 'authors'), where('email', '==', user.email));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const firstDoc = querySnap.docs[0];
          console.log("Found old author doc by email:", firstDoc.id);
          authorData = firstDoc.data();
        }
      }

      if (authorData) {
        console.log("Author data:", authorData);

        if (penNameElement) {
          penNameElement.textContent = (authorData.penName && authorData.penName.trim() !== "")
            ? authorData.penName
            : "Unknown Author";
        }
        if (profilePicElement) {
          profilePicElement.src = (authorData.profilePicURL && authorData.profilePicURL.trim() !== "")
            ? authorData.profilePicURL
            : "default-profile.png";
        }
      } else {
        console.warn("No author profile found for this user at all.");
        if (penNameElement) penNameElement.textContent = 'Unknown Author';
        if (profilePicElement) profilePicElement.src = 'default-profile.png'; // fallback image
      }

      // --- Load approved novels submitted by this author ---
      const novelsQuery = query(
        collection(db, 'novels'),
        where('submittedBy', '==', user.uid)
      );
      const novelsSnap = await getDocs(novelsQuery);
      const novelsContainer = document.getElementById('author-novels-container');
      if (novelsContainer) {
        novelsContainer.innerHTML = '';
        novelsSnap.forEach(doc => {
          const novel = doc.data();
          const div = document.createElement('div');
          div.className = 'author-novel-item';
          div.innerHTML = `<h3>${novel.title}</h3>`;
          novelsContainer.appendChild(div);
        });
      }

      // --- Load series created by this author ---
      const seriesQuery = query(
        collection(db, 'series'),
        where('createdBy', '==', user.uid)
      );
      const seriesSnap = await getDocs(seriesQuery);
      const seriesContainer = document.getElementById('author-series-container');
      if (seriesContainer) {
        seriesContainer.innerHTML = '';
        seriesSnap.forEach(doc => {
          const series = doc.data();
          const div = document.createElement('div');
          div.className = 'author-series-item';
          div.innerHTML = `<h3>${series.title}</h3>`;
          seriesContainer.appendChild(div);
        });
      }

      // --- Load verses created by this author ---
      const versesQuery = query(
        collection(db, 'verses'),
        where('createdBy', '==', user.uid)
      );
      const versesSnap = await getDocs(versesQuery);
      const versesContainer = document.getElementById('author-verses-container');
      if (versesContainer) {
        versesContainer.innerHTML = '';
        versesSnap.forEach(doc => {
          const verse = doc.data();
          const div = document.createElement('div');
          div.className = 'author-verse-item';
          div.innerHTML = `<h3>${verse.title}</h3>`;
          versesContainer.appendChild(div);
        });
      }

      // --- 🔔 Live notification badge listener ---
      const notificationsRef = collection(db, "authors", user.uid, "notifications");
      onSnapshot(notificationsRef, (snapshot) => {
        let unreadCount = 0;
        snapshot.forEach(doc => {
          const data = doc.data();
          if (!data.read) unreadCount++;
        });

        // ✅ Update floating menu inbox badge (by ID)
        const inboxBadge = document.getElementById('inbox-badge');
        if (inboxBadge) {
          inboxBadge.textContent = unreadCount > 0 ? unreadCount : '';
        }

        // ✅ Update inbox card badge (if dashboard has one)
        const inboxCardBadge = document.querySelector('.card.inbox .badge');
        if (inboxCardBadge) {
          inboxCardBadge.textContent = unreadCount > 0 ? unreadCount : '';
        }
      });

      // --- ✅ Reset notifications when on inbox.html ---
      const currentPage = window.location.pathname.split('/').pop().toLowerCase();
      if (currentPage === "inbox.html") {
        const snapshot = await getDocs(notificationsRef);
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => {
          const nRef = doc(db, "authors", user.uid, "notifications", docSnap.id);
          batch.update(nRef, { read: true });
        });
        await batch.commit();
        console.log("All notifications marked as read.");
      }

    } catch (error) {
      console.error('Error loading author data:', error);
    }
  });
});
