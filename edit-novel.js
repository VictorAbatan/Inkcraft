import { app, db, storage } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const titleInput = document.getElementById('title');
  const genreInput = document.getElementById('genre');
  const tagsInput = document.getElementById('tags');
  const synopsisInput = document.getElementById('synopsis');
  const coverInput = document.getElementById('cover');
  const preview = document.getElementById('preview');
  const form = document.getElementById('edit-form');

  const urlParams = new URLSearchParams(window.location.search);
  const novelId = urlParams.get('novelId'); // ✅ FIXED

  if (!novelId) {
    alert("No novel ID provided.");
    return;
  }

  let currentCoverUrl = '';

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("You must be logged in to edit a novel.");
      window.location.href = 'login.html';
      return;
    }

    try {
      const docRef = doc(db, 'novels', novelId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        alert("Novel not found.");
        return;
      }

      const novel = docSnap.data();

      // ✅ Updated to check authorId instead of submittedBy
      if (novel.authorId !== user.uid) {
        alert("You are not allowed to edit this novel.");
        window.location.href = 'author-novels.html';
        return;
      }

      // Prefill form
      titleInput.value = novel.title;
      genreInput.value = novel.genre;
      tagsInput.value = Array.isArray(novel.tags) ? novel.tags.join(', ') : '';
      synopsisInput.value = novel.synopsis || '';
      currentCoverUrl = novel.coverUrl;
      preview.src = currentCoverUrl;

    } catch (error) {
      console.error("Error loading novel:", error);
      alert("Error loading novel. Check console for details.");
    }
  });

  coverInput.addEventListener('change', () => {
    const file = coverInput.files[0];
    if (file) {
      preview.src = URL.createObjectURL(file);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const title = titleInput.value.trim();
    const genre = genreInput.value.trim();
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
    const synopsis = synopsisInput.value.trim();

    let coverUrl = currentCoverUrl;
    const file = coverInput.files[0];

    if (file) {
      // ✅ Updated path to match storage rules
      const fileRef = ref(storage, `novel-covers/${user.uid}/${novelId}-${Date.now()}`);
      await uploadBytes(fileRef, file);
      coverUrl = await getDownloadURL(fileRef);
    }

    try {
      await updateDoc(doc(db, 'novels', novelId), {
        title,
        genre,
        tags,
        synopsis,
        coverUrl
      });
      alert("Novel updated successfully!");
      window.location.href = 'author-novels.html';
    } catch (err) {
      console.error("Update failed:", err);
      alert("Failed to update novel.");
    }
  });

  // Load floating menu
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
});
