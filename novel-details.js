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

  // ✅ Inbox logic — switched to real-time listener (onSnapshot)
  onAuthStateChanged(auth, async (user) => {
    const inboxContainer = document.getElementById('inboxContainer');
    if (!user) {
      if (inboxContainer) inboxContainer.innerHTML = '<p>Please log in to view your inbox.</p>';
      return;
    }

    try {
      const inboxRef = collection(db, `users/${user.uid}/inbox`);
      const q = query(inboxRef, orderBy('timestamp', 'desc'));

      // Real-time updates so authors see incoming notifications immediately
      onSnapshot(q, (snap) => {
        if (!inboxContainer) return;
        inboxContainer.innerHTML = '<h2>Inbox</h2>';
        if (snap.empty) {
          inboxContainer.innerHTML += '<p>No messages yet.</p>';
          return;
        }

        // Clear previous contents then re-render
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
            : (msg.createdAt ? new Date(msg.createdAt).toLocaleString() : 'Unknown time');

          div.innerHTML = `${content}<small>${time}</small>`;
          inboxContainer.appendChild(div);
        });
      }, (err) => {
        console.error('Inbox listener error:', err);
        if (inboxContainer) inboxContainer.innerHTML = '<p>Failed to load inbox.</p>';
      });

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
  if ((!data.penNameOverride && !data.authorName) && data.authorId) {
    try {
      const authorRef = doc(db, 'authors', data.authorId);
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

  // ✅ Add to Library
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
            novelId,
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

    // 🔹 Recursive renderer for comments + unlimited nested replies
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

          // ✅ helper to close menu
          const closeMenu = () => wrapper.classList.remove('show-actions');

          // 🔹 Toggle actions menu (only one open at a time, scoped)
          const menuBtn = wrapper.querySelector('.menu-btn');
          menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.comment.show-actions, .reply.show-actions')
              .forEach(el => {
                if (el !== wrapper) el.classList.remove('show-actions');
              });
            wrapper.classList.toggle('show-actions');
          });

          // ✅ Attach button actions
          const replyBtn = wrapper.querySelector('.reply-btn');
          const editBtn = wrapper.querySelector('.edit-btn');
          const deleteBtn = wrapper.querySelector('.delete-btn');

          if (replyBtn) {
            replyBtn.addEventListener('click', async () => {
              closeMenu(); // ✅ close instantly

              const existingForm = wrapper.querySelector('.inline-reply-form');
              if (existingForm) return;

              const form = document.createElement('form');
              form.classList.add('add-comment-box', 'inline-reply-form');
              form.innerHTML = `
                <textarea placeholder="Write a reply..." required></textarea>
                <button type="submit">Reply</button>
              `;
              wrapper.appendChild(form);

              form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const text = form.querySelector('textarea').value.trim();
                if (!text) return;
                const user = auth.currentUser;
                if (!user) return alert('Login required to reply.');

                try {
                  const userDoc = await getDoc(doc(db, 'users', user.uid));
                  const userData = userDoc.exists() ? userDoc.data() : {};

                  let userName = userData.displayName || userData.username || 'Anonymous';
                  let photoURL = 'assets/images/default-avatar.jpg';
                  if (userData.profileImagePath) {
                    try {
                      photoURL = await getDownloadURL(ref(storage, userData.profileImagePath));
                    } catch {}
                  }

                  await addDoc(collection(db, `${path}/${docSnap.id}/replies`), {
                    text,
                    userId: user.uid,
                    userName,
                    photoURL,
                    timestamp: serverTimestamp()
                  });
                } catch (err) {
                  console.error('Failed to post reply:', err);
                  alert('Error posting reply.');
                }

                form.remove();
              });
            });
          }

          if (editBtn) {
            editBtn.addEventListener('click', async () => {
              closeMenu(); // ✅ close instantly

              const existingForm = wrapper.querySelector('.inline-edit-form');
              if (existingForm) return;

              const currentText = c.text;
              const textEl = wrapper.querySelector('.comment-text');
              textEl.style.display = 'none';

              const form = document.createElement('form');
              form.classList.add('add-comment-box', 'inline-edit-form');
              form.innerHTML = `
                <textarea required>${currentText}</textarea>
                <div style="display:flex;gap:0.5rem;justify-content:flex-end;">
                  <button type="submit">Save</button>
                  <button type="button" class="cancel-btn">Cancel</button>
                </div>
              `;
              wrapper.insertBefore(form, wrapper.querySelector('.replies'));

              form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newText = form.querySelector('textarea').value.trim();
                if (newText && newText !== currentText) {
                  await updateDoc(doc(db, path, docSnap.id), { text: newText });
                }
                textEl.style.display = 'block';
                form.remove();
              });

              form.querySelector('.cancel-btn').addEventListener('click', () => {
                textEl.style.display = 'block';
                form.remove();
              });
            });
          }

          if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
              closeMenu(); // ✅ close instantly

              if (confirm('Delete this comment?')) {
                await deleteDoc(doc(db, path, docSnap.id));
              }
            });
          }

          // 🔹 Replies toggle button
          const toggleRepliesBtn = document.createElement('button');
          toggleRepliesBtn.classList.add('toggle-replies-btn');
          toggleRepliesBtn.textContent = 'Show Replies';
          wrapper.appendChild(toggleRepliesBtn);

          toggleRepliesBtn.addEventListener('click', () => {
            const repliesBox = wrapper.querySelector(`#replies-${docSnap.id}`);
            const isHidden = repliesBox.style.display === 'none' || !repliesBox.style.display;
            repliesBox.style.display = isHidden ? 'block' : 'none';
            toggleRepliesBtn.textContent = isHidden ? 'Hide Replies' : 'Show Replies';
          });

          // 🔹 Render nested replies
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

        // Add the comment to the chapter's comments collection
        // CAPTURE the commentRef so we can include commentId in the notification
        const commentRef = await addDoc(collection(db, `novels/${novelId}/comments`), {
          text,
          userId: user.uid,
          userName,
          photoURL,
          timestamp: serverTimestamp()
        });

        form.reset();

        commentsSection.classList.remove('hidden');
        toggleBtn.textContent = '💬 Hide Comments';

        // ====== Robust author UID resolution & inbox push ======
        let resolvedAuthorUid = null;

        // 1) Trust direct authorId/submittedBy/author fields on the novel if present
        if (data.authorId) {
          resolvedAuthorUid = data.authorId;
        } else if (data.submittedBy) {
          resolvedAuthorUid = data.submittedBy;
        } else if (data.author) {
          resolvedAuthorUid = data.author;
        } else {
          // 2) fallback: try to look up in authors collection (rare)
          try {
            const authorRef = doc(db, 'authors', novelId);
            const authorSnap = await getDoc(authorRef);
            if (authorSnap.exists()) {
              const aData = authorSnap.data();
              resolvedAuthorUid = aData.userUid || aData.uid || aData.userId || aData.firebaseUid || null;
            }
          } catch (err) {
            console.warn('authors lookup failed while resolving author UID:', err);
          }
        }

        console.log('Final resolved author UID for inbox:', resolvedAuthorUid, 'novelId:', novelId, 'commentId:', commentRef.id);

        // Prepare a notification object that inbox.js expects (includes novelId & message)
        const notification = {
          type: 'comment',
          novelTitle: data.title || '',
          novelId: novelId,
          commentId: commentRef.id, // include link to the comment
          message: `${userName} commented: "${text}"`,
          text: text,
          userId: user.uid,
          userName,
          photoURL,
          timestamp: serverTimestamp(),
          createdAt: Date.now(), // client-side fallback for immediate ordering/debug
          read: false
        };

        // Only skip if no UID or author is the commenter
        if (resolvedAuthorUid && resolvedAuthorUid !== user.uid) {
          try {
            const inboxWrite = await addDoc(collection(db, `users/${resolvedAuthorUid}/inbox`), notification);
            console.log('📩 Inbox notification added for author:', resolvedAuthorUid, 'docId:', inboxWrite.id);
          } catch (err) {
            console.error('❌ Failed to add notification to author inbox:', err);
          }
        } else {
          console.warn('⚠ Could not resolve valid author UID or author is commenter — inbox notification not sent. resolvedAuthorUid:', resolvedAuthorUid, 'commenter:', user.uid);
        }

      } catch (err) {
        console.error('Failed to post comment:', err);
        alert('Error posting comment.');
      }
    });
  }

  // ✅ Global click listener to close open menus
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
