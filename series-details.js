import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ Load floating menu
  const menuContainer = document.getElementById('floating-menu-container');
  if (menuContainer) {
    try {
      const res = await fetch('./floating-menu.html');
      if (res.ok) {
        const html = await res.text();
        menuContainer.innerHTML = html;

        const currentPage = window.location.pathname.split('/').pop();
        document.querySelectorAll('.floating-menu a').forEach(link => {
          if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
          }
        });
      }
    } catch (err) {
      console.error("Failed to load floating menu:", err);
    }
  }

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

    // ✅ Use the novels array from seriesData if it exists
    const novelIds = seriesData.novels || [];

    if (novelIds.length === 0) {
      novelsList.innerHTML = "<p style='text-align:center; color:white;'>No novels in this series yet.</p>";
    } else {
      for (const novelId of novelIds) {
        const novelDoc = await getDoc(doc(db, "novels", novelId));
        if (novelDoc.exists()) {
          const novel = novelDoc.data();

          const card = document.createElement("div");
          card.className = "novel-card";
          card.innerHTML = `
            <img src="${novel.coverUrl || 'default-novel-cover.jpg'}" alt="${novel.title}">
            <p>${novel.title}</p>
          `;
          // ✅ Link novels with ?novelId to match novel-details.js
          card.addEventListener("click", () => {
            window.location.href = `novel-details.html?novelId=${novelDoc.id}`;
          });

          novelsList.appendChild(card);
        }
      }
    }

    // ✅ If this series belongs to a verse, make it clickable back to verse-details
    if (seriesData.verseId) {
      const verseLink = document.getElementById("verse-link");
      if (verseLink) {
        verseLink.style.display = "inline-block";
        verseLink.addEventListener("click", () => {
          window.location.href = `verse-details.html?id=${seriesData.verseId}`;
        });
      }
    }

  } catch (error) {
    console.error("Error loading series details:", error);
  }
});
