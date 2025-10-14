import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const storageRef = storage;
const fallbackAuthorAvatar = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';
const fallbackNovelCover = 'https://via.placeholder.com/150x220?text=No+Cover';

// ✅ Stylish Alert (matches login and library)
function showAlert(message, type = 'success') {
  const existingAlert = document.querySelector('.alert');
  if (existingAlert) existingAlert.remove();

  const alertBox = document.createElement('div');
  alertBox.className = `alert ${type}`;
  alertBox.textContent = message;
  document.body.appendChild(alertBox);

  // Show animation
  setTimeout(() => alertBox.classList.add('show'), 10);

  // Auto-remove after 2.5s
  setTimeout(() => {
    alertBox.classList.remove('show');
    setTimeout(() => alertBox.remove(), 300);
  }, 2500);
}

// --- Helper functions ---
async function getAuthorImage(data) {
  if (data.profilePicPath) {
    try {
      return await getDownloadURL(ref(storageRef, data.profilePicPath));
    } catch {
      return data.photoURL || data.profileImage || fallbackAuthorAvatar;
    }
  }
  return data.photoURL || data.profileImage || fallbackAuthorAvatar;
}

async function getNovelCover(novel) {
  if (novel.coverPath) {
    try {
      return await getDownloadURL(ref(storageRef, novel.coverPath));
    } catch {
      return novel.cover || novel.coverUrl || fallbackNovelCover;
    }
  }
  return novel.cover || novel.coverUrl || fallbackNovelCover;
}

// ================= DOMContentLoaded =================
document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
  fetch('author-floating-menu.html')
    .then(res => res.ok ? res.text() : Promise.reject(`HTTP error! Status: ${res.status}`))
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (!container) return;
      container.innerHTML = html;
      container.querySelectorAll('.floating-menu .menu-item').forEach((item, i) => {
        item.style.animationDelay = `${i * 0.2}s`;
        item.classList.add('show');
      });
      const currentPage = window.location.pathname.split('/').pop().toLowerCase();
      container.querySelectorAll('.floating-menu a').forEach(link => {
        if (link.getAttribute('href').toLowerCase() === currentPage) link.classList.add('active');
      });
    })
    .catch(err => console.error('Error loading floating menu:', err));

  const profilePicElement = document.getElementById('author-profile-pic');
  const penNameElement = document.getElementById('author-pen-name');
  const coverInput = document.getElementById('cover');
  const coverPreview = document.getElementById('cover-preview');

  // ===== Auth state =====
  onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'login.html';

    try {
      const authorSnap = await getDoc(doc(db, 'authors', user.uid));
      let authorName = 'Unknown Author';
      if (authorSnap.exists()) {
        const data = authorSnap.data();
        authorName = data.penName || 'Unknown Author';
        if (penNameElement) penNameElement.textContent = authorName;
        if (profilePicElement) profilePicElement.src = await getAuthorImage(data);
      } else {
        if (penNameElement) penNameElement.textContent = 'Unknown Author';
        if (profilePicElement) profilePicElement.src = fallbackAuthorAvatar;
      }

      // --- Novel cover preview ---
      if (coverInput && coverPreview) {
        coverInput.addEventListener('change', (event) => {
          const file = event.target.files[0];
          if (file) {
            coverPreview.src = URL.createObjectURL(file);
            coverPreview.style.display = 'block';
          } else {
            coverPreview.src = '';
            coverPreview.style.display = 'none';
          }
        });
      }

      // --- Load novels ---
      const novelsQuery = query(collection(db, 'novels'), where('authorId', '==', user.uid), where('status', '==', 'approved'));
      const novelsSnap = await getDocs(novelsQuery);
      const novelsContainer = document.getElementById('author-novels-container');
      if (novelsContainer) {
        novelsContainer.innerHTML = '';
        if (novelsSnap.empty) {
          novelsContainer.innerHTML = "<p>You haven't created any novels yet.</p>";
        } else {
          for (const docSnap of novelsSnap.docs) {
            const novel = docSnap.data();
            const coverUrl = await getNovelCover(novel);
            const div = document.createElement('div');
            div.className = 'author-novel-item';
            div.innerHTML = `<img src="${coverUrl}" alt="Novel cover"><h3>${novel.title}</h3>`;
            novelsContainer.appendChild(div);
          }
        }
      }

      // --- Load series ---
      const seriesQuery = query(collection(db, 'series'), where('createdBy', '==', user.uid));
      const seriesSnap = await getDocs(seriesQuery);
      const seriesContainer = document.getElementById('author-series-container');
      if (seriesContainer) {
        seriesContainer.innerHTML = '';
        for (const docSnap of seriesSnap.docs) {
          const series = docSnap.data();
          let seriesCover = series.coverImagePath ? await getDownloadURL(ref(storageRef, series.coverImagePath)) : series.coverImage || '';
          const div = document.createElement('div');
          div.className = 'author-series-item';
          div.innerHTML = `<img src="${seriesCover}" alt="Series cover"><h3>${series.title}</h3>`;
          seriesContainer.appendChild(div);
        }
      }

      // --- Load verses ---
      const versesQuery = query(collection(db, 'verses'), where('createdBy', '==', user.uid));
      const versesSnap = await getDocs(versesQuery);
      const versesContainer = document.getElementById('author-verses-container');
      if (versesContainer) {
        versesContainer.innerHTML = '';
        for (const docSnap of versesSnap.docs) {
          const verse = docSnap.data();
          let verseCover = verse.coverPath ? await getDownloadURL(ref(storageRef, verse.coverPath)) : '';
          const div = document.createElement('div');
          div.className = 'author-verse-item';
          div.innerHTML = `<img src="${verseCover}" alt="Verse cover"><h3>${verse.title}</h3>`;
          versesContainer.appendChild(div);
        }
      }

    } catch (err) {
      console.error('Error loading author data:', err);
    }
  });
});

// ================= Form submission =================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-novel-form");
  const submitBtn = document.getElementById("submit-btn");
  const coverPreview = document.getElementById('cover-preview');

  if (!form) return console.error("❌ Form element not found");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("title")?.value.trim();
    const synopsis = document.getElementById("synopsis")?.value.trim();
    const formPenName = document.getElementById("penNameOverride")?.value.trim();
    const selectedGenres = Array.from(document.querySelectorAll('input[name="genre"]:checked')).map(input => input.value).filter(Boolean);
    const genre = selectedGenres.length ? selectedGenres : null;
    const tagsRaw = document.getElementById("tags")?.value?.trim() || "";
    const tags = tagsRaw ? tagsRaw.split(",").map(tag => tag.trim()).filter(Boolean) : [];
    const coverFile = document.getElementById("cover")?.files?.[0];

    try {
      let coverPath = null;
      let coverUrl = "";

      if (coverFile) {
        coverPath = `novel-covers/${auth.currentUser.uid}/${Date.now()}-${coverFile.name}`;
        const coverRef = ref(storageRef, coverPath);
        await uploadBytes(coverRef, coverFile);
        coverUrl = await getDownloadURL(coverRef);
      }

      const authorSnap = await getDoc(doc(db, 'authors', auth.currentUser.uid));
      const authorName = formPenName || (authorSnap.exists() && authorSnap.data()?.penName) || "Unknown Author";

      const novelRef = await addDoc(collection(db, "novels"), {
        title,
        synopsis,
        genre,
        tags,
        coverUrl,
        coverPath,
        authorId: auth.currentUser.uid,
        authorName,
        status: "pending",
        createdAt: serverTimestamp()
      });

      // ✅ Pending notification
      await setDoc(doc(db, `users/${auth.currentUser.uid}/inbox`, novelRef.id), {
        type: "pending",
        message: `Your novel "${title}" has been submitted and is pending review.`,
        novelId: novelRef.id,
        timestamp: serverTimestamp()
      });

      showAlert("✅ Your novel has been submitted for review!", "success");
      form.reset();
      if (coverPreview) coverPreview.src = "";

    } catch (err) {
      console.error("❌ Error submitting novel:", err);
      showAlert("❌ Failed to submit novel. Please try again.", "error");
    }
  });

  // Submit button enable/disable logic
  const submitBtnFields = [
    document.getElementById("title"),
    document.getElementById("synopsis"),
    document.getElementById("cover")
  ];
  function checkFormValidity() {
    submitBtn.disabled = !submitBtnFields.every(f => f && (f.type === "file" ? f.files.length > 0 : f.value.trim() !== ""));
  }
  checkFormValidity();
  submitBtnFields.forEach(f => f?.addEventListener("input", checkFormValidity));
  submitBtnFields.forEach(f => f?.addEventListener("change", checkFormValidity));
});
