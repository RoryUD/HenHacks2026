// Array of placeholder images (later will come from backend)
const pages = [
    "Placeholders/page1.png",
    "Placeholders/page2.png",
    "Placeholders/page3.png"
];

let currentPage = 0;
let zoomLevel = 1;

// Get DOM elements
const imgElement = document.getElementById("manga-page");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");

// Initialize viewer
function init() {
    showPage(currentPage);
}

// Display the current page
function showPage(index) {
    imgElement.src = browser.runtime.getURL(pages[index]);
    updateProgressBar();
}

// Update progress bar based on current page
function updateProgressBar() {
    const progress = ((currentPage + 1) / pages.length) * 100;
    progressBar.style.width = progress + "%";
    progressText.textContent = `Progress: ${Math.round(progress)}% (${currentPage + 1}/${pages.length})`;
}

// Navigate to next page
function nextPage() {
    if (currentPage < pages.length - 1) {
        currentPage++;
        showPage(currentPage);
    } 
}

// Navigate to previous page
function prevPage() {
    if (currentPage > 0) {
        currentPage--;
        showPage(currentPage);
    }
}

// Zoom in
function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.2, 3);
    imgElement.style.transform = `scale(${zoomLevel})`;
}

// Zoom out
function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.2, 0.5);
    imgElement.style.transform = `scale(${zoomLevel})`;
}

// Button click handlers
prevBtn.addEventListener("click", nextPage); // Left button goes forward (Japanese manga style)
nextBtn.addEventListener("click", prevPage); // Right button goes backward (Japanese manga style)
zoomInBtn.addEventListener("click", zoomIn);
zoomOutBtn.addEventListener("click", zoomOut);

// Keyboard navigation
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
        nextPage();
    } else if (e.key === "ArrowRight") {
        prevPage();
    }
});

// Start the viewer
init();