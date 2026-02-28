// display_results.js
// Handles displaying the translation results on the screen

console.log("[display]Translation Display Module Loaded.");

document.addEventListener("MangaTextDetected", (e) => {
    const data = e.detail;
    console.log(`[display]Page ${data.pageNum}`, "color: magenta; font-weight: bold;");
    console.log("[display]Original Image Size:", data.pageWidth, "x", data.pageHeight);
    console.log("[display]Detected Texts:", data.results);

    // Placeholder for UI rendering logic
    // renderTranslationOverlay(data);
});

function renderTranslationOverlay(data) {
    // TODO: Draw boxes over the manga page
    // This is tricky because the original page is scrambled Canvas, 
    // so placing absolute divs on top might be hard if we don't know where the canvas is.
    alert(`[display]Page ${data.pageNum} processed! Check console for text.`);
}