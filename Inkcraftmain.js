import { app, db } from './firebase-config.js';
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

    verses.forEach(verse => {
      const card = document.createElement('div');
      card.classList.add('icon-card');

      const link = document.createElement('a');
      link.href = `verse-details.html?id=${verse.id}`;

      const img = document.createElement('img');
      img.src = verse.coverURL || 'default-verse-cover.jpg';
      img.alt = verse.title;

      const title = document.createElement('span');
      title.classList.add('icon-label');
      title.innerHTML = `<b>${verse.title}</b>`;

      link.appendChild(img);
      link.appendChild(title);
      card.appendChild(link);
      track.appendChild(card);
    });

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

  // === 🔹 LOAD NEW BOOKS (latest 2 only, published only) ===
  async function loadNewBooks() {
    const grid = document.querySelector('.new-books .book-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const q = query(
      collection(db, 'novels'),
      where('status', '==', 'published'), // ✅ Only published novels
      orderBy('submittedAt', 'desc'),
      limit(2)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const card = document.createElement('a');
      card.href = `novel-details.html?novelId=${docSnap.id}`;
      card.className = 'book-card';

      const img = document.createElement('img');
      img.src = data.coverUrl || 'default-book-cover.jpg';
      img.alt = data.title;

      const span = document.createElement('span');
      span.textContent = data.title;

      card.appendChild(img);
      card.appendChild(span);
      grid.appendChild(card);
    });
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
      if (profileImgEl) profileImgEl.src = 'default-profile.jpg';
      if (profileNameEl) profileNameEl.textContent = 'Loading...';

      try {
        // Fetch both regular user and author profile concurrently
        const userRef = doc(db, "users", user.uid);
        const authorRef = doc(db, "authorProfiles", user.uid);

        const [userSnap, authorSnap] = await Promise.all([getDoc(userRef), getDoc(authorRef)]);
        const data = (authorSnap.exists() ? authorSnap.data() : userSnap.data()) || {};

        // Update profile name
        if (profileNameEl) profileNameEl.textContent = data.displayName || user.displayName || "Anonymous Reader";

        // Preload image for faster rendering
        if (profileImgEl) {
          const img = new Image();
          img.src = data.photoURL || user.photoURL || 'default-profile.jpg';
          img.onload = () => {
            profileImgEl.src = img.src;
          };
        }
      } catch (err) {
        console.error("Error loading reader profile:", err);
        if (profileNameEl) profileNameEl.textContent = "Anonymous Reader";
        if (profileImgEl) profileImgEl.src = 'default-profile.jpg';
      }
    });
  }

  loadReaderProfile();

}); // <- final closing for DOMContentLoaded
