import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('shared-top-right-container');
  if (!container) return;

  // Insert loading spinner & placeholder author info
  const spinnerHTML = `
    <div id="author-info" style="display:flex;align-items:center;gap:8px;background:rgba(0,0,0,0.6);padding:6px 10px;border-radius:8px;color:#fff;font-size:1rem;box-shadow:0 0 6px rgba(0,0,0,0.4);white-space:nowrap;">
      <div class="spinner" style="width:38px;height:38px;border:4px solid rgba(255,255,255,0.3);border-top-color:#00aced;border-radius:50%;animation:spin 1s linear infinite;"></div>
      <span>Loading...</span>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', spinnerHTML);

  // Load Floating Menu HTML
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      container.insertAdjacentHTML('beforeend', html);

      const menuItems = container.querySelectorAll('.floating-menu .menu-item');
      menuItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.2}s`;
        item.classList.add('show');
      });

      const currentPage = window.location.pathname.split('/').pop().toLowerCase().replace(/\s+/g, '-');
      container.querySelectorAll('.floating-menu a').forEach(link => {
        const href = link.getAttribute('href').toLowerCase().replace(/\s+/g, '-');
        if (href === currentPage) {
          link.classList.add('active');
        }
      });
    })
    .catch(err => console.error('Error loading floating menu:', err));

  // Load author profile info with caching
  const auth = getAuth(app);
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const userId = user.uid;
    const cachedProfile = localStorage.getItem('inkcraft-profile');
    if (cachedProfile) {
      try {
        const profile = JSON.parse(cachedProfile);
        updateAuthorInfo(profile.displayName, profile.photoUrl);
      } catch {
        // invalid cache, ignore and refetch
      }
    }

    try {
      const profileRef = doc(db, `users/${userId}/profile`);
      const profileSnap = await getDoc(profileRef);

      let displayName = "Author";
      let photoUrl = "https://ui-avatars.com/api/?name=A&background=000&color=fff";

      if (profileSnap.exists()) {
        const profile = profileSnap.data();
        if (profile.displayName) displayName = profile.displayName;
        if (profile.photoUrl) photoUrl = profile.photoUrl;

        // Cache profile in localStorage
        localStorage.setItem('inkcraft-profile', JSON.stringify({ displayName, photoUrl }));
      }

      updateAuthorInfo(displayName, photoUrl);
    } catch (err) {
      console.error("Error fetching author profile:", err);
      // Optional: show error state in author info box
      updateAuthorInfo("Author", "https://ui-avatars.com/api/?name=A&background=000&color=fff");
    }
  });

  function updateAuthorInfo(displayName, photoUrl) {
    const infoBox = container.querySelector('#author-info');
    if (!infoBox) return;
    infoBox.innerHTML = `
      <img src="${photoUrl}" alt="Profile Picture" />
      <span>${displayName}</span>
    `;
  }
});
