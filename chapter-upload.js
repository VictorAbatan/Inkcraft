import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const auth = getAuth(app);
const urlParams = new URLSearchParams(window.location.search);
const novelId = urlParams.get('novelId');

if (!novelId) {
  alert("No novel ID found in URL.");
  window.location.href = 'author-novels.html';
}

const form = document.getElementById('chapterForm');
const list = document.getElementById('chapterList');
const numberInput = document.getElementById('chapterNumber');
const titleInput = document.getElementById('chapterTitle');
const bodyInput = document.getElementById('chapterBody'); // contenteditable div
const notesInput = document.getElementById('chapterNotes');
const saveBtn = document.getElementById('saveBtn');
const previewBtn = document.getElementById('previewBtn');
const publishBtn = document.getElementById('publishBtn');
const previewArea = document.getElementById('previewArea');

let chapters = [];
let editingChapterId = null;

/* === Markdown helper (for Notes only, NOT chapter body) === */
function formatTextToParagraphs(text) {
  if (!text) return '';
  text = text.trim();

  // 🔹 Only keep italics parsing for notes (so *note* works there)
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

  const paragraphs = text.split(/\n\s*\n/);
  return paragraphs
    .map(p => `<p>${p.trim().replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/* === TOOLBAR: only Italic === */
const formatButtons = document.querySelectorAll('.format-btn');

function updateToolbarState() {
  formatButtons.forEach(btn => {
    const cmd = btn.dataset.format; // only "italic" exists now
    try {
      const state = document.queryCommandState(cmd);
      if (state) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    } catch {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
}

formatButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const cmd = btn.dataset.format; // italic
    try {
      document.execCommand(cmd, false, null);
    } catch (err) {
      console.warn('Formatting not supported:', cmd, err);
    }
    updateToolbarState();
    bodyInput.focus();
  });
});

document.addEventListener('selectionchange', () => {
  if (document.activeElement === bodyInput) {
    updateToolbarState();
  }
});
bodyInput.addEventListener('keyup', updateToolbarState);
bodyInput.addEventListener('mouseup', updateToolbarState);
bodyInput.addEventListener('focus', updateToolbarState);
bodyInput.addEventListener('blur', updateToolbarState);

/* === AUTH & INITIALIZATION === */
onAuthStateChanged(auth, async user => {
  if (!user) {
    alert("Please log in to upload chapters.");
    window.location.href = 'login.html';
    return;
  }

  const novelRef = doc(db, 'novels', novelId);
  const novelSnap = await getDoc(novelRef);
  if (!novelSnap.exists()) {
    alert("Novel not found.");
    return;
  }

  const novel = novelSnap.data();
  const authorField = novel.authorId || novel.submittedBy || null;
  if (authorField !== user.uid) {
    alert("Unauthorized.");
    window.location.href = 'author-novels.html';
    return;
  }

  // Real-time listener for chapter changes
  const chaptersCol = collection(db, `novels/${novelId}/chapters`);
  onSnapshot(chaptersCol, (snapshot) => {
    chapters = [];
    snapshot.forEach(docSnap => {
      const c = docSnap.data();
      chapters.push({ ...c, id: docSnap.id });
    });
    renderChapterList();
    const event = new CustomEvent('chaptersUpdated', { detail: chapters });
    window.dispatchEvent(event);
  });

  // SAVE CHAPTER
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveChapter();
  });

  previewBtn.addEventListener('click', () => {
    const number = numberInput.value;
    const title = titleInput.value;
    const body = bodyInput.innerHTML; // 🔹 Use editor HTML directly
    const notes = notesInput.value;

    previewArea.innerHTML = `
      <hr>
      <h3>Preview - Chapter ${number}${title ? `: ${title}` : ''}</h3>
      ${notes ? `<div class="author-notes">${formatTextToParagraphs(notes)}</div>` : ''}
      <div class="chapter-body">
        ${body}
      </div>
    `;

    updateToolbarState();
  });

  publishBtn.addEventListener('click', async () => {
    try {
      await saveChapter(true);
      if (!editingChapterId) {
        alert("Failed to save chapter before publishing.");
        return;
      }
      const chapterRef = doc(db, `novels/${novelId}/chapters/${editingChapterId}`);
      const chapterSnap = await getDoc(chapterRef);
      if (!chapterSnap.exists()) return;

      const chapterData = chapterSnap.data();
      const publishedRef = doc(db, `novels/${novelId}/published_chapters/${editingChapterId}`);
      await setDoc(publishedRef, {
        ...chapterData,
        publishedAt: serverTimestamp(),
        order: chapterData.number || 0
      });

      alert("Chapter published successfully.");
      form.reset();
      bodyInput.innerHTML = "";
      editingChapterId = null;
      previewArea.innerHTML = '';
      updateToolbarState();
    } catch (err) {
      console.error("Publish failed:", err);
      alert("Failed to publish chapter.");
    }
  });
});

/* === SAVE === */
async function saveChapter(silent = false) {
  const number = numberInput.value;
  const title = titleInput.value.trim();
  const body = bodyInput.innerHTML.trim(); // 🔹 Preserve editor HTML
  const notes = notesInput.value.trim();

  if (!number || !body) {
    if (!silent) alert("Chapter number and body are required.");
    return;
  }

  try {
    if (editingChapterId) {
      await updateDoc(doc(db, `novels/${novelId}/chapters/${editingChapterId}`), {
        number: parseInt(number),
        title,
        body,
        notes
      });
      if (!silent) alert("Chapter updated.");
    } else {
      const docRef = await addDoc(collection(db, `novels/${novelId}/chapters`), {
        number: parseInt(number),
        title,
        body,
        notes,
        createdAt: serverTimestamp()
      });
      editingChapterId = docRef.id;
      if (!silent) alert("Chapter saved.");
    }

    if (!silent) {
      form.reset();
      bodyInput.innerHTML = "";
      previewArea.innerHTML = '';
      updateToolbarState();
    }
  } catch (err) {
    console.error("Save failed:", err);
    if (!silent) alert("Failed to save chapter.");
  }
}

/* === RENDER CHAPTER LIST === */
function renderChapterList() {
  list.innerHTML = '';
  if (chapters.length === 0) {
    list.innerHTML = '<li>No chapters yet.</li>';
    return;
  }

  const sorted = [...chapters].sort((a, b) => a.number - b.number);

  sorted.forEach((c, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>Chapter ${c.number}:</strong> ${c.title}
      <div class="chapter-actions">
        <button class="btn edit-btn" onclick="editChapter('${c.id}')"><i class="fas fa-edit"></i> Edit</button>
        <button class="btn delete-btn" onclick="deleteChapter('${c.id}')"><i class="fas fa-trash"></i> Delete</button>
        <button class="btn move-up" onclick="moveChapter(${index}, -1)"><i class="fas fa-arrow-up"></i></button>
        <button class="btn move-down" onclick="moveChapter(${index}, 1)"><i class="fas fa-arrow-down"></i></button>
      </div>
    `;
    list.appendChild(li);
  });
}

/* === EDIT / DELETE / MOVE === */
window.editChapter = function (chapterId) {
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  numberInput.value = chapter.number;
  titleInput.value = chapter.title;
  bodyInput.innerHTML = chapter.body || ''; // 🔹 Restore HTML directly
  notesInput.value = chapter.notes || '';
  editingChapterId = chapterId;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  updateToolbarState();
};

window.deleteChapter = async function (chapterId) {
  const confirmed = confirm("Are you sure you want to delete this chapter?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, `novels/${novelId}/chapters/${chapterId}`));

    const pubRef = doc(db, `novels/${novelId}/published_chapters/${chapterId}`);
    const pubSnap = await getDoc(pubRef);
    if (pubSnap.exists()) await deleteDoc(pubRef);

    alert("Chapter deleted.");
  } catch (error) {
    console.error("Delete failed:", error);
    alert("Failed to delete chapter.");
  }
};

window.moveChapter = async function (index, direction) {
  const sorted = [...chapters].sort((a, b) => a.number - b.number);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= sorted.length) return;

  const temp = sorted[index];
  sorted[index] = sorted[targetIndex];
  sorted[targetIndex] = temp;

  try {
    await Promise.all(
      sorted.map((chapter, i) =>
        updateDoc(doc(db, `novels/${novelId}/chapters/${chapter.id}`), { number: i + 1 })
      )
    );
  } catch (error) {
    console.error("Reorder failed:", error);
    alert("Failed to reorder chapters.");
  }
};
