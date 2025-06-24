import { app, db } from './firebase-config.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
  addDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const auth = getAuth(app);
const urlParams = new URLSearchParams(window.location.search);
const novelId = urlParams.get('novelId'); // Get novel ID from URL
const chapterFromUrl = parseInt(urlParams.get('chapter'), 10); // ✅ Support ?chapter=2

const novelTitle = document.getElementById('novelTitle');
const chapterList = document.getElementById('chapterList');
const chapterContent = document.getElementById('chapterContent');
const nextChapterBtn = document.getElementById('nextChapterBtn');
const scrollToggleBtn = document.getElementById('scrollToggleBtn');
const commentList = document.getElementById('commentList');
const commentForm = document.getElementById('commentForm');
const commentText = document.getElementById('commentText');
const themeToggleBtn = document.getElementById('themeToggleBtn');

let chapters = [];
let currentChapterIndex = 0;
let scrollMode = true;

// ✅ Font size slider
const fontSlider = document.getElementById('fontSizeRange');
fontSlider.addEventListener('input', () => {
  chapterContent.style.fontSize = `${fontSlider.value}px`;
});

// ✅ Previous chapter button
const prevBtn = document.getElementById('prevChapterBtn');
prevBtn.addEventListener('click', () => {
  const prevIndex = currentChapterIndex - 1;
  if (prevIndex >= 0) {
    loadChapterContent(prevIndex);
  } else {
    alert("You're at the first chapter.");
  }
});

// ✅ Scroll/Page Mode Toggle
scrollToggleBtn.addEventListener('click', () => {
  scrollMode = !scrollMode;
  document.body.classList.toggle('page-mode', !scrollMode);
  scrollToggleBtn.innerText = scrollMode ? 'Switch to Page Mode' : 'Switch to Scroll Mode';
});

// ✅ Dark Mode Toggle
themeToggleBtn.addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

// ✅ Font selector dropdown
const fontDropdown = document.createElement('select');
fontDropdown.innerHTML = `
  <option value="'Cormorant Garamond', serif">Cormorant Garamond</option>
  <option value="'Georgia', serif">Georgia</option>
  <option value="'Times New Roman', serif">Times New Roman</option>
  <option value="'Arial', sans-serif">Arial</option>
  <option value="'Courier New', monospace">Courier New</option>
`;
fontDropdown.style.marginLeft = '1rem';
fontDropdown.title = 'Change Font';

const fontControls = document.querySelector('.font-controls');
if (fontControls) fontControls.appendChild(fontDropdown);

fontDropdown.addEventListener('change', () => {
  chapterContent.style.fontFamily = fontDropdown.value;
});

// ✅ Chapter toggle (mobile)
const mobileToggle = document.createElement('button');
mobileToggle.className = 'mobile-toggle';
mobileToggle.innerText = '📖 Show Chapters';
document.body.appendChild(mobileToggle);

const chapterNav = document.querySelector('.chapter-nav');
mobileToggle.addEventListener('click', () => {
  chapterNav.classList.toggle('show');
  mobileToggle.innerText = chapterNav.classList.contains('show') ? '📕 Hide Chapters' : '📖 Show Chapters';
});

// === Load novel and chapters ===
async function loadNovel() {
  try {
    const novelRef = doc(db, 'novels', novelId);
    const novelSnap = await getDoc(novelRef);

    if (novelSnap.exists()) {
      const novel = novelSnap.data();
      novelTitle.innerText = novel.title;

      await loadChapters();
    } else {
      alert("Novel not found.");
    }
  } catch (error) {
    console.error("Error loading novel:", error);
    alert("Failed to load novel.");
  }
}

async function loadChapters() {
  const q = query(collection(db, `novels/${novelId}/published_chapters`), orderBy('order'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    chapterList.innerHTML = '<li>No chapters available.</li>';
    return;
  }

  chapters = snapshot.docs.map(docSnap => ({
    ...docSnap.data(),
    id: docSnap.id
  }));

  chapterList.innerHTML = '';

  chapters.forEach((chapter, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="?novelId=${novelId}&chapter=${chapter.number}" data-index="${index}">Chapter ${chapter.number}: ${chapter.title || 'Untitled'}</a>`;
    chapterList.appendChild(li);
  });

  // ✅ Load chapter from URL if available, else load first
  const chapterIndex = isNaN(chapterFromUrl)
    ? 0
    : chapters.findIndex(c => Number(c.number) === chapterFromUrl);

  loadChapterContent(chapterIndex >= 0 ? chapterIndex : 0);
}

function loadChapterContent(index) {
  const chapter = chapters[index];
  if (!chapter) {
    chapterContent.innerHTML = '<p>Chapter not found.</p>';
    return;
  }

  chapterContent.innerHTML = `
    <h2>Chapter ${chapter.number}: ${chapter.title || 'Untitled'}</h2>
    <p style="white-space:pre-line;">${chapter.body}</p>
  `;
  currentChapterIndex = index;
  loadComments();
}

chapterList.addEventListener('click', (e) => {
  const target = e.target;
  if (target.tagName === 'A') {
    e.preventDefault();
    const index = target.getAttribute('data-index');
    if (index !== null) {
      loadChapterContent(Number(index));
    }
  }
});

nextChapterBtn.addEventListener('click', () => {
  const nextIndex = currentChapterIndex + 1;
  if (nextIndex < chapters.length) {
    loadChapterContent(nextIndex);
  } else {
    alert("No more chapters.");
  }
});

commentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const comment = commentText.value.trim();
  if (comment) {
    try {
      const commentRef = collection(db, `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments`);
      await addDoc(commentRef, {
        text: comment,
        createdAt: new Date(),
        userId: auth.currentUser?.uid || 'anonymous'
      });

      commentText.value = '';
      loadComments();
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment.");
    }
  }
});

async function loadComments() {
  const commentRef = collection(db, `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments`);
  const snapshot = await getDocs(commentRef);
  commentList.innerHTML = '';

  snapshot.forEach(docSnap => {
    const comment = docSnap.data();
    const li = document.createElement('li');
    li.innerText = comment.text;
    commentList.appendChild(li);
  });
}

window.onload = loadNovel;
