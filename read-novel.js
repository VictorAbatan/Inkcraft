import { app, db } from './firebase-config.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, collection, getDocs, query, orderBy, addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const auth = getAuth(app);
const urlParams = new URLSearchParams(window.location.search);
const novelId = urlParams.get('novelId');
const chapterFromUrl = parseInt(urlParams.get('chapter'), 10);

let chapters = [];
let currentChapterIndex = 0;
let scrollMode = true;

document.addEventListener('DOMContentLoaded', () => {
  const novelTitle = document.getElementById('novelTitle');
  const chapterContent = document.getElementById('chapterContent');
  const prevChapterBtn = document.getElementById('prevChapterBtn');
  const nextChapterBtn = document.getElementById('nextChapterBtn');
  const chapterSelect = document.getElementById('chapterSelect');
  const fontSelect = document.getElementById('fontSelect');
  const fontSlider = document.getElementById('fontSizeRange');
  const toggleFontBtn = document.getElementById('toggleFontBtn');
  const toggleSizeBtn = document.getElementById('toggleSizeBtn');
  const fontPopup = document.getElementById('fontPopup');
  const sizePopup = document.getElementById('sizePopup');
  const scrollToggleDock = document.getElementById('scrollToggleDock');
  const themeToggleDock = document.getElementById('themeToggleDock');
  const commentForm = document.getElementById('commentForm');
  const commentText = document.getElementById('commentText');
  const commentList = document.getElementById('commentList');

  // ✅ Added: TOC Button Setup
  const chapterListBtn = document.createElement('button');
  chapterListBtn.id = 'tocBtn';
  chapterListBtn.innerHTML = '<i class="fas fa-list"></i>';
  chapterListBtn.title = 'Chapters';
  document.getElementById('menuPopup').prepend(chapterListBtn);

  const chapterListPopup = document.createElement('div');
  chapterListPopup.id = 'chapterListPopup';
  chapterListPopup.classList.add('popup-panel');
  document.body.appendChild(chapterListPopup);

  chapterListBtn.addEventListener('click', () => {
    chapterListPopup.classList.toggle('active');
    fontPopup.classList.remove('active');
    sizePopup.classList.remove('active');
  });

  // Hide chapter popup if clicking outside
  document.addEventListener('click', (e) => {
    if (!chapterListPopup.contains(e.target) && e.target !== chapterListBtn) {
      chapterListPopup.classList.remove('active');
    }
  });

  // ✅ Scroll Progress
  const progressBar = document.createElement('div');
  progressBar.id = 'scrollProgress';
  document.body.appendChild(progressBar);

  document.addEventListener('scroll', () => {
    const height = document.body.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const percent = Math.min((scrolled / height) * 100, 100);
    progressBar.textContent = `Progress: ${Math.round(percent)}%`;
  });

  // ✅ Font Change
  fontSelect.addEventListener('change', () => {
    chapterContent.style.fontFamily = fontSelect.value;
  });

  // ✅ Font Size
  fontSlider.addEventListener('input', () => {
    chapterContent.style.fontSize = `${fontSlider.value}px`;
  });

  // ✅ Scroll/Page Mode
  scrollToggleDock.addEventListener('click', () => {
    scrollMode = !scrollMode;
    document.body.classList.toggle('page-mode', !scrollMode);
  });

  // ✅ Theme Toggle
  themeToggleDock.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });

  // ✅ Popup Toggles
  toggleFontBtn.addEventListener('click', () => {
    fontPopup.classList.toggle('active');
    sizePopup.classList.remove('active');
    chapterListPopup.classList.remove('active');
  });

  toggleSizeBtn.addEventListener('click', () => {
    sizePopup.classList.toggle('active');
    fontPopup.classList.remove('active');
    chapterListPopup.classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    if (!fontPopup.contains(e.target) && e.target !== toggleFontBtn) {
      fontPopup.classList.remove('active');
    }
    if (!sizePopup.contains(e.target) && e.target !== toggleSizeBtn) {
      sizePopup.classList.remove('active');
    }
  });

  // ✅ Chapter Selector Dropdown
  chapterSelect.addEventListener('change', () => {
    const index = parseInt(chapterSelect.value, 10);
    if (!isNaN(index)) scrollToChapter(index);
  });

  prevChapterBtn.addEventListener('click', () => {
    const prev = currentChapterIndex - 1;
    if (prev >= 0) scrollToChapter(prev);
    else alert('You are at the first chapter.');
  });

  nextChapterBtn.addEventListener('click', () => {
    const next = currentChapterIndex + 1;
    if (next < chapters.length) scrollToChapter(next);
    else alert('No more chapters.');
  });

  // ✅ Load Novel + Chapters
  loadNovel();

  async function loadNovel() {
    try {
      const novelRef = doc(db, 'novels', novelId);
      const snap = await getDoc(novelRef);
      if (!snap.exists()) return alert('Novel not found.');

      novelTitle.textContent = snap.data().title || 'Untitled Novel';
      await loadChapters();
    } catch (err) {
      console.error('Error loading novel:', err);
      alert('Failed to load novel.');
    }
  }

  async function loadChapters() {
    try {
      const q = query(
        collection(db, `novels/${novelId}/published_chapters`),
        orderBy('number') // 🔁 Enforce correct order
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        chapterSelect.innerHTML = '<option>No chapters yet</option>';
        return;
      }

      chapters = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

      chapterContent.innerHTML = '';
      chapterSelect.innerHTML = '';
      chapterListPopup.innerHTML = '';

      chapters.forEach((chapter, i) => {
        const opt = document.createElement('option');
        opt.value = i;
        opt.textContent = `Chapter ${chapter.number}: ${chapter.title || 'Untitled'}`;
        chapterSelect.appendChild(opt);

        const section = document.createElement('section');
        section.id = `chapter-${i}`;
        section.classList.add('flip-page');
        section.innerHTML = `
          <h2>Chapter ${chapter.number}: ${chapter.title || 'Untitled'}</h2>
          <p>${chapter.body}</p>
        `;
        chapterContent.appendChild(section);

        const link = document.createElement('div');
        link.textContent = `Chapter ${chapter.number}: ${chapter.title || 'Untitled'}`;
        link.style.cursor = 'pointer';
        link.style.padding = '5px 0';
        link.style.borderBottom = '1px solid #ccc';
        link.addEventListener('click', () => {
          scrollToChapter(i);
          chapterListPopup.classList.remove('active');
        });
        chapterListPopup.appendChild(link);
      });

      const startIndex = isNaN(chapterFromUrl)
        ? 0
        : chapters.findIndex(c => Number(c.number) === chapterFromUrl);

      scrollToChapter(startIndex >= 0 ? startIndex : 0);
    } catch (err) {
      console.error('Error loading chapters:', err);
      alert('Could not load chapters.');
    }
  }

  function scrollToChapter(index) {
    const target = document.getElementById(`chapter-${index}`);
    if (!target) return;

    if (document.body.classList.contains('page-mode')) {
      target.classList.remove('flip-page');
      void target.offsetWidth;
      target.classList.add('flip-page');
    }

    target.scrollIntoView({ behavior: 'smooth' });
    currentChapterIndex = index;
    chapterSelect.value = index;
    loadComments();
  }

  // ✅ Submit Comment
  commentForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = commentText.value.trim();
    if (!text) return;

    const user = auth.currentUser;
    if (!user) {
      alert('Please login to comment.');
      return;
    }

    try {
      const ref = collection(
        db,
        `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments`
      );
      await addDoc(ref, {
        text,
        userId: user.uid,
        createdAt: new Date()
      });

      commentText.value = '';
      loadComments();
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Failed to post comment.');
    }
  });

  // ✅ Load Comments
  async function loadComments() {
    try {
      const ref = collection(
        db,
        `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments`
      );
      const snap = await getDocs(ref);
      commentList.innerHTML = '';

      snap.forEach(doc => {
        const comment = doc.data();
        const li = document.createElement('li');
        li.textContent = comment.text;
        commentList.appendChild(li);
      });
    } catch (err) {
      console.error('Error loading comments:', err);
    }
  }
});
