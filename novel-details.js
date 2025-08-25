import { app, db } from './firebase-config.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  setDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;
    });

  const auth = getAuth(app);
  const urlParams = new URLSearchParams(window.location.search);
  const novelId = urlParams.get('novelId');
  if (!novelId) return;

  const docRef = doc(db, 'novels', novelId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    document.getElementById('novelTitle').textContent = "Novel not found.";
    return;
  }

  const data = docSnap.data();
  document.getElementById('coverImage').src = data.cover || data.coverUrl || 'default-cover.jpg';
  document.getElementById('novelTitle').textContent = data.title || 'Untitled';

  // ✅ Unified author logic
  let authorName = data.penNameOverride || data.authorName || 'Unknown';
  if ((!data.penNameOverride && !data.authorName) && data.submittedBy) {
    try {
      const authorRef = doc(db, 'authors', data.submittedBy);
      const authorSnap = await getDoc(authorRef);
      if (authorSnap.exists()) {
        const authorData = authorSnap.data();
        authorName = authorData.penName || authorData.name || authorName;
      }
    } catch (err) {
      console.warn('Failed to fetch author name:', err);
    }
  }
  document.getElementById('authorName').textContent = authorName;

  document.getElementById('genreList').textContent = (data.genres || []).join(', ') || 'Unspecified';
  document.getElementById('viewCount').textContent = data.views || 'N/A';
  document.getElementById('novelSynopsis').textContent = data.synopsis || 'No synopsis available.';

  document.getElementById('readButton').href = `read-novel.html?novelId=${novelId}`;

  // ✅ Load chapters for count and ToC
  try {
    const chaptersRef = collection(db, `novels/${novelId}/published_chapters`);
    const q = query(chaptersRef, orderBy('order'));
    const snapshot = await getDocs(q);

    const chapterCount = snapshot.size;
    document.getElementById('chapterCount').textContent = chapterCount;

    const contentsTab = document.getElementById('contentsTab');
    if (!snapshot.empty) {
      const ul = document.createElement('ul');
      snapshot.forEach((docSnap) => {
        const chapter = docSnap.data();
        const chapterNumber = chapter.number || 1;
        const chapterTitle = chapter.title || `Chapter ${chapterNumber}`;
        const li = document.createElement('li');
        li.innerHTML = `<a href="read-novel.html?novelId=${novelId}&chapter=${chapterNumber}">📖 ${chapterTitle}</a>`;
        ul.appendChild(li);
      });
      contentsTab.innerHTML = '<h2>Chapters</h2>';
      contentsTab.appendChild(ul);
    } else {
      contentsTab.innerHTML = '<h2>Chapters</h2><p>No chapters uploaded yet.</p>';
    }
  } catch (err) {
    console.error('Error loading chapters:', err);
    document.getElementById('chapterCount').textContent = '—';
  }

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

      tab.classList.add('active');
      const id = tab.dataset.tab;
      document.getElementById(id + 'Tab').style.display = 'block';
    });
  });

  // ✅ Add to Library Feature
  const addToLibraryBtn = document.getElementById('addToLibraryBtn');
  if (addToLibraryBtn) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        addToLibraryBtn.disabled = true;
        addToLibraryBtn.textContent = 'Login to Save';
        return;
      }

      const libRef = doc(db, `users/${user.uid}/library/${novelId}`);
      const libSnap = await getDoc(libRef);

      if (libSnap.exists()) {
        addToLibraryBtn.textContent = '✔ In Library';
        addToLibraryBtn.disabled = true;
      }

      addToLibraryBtn.addEventListener('click', async () => {
        try {
          await setDoc(libRef, {
            novelId: novelId,
            title: data.title || 'Untitled',
            cover: data.cover || data.coverUrl || '',
            addedAt: new Date()
          });
          addToLibraryBtn.textContent = '✔ Added';
          addToLibraryBtn.disabled = true;
        } catch (err) {
          console.error('Failed to add to library:', err);
          alert('Error saving novel to library.');
        }
      });
    });
  }
});
