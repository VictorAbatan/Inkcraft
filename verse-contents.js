import { app, db, auth } from './firebase-config.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const verseId = new URLSearchParams(window.location.search).get('id');
  if (!verseId) {
    alert('No verse ID specified.');
    return;
  }

  // Load floating menu
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;
        container.querySelectorAll('.menu-item').forEach((item, i) => {
          setTimeout(() => item.classList.add('show'), i * 100);
        });
        const path = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href').toLowerCase() === path) {
            link.classList.add('active');
          }
        });
      }
    });

  const verseInfoSection = document.getElementById('verse-info');
  const novelsList = document.getElementById('novels-list');
  const seriesList = document.getElementById('series-list');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    try {
      // Fetch verse document
      const verseRef = doc(db, 'verses', verseId);
      const verseSnap = await getDoc(verseRef);
      if (!verseSnap.exists()) {
        verseInfoSection.innerHTML = '<p>Verse not found.</p>';
        return;
      }
      const verseData = verseSnap.data();

      // Verse info
      verseInfoSection.innerHTML = `
        <img src="${verseData.coverURL || 'default-verse-cover.jpg'}" alt="${verseData.title || 'Verse Cover'}" />
        <h2>${verseData.title || 'Untitled Verse'}</h2>
        <p>${verseData.description || ''}</p>
      `;

      // --- Novels in this verse ---
      novelsList.innerHTML = '';
      if (!verseData.novels || verseData.novels.length === 0) {
        novelsList.innerHTML = '<p style="text-align:center;">No novels in this verse yet.</p>';
      } else {
        for (const novelId of verseData.novels) {
          const novelRef = doc(db, 'novels', novelId);
          const novelSnap = await getDoc(novelRef);
          if (novelSnap.exists()) {
            const novel = novelSnap.data();
            const card = document.createElement('div');
            card.classList.add('card');
            card.innerHTML = `
              <img src="${novel.coverUrl || 'default-novel-cover.jpg'}" alt="${novel.title}" />
              <div class="card-details">
                <h3 class="card-title">${novel.title}</h3>
                <p class="card-genre">${Array.isArray(novel.genres) ? novel.genres.join(', ') : novel.genre || ''}</p>
                <p class="card-synopsis">${novel.synopsis ? novel.synopsis.substring(0, 200) + (novel.synopsis.length > 200 ? '...' : '') : 'No synopsis available.'}</p>
              </div>
            `;
            // ✅ fixed to use novelId param
            card.addEventListener('click', () => {
              window.location.href = `novel-details.html?novelId=${novelSnap.id}`;
            });
            novelsList.appendChild(card);
          }
        }
      }

      // --- Series in this verse ---
      seriesList.innerHTML = '';
      if (!verseData.series || verseData.series.length === 0) {
        seriesList.innerHTML = '<p style="text-align:center;">No series in this verse yet.</p>';
      } else {
        for (const seriesId of verseData.series) {
          const seriesRef = doc(db, 'series', seriesId);
          const seriesSnap = await getDoc(seriesRef);
          if (seriesSnap.exists()) {
            const series = seriesSnap.data();
            const card = document.createElement('div');
            card.classList.add('card');
            card.innerHTML = `
              <img src="${series.coverImageURL || 'default-series-cover.jpg'}" alt="${series.title}" />
              <div class="card-details">
                <h3 class="card-title">${series.title}</h3>
                <p class="card-genre">${series.genre || ''}</p>
                <p class="card-synopsis">${series.description ? series.description.substring(0,200)+(series.description.length>200?'...':'') : 'No description available.'}</p>
              </div>
            `;
            // ✅ fixed to use series-details.html with "id" param
            card.addEventListener('click', () => {
              window.location.href = `series-details.html?id=${seriesSnap.id}`;
            });
            seriesList.appendChild(card);
          }
        }
      }

    } catch (error) {
      console.error('Error loading verse contents:', error);
      verseInfoSection.innerHTML = '<p>Failed to load verse data. Please try again later.</p>';
    }
  });
});
