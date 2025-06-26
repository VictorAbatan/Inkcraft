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
let pageChunks = [];

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

  const pageIndicator = document.createElement('div');
  pageIndicator.id = 'pageIndicator';
  pageIndicator.style.textAlign = 'center';
  pageIndicator.style.margin = '1rem 0';
  pageIndicator.style.fontWeight = 'bold';
  chapterContent.parentElement.insertBefore(pageIndicator, chapterContent);

  const pageNav = document.createElement('div');
  pageNav.id = 'pageNav';
  pageNav.style.display = 'flex';
  pageNav.style.justifyContent = 'center';
  pageNav.style.gap = '1rem';
  pageNav.style.margin = '1rem 0';

  const prevPageBtn = document.createElement('button');
  prevPageBtn.textContent = '← Prev Page / Chapter';
  const nextPageBtn = document.createElement('button');
  nextPageBtn.textContent = 'Next Page / Chapter →';

  pageNav.appendChild(prevPageBtn);
  pageNav.appendChild(nextPageBtn);
  chapterContent.parentElement.insertBefore(pageNav, pageIndicator.nextSibling);

  let currentPageIndex = 0;

  prevPageBtn.addEventListener('click', () => {
    if (!scrollMode) {
      if (currentPageIndex > 0) {
        showPage(currentPageIndex - 1);
      } else if (currentChapterIndex > 0) {
        scrollToChapter(currentChapterIndex - 1, true);
      }
    } else {
      if (currentChapterIndex > 0) scrollToChapter(currentChapterIndex - 1);
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (!scrollMode) {
      if (currentPageIndex < pageChunks.length - 1) {
        showPage(currentPageIndex + 1);
      } else if (currentChapterIndex < chapters.length - 1) {
        scrollToChapter(currentChapterIndex + 1);
      }
    } else {
      if (currentChapterIndex < chapters.length - 1) scrollToChapter(currentChapterIndex + 1);
    }
  });

  let touchStartX = 0;
  let touchEndX = 0;

  chapterContent.addEventListener('touchstart', (e) => {
    if (!scrollMode) touchStartX = e.changedTouches[0].screenX;
  });

  chapterContent.addEventListener('touchend', (e) => {
    if (!scrollMode) {
      touchEndX = e.changedTouches[0].screenX;
      const diff = touchEndX - touchStartX;
      if (diff < -50) nextPageBtn.click();
      else if (diff > 50) prevPageBtn.click();
    }
  });

  const chapterListBtn = document.createElement('button');
  chapterListBtn.id = 'tocBtn';
  chapterListBtn.innerHTML = '<i class="fas fa-list"></i>';
  chapterListBtn.title = 'Chapters';
  document.getElementById('menuPopup').prepend(chapterListBtn);

  const chapterListPopup = document.createElement('div');
  chapterListPopup.id = 'chapterListPopup';
  chapterListPopup.classList.add('popup-panel');
  document.body.appendChild(chapterListPopup);

  chapterListBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    chapterListPopup.classList.toggle('active');
    fontPopup.classList.remove('active');
    sizePopup.classList.remove('active');
  });

  document.addEventListener('click', (e) => {
    if (!fontPopup.contains(e.target) && e.target !== toggleFontBtn) fontPopup.classList.remove('active');
    if (!sizePopup.contains(e.target) && e.target !== toggleSizeBtn) sizePopup.classList.remove('active');
    if (!chapterListPopup.contains(e.target) && e.target !== chapterListBtn) chapterListPopup.classList.remove('active');
  });

  const progressBar = document.createElement('div');
  progressBar.id = 'scrollProgress';
  document.body.appendChild(progressBar);

  document.addEventListener('scroll', () => {
    if (!scrollMode) return;
    const height = document.body.scrollHeight - window.innerHeight;
    const scrolled = window.scrollY;
    const percent = Math.min((scrolled / height) * 100, 100);
    progressBar.textContent = `Progress: ${Math.round(percent)}%`;
  });

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

  toggleFontBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fontPopup.classList.toggle('active');
    sizePopup.classList.remove('active');
    chapterListPopup.classList.remove('active');
  });

  toggleSizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sizePopup.classList.toggle('active');
    fontPopup.classList.remove('active');
    chapterListPopup.classList.remove('active');
  });

  chapterSelect.addEventListener('change', () => {
    const index = parseInt(chapterSelect.value, 10);
    if (!isNaN(index)) scrollToChapter(index);
  });

  prevChapterBtn.addEventListener('click', () => {
    if (currentChapterIndex > 0) scrollToChapter(currentChapterIndex - 1);
    else alert('You are at the first chapter.');
  });

  nextChapterBtn.addEventListener('click', () => {
    if (currentChapterIndex < chapters.length - 1) scrollToChapter(currentChapterIndex + 1);
    else alert('No more chapters.');
  });

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
        orderBy('number')
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

  function splitIntoChunks(text, maxWordsPerPage = 400) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim() !== '');
    const chunks = [];
    let currentChunk = '';
    let wordCount = 0;

    for (let paragraph of paragraphs) {
      const words = paragraph.split(/\s+/);
      if (wordCount + words.length > maxWordsPerPage && currentChunk.trim() !== '') {
        chunks.push(currentChunk.trim());
        currentChunk = paragraph;
        wordCount = words.length;
      } else {
        currentChunk += '\n\n' + paragraph;
        wordCount += words.length;
      }
    }

    if (currentChunk.trim() !== '') {
      chunks.push(currentChunk.trim());
    }

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

    updatePageUI();
    applyFontSettings();
    loadComments();
  }

  function showPage(index) {
    pageChunks.forEach((sec, i) => {
      sec.style.display = i === index ? 'block' : 'none';
    });
    currentPageIndex = index;
    updatePageUI();
  }

  function updatePageUI() {
    if (!scrollMode) {
      pageIndicator.textContent = `Page ${currentPageIndex + 1} / ${pageChunks.length}`;
    } else {
      pageIndicator.textContent = `Chapter ${currentChapterIndex + 1} / ${chapters.length}`;
    }
  }

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
