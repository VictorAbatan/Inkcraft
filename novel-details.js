import { app, db } from './firebase-config.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;
    });

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
  document.getElementById('coverImage').src = data.cover || 'default-cover.jpg';
  document.getElementById('novelTitle').textContent = data.title || 'Untitled';
  document.getElementById('authorName').textContent = data.author || 'Unknown';
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
        // ✅ Use real chapter number in URL
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
});
