// Will be populated from browser storage
let pages = [];
let currentPage = 0;
let zoomLevel = 1;

const imgElement = document.getElementById("manga-page");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");

// Initialize viewer - try server first, fallback to storage
  async function init() {
      try {
          // Try to load from server first
          const res = await fetch("http://localhost:5001/pages");
          const data = await res.json();
          pages = data.pages; // ["manga_page_001.png", ...]

          if (pages.length > 0) {
              console.log(`Loaded ${pages.length} pages from server`);
              showPage(currentPage);
              return;
          }
      } catch (err) {
          console.log("Server not available, trying browser storage...", err);
      }

      // Fallback to browser storage
      const result = await browser.storage.local.get("mangaPages");

      if (result.mangaPages && result.mangaPages.length > 0) {
          pages = result.mangaPages;
          console.log(`Loaded ${pages.length} pages from storage`);
      } else {
          // Final fallback to placeholders
          pages = [
              browser.runtime.getURL("Placeholders/page1.png"),
              browser.runtime.getURL("Placeholders/page2.png"),
              browser.runtime.getURL("Placeholders/page3.png")
          ];
          console.log("No stored pages found, using placeholders");
      }

      showPage(currentPage);
}

function showPage(index) {
    // If it's a data URL, use directly; if it's a path, get extension URL
    if (pages[index].startsWith('data:')) {
        imgElement.src = pages[index];
    } else {
        imgElement.src = browser.runtime.getURL(pages[index]);
    }
    updateProgressBar();
}

function updateProgressBar() {
    const progress = ((currentPage + 1) / pages.length) * 100;
    progressBar.style.width = progress + "%";
    progressText.textContent = `Progress: ${Math.round(progress)}% (${currentPage + 1}/${pages.length})`;
}

function nextPage() {
    if (currentPage < pages.length - 1) {
        currentPage++;
        showPage(currentPage);
    }
}

function prevPage() {
    if (currentPage > 0) {
        currentPage--;
        showPage(currentPage);
    }
}

function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    imgElement.style.transform = `scale(${zoomLevel})`;
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    imgElement.style.transform = `scale(${zoomLevel})`;
}

prevBtn.addEventListener("click", nextPage);
nextBtn.addEventListener("click", prevPage);
zoomInBtn.addEventListener("click", zoomIn);
zoomOutBtn.addEventListener("click", zoomOut);

document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") nextPage();
    else if (e.key === "ArrowRight") prevPage();
});

init();