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
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy,
  setDoc
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
const bodyInput = document.getElementById('chapterBody');
const notesInput = document.getElementById('chapterNotes');
const saveBtn = document.getElementById('saveBtn');
const previewBtn = document.getElementById('previewBtn');
const publishBtn = document.getElementById('publishBtn');
const previewArea = document.getElementById('previewArea');

let chapters = [];
let editingChapterId = null;

// AUTH & INITIALIZATION
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
  if (novel.submittedBy !== user.uid) {
    alert("Unauthorized.");
    window.location.href = 'author-novels.html';
    return;
  }

  if (novel.status !== 'published') {
    alert("This novel is not yet approved.");
    window.location.href = 'author-novels.html';
    return;
  }

  loadChapters();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const number = numberInput.value;
    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const notes = notesInput.value.trim();

    if (!number || !body) {
      alert("Chapter number and body are required.");
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
        alert("Chapter updated.");
        editingChapterId = null;
      } else {
        const newOrder = chapters.length + 1;
        await addDoc(collection(db, `novels/${novelId}/chapters`), {
          number: parseInt(number),
          title,
          body,
          notes,
          createdAt: serverTimestamp(),
          order: newOrder
        });
        alert("Chapter saved.");
      }

      form.reset();
      loadChapters();
    } catch (err) {
      console.error("Save failed:", err);
      alert("Failed to save chapter.");
    }
  });

  previewBtn.addEventListener('click', () => {
    const number = numberInput.value;
    const title = titleInput.value;
    const body = bodyInput.value;

    previewArea.innerHTML = `
      <hr>
      <h3>Preview - Chapter ${number}${title ? `: ${title}` : ''}</h3>
      <p style="white-space:pre-line;">${body}</p>
    `;
  });

  publishBtn.addEventListener('click', async () => {
    if (!editingChapterId) {
      alert("Please edit and save the chapter before publishing.");
      return;
    }

    try {
      const chapterRef = doc(db, `novels/${novelId}/chapters/${editingChapterId}`);
      const chapterSnap = await getDoc(chapterRef);

      if (!chapterSnap.exists()) {
        alert("Chapter not found.");
        return;
      }

      const chapterData = chapterSnap.data();
      const publishedRef = doc(db, `novels/${novelId}/published_chapters/${editingChapterId}`);
      await setDoc(publishedRef, {
        ...chapterData,
        publishedAt: serverTimestamp()
      });

      alert("Chapter published successfully.");
    } catch (err) {
      console.error("Publish failed:", err);
      alert("Failed to publish chapter.");
    }
  });
});

// LOAD CHAPTERS
async function loadChapters() {
  const q = query(collection(db, `novels/${novelId}/chapters`), orderBy('order'));
  const snapshot = await getDocs(q);

  list.innerHTML = '';
  chapters = [];

  if (snapshot.empty) {
    list.innerHTML = '<li>No chapters yet.</li>';
    return;
  }

  snapshot.forEach(docSnap => {
    const c = docSnap.data();
    chapters.push({ ...c, id: docSnap.id });
  });

  chapters.forEach((c, index) => {
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

// CHAPTER FUNCTIONS
window.editChapter = function (chapterId) {
  const chapter = chapters.find(c => c.id === chapterId);
  if (!chapter) return;

  numberInput.value = chapter.number;
  titleInput.value = chapter.title;
  bodyInput.value = chapter.body;
  notesInput.value = chapter.notes;
  editingChapterId = chapterId;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteChapter = async function (chapterId) {
  const confirmed = confirm("Are you sure you want to delete this chapter?");
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, `novels/${novelId}/chapters/${chapterId}`));
    alert("Chapter deleted.");
    loadChapters();
  } catch (error) {
    console.error("Delete failed:", error);
    alert("Failed to delete chapter.");
  }
};

window.moveChapter = async function (index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= chapters.length) return;

  const chapterA = chapters[index];
  const chapterB = chapters[targetIndex];

  try {
    await Promise.all([
      updateDoc(doc(db, `novels/${novelId}/chapters/${chapterA.id}`), { order: chapterB.order }),
      updateDoc(doc(db, `novels/${novelId}/chapters/${chapterB.id}`), { order: chapterA.order })
    ]);
    loadChapters();
  } catch (error) {
    console.error("Reorder failed:", error);
    alert("Failed to reorder chapters.");
  }
};
