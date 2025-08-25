import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const seriesId = urlParams.get("id");

  if (!seriesId) {
    console.error("No series ID provided in URL.");
    return;
  }

  try {
    // Fetch the series document
    const seriesRef = doc(db, "series", seriesId);
    const seriesSnap = await getDoc(seriesRef);

    if (!seriesSnap.exists()) {
      console.error("Series not found");
      return;
    }

    const seriesData = seriesSnap.data();

    // Populate series info
    document.getElementById("series-title").textContent = seriesData.title || "Untitled Series";
    document.getElementById("series-genre").textContent = seriesData.genre || "";
    document.getElementById("series-description").textContent = seriesData.description || "";
    document.getElementById("series-cover").src = seriesData.coverImageURL || "default-series-cover.jpg";

    // Fetch novels that belong to this series
    const novelsList = document.getElementById("novels-list");
    novelsList.innerHTML = "";

    const novelsQuery = query(
      collection(db, "novels"),
      where("seriesId", "==", seriesId)
    );

    const novelsSnap = await getDocs(novelsQuery);

    novelsSnap.forEach(docSnap => {
      const novel = docSnap.data();

      const card = document.createElement("div");
      card.className = "novel-card";
      card.innerHTML = `
        <img src="${novel.coverUrl || 'default-novel-cover.jpg'}" alt="${novel.title}">
        <p>${novel.title}</p>
      `;
      card.addEventListener("click", () => {
        window.location.href = `novel-details.html?id=${docSnap.id}`;
      });

      novelsList.appendChild(card);
    });

  } catch (error) {
    console.error("Error loading series details:", error);
  }
});
