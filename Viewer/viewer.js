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

// processed/ から画像リストを取得して初期化
async function init() {
    try {
        const res = await fetch("http://localhost:5001/pages");
        const data = await res.json();
        pages = data.pages; // ["manga_page_001.png", ...]
        
        if (pages.length === 0) {
            imgElement.alt = "No processed pages found.";
            return;
        }

        showPage(currentPage);
    } catch (err) {
        console.error("Failed to load pages from server:", err);
    }
}

function showPage(index) {
    imgElement.src = `http://localhost:5001/pages/${pages[index]}`;
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