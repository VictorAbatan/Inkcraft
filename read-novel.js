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

const novelTitle = document.getElementById('novelTitle');
const chapterList = document.getElementById('chapterList');
const chapterContent = document.getElementById('chapterContent');
const nextChapterBtn = document.getElementById('nextChapterBtn');
const scrollToggleBtn = document.getElementById('scrollToggleBtn'); // ✅ Renamed
const commentList = document.getElementById('commentList');
const commentForm = document.getElementById('commentForm');
const commentText = document.getElementById('commentText');
const themeToggleBtn = document.getElementById('themeToggleBtn'); // ✅ New

let chapters = [];
let currentChapterIndex = 0;
let scrollMode = true;

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

// Fetch and display novel details
async function loadNovel() {
  try {
    const novelRef = doc(db, 'novels', novelId);
    const novelSnap = await getDoc(novelRef);

    if (novelSnap.exists()) {
      const novel = novelSnap.data();
      novelTitle.innerText = novel.title;

      // Load chapters
      loadChapters();
    } else {
      alert("Novel not found.");
    }
  } catch (error) {
    console.error("Error loading novel:", error);
    alert("Failed to load novel.");
  }
}

// Fetch and display chapters
async function loadChapters() {
  const q = query(collection(db, `novels/${novelId}/published_chapters`), orderBy('order'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    chapterList.innerHTML = '<li>No chapters available.</li>';
    return;
  }

  chapters = snapshot.docs.map(docSnap => ({
    ...docSnap.data(),
    id: docSnap.id // ✅ Needed for comment logic
  }));

  chapters.forEach((chapter, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="#" data-index="${index}">Chapter ${chapter.number}: ${chapter.title || 'Untitled'}</a>`;
    chapterList.appendChild(li);
  });

  // Load the first chapter
  loadChapterContent(0);
}

// Load selected chapter content
function loadChapterContent(index) {
  const chapter = chapters[index];
  chapterContent.innerHTML = `
    <h2>Chapter ${chapter.number}: ${chapter.title || 'Untitled'}</h2>
    <p style="white-space:pre-line;">${chapter.body}</p>
  `;
  currentChapterIndex = index;
  loadComments();
}

// Event listener for chapter selection
chapterList.addEventListener('click', (e) => {
  const index = e.target.getAttribute('data-index');
  if (index) {
    loadChapterContent(index);
  }
});

// Event listener for "Next Chapter" button
nextChapterBtn.addEventListener('click', () => {
  const nextIndex = currentChapterIndex + 1;
  if (nextIndex < chapters.length) {
    loadChapterContent(nextIndex);
  } else {
    alert("No more chapters.");
  }
});

// Event listener for comment submission
commentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const comment = commentText.value.trim();
  if (comment) {
    try {
      const commentRef = collection(db, `novels/${novelId}/published_chapters/${chapters[currentChapterIndex].id}/comments`);
      await addDoc(commentRef, {
        text: comment,
        createdAt: new Date(),
        userId: auth.currentUser.uid
      });

      commentText.value = '';
      loadComments(); // Reload comments
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("Failed to post comment.");
    }
  }
});

// Fetch and display comments
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

// Load the novel on page load
window.onload = loadNovel;
