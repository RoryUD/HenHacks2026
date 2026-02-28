// Array of placeholder images (later will come from backend)
const pages = [
    "Placeholders/page1.png",
    "Placeholders/page2.png",
    "Placeholders/page3.png"
];

let currentPage = 0;

// Get DOM elements
const imgElement = document.getElementById("manga-page");
const currentPageSpan = document.getElementById("current-page");
const totalPagesSpan = document.getElementById("total-pages");
const leftArrow = document.getElementById("left-arrow");
const rightArrow = document.getElementById("right-arrow");

// Initialize viewer
function init() {
    totalPagesSpan.textContent = pages.length;
    showPage(currentPage);
}

// Display the current page
function showPage(index) {
    imgElement.src = browser.runtime.getURL(pages[index]);
    currentPageSpan.textContent = index + 1;
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

// Arrow click handlers
leftArrow.addEventListener("click", prevPage);
rightArrow.addEventListener("click", nextPage);

// Keyboard navigation
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") {
        prevPage();
    } else if (e.key === "ArrowRight") {
        nextPage();
    }
});

// Start the viewer
init();