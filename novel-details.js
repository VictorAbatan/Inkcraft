import { app, db } from './firebase-config.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  setDoc,
  addDoc,
  serverTimestamp,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;
    });

  const auth = getAuth(app);

  // ✅ Inbox logic (status, comment, reply notifications)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      const inboxContainer = document.getElementById('inboxContainer');
      if (inboxContainer) {
        inboxContainer.innerHTML = '<p>Please log in to view your inbox.</p>';
      }
      return;
    }

    try {
      const inboxRef = collection(db, `users/${user.uid}/inbox`);
      const q = query(inboxRef, orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);

      const inboxContainer = document.getElementById('inboxContainer');
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
          if (msg.type === 'status') {
            content = `<p>📖 <strong>${msg.novelTitle || 'Your novel'}</strong> was <em>${msg.status}</em>.</p>`;
          } else if (msg.type === 'comment') {
            content = `<p>💬 New comment on <strong>${msg.novelTitle || 'your novel'}</strong> by ${msg.userName || 'Anonymous'}: "${msg.text}"</p>`;
          } else if (msg.type === 'reply') {
            content = `<p>↩️ ${msg.userName || 'Anonymous'} replied to your comment on <strong>${msg.novelTitle || 'your novel'}</strong>: "${msg.text}"</p>`;
          } else {
            content = `<p>${msg.text || 'You have a new message.'}</p>`;
          }

          const time = msg.timestamp?.toDate
            ? msg.timestamp.toDate().toLocaleString()
            : 'Unknown time';

          div.innerHTML = `
            ${content}
            <small>${time}</small>
          `;

          inboxContainer.appendChild(div);
        });
      }
    } catch (err) {
      console.error('Error loading inbox:', err);
      const inboxContainer = document.getElementById('inboxContainer');
      if (inboxContainer) {
        inboxContainer.innerHTML = '<p>Failed to load inbox.</p>';
      }
    }
  });

  // ✅ Novel details logic (only runs if novelId exists)
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
  document.getElementById('coverImage').src = data.cover || data.coverUrl || 'default-cover.jpg';
  document.getElementById('novelTitle').textContent = data.title || 'Untitled';

  // ✅ Unified author logic
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

  // ✅ SAFE genre check
  const genre = Array.isArray(data.genre) && data.genre.length > 0
    ? data.genre.join(', ')
    : data.genre || 'Unspecified';
  document.getElementById('genreList').textContent = genre;

  document.getElementById('novelSynopsis').textContent = data.synopsis || 'No synopsis available.';
  document.getElementById('readButton').href = `read-novel.html?novelId=${novelId}`;

  // ✅ Real-time Chapters Listener
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
    snapshot.forEach((docSnap) => {
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
  const q = query(chaptersRef, orderBy('order'));
  onSnapshot(q, renderChapters);

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

  // ✅ Add to Library Feature
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
        addToLibraryBtn.disabled = true;
      }

      addToLibraryBtn.addEventListener('click', async () => {
        try {
          await setDoc(libRef, {
            novelId: novelId,
            title: data.title || 'Untitled',
            cover: data.cover || data.coverUrl || '',
            addedAt: new Date()
          });
          addToLibraryBtn.textContent = '✔ Added';
          addToLibraryBtn.disabled = true;
        } catch (err) {
          console.error('Failed to add to library:', err);
          alert('Error saving novel to library.');
        }
      });
    });
  }

  // ✅ Comments Section
  const commentsTab = document.getElementById('commentsTab');
  if (commentsTab) {
    const commentsList = document.createElement('div');
    commentsList.id = 'commentsList';
    commentsTab.appendChild(commentsList);

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '💬 Show Comments';
    toggleBtn.style.margin = '1rem 0';
    commentsTab.insertBefore(toggleBtn, commentsList);

    commentsList.style.display = 'none';

    toggleBtn.addEventListener('click', () => {
      commentsList.style.display = commentsList.style.display === 'none' ? 'block' : 'none';
      toggleBtn.textContent = commentsList.style.display === 'none' ? '💬 Show Comments' : '💬 Hide Comments';
    });

    async function loadComments() {
      commentsList.innerHTML = '<p>Loading comments...</p>';
      try {
        const commentsRef = collection(db, `novels/${novelId}/comments`);
        const q = query(commentsRef, orderBy('timestamp', 'asc'));
        const snap = await getDocs(q);

        if (snap.empty) {
          commentsList.innerHTML = '<p>No comments yet.</p>';
          return;
        }

        commentsList.innerHTML = '';
        snap.forEach(docSnap => {
          const c = docSnap.data();
          const div = document.createElement('div');
          div.classList.add('comment');
          div.innerHTML = `
            <p><strong>${c.userName || 'Anonymous'}:</strong> ${c.text}</p>
          `;
          commentsList.appendChild(div);
        });
      } catch (err) {
        console.error('Error loading comments:', err);
        commentsList.innerHTML = '<p>Failed to load comments.</p>';
      }
    }

    loadComments();

    const form = document.createElement('form');
    form.innerHTML = `
      <textarea placeholder="Write a comment..." required></textarea>
      <button type="submit">Post</button>
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
        await addDoc(collection(db, `novels/${novelId}/comments`), {
          text,
          userId: user.uid,
          userName: user.displayName || 'Anonymous',
          timestamp: serverTimestamp()
        });
        form.reset();
        loadComments();
      } catch (err) {
        console.error('Failed to post comment:', err);
        alert('Error posting comment.');
      }
    });
  }
});
