import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, addDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const storage = getStorage();

document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
  fetch('author-floating-menu.html')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response.text();
    })
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (!container) return;

      container.innerHTML = html;

      const menuItems = container.querySelectorAll('.floating-menu .menu-item');
      menuItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.2}s`;
        item.classList.add('show');
      });

      const currentPage = window.location.pathname.split('/').pop().toLowerCase();
      container.querySelectorAll('.floating-menu a').forEach(link => {
        const href = link.getAttribute('href').toLowerCase();
        if (href === currentPage) {
          link.classList.add('active');
        }
      });
    })
    .catch(error => console.error('Error loading floating menu:', error));

  // Profile pic & pen name & cover preview
  const profilePicElement = document.getElementById('author-profile-pic');
  const penNameElement = document.getElementById('author-pen-name');
  const coverInput = document.getElementById('cover');
  const coverPreview = document.getElementById('cover-preview'); // single global reference

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const authorSnap = await getDoc(doc(db, 'authors', auth.currentUser.uid));
      let authorName = "Unknown Author";

      if (authorSnap.exists()) {
        const data = authorSnap.data();
        if (penNameElement) { // ✅ Check element exists
          if (data.penName) {
            penNameElement.textContent = data.penName;
            authorName = data.penName;
          }
        }
        if (data.profilePicURL && profilePicElement) profilePicElement.src = data.profilePicURL;
      }

      // Novel cover preview
      if (coverInput && coverPreview) {
        coverInput.addEventListener('change', (event) => {
          const file = event.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              coverPreview.src = e.target.result;
              coverPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
          } else {
            coverPreview.src = '';
            coverPreview.style.display = 'none';
          }
        });
      }

      // Load novels
      const novelsQuery = query(
        collection(db, 'novels'),
        where('authorId', '==', user.uid),
        where('status', '==', 'approved')
      );
      const novelsSnap = await getDocs(novelsQuery);
      const novelsContainer = document.getElementById('author-novels-container');
      if (novelsContainer) {
        novelsContainer.innerHTML = '';
        if (novelsSnap.empty) {
          novelsContainer.innerHTML = "<p>You haven't created any novels yet.</p>";
        } else {
          novelsSnap.forEach(doc => {
            const novel = doc.data();
            const div = document.createElement('div');
            div.className = 'author-novel-item';
            div.innerHTML = `<h3>${novel.title}</h3>`;
            novelsContainer.appendChild(div);
          });
        }
      }

      // Load series
      const seriesQuery = query(
        collection(db, 'series'),
        where('createdBy', '==', user.uid)
      );
      const seriesSnap = await getDocs(seriesQuery);
      const seriesContainer = document.getElementById('author-series-container');
      if (seriesContainer) {
        seriesContainer.innerHTML = '';
        seriesSnap.forEach(doc => {
          const series = doc.data();
          const div = document.createElement('div');
          div.className = 'author-series-item';
          div.innerHTML = `<h3>${series.title}</h3>`;
          seriesContainer.appendChild(div);
        });
      }

      // Load verses
      const versesQuery = query(
        collection(db, 'verses'),
        where('createdBy', '==', user.uid)
      );
      const versesSnap = await getDocs(versesQuery);
      const versesContainer = document.getElementById('author-verses-container');
      if (versesContainer) {
        versesContainer.innerHTML = '';
        versesSnap.forEach(doc => {
          const verse = doc.data();
          const div = document.createElement('div');
          div.className = 'author-verse-item';
          div.innerHTML = `<h3>${verse.title}</h3>`;
          versesContainer.appendChild(div);
        });
      }

    } catch (error) {
      console.error('Error loading author data:', error);
    }
  });
});

// Form submission
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-novel-form");
  const submitBtn = document.getElementById("submit-btn");
  const coverPreview = document.getElementById('cover-preview');

  if (!form) return console.error("❌ Form element not found");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("title")?.value.trim();
    const synopsis = document.getElementById("synopsis")?.value.trim();
    const formPenName = document.getElementById("penNameOverride")?.value.trim(); // ✅ Updated ID to match HTML

    const selectedGenres = Array.from(document.querySelectorAll('input[name="genre"]:checked'))
      .map(input => input.value)
      .filter(Boolean);
    const genre = selectedGenres.length ? selectedGenres : null;

    const tagsRaw = document.getElementById("tags")?.value?.trim() || "";
    const tags = tagsRaw ? tagsRaw.split(",").map(tag => tag.trim()).filter(Boolean) : [];
    const coverFile = document.getElementById("cover")?.files?.[0];

    try {
      let coverUrl = "";
      if (coverFile) {
        const coverRef = ref(
          storage,
          `novel-covers/${auth.currentUser.uid}/${Date.now()}-${coverFile.name}`
        );
        await uploadBytes(coverRef, coverFile);
        coverUrl = await getDownloadURL(coverRef);
      }

      const authorSnap = await getDoc(doc(db, 'authors', auth.currentUser.uid));
      const authorName = formPenName || (authorSnap.exists() && authorSnap.data()?.penName) || "Unknown Author";

      // ✅ Save novel
      const novelRef = await addDoc(collection(db, "novels"), {
        title,
        synopsis,
        genre,
        tags,
        coverUrl,
        authorId: auth.currentUser.uid,
        authorName,
        status: "pending",
        createdAt: serverTimestamp()
      });

      // ✅ Wire Pending Notification directly
      await setDoc(doc(db, `users/${auth.currentUser.uid}/notifications`, novelRef.id), {
        type: "pending",
        message: `Your novel "${title}" has been submitted and is pending review.`,
        novelId: novelRef.id,
        timestamp: serverTimestamp()
      });

      alert("✅ Your novel has been submitted for review!");
      form.reset();
      if (coverPreview) coverPreview.src = "";

    } catch (error) {
      console.error("❌ Error submitting novel:", error);
      alert("❌ Failed to submit novel. Please try again.");
    }
  });

  // Submit button enable/disable logic
  if (submitBtn) {
    const requiredFields = [
      document.getElementById("title"),
      document.getElementById("synopsis"),
      document.getElementById("cover")
    ];

    function checkFormValidity() {
      const allFilled = requiredFields.every(field => {
        if (!field) return false;
        return field.type === "file" ? field.files.length > 0 : field.value.trim() !== "";
      });
      submitBtn.disabled = !allFilled;
    }

    checkFormValidity();
    requiredFields.forEach(field => {
      if (!field) return;
      field.addEventListener("input", checkFormValidity);
      field.addEventListener("change", checkFormValidity);
    });
  }
});
