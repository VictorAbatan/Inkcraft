import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const fallbackAvatar = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';

document.addEventListener("DOMContentLoaded", () => {
  const profilePic = document.getElementById("profile-pic");
  const profilePicInput = document.getElementById("profile-pic-input");
  const displayNameInput = document.getElementById("display-name");
  const saveBtn = document.getElementById("save-profile");

  let tempPhotoURL = null; // Temporary preview URL

  // === Toast Notification Function ===
  function showAlert(message, type = 'success') {
    const existingAlert = document.querySelector('.toast-alert');
    if (existingAlert) existingAlert.remove();

    const alertBox = document.createElement('div');
    alertBox.className = `toast-alert ${type}`;
    alertBox.textContent = message;
    document.body.appendChild(alertBox);

    // Slide in
    setTimeout(() => alertBox.classList.add('show'), 100);

    // Slide out
    setTimeout(() => {
      alertBox.classList.remove('show');
      setTimeout(() => alertBox.remove(), 600);
    }, 3500);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      showAlert("You must be logged in to view your profile.", "error");
      setTimeout(() => (window.location.href = "login.html"), 1200);
      return;
    }

    // Firestore references
    const userRef = doc(db, "users", user.uid);
    const authorRef = doc(db, "authorProfiles", user.uid);

    const [userSnap, authorSnap] = await Promise.all([getDoc(userRef), getDoc(authorRef)]);

    const activeRef = authorSnap.exists() ? authorRef : userRef;
    const data = (authorSnap.exists() ? authorSnap.data() : userSnap.data()) || {};

    // --- ✅ Load initial display name ---
    if (data.displayName) {
      displayNameInput.value = data.displayName;
    } else if (data.username) {
      displayNameInput.value = data.username;
    } else {
      displayNameInput.value = user.email;
    }

    // --- ✅ Load profile picture using Storage first ---
    async function loadProfilePicture() {
      let url = fallbackAvatar;

      if (data.photoPath) {
        try {
          url = await getDownloadURL(ref(storage, data.photoPath));
        } catch (err) {
          console.warn("Failed to load photoPath:", err);
        }
      } else if (data.profileImagePath) {
        try {
          url = await getDownloadURL(ref(storage, data.profileImagePath));
        } catch (err) {
          console.warn("Failed to load profileImagePath:", err);
        }
      } else if (data.photoURL) {
        url = data.photoURL;
      } else if (data.profileImage) {
        url = data.profileImage;
      }

      profilePic.src = url;
      tempPhotoURL = url;
    }

    await loadProfilePicture();

    // Handle profile picture preview & upload
    profilePicInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Immediate preview
      const localURL = URL.createObjectURL(file);
      profilePic.src = localURL;
      tempPhotoURL = localURL;

      // Upload to Firebase Storage
      const storagePath = activeRef.path.includes("authorProfiles")
        ? `authorProfiles/${user.uid}/profilePic.jpg`
        : `users/${user.uid}/profilePic.jpg`;

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore
      await updateDoc(activeRef, { 
        photoURL: downloadURL,
        profileImage: downloadURL,
        photoPath: storagePath,
        profileImagePath: storagePath
      }).catch(async () => {
        await setDoc(activeRef, { 
          photoURL: downloadURL,
          profileImage: downloadURL,
          photoPath: storagePath,
          profileImagePath: storagePath
        }, { merge: true });
      });

      tempPhotoURL = downloadURL; // final URL
      showAlert("Profile picture updated successfully!");
    });

    // Handle save profile
    saveBtn.addEventListener("click", async () => {
      const name = displayNameInput.value.trim();
      if (!name) {
        showAlert("Please enter a display name.", "error");
        return;
      }

      await setDoc(
        activeRef,
        { 
          displayName: name,
          username: name,
          photoURL: tempPhotoURL || profilePic.src,
          profileImage: tempPhotoURL || profilePic.src
        },
        { merge: true }
      );

      showAlert("Profile updated successfully!");
      setTimeout(() => (window.location.href = "Inkcraftmain.html"), 1500);
    });
  });
});
