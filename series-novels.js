import { app, db } from './firebase-config.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', async () => {
  const seriesId = new URLSearchParams(window.location.search).get('id');
  if (!seriesId) {
    alert('No series ID specified.');
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

  const seriesInfoSection = document.getElementById('series-info');
  const novelsList = document.getElementById('novels-list');

  try {
    // Fetch series document
    const seriesRef = doc(db, 'series', seriesId);
    const seriesSnap = await getDoc(seriesRef);
    if (!seriesSnap.exists()) {
      seriesInfoSection.innerHTML = '<p>Series not found.</p>';
      return;
    }
    const seriesData = seriesSnap.data();

    // Show series info
    seriesInfoSection.innerHTML = `
      <h2>${seriesData.title || 'Untitled Series'}</h2>
      <p>${seriesData.description || ''}</p>
    `;

    // Get list of novel IDs from the series
    const novelIds = seriesData.novels || [];

    if (novelIds.length === 0) {
      novelsList.innerHTML = '<p>No novels have been added to this series yet.</p>';
      return;
    }

    // Fetch novel documents in parallel
    const novelPromises = novelIds.map(id => getDoc(doc(db, 'novels', id)));
    const novelDocs = await Promise.all(novelPromises);

    novelsList.innerHTML = ''; // Clear

    novelDocs.forEach(novelDoc => {
      if (!novelDoc.exists()) return; // Skip missing novels
      const novel = novelDoc.data();

      const card = document.createElement('div');
      card.classList.add('novel-card');

      card.innerHTML = `
        <img src="${novel.coverUrl || 'default-cover.jpg'}" alt="Cover of ${novel.title}" class="novel-cover" />
        <div class="novel-details">
          <h3 class="novel-title">${novel.title || 'Untitled'}</h3>
          <p class="novel-genre">${Array.isArray(novel.genres) ? novel.genres.join(', ') : novel.genre || ''}</p>
          <p class="novel-synopsis">${novel.synopsis ? novel.synopsis.substring(0, 200) + (novel.synopsis.length > 200 ? '...' : '') : 'No synopsis available.'}</p>
        </div>
      `;

      // Clicking card navigates to the novel details page with correct param name
      card.addEventListener('click', () => {
        window.location.href = `novel-details.html?novelId=${novelDoc.id}`;
      });

      novelsList.appendChild(card);
    });

  } catch (error) {
    console.error('Error loading series novels:', error);
    seriesInfoSection.innerHTML = '<p>Failed to load series data. Please try again later.</p>';
  }
});
