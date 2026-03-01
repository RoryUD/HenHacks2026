// Create the floating button
const floatingBtn = document.createElement("div");
floatingBtn.id = "manga-enlarge-btn";
floatingBtn.title = "Enlarge Manga";
document.body.appendChild(floatingBtn);

// Create the modal overlay
const modalOverlay = document.createElement("div");
modalOverlay.id = "manga-modal-overlay";
modalOverlay.innerHTML = `
    <div id="manga-modal">
      <!-- Title Container -->
      <div class="modal-container" id="modal-title-container">
        <h1>Manga Text Extractor</h1>
      </div>

      <!-- Settings Container -->
      <div class="modal-container" id="modal-settings-container">
        <label for="modal-num-pages">Number of Pages:</label>
        <input type="number" id="modal-num-pages" value="3" min="1" max="100">
      </div>

      <!-- Action Container -->
      <div class="modal-container" id="modal-action-container">
        <button id="modal-enlarge-btn">Enlarge</button>
      </div>
    </div>
`;
document.body.appendChild(modalOverlay);

// Get modal elements
const modal = document.getElementById("manga-modal");
const numPagesInput = document.getElementById("modal-num-pages");
const enlargeBtn = document.getElementById("modal-enlarge-btn");

// Show modal when floating button is clicked
floatingBtn.addEventListener("click", () => {
    modalOverlay.classList.add("show");
});

// Close modal when clicking outside of it
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.classList.remove("show");
    }
});

// Prevent clicks inside modal from closing it
modal.addEventListener("click", (e) => {
    e.stopPropagation();
});

// Handle "Enlarge" button click
enlargeBtn.addEventListener("click", () => {
    const numPages = parseInt(numPagesInput.value, 10);

    if (!numPages || numPages < 1 || numPages > 100) {
      alert("Please enter a valid number of pages (1-100).");
      return;
    }

    // Send message to background script to open viewer
    browser.runtime.sendMessage({
      action: "openResult",
      numPages: numPages
    });

    // Close modal
    modalOverlay.classList.remove("show");
});