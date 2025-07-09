import { app, db } from './firebase-config.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, collection, getDocs, query, orderBy, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const auth = getAuth(app);
const urlParams = new URLSearchParams(window.location.search);
const novelId = urlParams.get('novelId');
const chapterFromUrl = parseInt(urlParams.get('chapter'), 10);

let chapters = [];
let currentChapterIndex = 0;
let currentPageIndex = 0;
let scrollMode = true;
let pageChunks = [];

document.addEventListener('DOMContentLoaded', () => {
  const novelTitle = document.getElementById('novelTitle');
  const chapterContent = document.getElementById('chapterContent');
  const prevChapterBtn = document.getElementById('prevChapterBtn');
  const nextChapterBtn = document.getElementById('nextChapterBtn');
  const chapterSelect = document.getElementById('chapterSelect');
  const fontSelect = document.getElementById('fontSelect');
  const fontSlider = document.getElementById('fontSizeRange');
  const scrollToggleDock = document.getElementById('scrollToggleDock');
  const themeToggleDock = document.getElementById('themeToggleDock');
  const commentForm = document.getElementById('commentForm');
  const commentText = document.getElementById('commentText');
  const commentList = document.getElementById('commentList');

  const fontPopup = document.getElementById('fontPopup');
  const sizePopup = document.getElementById('sizePopup');
  const chapterListPopup = document.getElementById('chapterListPopup');
  const commentsPopup = document.getElementById('commentsPopup');

  const toggleFontBtn = document.getElementById('toggleFontBtn');
  const toggleSizeBtn = document.getElementById('toggleSizeBtn');
  const toggleChapterListBtn = document.getElementById('toggleChapterList');
  const toggleCommentsBtn = document.getElementById('toggleCommentsBtn');
  const menuBtn = document.getElementById('menuButton');
  const menuPopup = document.getElementById('menuPopup');

  // ✅ Popup Toggle Setup
  function setupPopupToggles() {
    function closeAllPopups(except = null) {
      if (except !== 'font') fontPopup.classList.remove('active');
      if (except !== 'size') sizePopup.classList.remove('active');
      if (except !== 'chapter') chapterListPopup.classList.remove('active');
      if (except !== 'comments') commentsPopup.classList.remove('active');
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

    toggleCommentsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isActive = commentsPopup.classList.contains('active');
      closeAllPopups('comments');
      if (!isActive) {
        commentsPopup.classList.add('active');
        loadComments();
      }
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
        !commentsPopup.contains(e.target) &&
        !menuPopup.contains(e.target) &&
        e.target !== toggleFontBtn &&
        e.target !== toggleSizeBtn &&
        e.target !== toggleChapterListBtn &&
        e.target !== toggleCommentsBtn &&
        e.target !== menuBtn
      ) {
        closeAllPopups();
      }
    });
  }

  setupPopupToggles(); // ✅ Run popup setup

  // ✅ Comment submission logic...
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = commentText.value.trim();
    if (!text) return;

    const user = auth.currentUser;
    if (!user) return alert('Login to comment.');

    try {
      const commentData = {
        text,
        userId: user.uid,
        userDisplayName: user.displayName || 'Anonymous',
        userPhotoURL: user.photoURL || '',
        createdAt: serverTimestamp()
      };

      const ref = collection(
        db,
        `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments`
      );
      await addDoc(ref, commentData);

      await addDoc(collection(db, 'inbox'), {
        ...commentData,
        novelId,
        chapterId: chapters[currentChapterIndex].id,
        type: 'comment'
      });

      commentText.value = '';
      loadComments();
    } catch (err) {
      console.error('Error posting comment:', err);
    }
  });

  async function loadComments() {
    try {
      const ref = collection(
        db,
        `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments`
      );
      const snap = await getDocs(ref);
      commentList.innerHTML = '';

      snap.forEach(docSnap => {
        const comment = docSnap.data();
        const commentId = docSnap.id;

        const li = document.createElement('li');
        li.innerHTML = `
          <div class="comment-header">
            <img src="${comment.userPhotoURL || 'default-avatar.png'}" alt="avatar" class="avatar" />
            <strong>${comment.userDisplayName || 'Reader'}</strong>
          </div>
          <p>${comment.text}</p>
          <button class="reply-btn" data-id="${commentId}">Reply</button>
          <ul class="replies" id="replies-${commentId}"></ul>
        `;
        commentList.appendChild(li);

        loadReplies(commentId);

        const replyBtn = li.querySelector('.reply-btn');
        replyBtn.addEventListener('click', () => {
          const replyText = prompt('Your reply:');
          if (!replyText) return;

          const user = auth.currentUser;
          if (!user) return alert('Login to reply.');

          const replyRef = collection(
            db,
            `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments/${commentId}/replies`
          );

          addDoc(replyRef, {
            text: replyText,
            userId: user.uid,
            userDisplayName: user.displayName || 'Anonymous',
            userPhotoURL: user.photoURL || '',
            createdAt: serverTimestamp()
          }).then(() => loadReplies(commentId));
        });
      });
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  }

  async function loadReplies(commentId) {
    try {
      const ref = collection(
        db,
        `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments/${commentId}/replies`
      );
      const snap = await getDocs(ref);
      const container = document.getElementById(`replies-${commentId}`);
      container.innerHTML = '';

      snap.forEach(docSnap => {
        const reply = docSnap.data();
        const li = document.createElement('li');
        li.innerHTML = `
          <div class="reply-header">
            <img src="${reply.userPhotoURL || 'default-avatar.png'}" alt="avatar" class="avatar small" />
            <em>${reply.userDisplayName || 'Reader'}</em>: ${reply.text}
          </div>
        `;
        container.appendChild(li);
      });
    } catch (err) {
      console.error('Error loading replies:', err);
    }
  }

  // === Reader Functions (unchanged) ===

  function applyFontSettings() {
    chapterContent.style.fontFamily = fontSelect.value;
    chapterContent.style.fontSize = `${fontSlider.value}px`;
  }
  fontSelect.addEventListener('change', applyFontSettings);
  fontSlider.addEventListener('input', applyFontSettings);

  scrollToggleDock.addEventListener('click', () => {
    scrollMode = !scrollMode;
    document.body.classList.toggle('page-mode', !scrollMode);
    scrollToChapter(currentChapterIndex);
  });

  themeToggleDock.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });

  async function loadNovel() {
    try {
      const novelRef = doc(db, 'novels', novelId);
      const snap = await getDoc(novelRef);
      if (!snap.exists()) return alert('Novel not found.');
      novelTitle.textContent = snap.data().title || 'Untitled Novel';
      await loadChapters();
    } catch (err) {
      console.error('Error loading novel:', err);
    }
  }

  async function loadChapters() {
    try {
      const q = query(
        collection(db, `novels/${novelId}/published_chapters`),
        orderBy('number')
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        chapterSelect.innerHTML = '<option>No chapters</option>';
        return;
      }

      chapters = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      chapterSelect.innerHTML = '';
      chapters.forEach((ch, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Chapter ${ch.number}: ${ch.title || 'Untitled'}`;
        chapterSelect.appendChild(opt);
      });

      const index = isNaN(chapterFromUrl)
        ? 0
        : chapters.findIndex(c => Number(c.number) === chapterFromUrl);

      scrollToChapter(index >= 0 ? index : 0);
    } catch (err) {
      console.error('Error loading chapters:', err);
    }
  }

  function splitIntoChunks(text, maxWords = window.innerWidth <= 768 ? 200 : 400) {
    const paras = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
    const chunks = [];
    let chunk = '';
    let words = 0;

    for (let p of paras) {
      const w = p.split(/\s+/);
      if (words + w.length > maxWords && chunk) {
        chunks.push(chunk.trim());
        chunk = p;
        words = w.length;
      } else {
        chunk += '\n\n' + p;
        words += w.length;
      }
    }

    if (chunk.trim()) chunks.push(chunk.trim());
    return chunks;
  }

  function scrollToChapter(index, goToLastPage = false) {
    currentChapterIndex = index;
    chapterSelect.value = index;
    chapterContent.innerHTML = '';
    pageChunks = [];

    const chapter = chapters[index];
    const chunks = scrollMode ? [chapter.body] : splitIntoChunks(chapter.body);

    chunks.forEach((chunk, i) => {
      const section = document.createElement('section');
      section.classList.add('flip-page');
      section.innerHTML = `
        <h2>Chapter ${chapter.number}: ${chapter.title || 'Untitled'} ${!scrollMode && chunks.length > 1 ? `(Page ${i + 1})` : ''}</h2>
        <p>${chunk.replace(/\n/g, '<br>')}</p>
      `;
      section.style.display = scrollMode || i === 0 ? 'block' : 'none';
      chapterContent.appendChild(section);
      pageChunks.push(section);
    });

    currentPageIndex = goToLastPage ? pageChunks.length - 1 : 0;
    if (!scrollMode) showPage(currentPageIndex);
    applyFontSettings();

    if (commentsPopup.classList.contains('active')) {
      loadComments();
    }
  }

  function showPage(index) {
    pageChunks.forEach((pg, i) => {
      pg.style.display = i === index ? 'block' : 'none';
    });
    currentPageIndex = index;
  }

  chapterSelect.addEventListener('change', () => {
    const idx = parseInt(chapterSelect.value, 10);
    if (!isNaN(idx)) scrollToChapter(idx);
  });

  prevChapterBtn.addEventListener('click', () => {
    if (currentChapterIndex > 0) scrollToChapter(currentChapterIndex - 1);
    else alert('First chapter.');
  });

  nextChapterBtn.addEventListener('click', () => {
    if (currentChapterIndex < chapters.length - 1) scrollToChapter(currentChapterIndex + 1);
    else alert('No more chapters.');
  });

  loadNovel();
});
