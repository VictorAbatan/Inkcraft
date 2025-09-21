import { app, db, storage } from './firebase-config.js';
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
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);

  const logoutBtn = document.getElementById('logout-btn');
  const darkToggle = document.getElementById('dark-toggle');
  const notifCount = document.getElementById('notif-count');
  const statApproved = document.getElementById('stat-approved');
  const statRejected = document.getElementById('stat-rejected');
  const statPending = document.getElementById('stat-pending');
  const statSeries = document.getElementById('stat-series');
  const statVerses = document.getElementById('stat-verses');

  const sideNavLinks = document.querySelectorAll('.admin-sidenav a');
  const adminSections = document.querySelectorAll('.admin-section');

  [logoutBtn, darkToggle, notifCount, statApproved, statRejected, statPending, statSeries, statVerses]
    .forEach(el => { if (!el) console.error(`${el?.id || 'Element'} not found!`); });

  // === Side Nav Section Switching ===
  sideNavLinks.forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = link.getAttribute('data-section');

      sideNavLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      adminSections.forEach(sec => {
        sec.style.display = (sec.id === target) ? 'block' : 'none';
      });
    });
  });

  async function sendNotification(authorId, type, message) {
    try {
      const payload = { type, message, timestamp: serverTimestamp(), read: false };
      await addDoc(collection(db, "users", authorId, "notifications"), payload);
      await addDoc(collection(db, "users", authorId, "inbox"), payload);
    } catch (err) {
      console.warn("Notification failed (non-critical):", err);
    }
  }

  function resolveAuthorName(docData, authorMap) {
    return (
      docData.authorName ||
      authorMap.get(docData.authorId) ||
      authorMap.get(docData.createdBy) ||
      authorMap.get(docData.ownerId) ||
      docData.authorId ||
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

    async function getImageURL(storagePath, fallback) {
      if (storagePath) {
        try {
          return await getDownloadURL(ref(storage, storagePath));
        } catch {}
      }
      return fallback;
    }

    async function getNovelCover(novel) {
      return await getImageURL(novel.coverPath, novel.coverUrl || novel.cover || 'placeholder.jpg');
    }

    async function getSeriesCover(series) {
      return await getImageURL(series.coverImagePath, series.coverImage || 'placeholder.jpg');
    }

    async function getVerseCover(verse) {
      return await getImageURL(verse.coverPath, verse.coverURL || 'placeholder.jpg');
    }

    async function getAuthorAvatar(author) {
      return await getImageURL(author.profilePicPath, author.photoURL || author.profileImage || 'avatar-placeholder.jpg');
    }

    async function renderAll() {
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

        novelSnap.docs.forEach(docSnap => {
          const novel = docSnap.data();
          if (novel.status === 'approved') approved++;
          if (novel.status === 'rejected') rejected++;
          if (novel.status === 'pending') pending++;
        });
        seriesCount = seriesSnap.size;
        verseCount = verseSnap.size;

        if(statApproved) statApproved.textContent = approved;
        if(statRejected) statRejected.textContent = rejected;
        if(statPending) statPending.textContent = pending;
        if(notifCount) notifCount.textContent = notifications;
        if(statSeries) statSeries.textContent = seriesCount;
        if(statVerses) statVerses.textContent = verseCount;

        const renderNovelSection = async (statusFilter, containerId) => {
          const container = document.getElementById(containerId);
          if(!container) return;
          container.innerHTML = '';

          for (const docSnap of novelSnap.docs) {
            const novel = docSnap.data();
            const id = docSnap.id;
            if(statusFilter !== 'all' && novel.status !== statusFilter) continue;

            const coverURL = await getNovelCover(novel);

            const card = document.createElement('div');
            card.className = 'submission-card';
            card.innerHTML = `
              <img src="${coverURL}" alt="Cover" />
              <div class="submission-details">
                <h3>${novel.title}</h3>
                <p><strong>Author:</strong> ${resolveAuthorName(novel, authorMap)}</p>
                <p><strong>Genre:</strong> ${novel.genre || '—'}</p>
                <p><strong>Status:</strong> ${novel.status}</p>
                <div class="action-buttons">
                  ${statusFilter==='pending'?'<button class="approve-btn">Approve</button><button class="reject-btn">Reject</button>':''}
                  ${statusFilter==='approved'?'<button class="rollback-btn">Rollback</button>':''}
                  ${statusFilter==='rejected'?'<button class="rollback-btn">Rollback</button><button class="delete-btn">Delete</button>':''}
                </div>
              </div>
            `;

            card.querySelector('.approve-btn')?.addEventListener('click', async () => {
              await updateDoc(doc(db, 'novels', id), { status: 'approved' });
              await sendNotification(novel.authorId, 'approval', `Your novel "${novel.title}" was approved.`);
              renderAll();
            });
            card.querySelector('.reject-btn')?.addEventListener('click', async () => {
              await updateDoc(doc(db, 'novels', id), { status: 'rejected' });
              await sendNotification(novel.authorId, 'rejection', `Your novel "${novel.title}" was rejected.`);
              renderAll();
            });
            card.querySelector('.rollback-btn')?.addEventListener('click', async () => {
              await updateDoc(doc(db, 'novels', id), { status: 'pending' });
              await sendNotification(novel.authorId, 'rollback', `Your novel "${novel.title}" was rolled back to pending.`);
              renderAll();
            });
            card.querySelector('.delete-btn')?.addEventListener('click', async () => {
              await deleteDoc(doc(db, 'novels', id));
              await sendNotification(novel.authorId, 'delete', `Your novel "${novel.title}" was deleted.`);
              renderAll();
            });

            container.appendChild(card);
          }
        };

        await renderNovelSection('pending','pending-list');
        await renderNovelSection('approved','approved-list');
        await renderNovelSection('rejected','rejected-list');

        // --- Series Section ---
        const seriesContainer = document.getElementById('series-list');
        if(seriesContainer){
          seriesContainer.innerHTML = '';
          for(const docSnap of seriesSnap.docs){
            const series = docSnap.data();
            const id = docSnap.id;
            const coverURL = await getSeriesCover(series);

            const card = document.createElement('div');
            card.className = 'series-card';
            card.innerHTML = `
              <img src="${coverURL}" alt="Series Cover"/>
              <h4>${series.title}</h4>
              <p>${series.description || ''}</p>
              <p><strong>Author:</strong> ${resolveAuthorName(series, authorMap)}</p>
              <button class="view-series-btn">View</button>
            `;
            card.querySelector('.view-series-btn')?.addEventListener('click', () => {
              alert(`Series: ${series.title}\nDescription: ${series.description || ''}`);
            });
            seriesContainer.appendChild(card);
          }
        }

        // --- Verse Section ---
        const verseContainer = document.getElementById('verse-list');
        if(verseContainer){
          verseContainer.innerHTML = '';
          for(const docSnap of verseSnap.docs){
            const verse = docSnap.data();
            const id = docSnap.id;
            const coverURL = await getVerseCover(verse);

            const card = document.createElement('div');
            card.className = 'verse-card';
            card.innerHTML = `
              <img src="${coverURL}" alt="Verse Cover"/>
              <div class="verse-details">
                <h3>${verse.title}</h3>
                <p>${verse.description}</p>
                <p><strong>Author:</strong> ${resolveAuthorName(verse, authorMap)}</p>
                <button class="view-verse-btn">View</button>
              </div>
            `;
            card.querySelector('.view-verse-btn')?.addEventListener('click', () => {
              alert(`Verse: ${verse.title}\nDescription: ${verse.description || ''}`);
            });
            verseContainer.appendChild(card);
          }
        }

      } catch(err){
        console.error('Error loading dashboard data:', err);
      }
    }

    await renderAll();
  });
});
