import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  updateDoc,
  setDoc,
  doc,
  serverTimestamp,
  addDoc,
  deleteDoc,
  getDoc
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
  const approvedContainer = document.getElementById('approved-novels-container');
  const pendingVersesContainer = document.getElementById('pending-verses-list'); // ✅ New
  const approvedVersesContainer = document.getElementById('approved-verses-container'); // ✅ New

  darkToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
  });

  logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
      window.location.href = 'login.html';
    }).catch(error => {
      console.error('Logout failed:', error);
      alert('Logout failed.');
    });
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("You must be logged in.");
      window.location.href = 'login.html';
      return;
    }

    const tokenResult = await user.getIdTokenResult();
    if (!tokenResult.claims.admin) {
      alert("Access denied. Admins only.");
      window.location.href = 'login.html';
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, 'pending_novels'));
      let approved = 0, rejected = 0, pending = 0, notifications = 0;

      if (snapshot.empty) {
        listContainer.innerHTML = '<p>No pending submissions.</p>';
      } else {
        listContainer.innerHTML = '';

        snapshot.forEach(docSnap => {
          const novel = docSnap.data();
          const id = docSnap.id;

          if (novel.status === 'approved') approved++;
          if (novel.status === 'rejected') rejected++;

          if (novel.status === 'pending') {
            pending++;
            const card = document.createElement('div');
            card.className = 'submission-card';
            card.innerHTML = `
              <img src="${novel.coverUrl || 'placeholder.jpg'}" alt="Cover" />
              <div class="submission-details">
                <h3>${novel.title || 'Untitled'}</h3>
                <p><strong>Genre:</strong> ${novel.genre || '—'}</p>
                <p><strong>Tags:</strong> ${Array.isArray(novel.tags) ? novel.tags.join(', ') : '—'}</p>
                <p><strong>Synopsis:</strong> ${novel.synopsis || 'No synopsis available.'}</p>
                <div class="action-buttons">
                  <button class="approve-btn">Approve</button>
                  <button class="reject-btn">Reject</button>
                </div>
              </div>
            `;

            card.querySelector('.approve-btn').addEventListener('click', async () => {
              try {
                await updateDoc(doc(db, 'pending_novels', id), { status: 'approved' });

                await setDoc(doc(db, 'novels', id), {
                  ...novel,
                  status: 'published',
                  approvedAt: serverTimestamp()
                });

                await addDoc(collection(db, `users/${novel.submittedBy}/notifications`), {
                  type: 'approval',
                  message: `Your novel "${novel.title}" has been approved.`,
                  timestamp: serverTimestamp()
                });

                card.remove();
                approved++;
                pending--;
                notifications++;
                updateStats();
                updateNotif();
              } catch (error) {
                console.error("Error approving novel:", error);
                alert("Failed to approve novel.");
              }
            });

            card.querySelector('.reject-btn').addEventListener('click', async () => {
              try {
                await updateDoc(doc(db, 'pending_novels', id), { status: 'rejected' });

                await addDoc(collection(db, `users/${novel.submittedBy}/notifications`), {
                  type: 'rejection',
                  message: `Your novel "${novel.title}" was rejected.`,
                  timestamp: serverTimestamp()
                });

                card.remove();
                rejected++;
                pending--;
                notifications++;
                updateStats();
                updateNotif();
              } catch (error) {
                console.error("Error rejecting novel:", error);
                alert("Failed to reject novel.");
              }
            });

            listContainer.appendChild(card);
          }
        });
      }

      updateStats();
      updateNotif();

      // ✅ Load and display approved novels
      const publishedSnapshot = await getDocs(collection(db, 'novels'));

      if (publishedSnapshot.empty) {
        approvedContainer.innerHTML = '<p>No approved novels yet.</p>';
      } else {
        approvedContainer.innerHTML = '';

        publishedSnapshot.forEach(async (docSnap) => {
          const novel = docSnap.data();
          const id = docSnap.id;

          if (novel.status !== 'published') return;

          let chapterCount = 0;
          try {
            const chaptersSnapshot = await getDocs(collection(db, `novels/${id}/chapters`));
            chapterCount = chaptersSnapshot.size;
          } catch (err) {
            console.warn(`No chapters found for ${novel.title}`);
          }

          const card = document.createElement('div');
          card.className = 'approved-novel-card';
          card.innerHTML = `
            <img src="${novel.coverUrl || 'placeholder.jpg'}" alt="Cover of ${novel.title}" />
            <h4>${novel.title || 'Untitled'}</h4>
            <p>Chapters: ${chapterCount}</p>
            <div class="approved-actions">
              <button class="view-btn">View</button>
              <button class="rollback-btn">Rollback</button>
            </div>
          `;

          card.querySelector('.view-btn').addEventListener('click', () => {
            alert(`Feature coming soon: View/edit "${novel.title}"`);
          });

          card.querySelector('.rollback-btn').addEventListener('click', async () => {
            if (confirm(`Are you sure you want to unpublish "${novel.title}"?`)) {
              try {
                await setDoc(doc(db, 'pending_novels', id), {
                  ...novel,
                  status: 'pending',
                  rolledBackAt: serverTimestamp()
                });

                await deleteDoc(doc(db, 'novels', id));

                await addDoc(collection(db, `users/${novel.submittedBy}/notifications`), {
                  type: 'rollback',
                  message: `Your novel "${novel.title}" was unpublished and sent back for revision.`,
                  timestamp: serverTimestamp()
                });

                card.remove();
                approved--;
                pending++;
                updateStats();
                alert(`"${novel.title}" has been rolled back to pending novels.`);
              } catch (err) {
                console.error("Rollback failed:", err);
                alert("Failed to rollback this novel.");
              }
            }
          });

          approvedContainer.appendChild(card);
        });
      }

      // ✅ Load Pending Verses
      const verseSnapshot = await getDocs(collection(db, 'pending_verses'));
      if (verseSnapshot.empty) {
        pendingVersesContainer.innerHTML = '<p>No pending verses found.</p>';
      } else {
        pendingVersesContainer.innerHTML = '';
        verseSnapshot.forEach(docSnap => {
          const verse = docSnap.data();
          const id = docSnap.id;

          const card = document.createElement('div');
          card.className = 'verse-card';
          card.innerHTML = `
            <img src="${verse.coverURL || 'placeholder.jpg'}" alt="Verse Cover" />
            <div class="verse-details">
              <h3>${verse.title}</h3>
              <p>${verse.description}</p>
              <div class="action-buttons">
                <button class="approve-btn">Approve</button>
                <button class="reject-btn">Reject</button>
              </div>
            </div>
          `;

          card.querySelector('.approve-btn').addEventListener('click', async () => {
            try {
      const { status, ...verseData } = verse; // strip old status
await setDoc(doc(db, 'verses', id), {
  ...verseData,
  status: 'approved',
  approvedAt: serverTimestamp()
});


              await deleteDoc(doc(db, 'pending_verses', id));

              await addDoc(collection(db, `users/${verse.createdBy}/notifications`), {
                type: 'verse_approval',
                message: `Your verse "${verse.title}" has been approved.`,
                timestamp: serverTimestamp()
              });

              card.remove();
              notifications++;
              updateNotif();
            } catch (err) {
              console.error("Error approving verse:", err);
              alert("Failed to approve verse.");
            }
          });

          card.querySelector('.reject-btn').addEventListener('click', async () => {
            try {
              await deleteDoc(doc(db, 'pending_verses', id));

              await addDoc(collection(db, `users/${verse.createdBy}/notifications`), {
                type: 'verse_rejection',
                message: `Your verse "${verse.title}" was rejected.`,
                timestamp: serverTimestamp()
              });

              card.remove();
              notifications++;
              updateNotif();
            } catch (err) {
              console.error("Error rejecting verse:", err);
              alert("Failed to reject verse.");
            }
          });

          pendingVersesContainer.appendChild(card);
        });
      }

      // ✅ Load Approved Verses
      const approvedVerseSnapshot = await getDocs(collection(db, 'verses'));
      if (approvedVerseSnapshot.empty) {
        approvedVersesContainer.innerHTML = '<p>No approved verses yet.</p>';
      } else {
        approvedVersesContainer.innerHTML = '';
        approvedVerseSnapshot.forEach(docSnap => {
          const verse = docSnap.data();

          const card = document.createElement('div');
          card.className = 'approved-verse-card';
          card.innerHTML = `
            <img src="${verse.coverURL || 'placeholder.jpg'}" alt="Approved Verse Cover" />
            <div class="verse-details">
              <h3>${verse.title}</h3>
              <p>${verse.description}</p>
            </div>
          `;

          approvedVersesContainer.appendChild(card);
        });
      }

      function updateStats() {
        statApproved.textContent = approved;
        statRejected.textContent = rejected;
        statPending.textContent = pending;
      }

      function updateNotif() {
        notifCount.textContent = notifications;
      }

    } catch (err) {
      console.error("Error loading dashboard data:", err);
      listContainer.innerHTML = '<p>Error loading submissions.</p>';
    }
  });
});
