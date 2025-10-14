import { app, db } from './firebase-config.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const auth = getAuth(app);
const storage = getStorage(app);
const fallbackNovelCover = 'https://via.placeholder.com/150x220?text=No+Novel+Cover';

// ✅ Custom centered alert (styling handled in CSS)
function showCenteredAlert(message) {
  const alertBox = document.createElement('div');
  alertBox.className = 'centered-alert';
  alertBox.textContent = message;
  document.body.appendChild(alertBox);

  setTimeout(() => {
    alertBox.classList.add('fade-out');
    setTimeout(() => alertBox.remove(), 500);
  }, 1500);
}

// ✅ Custom confirm popup (Inkcraft-styled)
function showConfirmDialog(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'inkcraft-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'inkcraft-dialog';
    dialog.innerHTML = `
      <p>${message}</p>
      <div class="dialog-buttons">
        <button class="btn confirm">OK</button>
        <button class="btn cancel">Cancel</button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    dialog.querySelector('.confirm').onclick = () => {
      overlay.remove();
      resolve(true);
    };
    dialog.querySelector('.cancel').onclick = () => {
      overlay.remove();
      resolve(false);
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      container.innerHTML = html;

      // ✅ Highlight active page
      const currentPage = window.location.pathname.split('/').pop();
      container.querySelectorAll('.floating-menu a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
          link.classList.add('active');
        }
      });

      // ✅ Logout handling
      const logoutBtn = container.querySelector('#logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          await signOut(auth);
          window.location.href = 'login.html';
        });
      }
    });

  // Wait for auth state
  onAuthStateChanged(auth, async user => {
    if (!user) {
      showCenteredAlert("You must be logged in to view your library.");
      window.location.href = 'login.html';
      return;
    }

    try {
      const libraryRef = collection(db, 'users', user.uid, 'library');
      const librarySnap = await getDocs(libraryRef);

      const grid = document.getElementById('libraryGrid');
      const emptyMessage = document.getElementById('emptyMessage');

      if (librarySnap.empty) {
        emptyMessage.style.display = 'block';
        return;
      }

      emptyMessage.style.display = 'none';

      let index = 0;
      for (const docSnap of librarySnap.docs) {
        const novelId = docSnap.id;
        const novelRef = doc(db, 'novels', novelId);
        const novelSnap = await getDoc(novelRef);

        if (novelSnap.exists()) {
          const novel = novelSnap.data();
          const card = document.createElement('div');
          card.className = 'novel-card';
          card.style.animationDelay = `${index * 100}ms`;

          // ✅ Load cover image using Storage first
          let coverURL = fallbackNovelCover;
          if (novel.coverPath) {
            try {
              coverURL = await getDownloadURL(ref(storage, novel.coverPath));
            } catch (err) {
              console.warn(`Failed to load novel cover from Storage for ${novelId}:`, err);
              coverURL = novel.cover || novel.coverUrl || fallbackNovelCover;
            }
          } else {
            coverURL = novel.cover || novel.coverUrl || fallbackNovelCover;
          }

          // ✅ Build novel card
          card.innerHTML = `
            <img src="${coverURL}" alt="Cover" />
            <h3>${novel.title || 'Untitled'}</h3>
            <a href="novel-details.html?novelId=${novelId}">View Details</a>
            <button class="remove-library-btn" data-id="${novelId}">Remove from Library</button>
          `;

          // ✅ Attach remove button event (using custom Inkcraft confirm)
          const removeBtn = card.querySelector('.remove-library-btn');
          removeBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmDialog(`Remove "${novel.title}" from your library?`);
            if (confirmed) {
              try {
                await deleteDoc(doc(db, 'users', user.uid, 'library', novelId));
                card.classList.add('removed');
                showCenteredAlert('Removed from Library');
                setTimeout(() => {
                  card.remove();
                  if (grid.children.length === 0) {
                    emptyMessage.style.display = 'block';
                  }
                }, 500);
              } catch (err) {
                console.error('Error removing novel:', err);
                showCenteredAlert('Failed to remove this novel. Please try again.');
              }
            }
          });

          grid.appendChild(card);
          index++;
        }
      }
    } catch (err) {
      console.error('Error loading library:', err);
      document.getElementById('emptyMessage').textContent = 'Failed to load your library.';
      document.getElementById('emptyMessage').style.display = 'block';
    }
  });
});
