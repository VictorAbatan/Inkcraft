import { app, db, storage } from './firebase-config.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDownloadURL, ref } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { getImageURL } from './image-helpers.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;
    });

  const auth = getAuth(app);

  // ✅ Inbox logic
  onAuthStateChanged(auth, async (user) => {
    const inboxContainer = document.getElementById('inboxContainer');
    if (!user) {
      if (inboxContainer) inboxContainer.innerHTML = '<p>Please log in to view your inbox.</p>';
      return;
    }

    try {
      const inboxRef = collection(db, `users/${user.uid}/inbox`);
      const q = query(inboxRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);

      if (inboxContainer) {
        inboxContainer.innerHTML = '<h2>Inbox</h2>';
        if (snap.empty) {
          inboxContainer.innerHTML += '<p>No messages yet.</p>';
          return;
        }

        snap.forEach(docSnap => {
          const msg = docSnap.data();
          const div = document.createElement('div');
          div.classList.add('inbox-message');

          let content = '';
          switch (msg.type) {
            case 'status':
              content = `<p>📖 <strong>${msg.novelTitle || 'Your novel'}</strong> was <em>${msg.status}</em>.</p>`;
              break;
            case 'comment':
              content = `<p>💬 New comment on <strong>${msg.novelTitle || 'your novel'}</strong> by ${msg.userName || 'Anonymous'}: "${msg.text}"</p>`;
              break;
            case 'reply':
              content = `<p>↩️ ${msg.userName || 'Anonymous'} replied to your comment on <strong>${msg.novelTitle || 'your novel'}</strong>: "${msg.text}"</p>`;
              break;
            default:
              content = `<p>${msg.text || 'You have a new message.'}</p>`;
          }

          const time = msg.timestamp?.toDate
            ? msg.timestamp.toDate().toLocaleString()
            : 'Unknown time';

          div.innerHTML = `${content}<small>${time}</small>`;
          inboxContainer.appendChild(div);
        });
      }
    } catch (err) {
      console.error('Error loading inbox:', err);
      if (inboxContainer) inboxContainer.innerHTML = '<p>Failed to load inbox.</p>';
    }
  });

  // ✅ Novel details logic
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

  // ✅ Use helper for novel cover
  const coverImageEl = document.getElementById('coverImage');
  if (coverImageEl) {
    coverImageEl.src = await getImageURL(data, "novel");
    coverImageEl.alt = data.title || 'Novel Cover';
  }

  document.getElementById('novelTitle').textContent = data.title || 'Untitled';

  // Unified author logic
  let authorName = data.penNameOverride || data.authorName || 'Unknown';
  if ((!data.penNameOverride && !data.authorName) && data.submittedBy) {
    try {
      const authorRef = doc(db, 'authors', data.submittedBy);
      const authorSnap = await getDoc(authorRef);
      if (authorSnap.exists()) {
        const authorData = authorSnap.data();
        authorName = authorData.penName || authorData.name || authorName;
      }
    } catch (err) {
      console.warn('Failed to fetch author name:', err);
    }
  }
  document.getElementById('authorName').textContent = authorName;

  // Genre display
  const genre = Array.isArray(data.genre) && data.genre.length > 0
    ? data.genre.join(', ')
    : data.genre || 'Unspecified';
  document.getElementById('genreList').textContent = genre;

  document.getElementById('novelSynopsis').textContent = data.synopsis || 'No synopsis available.';
  const readButton = document.getElementById('readButton');
  readButton.href = `read-novel.html?novelId=${novelId}`;
  readButton.addEventListener('click', () => localStorage.setItem('lastNovelId', novelId));

  // ✅ Chapters
  const contentsTab = document.getElementById('contentsTab');
  const chapterCountEl = document.getElementById('chapterCount');

  function renderChapters(snapshot) {
    contentsTab.innerHTML = '<h2>Chapters</h2>';
    if (snapshot.empty) {
      chapterCountEl.textContent = 0;
      const p = document.createElement('p');
      p.textContent = 'No chapters uploaded yet.';
      contentsTab.appendChild(p);
      return;
    }

    const ul = document.createElement('ul');
    snapshot.forEach(docSnap => {
      const chapter = docSnap.data();
      const chapterId = docSnap.id;
      const chapterNumber = chapter.number != null ? chapter.number : 1;
      const chapterTitle = chapter.title || `Chapter ${chapterNumber}`;
      const li = document.createElement('li');
      li.innerHTML = `<a href="read-novel.html?novelId=${novelId}&chapterId=${chapterId}">
                        <span class="chapter-number">${chapterNumber}.</span>
                        <span class="chapter-title">${chapterTitle}</span>
                      </a>`;
      ul.appendChild(li);
    });
    contentsTab.appendChild(ul);
    chapterCountEl.textContent = snapshot.size;
  }

  const chaptersRef = collection(db, `novels/${novelId}/published_chapters`);
  const chaptersQuery = query(chaptersRef, orderBy('order'));
  onSnapshot(chaptersQuery, renderChapters);

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

  // ✅ Add to Library (toggle)
  const addToLibraryBtn = document.getElementById('addToLibraryBtn');
  if (addToLibraryBtn) {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        addToLibraryBtn.disabled = true;
        addToLibraryBtn.textContent = 'Login to Save';
        return;
      }

      const libRef = doc(db, `users/${user.uid}/library/${novelId}`);
      const libSnap = await getDoc(libRef);

      if (libSnap.exists()) {
        addToLibraryBtn.textContent = '✔ In Library';
        addToLibraryBtn.title = 'Tap to remove from library';
      } else {
        addToLibraryBtn.textContent = 'Add to Library';
        addToLibraryBtn.title = '';
      }

      addToLibraryBtn.addEventListener('click', async () => {
        try {
          const currentText = addToLibraryBtn.textContent;
          if (currentText.includes('In Library')) {
            await deleteDoc(libRef);
            addToLibraryBtn.textContent = 'Add to Library';
            addToLibraryBtn.title = '';
          } else {
            await setDoc(libRef, {
              novelId,
              title: data.title || 'Untitled',
              cover: data.cover || data.coverUrl || '',
              addedAt: new Date()
            });
            addToLibraryBtn.textContent = '✔ In Library';
            addToLibraryBtn.title = 'Tap to remove from library';
          }
        } catch (err) {
          console.error('Failed to toggle library:', err);
          alert('Error updating library.');
        }
      });
    });
  }

  // ✅ COMMENTS + REPLIES with actions
  const commentsTab = document.getElementById('commentsTab');
  if (commentsTab) {
    const commentsSection = document.createElement('div');
    commentsSection.id = 'commentsSection';
    commentsSection.classList.add('hidden');

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggleCommentsBtn';
    toggleBtn.classList.add('toggle-comments-btn');
    toggleBtn.textContent = '💬 Show Comments';
    commentsTab.appendChild(toggleBtn);
    commentsTab.appendChild(commentsSection);

    const commentsList = document.createElement('ul');
    commentsList.id = 'commentsList';
    commentsSection.appendChild(commentsList);

    // ✅ Toggle comments show/hide
    toggleBtn.addEventListener('click', () => {
      commentsSection.classList.toggle('hidden');
      toggleBtn.textContent = commentsSection.classList.contains('hidden')
        ? '💬 Show Comments'
        : '💬 Hide Comments';
    });

    // 🔹 Recursive renderer for comments
    async function renderThread(path, container) {
      const q = query(collection(db, path), orderBy('timestamp', 'asc'));
      onSnapshot(q, snapshot => {
        container.innerHTML = '';
        snapshot.forEach(docSnap => {
          const c = docSnap.data();
          const currentUser = auth.currentUser;
          const isOwner = currentUser && c.userId === currentUser.uid;

          const wrapper = document.createElement('div');
          wrapper.classList.add(path.includes('replies') ? 'reply' : 'comment');
          wrapper.innerHTML = `
            <div class="comment-header">
              <img src="${c.photoURL || 'assets/images/default-avatar.jpg'}" class="comment-avatar">
              <span class="comment-author">${c.userName || 'Anonymous'}</span>
              <span class="comment-date">${c.timestamp?.toDate ? c.timestamp.toDate().toLocaleString() : ''}</span>
              <div class="comment-actions">
                <button class="menu-btn">⋮</button>
                <div class="actions-menu">
                  ${isOwner
                    ? `<button class="action-btn edit-btn">Edit</button>
                       <button class="action-btn delete-btn">Delete</button>`
                    : `<button class="action-btn reply-btn">Reply</button>`
                  }
                </div>
              </div>
            </div>
            <p class="comment-text">${c.text}</p>
            <div class="replies" id="replies-${docSnap.id}" style="display:none;"></div>
          `;
          container.appendChild(wrapper);

          // ✅ Attach actions...
          // (unchanged for brevity)
          // renderThread for nested replies...
          const repliesContainer = wrapper.querySelector(`#replies-${docSnap.id}`);
          renderThread(`${path}/${docSnap.id}/replies`, repliesContainer);
        });
      });
    }

    renderThread(`novels/${novelId}/comments`, commentsList);

    // Comment form
    const form = document.createElement('form');
    form.id = 'commentForm';
    form.classList.add('add-comment-box');
    form.innerHTML = `
      <textarea id="commentInput" class="comment-input" placeholder="Write a comment..." required></textarea>
      <button type="submit" class="comment-submit">Post</button>
    `;
    commentsTab.appendChild(form);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        alert('You must be logged in to comment.');
        return;
      }
      const text = form.querySelector('textarea').value.trim();
      if (!text) return;

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : {};

        let userName = userData.displayName || userData.username || 'Anonymous';
        let photoURL = 'assets/images/default-avatar.jpg';
        if (userData.profileImagePath) {
          try {
            photoURL = await getDownloadURL(ref(storage, userData.profileImagePath));
          } catch {}
        }

        await addDoc(collection(db, `novels/${novelId}/comments`), {
          text,
          userId: user.uid,
          userName,
          photoURL,
          timestamp: serverTimestamp()
        });

        form.reset();

        commentsSection.classList.remove('hidden');
        toggleBtn.textContent = '💬 Hide Comments';

        const authorUid = data.submittedBy;
        if (authorUid && authorUid !== user.uid) {
          // 🔔 Send to inbox
          await addDoc(collection(db, `users/${authorUid}/inbox`), {
            type: 'comment',
            novelTitle: data.title,
            text,
            userId: user.uid,
            userName,
            photoURL,
            timestamp: serverTimestamp()
          });

          // 🔔 Send to notifications
          await addDoc(collection(db, `users/${authorUid}/notifications`), {
            type: 'comment',
            novelId,
            novelTitle: data.title,
            text,
            userId: user.uid,
            userName,
            photoURL,
            createdAt: serverTimestamp(),
            read: false
          });
        }
      } catch (err) {
        console.error('Failed to post comment:', err);
        alert('Error posting comment.');
      }
    });
  }

  // ✅ Global click listener
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('menu-btn')) return;
    document.querySelectorAll('.comment.show-actions, .reply.show-actions')
      .forEach(el => {
        if (!el.contains(e.target)) {
          el.classList.remove('show-actions');
        }
      });
  });
});
