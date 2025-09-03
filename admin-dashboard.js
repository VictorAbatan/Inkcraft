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
  setDoc,
  serverTimestamp
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
  const approvedContainer = document.getElementById('approved-novels-container');

  [listContainer, logoutBtn, darkToggle, notifCount, statApproved, statRejected, statPending, statSeries, statVerses, approvedContainer]
    .forEach(el => { if (!el) console.error(`${el?.id || 'Element'} not found!`); });

  // ✅ Helper: send notification
  async function sendNotification(authorId, type, message) {
    const notifRef = doc(collection(db, "notifications", authorId, "items"));
    await setDoc(notifRef, {
      type,
      message,
      createdAt: serverTimestamp(),
      read: false
    });
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
      novelSnap.forEach(docSnap => {
        const novel = docSnap.data();
        const id = docSnap.id;
        if (novel.status === 'published' || novel.status === 'approved') approved++;
        if (novel.status === 'rejected') rejected++;
        if (novel.status === 'pending') {
          pending++;
          // 🔔 Notify when novel first enters pending
          sendNotification(
            novel.authorId,
            "pending",
            `Your novel "${novel.title}" has been submitted and is pending review.`
          ).catch(err => console.error("Failed to send pending notification:", err));
        }
        if (!listContainer) return;

        const authorName = authorMap.get(novel.author || novel.authorId) || 'Unknown Author';

        const card = document.createElement('div');
        card.className = 'submission-card';
        card.style.maxWidth = '350px';
        card.style.margin = '0.5rem';
        card.innerHTML = `
          <img src="${novel.coverUrl || 'placeholder.jpg'}" alt="Cover" />
          <div class="submission-details">
            <h3>${novel.title || 'Untitled'}</h3>
            <p><strong>Author:</strong> ${authorName}</p>
            <p><strong>Genre:</strong> ${novel.genre || '—'}</p>
            <p><strong>Tags:</strong> ${Array.isArray(novel.tags) ? novel.tags.join(', ') : '—'}</p>
            <p><strong>Synopsis:</strong> ${novel.synopsis || 'No synopsis available.'}</p>
            <p><strong>Status:</strong> ${novel.status}</p>
            <div class="action-buttons">
              <button class="rollback-btn">Rollback</button>
              ${novel.status === 'pending' ? '<button class="approve-btn">Approve</button>' : ''}
              ${novel.status !== 'rejected' ? '<button class="reject-btn">Reject</button>' : ''}
            </div>
          </div>
        `;
        listContainer.appendChild(card);

        // ✅ Rollback button
        card.querySelector('.rollback-btn')?.addEventListener('click', async () => {
          try {
            await updateDoc(doc(db, 'novels', id), { status: 'pending' });
            card.querySelector('p:nth-of-type(5)').textContent = `Status: pending`;
            alert(`Novel "${novel.title}" rolled back to pending.`);
            await sendNotification(novel.authorId, "rollback", `Your novel "${novel.title}" was rolled back by admin.`);

            // Re-add Approve button if missing
            if (!card.querySelector('.approve-btn')) {
              const approveBtn = document.createElement('button');
              approveBtn.className = 'approve-btn';
              approveBtn.textContent = 'Approve';
              card.querySelector('.action-buttons').appendChild(approveBtn);

              approveBtn.addEventListener('click', async () => {
                try {
                  await updateDoc(doc(db, 'novels', id), { status: 'approved' });
                  card.querySelector('p:nth-of-type(5)').textContent = `Status: approved`;
                  approveBtn.remove();
                  alert(`Novel "${novel.title}" approved.`);
                  await sendNotification(novel.authorId, "approval", `Your novel "${novel.title}" has been approved and is live.`);
                } catch (err) { console.error(err); alert('Approve failed.'); }
              });
            }
          } catch (err) { console.error(err); alert('Rollback failed.'); }
        });

        // Approve button
        const approveBtn = card.querySelector('.approve-btn');
        if (approveBtn) {
          approveBtn.addEventListener('click', async () => {
            try {
              await updateDoc(doc(db, 'novels', id), { status: 'approved' });
              card.querySelector('p:nth-of-type(5)').textContent = `Status: approved`;
              approveBtn.remove();
              alert(`Novel "${novel.title}" approved.`);
              await sendNotification(novel.authorId, "approval", `Your novel "${novel.title}" has been approved and is live.`);
            } catch (err) { console.error(err); alert('Approve failed.'); }
          });
        }

        // Reject button
        const rejectBtn = card.querySelector('.reject-btn');
        if (rejectBtn) {
          rejectBtn.addEventListener('click', async () => {
            try {
              await updateDoc(doc(db, 'novels', id), { status: 'rejected' });
              card.querySelector('p:nth-of-type(5)').textContent = `Status: rejected`;
              rejectBtn.remove();
              alert(`Novel "${novel.title}" rejected.`);
              await sendNotification(novel.authorId, "rejection", `Your novel "${novel.title}" was rejected. Please review feedback and resubmit.`);
            } catch (err) { console.error(err); alert('Reject failed.'); }
          });
        }
      });

      // === Approved Novels Section ===
      if (approvedContainer) approvedContainer.innerHTML = '';
      novelSnap.forEach(async docSnap => {
        const novel = docSnap.data();
        const id = docSnap.id;
        if (novel.status !== 'published') return;
        if (!approvedContainer) return;

        let chapterCount = 0;
        try { chapterCount = (await getDocs(collection(db, `novels/${id}/chapters`))).size; } catch {}

        const authorName = authorMap.get(novel.author || novel.authorId) || 'Unknown Author';

        const card = document.createElement('div');
        card.className = 'approved-novel-card';
        card.style.maxWidth = '250px';
        card.style.margin = '0.5rem';
        card.innerHTML = `
          <img src="${novel.coverUrl || 'placeholder.jpg'}" alt="Cover of ${novel.title}" />
          <h4>${novel.title || 'Untitled'}</h4>
          <p><strong>Author:</strong> ${authorName}</p>
          <p>Chapters: ${chapterCount}</p>
          <div class="approved-actions">
            <button class="rollback-btn">Rollback</button>
          </div>
        `;
        approvedContainer.appendChild(card);

        // ✅ Rollback approved novels
        card.querySelector('.rollback-btn')?.addEventListener('click', async () => {
          try {
            await updateDoc(doc(db, 'novels', id), { status: 'pending' });
            card.remove();
            alert(`Novel "${novel.title}" rolled back to pending.`);
            await sendNotification(novel.authorId, "rollback", `Your novel "${novel.title}" was rolled back by admin.`);
          } catch (err) { console.error(err); alert('Rollback failed.'); }
        });
      });

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

          const penName = authorMap.get(series.authorId || series.createdBy) || 'Unknown Author';

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

          const penName = authorMap.get(verse.authorId || verse.createdBy) || 'Unknown Author';

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
  });
});
