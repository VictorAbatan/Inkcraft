import { app, db } from './firebase-config.js';
import { collection, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const storage = getStorage(app);
const fallbackCover = 'https://via.placeholder.com/150x220?text=No+Cover'; // public placeholder

document.addEventListener('DOMContentLoaded', async () => {
  // Load floating menu
  const menuContainer = document.getElementById('floating-menu-container');
  if (menuContainer) {
    try {
      const res = await fetch('./floating-menu.html');
      if (res.ok) {
        const html = await res.text();
        menuContainer.innerHTML = html;

        const currentPage = window.location.pathname.split('/').pop();
        document.querySelectorAll('.floating-menu a').forEach(link => {
          if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
          }
        });
      }
    } catch (err) {
      console.error("Failed to load floating menu:", err);
    }
  }

  // Get verse id from URL
  const params = new URLSearchParams(window.location.search);
  const verseId = params.get('id');
  if (!verseId) return;

  // Fetch verse data
  const verseRef = doc(db, 'verses', verseId);
  const verseSnap = await getDoc(verseRef);
  if (!verseSnap.exists()) return;

  const verseData = verseSnap.data();
  const verseTitleEl = document.getElementById('verseTitle');
  const verseDescEl = document.getElementById('verseDescription');
  const verseCoverEl = document.getElementById('verseCover');

  if (verseTitleEl) verseTitleEl.textContent = verseData.title;
  if (verseDescEl) verseDescEl.textContent = verseData.description || '';
  if (verseCoverEl) {
    let coverURL = fallbackCover;
    if (verseData.coverURL) {
      try {
        coverURL = await getDownloadURL(ref(storage, verseData.coverURL));
      } catch (err) {
        console.warn("Failed to load verse cover:", verseId, err);
      }
    }
    verseCoverEl.src = coverURL;
    verseCoverEl.alt = verseData.title;
  }

  // Fetch novels directly from their docs
  const novelGrid = document.getElementById('novelList');
  if (novelGrid) {
    novelGrid.innerHTML = '';
    const novelIds = [...new Set(verseData.novels || [])]; // remove duplicates
    if (novelIds.length === 0) {
      novelGrid.innerHTML = "<p style='color:white; text-align:center;'>No novels in this verse yet.</p>";
    } else {
      for (const novelId of novelIds) {
        const novelDoc = await getDoc(doc(db, 'novels', novelId));
        if (novelDoc.exists()) {
          const novel = novelDoc.data();
          let coverURL = fallbackCover;
          if (novel.coverUrl) {
            coverURL = novel.coverUrl; // already a URL in doc
          }
          const div = document.createElement('div');
          div.className = 'novel-card';
          div.innerHTML = `
            <img src="${coverURL}" alt="${novel.title}">
            <span>${novel.title}</span>
          `;
          div.addEventListener('click', () => window.location.href = `novel-details.html?novelId=${novelDoc.id}`);
          novelGrid.appendChild(div);
        }
      }
    }
  }

  // Fetch series directly from their docs
  const seriesGrid = document.getElementById('seriesList');
  if (seriesGrid) {
    seriesGrid.innerHTML = '';
    const seriesIds = [...new Set(verseData.series || [])]; // remove duplicates
    if (seriesIds.length === 0) {
      seriesGrid.innerHTML = "<p style='color:white; text-align:center;'>No series in this verse yet.</p>";
    } else {
      for (const seriesId of seriesIds) {
        const seriesDoc = await getDoc(doc(db, 'series', seriesId));
        if (seriesDoc.exists()) {
          const series = seriesDoc.data();
          let coverURL = fallbackCover;
          if (series.coverImageURL) {
            coverURL = series.coverImageURL;
          }
          const div = document.createElement('div');
          div.className = 'series-card';
          div.innerHTML = `
            <img src="${coverURL}" alt="${series.title}">
            <span>${series.title}</span>
          `;
          // ✅ FIXED: use ?id= instead of ?seriesId=
          div.addEventListener('click', () => window.location.href = `series-details.html?id=${seriesDoc.id}`);
          seriesGrid.appendChild(div);
        }
      }
    }
  }
});
