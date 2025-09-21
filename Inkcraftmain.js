import { app, db, storage } from './firebase-config.js';
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDownloadURL, ref } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu dynamically
  fetch('floating-menu.html')
    .then(response => response.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;

      const menu = document.querySelector('.floating-menu');
      if (menu) menu.classList.add('animated');

      const currentPage = decodeURIComponent(window.location.pathname.split('/').pop().toLowerCase());
      document.querySelectorAll('.floating-menu a').forEach(link => {
        if (link.getAttribute('href').toLowerCase() === currentPage) link.classList.add('active');
      });

      // ✅ Logout logic
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', e => {
          e.preventDefault();
          const auth = getAuth(app);
          signOut(auth)
            .then(() => {
              alert("You've been signed out.");
              window.location.href = 'login.html';
            })
            .catch(err => {
              console.error('Logout error:', err);
              alert('Failed to sign out. Try again.');
            });
        });
      }
    });

  // === ICON CAROUSEL LOGIC ===
  const carousel = document.querySelector('.icon-carousel');
  const track = document.querySelector('.icon-track');
  if (!carousel || !track) return;

  let cards = Array.from(track.children);
  let prependClones = [], appendClones = [];
  let totalReal = 0, offset = 0, currentIndex = 0, isTransitioning = false;
  let cardWidth = cards[0]?.offsetWidth || 200;

  function updateActive() {
    cards.forEach((c, i) => c.classList.toggle('active-slide', i === currentIndex));
  }

  function slideTo(newIndex) {
    if (isTransitioning) return;
    isTransitioning = true;
    currentIndex = newIndex;
    carousel.scrollTo({ left: currentIndex * cardWidth, behavior: 'smooth' });

    setTimeout(() => {
      if (currentIndex < offset) currentIndex += totalReal;
      else if (currentIndex >= offset + totalReal) currentIndex -= totalReal;
      carousel.scrollLeft = currentIndex * cardWidth;
      updateActive();
      isTransitioning = false;
    }, 600);
  }

  document.querySelector('.nav-arrow.left')?.addEventListener('click', () => slideTo(currentIndex - 1));
  document.querySelector('.nav-arrow.right')?.addEventListener('click', () => slideTo(currentIndex + 1));

  let startX = 0, dragging = false;
  carousel.addEventListener('touchstart', e => { startX = e.touches[0].clientX; dragging = true; });
  carousel.addEventListener('touchend', e => {
    if (!dragging) return;
    const diff = e.changedTouches[0].clientX - startX;
    if (Math.abs(diff) > 50) slideTo(diff > 0 ? currentIndex - 1 : currentIndex + 1);
    dragging = false;
  });

  // === 🔹 LOAD REAL VERSES INTO CAROUSEL ===
  async function loadHomeVerses() {
    if (!track) return;

    track.innerHTML = '';
    const versesSnapshot = await getDocs(collection(db, 'verses'));
    const verses = versesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (verses.length === 0) return;

    for (const verse of verses) {
      const card = document.createElement('div');
      card.classList.add('icon-card');

      const link = document.createElement('a');
      link.href = `verse-details.html?id=${verse.id}`;

      const img = document.createElement('img');
      img.alt = verse.title;

      // ✅ Always fetch from Storage dynamically
      if (verse.coverPath) {
        try {
          const url = await getDownloadURL(ref(storage, verse.coverPath));
          img.src = url;
        } catch (err) {
          console.error("Verse cover load error:", err);
          img.src = 'default-verse-cover.jpg';
        }
      } else {
        img.src = 'default-verse-cover.jpg';
      }

      const title = document.createElement('span');
      title.classList.add('icon-label');
      title.innerHTML = `<b>${verse.title}</b>`;

      link.appendChild(img);
      link.appendChild(title);
      card.appendChild(link);
      track.appendChild(card);
    }

    cards = Array.from(track.children);
    cardWidth = cards[0].offsetWidth + parseInt(getComputedStyle(track).gap || 0);

    if (cards.length > 1) {
      prependClones = cards.map(c => c.cloneNode(true)).reverse();
      appendClones = cards.map(c => c.cloneNode(true));

      prependClones.forEach(c => track.insertBefore(c, track.firstChild));
      appendClones.forEach(c => track.appendChild(c));

      cards = Array.from(track.children);
      totalReal = cards.length - prependClones.length - appendClones.length;
      offset = prependClones.length;
      currentIndex = offset;
      carousel.scrollLeft = currentIndex * cardWidth;
    } else {
      totalReal = 1;
      offset = 0;
      currentIndex = 0;
      carousel.scrollLeft = 0;
    }

    updateActive();
  }

  loadHomeVerses();

  setInterval(() => {
    if (cards.length > 1) slideTo(currentIndex + 1);
  }, 5000);

  // === 🔹 LOAD NEW BOOKS (latest 2 only, approved only) ===
  async function loadNewBooks() {
    const grid = document.querySelector('.new-books .book-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const q = query(
      collection(db, 'novels'),
      where('status', '==', 'approved'), // ✅ Only approved novels
      orderBy('createdAt', 'desc'),
      limit(2)
    );

    const snapshot = await getDocs(q);
    const authorCache = new Map();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // ✅ Use authorName from the novel document if it exists
      let authorName = data.authorName || 'Unknown Author';

      if (!data.authorName && data.authorId) {
        if (authorCache.has(data.authorId)) {
          authorName = authorCache.get(data.authorId);
        } else {
          const userDoc = await getDoc(doc(db, 'users', data.authorId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            authorName = userData.authorName || userData.penName || 'Unknown Author';
            authorCache.set(data.authorId, authorName);
          }
        }
      }

      const card = document.createElement('a');
      card.href = `novel-details.html?novelId=${docSnap.id}`;
      card.className = 'book-card';

      const img = document.createElement('img');
      img.alt = data.title || 'Untitled';

      // ✅ Always fetch from Storage dynamically
      if (data.coverPath) {
        try {
          const url = await getDownloadURL(ref(storage, data.coverPath));
          img.src = url;
        } catch (err) {
          console.error("Novel cover load error:", err);
          img.src = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
        }
      } else {
        img.src = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
      }

      const span = document.createElement('span');
      span.innerHTML = `<strong>${data.title || 'Untitled'}</strong><br><small>by ${authorName}</small>`;

      card.appendChild(img);
      card.appendChild(span);
      grid.appendChild(card);
    }
  }

  loadNewBooks();

  // === 🔹 LOAD READER PROFILE (name + image) ===
  async function loadReaderProfile() {
    const auth = getAuth(app);

    onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const profileNameEl = document.getElementById('reader-name');
      const profileImgEl = document.getElementById('reader-img');

      // Set temporary placeholder immediately
      if (profileImgEl) profileImgEl.src = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
      if (profileNameEl) profileNameEl.textContent = 'Loading...';

      try {
        // Fetch both regular user and author profile concurrently
        const userRef = doc(db, "users", user.uid);
        const authorRef = doc(db, "authorProfiles", user.uid);

        const [userSnap, authorSnap] = await Promise.all([getDoc(userRef), getDoc(authorRef)]);
        const data = (authorSnap.exists() ? authorSnap.data() : userSnap.data()) || {};

        // --- ✅ Updated profile name logic ---
        if (profileNameEl) {
          profileNameEl.textContent =
            data.username ||
            data.penName ||
            data.displayName ||
            user.displayName ||
            user.email ||
            "Anonymous Reader";
        }

        // --- ✅ Always fetch profile image dynamically ---
        if (profileImgEl) {
          try {
            if (data.profilePicPath || data.photoPath || data.profileImagePath) {
              const path = data.profilePicPath || data.photoPath || data.profileImagePath;
              const url = await getDownloadURL(ref(storage, path));
              profileImgEl.src = url;
            } else {
              profileImgEl.src =
                data.profileImage ||
                data.photoURL ||
                user.photoURL ||
                'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
            }
          } catch (err) {
            console.error("Profile image load error:", err);
            profileImgEl.src = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
          }
        }
      } catch (err) {
        console.error("Error loading reader profile:", err);
        if (profileNameEl) profileNameEl.textContent = "Anonymous Reader";
        if (profileImgEl) profileImgEl.src = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
      }
    });
  }

  loadReaderProfile();

}); // <- final closing for DOMContentLoaded
