import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);

  const listContainer = document.getElementById('submission-list');
  const logoutBtn = document.getElementById('logout-btn');
  const darkToggle = document.getElementById('dark-toggle');
  const notifCount = document.getElementById('notif-count');
  const statApproved = document.getElementById('stat-approved');
  const statRejected = document.getElementById('stat-rejected');
  const statPending = document.getElementById('stat-pending');
  const statSeries = document.getElementById('stat-series');
  const statVerses = document.getElementById('stat-verses');

  [listContainer, logoutBtn, darkToggle, notifCount, statApproved, statRejected, statPending, statSeries, statVerses]
    .forEach(el => { if (!el) console.error(`${el?.id || 'Element'} not found!`); });

  // ✅ Helper: send notification to BOTH inbox + notifications
  async function sendNotification(authorId, type, message) {
    try {
      const payload = {
        type,                 // must match inbox.js expectations
        message,
        timestamp: serverTimestamp(), // ✅ renamed so inbox.js can read
        read: false
      };

      // Notifications
      await addDoc(collection(db, "users", authorId, "notifications"), payload);

      // Inbox (mirror)
      await addDoc(collection(db, "users", authorId, "inbox"), payload);

    } catch (err) {
      console.warn("Notification failed (non-critical):", err);
    }
  }

  // ✅ Helper: resolve author name for novels/series/verses
  function resolveAuthorName(docData, authorMap) {
    return (
      docData.authorName ||               // explicit name on doc
      authorMap.get(docData.authorId) ||  // lookup by authorId
      authorMap.get(docData.createdBy) || // lookup by createdBy
      authorMap.get(docData.ownerId) ||   // lookup by ownerId
      docData.authorId ||                 // fallback: show id
      docData.createdBy ||
      docData.ownerId ||
      'Unknown Author'
    );
  }

  darkToggle?.addEventListener('click', () => document.body.classList.toggle('light-mode'));

  logoutBtn?.addEventListener('click', () => {
    auth.signOut().then(() => window.location.href = 'login.html')
      .catch(error => { console.error('Logout failed:', error); alert('Logout failed.'); });
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) { alert("You must be logged in."); window.location.href = 'login.html'; return; }
    const tokenResult = await user.getIdTokenResult();
    if (!tokenResult.claims.admin) { alert("Access denied. Admins only."); window.location.href = 'login.html'; return; }

    // ✅ extracted into function so we can re-render after status updates
    async function renderDashboard() {
      try {
        const [novelSnap, seriesSnap, verseSnap, usersSnap] = await Promise.all([
          getDocs(collection(db, 'novels')),
          getDocs(collection(db, 'series')),
          getDocs(collection(db, 'verses')),
          getDocs(collection(db, 'users'))
        ]);

        const authorMap = new Map();
        usersSnap.forEach(docSnap => {
          const userData = docSnap.data();
          authorMap.set(docSnap.id, userData.penName || 'Unknown Author');
        });

        let approved = 0, rejected = 0, pending = 0, notifications = 0;
        let seriesCount = 0, verseCount = 0;

        // === Novels ===
        if (listContainer) listContainer.innerHTML = '';

        const novelSection = document.createElement('section');
        novelSection.innerHTML = `<h2>📖 Novels</h2>`;
        const novelContainer = document.createElement('div');
        novelContainer.id = 'novel-container';
        novelContainer.style.display = 'flex';
        novelContainer.style.flexWrap = 'wrap';
        novelContainer.style.gap = '1rem';
        novelSection.appendChild(novelContainer);
        listContainer.appendChild(novelSection);

        for (const docSnap of novelSnap.docs) {
          const novel = docSnap.data();
          const id = docSnap.id;

          if (novel.status === 'published' || novel.status === 'approved') approved++;
          if (novel.status === 'rejected') {
            rejected++;
            // ✅ Auto-delete already rejected novels
            try {
              await deleteDoc(doc(db, 'novels', id));
              console.log(`Deleted rejected novel: ${novel.title}`);
              continue; // skip rendering
            } catch (err) {
              console.error(`Failed to auto-delete rejected novel ${id}:`, err);
            }
          }
          if (novel.status === 'pending') pending++;
          if (!listContainer) continue;

          const authorName = resolveAuthorName(novel, authorMap);

          const card = document.createElement('div');
          card.className = 'submission-card';
          card.style.maxWidth = '350px';
          card.style.margin = '0.5rem';

          let actionButtons = '';
          if (novel.status === 'pending') {
            actionButtons = `
              <button class="approve-btn">Approve</button>
              <button class="reject-btn">Reject</button>`;
          } else if (novel.status === 'approved') {
            actionButtons = `<p class="status-approved">Approved ✅</p>`;
          }

          card.innerHTML = `
            <img src="${novel.coverUrl || 'placeholder.jpg'}" alt="Cover" />
            <div class="submission-details">
              <h3>${novel.title || 'Untitled'}</h3>
              <p><strong>Author:</strong> ${authorName}</p>
              <p><strong>Genre:</strong> ${novel.genre || '—'}</p>
              <p><strong>Tags:</strong> ${Array.isArray(novel.tags) ? novel.tags.join(', ') : '—'}</p>
              <p><strong>Synopsis:</strong> ${novel.synopsis || 'No synopsis available.'}</p>
              <p class="status-line"><strong>Status:</strong> ${novel.status}</p>
              <div class="action-buttons">${actionButtons}</div>
            </div>
          `;
          novelContainer.appendChild(card);

          // === Button handlers ===
          const approveBtn = card.querySelector('.approve-btn');
          approveBtn?.addEventListener('click', async () => {
            try {
              await updateDoc(doc(db, 'novels', id), { status: 'approved' });
              alert(`Novel "${novel.title}" approved.`);
              await sendNotification(novel.authorId, "approval", `Your novel "${novel.title}" has been approved and is live.`);
              await renderDashboard(); // re-render after status change
            } catch (err) { console.error(err); alert('Approve failed.'); }
          });

          const rejectBtn = card.querySelector('.reject-btn');
          rejectBtn?.addEventListener('click', async () => {
            try {
              await deleteDoc(doc(db, 'novels', id)); // ✅ manual reject delete
              alert(`Novel "${novel.title}" rejected and deleted.`);
              await sendNotification(novel.authorId, "rejection", `Your novel "${novel.title}" was rejected and has been removed.`);
              await renderDashboard();
            } catch (err) { console.error(err); alert('Reject failed.'); }
          });
        }

        // === Series ===
        if (listContainer) {
          const seriesSection = document.createElement('section');
          seriesSection.innerHTML = `<h2>📚 Series</h2>`;
          const seriesContainer = document.createElement('div');
          seriesContainer.id = 'series-container';
          seriesContainer.style.display = 'flex';
          seriesContainer.style.flexWrap = 'wrap';
          seriesContainer.style.gap = '1rem';
          seriesSection.appendChild(seriesContainer);
          listContainer.appendChild(seriesSection);

          for (const docSnap of seriesSnap.docs) {
            const series = docSnap.data();
            const id = docSnap.id;
            seriesCount++;

            const penName = resolveAuthorName(series, authorMap);

            const card = document.createElement('div');
            card.className = 'series-card';
            card.style.maxWidth = '250px';
            card.style.margin = '0.5rem';
            card.innerHTML = `
              <img src="${series.coverImageURL || 'placeholder.jpg'}" alt="Series Cover" />
              <h4>${series.title || 'Untitled Series'}</h4>
              <p>${series.description || ''}</p>
              <p><strong>Author:</strong> ${penName}</p>
              <button class="view-series-btn">View</button>
            `;
            card.querySelector('.view-series-btn')?.addEventListener('click', () => {
              alert(`Series: ${series.title}\nDescription: ${series.description || ''}`);
            });
            seriesContainer.appendChild(card);
          }
        }

        // === Verses ===
        if (listContainer) {
          const verseSection = document.createElement('section');
          verseSection.innerHTML = `<h2>📖 Verses</h2>`;
          const verseContainer = document.createElement('div');
          verseContainer.id = 'verse-container';
          verseContainer.style.display = 'flex';
          verseContainer.style.flexWrap = 'wrap';
          verseContainer.style.gap = '1rem';
          verseSection.appendChild(verseContainer);
          listContainer.appendChild(verseSection);

          for (const docSnap of verseSnap.docs) {
            const verse = docSnap.data();
            const id = docSnap.id;
            verseCount++;

            const penName = resolveAuthorName(verse, authorMap);

            const card = document.createElement('div');
            card.className = 'verse-card';
            card.style.maxWidth = '250px';
            card.style.margin = '0.5rem';
            card.innerHTML = `
              <img src="${verse.coverURL || 'placeholder.jpg'}" alt="Verse Cover" />
              <div class="verse-details">
                <h3>${verse.title}</h3>
                <p>${verse.description}</p>
                <p><strong>Author:</strong> ${penName}</p>
                <button class="view-verse-btn">View</button>
              </div>
            `;
            card.querySelector('.view-verse-btn')?.addEventListener('click', () => {
              alert(`Verse: ${verse.title}\nDescription: ${verse.description || ''}`);
            });
            verseContainer.appendChild(card);
          }
        }

        // Update Stats
        if (statApproved) statApproved.textContent = approved;
        if (statRejected) statRejected.textContent = rejected;
        if (statPending) statPending.textContent = pending;
        if (notifCount) notifCount.textContent = notifications;
        if (statSeries) statSeries.textContent = seriesCount;
        if (statVerses) statVerses.textContent = verseCount;

      } catch (err) {
        console.error("Error loading dashboard data:", err);
        if (listContainer) listContainer.innerHTML = '<p>Error loading submissions.</p>';
      }
    }

    // Initial render
    await renderDashboard();
  });
});
