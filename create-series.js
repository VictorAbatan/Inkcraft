import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// --- Fallbacks ---
const fallbackSeriesCover = 'https://via.placeholder.com/150x220?text=No+Cover';
const fallbackAuthorAvatar = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';

// --- Custom centered toast alert ---
function showCenteredAlert(message) {
  const alertBox = document.createElement('div');
  alertBox.className = 'centered-alert slide-in';
  alertBox.textContent = message;
  document.body.appendChild(alertBox);

  // Slide out after 2 seconds
  setTimeout(() => {
    alertBox.classList.remove('slide-in');
    alertBox.classList.add('slide-out');
    setTimeout(() => alertBox.remove(), 500);
  }, 2000);
}

// --- Helper function for series image ---
async function getSeriesCover(coverPath, coverImageField) {
  if (coverPath) {
    try {
      return await getDownloadURL(ref(getStorage(), coverPath));
    } catch {
      return coverImageField || fallbackSeriesCover;
    }
  }
  return coverImageField || fallbackSeriesCover;
}

// === Wait for DOM ===
document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const storage = getStorage(app); // ✅ Initialize storage

  // === Load Author Floating Menu ===
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;

        const items = container.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 100);
        });

        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href').toLowerCase() === currentPath) {
            link.classList.add('active');
          }
        });
      }
    });

  // === Auth Check ===
  onAuthStateChanged(auth, user => {
    if (!user) {
      showCenteredAlert('You must be logged in to create a series.');
      window.location.href = 'login.html';
      return;
    }

    const uid = user.uid;
    const form = document.getElementById('series-form');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('series-title').value.trim();
        const description = document.getElementById('series-description').value.trim();
        const coverFileInput = document.getElementById('series-cover');
        const coverFile = coverFileInput?.files?.[0];

        if (!title || !description) {
          showCenteredAlert('Please fill in all required fields.');
          return;
        }

        try {
          let coverPath = null;
          let coverUrl = '';

          if (coverFile) {
            coverPath = `series_covers/${uid}_${Date.now()}_${coverFile.name}`;
            const storageRef = ref(storage, coverPath);
            await uploadBytes(storageRef, coverFile);
            coverUrl = await getDownloadURL(storageRef);
          }

          // Ensure image-handling fallback works
          coverUrl = coverUrl || fallbackSeriesCover;

          const seriesData = {
            title,
            description,
            authorId: uid,
            createdBy: uid,
            ownerId: uid,
            createdAt: serverTimestamp(),
            novels: [],
            coverImagePath: coverPath || null, // Save storage path
            coverImage: coverUrl // Firestore URL
          };

          const docId = `series_${uid}_${Date.now()}`;
          const seriesRef = doc(db, "series", docId);
          await setDoc(seriesRef, seriesData);

          showCenteredAlert('Series created successfully! You can now add novels to it.');
          form.reset();
          if (coverFileInput) coverFileInput.value = '';
        } catch (error) {
          console.error('Error creating series:', error);
          showCenteredAlert('Something went wrong. Please try again.');
        }
      });
    }
  });
});
