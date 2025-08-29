import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
      const authorRef = doc(db, 'authors', user.uid);
      const authorSnap = await getDoc(authorRef);

      console.log("Firestore author doc exists:", authorSnap.exists());
      if (authorSnap.exists()) {
        const data = authorSnap.data();
        console.log("Author data:", data);

        // ✅ Ensure fields come from Firestore correctly
        if (penNameElement) {
          penNameElement.textContent = (data.penName && data.penName.trim() !== "")
            ? data.penName
            : "Unknown Author";
        }
        if (profilePicElement) {
          profilePicElement.src = (data.profilePicURL && data.profilePicURL.trim() !== "")
            ? data.profilePicURL
            : "default-profile.png";
        }
      } else {
        console.warn(`No author doc found for UID ${user.uid} in 'authors' collection`);
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

    } catch (error) {
      console.error('Error loading author data:', error);
    }
  });
});
