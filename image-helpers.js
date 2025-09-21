// image-helpers.js
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const storage = getStorage();

/**
 * Get the correct Firebase Storage download URL for an image
 * based on document data and type.
 *
 * @param {Object} data - Firestore document data
 * @param {string} type - one of: "author", "novel", "series", "verse", "user"
 * @returns {Promise<string>} - direct download URL or fallback
 */
export async function getImageURL(data, type) {
  try {
    let path;

    switch (type) {
      case "author":
        path = data.profilePicPath;
        break;
      case "novel":
        path = data.coverPath;
        break;
      case "series":
        path = data.coverImagePath;
        break;
      case "verse":
        path = data.coverPath;
        break;
      case "user":
        path = data.photoPath || data.profileImagePath;
        break;
      default:
        path = null;
    }

    if (path) {
      const storageRef = ref(storage, path);
      return await getDownloadURL(storageRef);
    }

  } catch (err) {
    console.warn(`⚠️ Could not fetch image for ${type}:`, err);
  }

  // ✅ Fallbacks
  switch (type) {
    case "author":
      return "default-author.jpg";
    case "novel":
      return "default-novel-cover.jpg";
    case "series":
      return "default-series-cover.jpg";
    case "verse":
      return "default-verse-cover.jpg";
    case "user":
      return "default-user.jpg";
    default:
      return "default-placeholder.jpg";
  }
}
