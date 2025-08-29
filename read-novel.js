import { app, db } from './firebase-config.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc, getDoc, collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const auth = getAuth(app);
const urlParams = new URLSearchParams(window.location.search);
const novelId = urlParams.get('novelId');
const chapterIdFromUrl = urlParams.get('chapterId');

let chapters = [];
let currentChapterIndex = 0;
let currentPageIndex = 0;
let scrollMode = true;
let pageChunks = [];

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

  // === Load Novel & Author Notes ===
  async function loadNovel() {
    try {
      const novelRef = doc(db, 'novels', novelId);
      const snap = await getDoc(novelRef);
      if (!snap.exists()) return alert('Novel not found.');

      const novelData = snap.data();
      novelTitle.textContent = novelData.title || 'Untitled Novel';

      // Global notes
      authorNotesEl.textContent = novelData.notes || '';
      authorNotesEl.style.display = novelData.notes ? 'block' : 'none';

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
      chapters.forEach((ch) => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = `Chapter ${ch.number}: ${ch.title || 'Untitled'}`;
        chapterSelect.appendChild(opt);
      });

      const index = chapterIdFromUrl
        ? chapters.findIndex(c => c.id === chapterIdFromUrl)
        : 0;

      scrollToChapter(index >= 0 ? index : 0);
    } catch (err) {
      console.error('Error loading chapters:', err);
    }
  }

  // === Dynamic Pagination Based on Screen Size ===
  function calculateWordsPerPage() {
    const screenArea = window.innerWidth * window.innerHeight;

    if (screenArea < 400 * 900) {
      return 120; // small phones
    } else if (screenArea < 800 * 1000) {
      return 200; // mid-size devices
    } else if (screenArea < 1200 * 1000) {
      return 300; // tablets
    } else {
      return 450; // desktops & large screens
    }
  }

  function splitIntoChunks(text) {
    const maxWords = calculateWordsPerPage();
    const words = text.split(/\s+/).filter(w => w.trim() !== '');
    const chunks = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + maxWords, words.length);
      const chunkWords = words.slice(start, end);
      chunks.push(chunkWords.join(' '));
      start = end;
    }

    return chunks;
  }

  function scrollToChapter(index, goToLastPage = false) {
    currentChapterIndex = index;
    chapterSelect.value = chapters[index].id;
    chapterContent.innerHTML = '';
    pageChunks = [];

    const chapter = chapters[index];

    if (scrollMode) {
      // Scroll mode: body then notes
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
      // Page mode
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

      // Notes on last page
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

    // ✅ Always reset scroll to top on new chapter
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // === Flip Animation Fixed (direction-aware) ===
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

    // ✅ Reset scroll to top when showing a page
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

  // ✅ Swipe Support with direction
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
