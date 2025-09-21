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

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("You must be logged in to view your profile.");
      window.location.href = "login.html";
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
    });

    // Handle save profile
    saveBtn.addEventListener("click", async () => {
      const name = displayNameInput.value.trim();
      if (!name) {
        alert("Please enter a display name.");
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

      alert("Profile updated successfully!");
      window.location.href = "Inkcraftmain.html";
    });
  });
});
