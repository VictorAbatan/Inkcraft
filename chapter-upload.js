import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);

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

  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert('You must be logged in.');
      window.location.href = 'login.html';
      return;
    }

    const uid = user.uid;
    const form = document.getElementById('chapter-form');
    const previewSection = document.getElementById('chapter-preview');
    const chapterList = document.getElementById('chapter-list');

    // Load user's chapters into the sidebar
    async function loadChapters() {
      chapterList.innerHTML = ''; // Clear previous list
      const snapshot = await getDocs(collection(db, `users/${uid}/chapters`));
      snapshot.forEach(docSnap => {
        const chapter = docSnap.data();
        const item = document.createElement('li');
        item.className = 'chapter-entry';
        item.innerHTML = `<strong>Chapter ${chapter.number}</strong>: ${chapter.title} (${chapter.status})`;
        chapterList.appendChild(item);
      });
    }

    loadChapters();

    // Save or publish chapter
    async function handleSubmit(status = 'draft') {
      const number = document.getElementById('chapter-number').value.trim();
      const title = document.getElementById('chapter-title').value.trim();
      const body = document.getElementById('chapter-body').value.trim();
      const notes = document.getElementById('chapter-notes').value.trim();

      if (!number || !title || !body) {
        alert('Please fill in the chapter number, title, and body.');
        return;
      }

      const chapterData = {
        number,
        title,
        body,
        notes,
        status,
        createdBy: uid,
        createdAt: serverTimestamp()
      };

      const chapterId = `chapter_${number}_${Date.now()}`;
      const ref = doc(db, `users/${uid}/chapters/${chapterId}`);
      await setDoc(ref, chapterData);

      alert(status === 'published' ? 'Chapter published!' : 'Chapter saved as draft!');
      form.reset();
      previewSection.style.display = 'none';
      loadChapters();
    }

    // Button event listeners
    form.querySelector('button[type="submit"]').addEventListener('click', (e) => {
      e.preventDefault();
      handleSubmit('draft');
    });

    document.getElementById('publish-btn').addEventListener('click', (e) => {
      e.preventDefault();
      handleSubmit('published');
    });

    document.getElementById('preview-btn').addEventListener('click', (e) => {
      e.preventDefault();

      document.getElementById('preview-title').textContent = document.getElementById('chapter-title').value;
      document.getElementById('preview-number').textContent = `Chapter ${document.getElementById('chapter-number').value}`;
      document.getElementById('preview-body').innerHTML = document.getElementById('chapter-body').value
        .split('\n')
        .map(line => `<p>${line}</p>`)
        .join('');
      document.getElementById('preview-notes').textContent = document.getElementById('chapter-notes').value;

      previewSection.style.display = 'block';
    });
  });
});
