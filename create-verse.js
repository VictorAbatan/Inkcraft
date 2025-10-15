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
const fallbackVerseCover = 'https://via.placeholder.com/150x220?text=No+Cover';

// --- Helper: load verse cover with image-handler pattern ---
async function getVerseCover(coverPath) {
  if (coverPath) {
    try {
      return await getDownloadURL(ref(getStorage(), coverPath));
    } catch {
      return fallbackVerseCover;
    }
  }
  return fallbackVerseCover;
}

// === ✅ Custom Toast Alert Function ===
function showCenteredAlert(message, duration = 3000) {
  const alertBox = document.createElement('div');
  alertBox.className = 'centered-alert';
  alertBox.textContent = message;
  document.body.appendChild(alertBox);

  // Slide in
  setTimeout(() => alertBox.classList.add('slide-in'), 50);

  // Slide out after timeout
  setTimeout(() => {
    alertBox.classList.remove('slide-in');
    alertBox.classList.add('slide-out');
    setTimeout(() => alertBox.remove(), 600);
  }, duration);
}

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const storage = getStorage(app);

  // === Load Floating Menu ===
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
    });

  // === Auth Protection ===
  onAuthStateChanged(auth, user => {
    if (!user) {
      showCenteredAlert('You must be logged in to access this page.');
      setTimeout(() => window.location.href = 'login.html', 2500);
      return;
    }

    const uid = user.uid;
    const form = document.getElementById('verse-form');

    // === Cover Image Preview ===
    const imageInput = document.getElementById('cover');
    const preview = document.getElementById('cover-preview');

    if (imageInput && preview) {
      imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
          preview.src = URL.createObjectURL(file);
          preview.style.display = 'block';
        } else {
          preview.style.display = 'none';
        }
      });
    }

    // === Form Submit Handler ===
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const title = document.getElementById('title').value.trim();
      const description = document.getElementById('description').value.trim();
      const file = imageInput.files[0];

      if (!title || !description) {
        showCenteredAlert('Please complete all required fields.');
        return;
      }

      try {
        let coverPath = null;
        let coverURL = fallbackVerseCover;

        if (file) {
          if (!(file instanceof File)) throw new Error('Invalid file.');

          coverPath = `verse-covers/${uid}/${Date.now()}-${file.name}`;
          const storageRef = ref(storage, coverPath);
          await uploadBytes(storageRef, file);
          coverURL = await getDownloadURL(storageRef);
        }

        const verseData = {
          title,
          description,
          coverPath,      // Store storage path
          coverURL,       // Firestore URL
          authorId: uid,
          createdBy: uid,
          createdAt: serverTimestamp(),
          status: 'pending'
        };

        const docId = `verse_${uid}_${Date.now()}`;
        const verseRef = doc(db, "verses", docId);

        await setDoc(verseRef, verseData);

        showCenteredAlert('Verse created successfully!');
        form.reset();
        if (preview) preview.style.display = 'none';

      } catch (error) {
        console.error('Error submitting verse:', error);

        if (error.code === 'permission-denied') {
          showCenteredAlert('You do not have permission to submit a verse.');
        } else if (error.message.includes('network')) {
          showCenteredAlert('Network error. Please check your connection.');
        } else {
          showCenteredAlert('Submission failed. Please try again.');
        }
      }
    });
  });
});
