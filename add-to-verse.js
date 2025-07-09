import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);
  const urlParams = new URLSearchParams(window.location.search);
  const verseId = urlParams.get('id');
  const novelList = document.getElementById('novel-list');
  const seriesList = document.getElementById('series-list');
  const saveButton = document.getElementById('save-button');

  // Load floating menu
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const menuContainer = document.getElementById('floating-menu-container');
      menuContainer.innerHTML = html;
    });

  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert('You must be logged in.');
      window.location.href = 'login.html';
      return;
    }

    // Load author's novels
    const novelsQuery = query(collection(db, 'novels'), where('createdBy', '==', user.uid));
    const novelsSnapshot = await getDocs(novelsQuery);
    novelsSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = docSnap.id;
      checkbox.classList.add('novel-checkbox');

      const label = document.createElement('label');
      label.textContent = data.title;
      label.prepend(checkbox);

      novelList.appendChild(label);
    });

    // Load author's series
    const seriesQuery = query(collection(db, 'series'), where('createdBy', '==', user.uid));
    const seriesSnapshot = await getDocs(seriesQuery);
    seriesSnapshot.forEach(docSnap => {
      const data = docSnap.data();
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = docSnap.id;
      checkbox.classList.add('series-checkbox');

      const label = document.createElement('label');
      label.textContent = data.title;
      label.prepend(checkbox);

      seriesList.appendChild(label);
    });

    // Save selected to verse
    saveButton.addEventListener('click', async () => {
      const selectedNovels = Array.from(document.querySelectorAll('.novel-checkbox:checked')).map(cb => cb.value);
      const selectedSeries = Array.from(document.querySelectorAll('.series-checkbox:checked')).map(cb => cb.value);

      const verseRef = doc(db, 'verses', verseId);
      await updateDoc(verseRef, {
        novels: arrayUnion(...selectedNovels),
        series: arrayUnion(...selectedSeries)
      });

      alert('Verse updated successfully!');
      window.location.href = 'author-verse.html';
    });
  });
});
