import { app, db } from './firebase-config.js';
import { 
  getAuth, onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const auth = getAuth(app);
const urlParams = new URLSearchParams(window.location.search);
let novelId = urlParams.get('novelId') || localStorage.getItem('lastNovelId');
const chapterIdFromUrl = urlParams.get('chapterId');

let chapters = [];
let currentChapterIndex = 0;
let currentPageIndex = 0;
let scrollMode = true;
let pageChunks = [];

// Store novelId in localStorage for back button fallback
if (novelId) localStorage.setItem('lastNovelId', novelId);

// === Persistent unsub functions to avoid multiple snapshots ===
window.publishedChaptersUnsub = null;
window.chapterCommentsUnsub = null;

document.addEventListener('DOMContentLoaded', () => {
  const novelTitle = document.getElementById('novelTitle');
  const chapterContent = document.getElementById('chapterContent');
  const authorNotesEl = document.getElementById('authorNotes');
  const prevChapterBtn = document.getElementById('prevChapterBtn');
  const nextChapterBtn = document.getElementById('nextChapterBtn');
  const chapterSelect = document.getElementById('chapterSelect');
  const fontSelect = document.getElementById('fontSelect');
  const fontSlider = document.getElementById('fontSizeRange');
  const scrollToggleDock = document.getElementById('scrollToggleDock');
  const themeToggleDock = document.getElementById('themeToggleDock');
  const menuBtn = document.getElementById('menuButton');
  const menuPopup = document.getElementById('menuPopup');
  const toggleFontBtn = document.getElementById('toggleFontBtn');
  const toggleSizeBtn = document.getElementById('toggleSizeBtn');
  const toggleChapterListBtn = document.getElementById('toggleChapterList');
  const fontPopup = document.getElementById('fontPopup');
  const sizePopup = document.getElementById('sizePopup');
  const chapterListPopup = document.getElementById('chapterListPopup');
  const backBtn = document.getElementById('backToDetailsBtn');

  // ✅ Comments Elements
  const toggleCommentsBtn = document.getElementById('toggleCommentsBtn');
  const closeCommentsBtn = document.getElementById('closeCommentsBtn');
  const commentsContainer = document.getElementById('commentsContainer');

  // === Popup & Menu Toggle Logic ===
  function closeAllPopups(except = null) {
    if (except !== 'font') fontPopup.classList.remove('active');
    if (except !== 'size') sizePopup.classList.remove('active');
    if (except !== 'chapter') chapterListPopup.classList.remove('active');
    if (except !== 'menu') menuPopup.classList.remove('show');
  }

  toggleFontBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = fontPopup.classList.contains('active');
    closeAllPopups('font');
    if (!isActive) fontPopup.classList.add('active');
  });

  toggleSizeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = sizePopup.classList.contains('active');
    closeAllPopups('size');
    if (!isActive) sizePopup.classList.add('active');
  });

  toggleChapterListBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = chapterListPopup.classList.contains('active');
    closeAllPopups('chapter');
    if (!isActive) chapterListPopup.classList.add('active');
  });

  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = menuPopup.classList.contains('show');
    closeAllPopups('menu');
    if (!isShown) menuPopup.classList.add('show');
  });

  document.addEventListener('click', (e) => {
    if (
      !fontPopup.contains(e.target) &&
      !sizePopup.contains(e.target) &&
      !chapterListPopup.contains(e.target) &&
      !menuPopup.contains(e.target) &&
      e.target !== toggleFontBtn &&
      e.target !== toggleSizeBtn &&
      e.target !== toggleChapterListBtn &&
      e.target !== menuBtn
    ) {
      closeAllPopups();
    }
  });

  // === Font & Size ===
  function applyFontSettings() {
    chapterContent.style.fontFamily = fontSelect.value;
    chapterContent.style.fontSize = `${fontSlider.value}px`;
  }
  fontSelect.addEventListener('change', applyFontSettings);
  fontSlider.addEventListener('input', applyFontSettings);

  // === Scroll/Page Mode ===
  scrollToggleDock.addEventListener('click', () => {
    scrollMode = !scrollMode;
    document.body.classList.toggle('page-mode', !scrollMode);
    scrollToChapter(currentChapterIndex);
  });

  themeToggleDock.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });

  function updateScrollProgress() {
    if (scrollMode) {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const percent = scrollHeight ? Math.round((scrollTop / scrollHeight) * 100) : 0;
      document.getElementById('scrollProgress').textContent = `${percent}%`;
    } else {
      const percent = pageChunks.length ? Math.round(((currentPageIndex + 1) / pageChunks.length) * 100) : 0;
      document.getElementById('scrollProgress').textContent = `${percent}%`;
    }
  }

  window.addEventListener('scroll', updateScrollProgress);

  // === Back Button ===
  backBtn?.addEventListener('click', () => {
    if (commentsContainer?.classList.contains('show')) {
      commentsContainer.classList.remove('show');
      return;
    }
    if (novelId) {
      window.location.href = `novel-details.html?novelId=${novelId}`;
    } else {
      window.location.href = 'discover.html';
    }
  });

  // === Load Novel ===
  async function loadNovel() {
    if (!novelId) return alert('Novel ID missing.');
    try {
      const novelRef = doc(db, 'novels', novelId);
      const snap = await getDoc(novelRef);
      if (!snap.exists()) return alert('Novel not found.');

      const novelData = snap.data();
      novelTitle.textContent = novelData.title || 'Untitled Novel';
      authorNotesEl.textContent = novelData.notes || '';
      authorNotesEl.style.display = novelData.notes ? 'block' : 'none';

      await loadChaptersRealTime();
      initComments();
    } catch (err) {
      console.error('Error loading novel:', err);
    }
  }

// === COMMENTS ===
function initComments() {
  if (!toggleCommentsBtn || !closeCommentsBtn || !commentsContainer) return;

  // Only create form once
  let form = commentsContainer.querySelector('.comment-form');
  if (!form) {
    form = document.createElement('div');
    form.classList.add('comment-form');
    form.innerHTML = `
      <textarea id="newComment" placeholder="Add a comment..."></textarea>
      <button id="postCommentBtn">Post</button>
    `;
    commentsContainer.appendChild(form);
  }

  const postBtn = document.getElementById('postCommentBtn');
  const newCommentInput = document.getElementById('newComment');

  // Scrollable body for comments
  let commentsBody = commentsContainer.querySelector('.comments-body');
  if (!commentsBody) {
    commentsBody = document.createElement('div');
    commentsBody.classList.add('comments-body');
    commentsContainer.insertBefore(commentsBody, form);
  }

  commentsBody.innerHTML = '<p class="loading-comments">Loading comments…</p>';

  let currentChapterCollection = null;

  toggleCommentsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    commentsContainer.classList.add('show');
  });

  closeCommentsBtn.addEventListener('click', () => {
    commentsContainer.classList.remove('show');
  });

  async function loadChapterComments(chapterId) {
    if (!chapterId) return;
    currentChapterCollection = collection(db, `novels/${novelId}/published_chapters/${chapterId}/comments`);
    const q = query(currentChapterCollection, orderBy('createdAt'));

    if (window.chapterCommentsUnsub) {
      window.chapterCommentsUnsub(); 
      window.chapterCommentsUnsub = null;
    }

    window.chapterCommentsUnsub = onSnapshot(q, (snapshot) => {
      // Clear only previous comments, keep form at bottom
      commentsBody.innerHTML = '';

      if (snapshot.empty) {
        commentsBody.innerHTML = '<p class="no-comments">No comments yet.</p>';
        return;
      }

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const commentEl = document.createElement('div');
        commentEl.classList.add('comment');
        commentEl.innerHTML = `
          <div class="comment-header">
            <img src="${data.photoPath || data.profileImagePath || 'default-avatar.png'}" alt="user" class="comment-avatar" />
            <span class="comment-user">${data.displayName || data.username || 'Anonymous'}</span>
          </div>
          <p>${data.text}</p>
        `;

        const actions = document.createElement('div');
        actions.classList.add('comment-actions');

        if (auth.currentUser && auth.currentUser.uid === data.uid) {
          const editBtn = document.createElement('button');
          editBtn.textContent = 'Edit';
          editBtn.onclick = async () => {
            const newText = prompt('Edit your comment:', data.text);
            if (newText) await updateDoc(doc(currentChapterCollection, docSnap.id), { text: newText });
          };
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.onclick = async () => {
            if (confirm('Delete this comment?')) await deleteDoc(doc(currentChapterCollection, docSnap.id));
          };
          actions.appendChild(editBtn);
          actions.appendChild(deleteBtn);
        } else {
          const replyBtn = document.createElement('button');
          replyBtn.textContent = 'Reply';
          replyBtn.onclick = () => alert('Replies under replies supported in extended version.');
          actions.appendChild(replyBtn);
        }

        commentEl.appendChild(actions);
        commentsBody.appendChild(commentEl);
      });

      // Scroll to bottom on update
      commentsBody.scrollTop = commentsBody.scrollHeight;
    });
  }

  postBtn.onclick = async () => {
    if (!currentChapterCollection) return alert('Please select a chapter first.');
    const user = auth.currentUser;
    if (!user) return alert('Please log in to comment.');
    const text = newCommentInput.value.trim();
    if (!text) return;

    // Fetch user record from Firestore
    let userData = {};
    try {
      const userDocSnap = await getDoc(doc(db, 'users', user.uid));
      if (userDocSnap.exists()) userData = userDocSnap.data();
    } catch (err) {
      console.error('Error fetching user data:', err);
    }

    await addDoc(currentChapterCollection, {
      text,
      uid: user.uid,
      displayName: userData.displayName || 'Anonymous',
      username: userData.username || user.email.split('@')[0],
      photoPath: userData.profileImagePath || 'default-avatar.png',
      profileImagePath: userData.profileImagePath || 'default-avatar.png',
      createdAt: serverTimestamp()
    });

    newCommentInput.value = '';
    commentsBody.scrollTop = commentsBody.scrollHeight;
  };

  function updateCommentsForChapter() {
    const chapter = chapters[currentChapterIndex];
    if (chapter) loadChapterComments(chapter.id);
  }

  updateCommentsForChapter();

  chapterSelect.addEventListener('change', () => {
    const selectedId = chapterSelect.value;
    const idx = chapters.findIndex(c => c.id === selectedId);
    if (idx >= 0) {
      currentChapterIndex = idx;
      updateCommentsForChapter();
    }
  });
}



  // === Chapters ===
  async function loadChaptersRealTime() {
    const q = query(
      collection(db, `novels/${novelId}/published_chapters`),
      orderBy('number')
    );

    if (window.publishedChaptersUnsub) {
      window.publishedChaptersUnsub();
      window.publishedChaptersUnsub = null;
    }

    return new Promise(resolve => {
      window.publishedChaptersUnsub = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
          chapters = [];
          chapterSelect.innerHTML = '<option>No chapters</option>';
          chapterContent.innerHTML = '';
          resolve();
          return;
        }

        chapters = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        chapterSelect.innerHTML = '';
        chapters.forEach((ch) => {
          const opt = document.createElement('option');
          opt.value = ch.id;
          opt.textContent = `Chapter ${ch.number}: ${ch.title || 'Untitled'}`;
          chapterSelect.appendChild(opt);
        });

        let index = chapterIdFromUrl
          ? chapters.findIndex(c => c.id === chapterIdFromUrl)
          : 0;

        if (index < 0) index = 0;
        scrollToChapter(index);
        resolve();
      });
    });
  }

  // === Pagination & Page Display ===
  function calculateWordsPerPage() {
    const screenArea = window.innerWidth * window.innerHeight;
    if (screenArea < 400 * 900) return 120;
    if (screenArea < 800 * 1000) return 200;
    if (screenArea < 1200 * 1000) return 300;
    return 450;
  }

  function splitIntoChunks(text) {
    const maxWords = calculateWordsPerPage();
    const words = text.split(/\s+/).filter(w => w.trim() !== '');
    const chunks = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + maxWords, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start = end;
    }
    return chunks;
  }

  function scrollToChapter(index, goToLastPage = false) {
    currentChapterIndex = index;
    if (!chapters[index]) return;
    chapterSelect.value = chapters[index].id;
    chapterContent.innerHTML = '';
    pageChunks = [];

    const chapter = chapters[index];

    if (scrollMode) {
      const section = document.createElement('section');
      section.innerHTML = `
        <h2>Chapter ${chapter.number}: ${chapter.title || 'Untitled'}</h2>
        <div>${chapter.body.replace(/\n/g, '<br>')}</div>
      `;
      chapterContent.appendChild(section);

      if (chapter.notes) {
        const notesBlock = document.createElement('div');
        notesBlock.classList.add('author-notes');
        notesBlock.innerHTML = `<h3>Author Notes</h3><p>${chapter.notes.replace(/\n/g, '<br>')}</p>`;
        chapterContent.appendChild(notesBlock);
      }

      pageChunks.push(section);
    } else {
      const chunks = splitIntoChunks(chapter.body);
      chunks.forEach((chunk, i) => {
        const section = document.createElement('section');
        section.classList.add('flip-page');
        section.innerHTML = `
          <h2>Chapter ${chapter.number}: ${chapter.title || 'Untitled'} ${chunks.length > 1 ? `(Page ${i + 1})` : ''}</h2>
          <div>${chunk.replace(/\n/g, '<br>')}</div>
        `;
        section.style.display = i === 0 ? 'block' : 'none';
        chapterContent.appendChild(section);
        pageChunks.push(section);
      });

      if (chapter.notes && pageChunks.length > 0) {
        const notesBlock = document.createElement('div');
        notesBlock.classList.add('author-notes');
        notesBlock.innerHTML = `<h3>Author Notes</h3><p>${chapter.notes.replace(/\n/g, '<br>')}</p>`;
        pageChunks[pageChunks.length - 1].appendChild(notesBlock);
      }

      currentPageIndex = goToLastPage ? pageChunks.length - 1 : 0;
      showPage(currentPageIndex);
    }

    applyFontSettings();
    updateScrollProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (commentsContainer && typeof updateCommentsForChapter === 'function') {
      updateCommentsForChapter();
    }
  }

  function showPage(index, direction = 'next') {
    pageChunks.forEach((pg, i) => {
      if (i === index) {
        pg.style.display = 'block';
        const flipClass = direction === 'next' ? 'flipping-next' : 'flipping-prev';
        pg.classList.add(flipClass);
        setTimeout(() => pg.classList.remove(flipClass), 600);
      } else {
        pg.style.display = 'none';
      }
    });
    currentPageIndex = index;
    updateScrollProgress();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  chapterSelect.addEventListener('change', () => {
    const selectedId = chapterSelect.value;
    const idx = chapters.findIndex(c => c.id === selectedId);
    if (idx >= 0) scrollToChapter(idx);
  });

  prevChapterBtn.addEventListener('click', () => {
    if (scrollMode) {
      if (currentChapterIndex > 0) scrollToChapter(currentChapterIndex - 1, true);
      else alert('First chapter.');
    } else if (currentPageIndex > 0) {
      showPage(currentPageIndex - 1, 'prev');
    } else if (currentChapterIndex > 0) {
      scrollToChapter(currentChapterIndex - 1, true);
    } else {
      alert('First chapter.');
    }
  });

  nextChapterBtn.addEventListener('click', () => {
    if (scrollMode) {
      if (currentChapterIndex < chapters.length - 1) scrollToChapter(currentChapterIndex + 1);
      else alert('No more chapters.');
    } else if (currentPageIndex < pageChunks.length - 1) {
      showPage(currentPageIndex + 1, 'next');
    } else if (currentChapterIndex < chapters.length - 1) {
      scrollToChapter(currentChapterIndex + 1);
    } else {
      alert('No more chapters.');
    }
  });

  let touchStartX = 0;
  let touchEndX = 0;

  chapterContent.addEventListener('touchstart', (e) => {
    if (scrollMode) return;
    touchStartX = e.changedTouches[0].screenX;
  });

  chapterContent.addEventListener('touchend', (e) => {
    if (scrollMode) return;
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
  });

  function handleGesture() {
    const swipeDistance = touchEndX - touchStartX;
    const minSwipe = 50;
    if (swipeDistance > minSwipe) {
      if (currentPageIndex > 0) showPage(currentPageIndex - 1, 'prev');
      else if (currentChapterIndex > 0) scrollToChapter(currentChapterIndex - 1, true);
    } else if (swipeDistance < -minSwipe) {
      if (currentPageIndex < pageChunks.length - 1) showPage(currentPageIndex + 1, 'next');
      else if (currentChapterIndex < chapters.length - 1) scrollToChapter(currentChapterIndex + 1);
    }
  }

  loadNovel();
});

// ✅ Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.publishedChaptersUnsub) window.publishedChaptersUnsub();
  if (window.chapterCommentsUnsub) window.chapterCommentsUnsub();
});
