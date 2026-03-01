console.log("content.js loaded");
console.log("downloadShonenJumpPages:", typeof downloadShonenJumpPages);

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
            <div id="enlarge-btn-wrapper">
                <div id="enlarge-progress-bar"></div>
                <div id="enlarge-progress-text"></div>
                <button id="modal-enlarge-btn">Enlarge</button>
            </div>
        </div>
    </div>
`;
document.body.appendChild(modalOverlay);

// Get modal elements
const modal = document.getElementById("manga-modal");
const numPagesInput = document.getElementById("modal-num-pages");
const enlargeBtn = document.getElementById("modal-enlarge-btn");
const enlargeProgressBar = document.getElementById("enlarge-progress-bar");
const enlargeProgressText = document.getElementById("enlarge-progress-text");

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
enlargeBtn.addEventListener("click", async () => {
    const numPages = parseInt(numPagesInput.value, 10);

    if (!numPages || numPages < 1 || numPages > 100) {
      alert("Please enter a valid number of pages (1-100).");
      return;
    }
    
    // Call the correct function from download_pages.js
    if (typeof downloadShonenJumpPages === 'function') {
      downloadShonenJumpPages(numPages);
    } else {
      console.error("downloadShonenJumpPages function not available");
      if(window.downloadShonenJumpPages) {
          window.downloadShonenJumpPages(numPages);
      } else {
         alert("Error: Download function not loaded. Please refresh the page.");
      }
    }

    // Hide button, show progress bar
    enlargeBtn.style.display = "none";
    enlargeProgressText.style.display = "flex";
    enlargeProgressText.textContent = `Processing 0/${numPages}...`;

    try {
        // Start download with user's page limit
        const response = await browser.runtime.sendMessage({
            action: "START_DOWNLOAD",
            limit: numPages
        });

        if (response && response.status === "complete") {
            console.log(`Downloaded ${response.count} pages`);

            // Open viewer
            await browser.runtime.sendMessage({
            action: "openResult",
            numPages: response.count
            });

            // Close modal
            modalOverlay.classList.remove("show");
        } else {
            alert("Download failed. Please try again.");
        }
    } catch (err) {
        console.error("Error:", err);
        alert("An error occurred. Check console for details.");
    } finally {
        // Reset: show button, hide progress
        enlargeBtn.style.display = "block";
        enlargeBtn.disabled = false;
        enlargeProgressText.style.display = "none";
        enlargeProgressBar.style.width = "0%";
    }
});

// Listen for download progress updates
browser.runtime.onMessage.addListener((message) => {
    console.log("Message received in content.js:", message);
    if (message.action === "DOWNLOAD_PROGRESS") {
        const percent = (message.current / message.total) * 100;
        console.log(`Progress update: ${message.current}/${message.total} = ${percent}%`);
        enlargeProgressText.textContent = `Processing ${message.current}/${message.total}...`;
        enlargeProgressBar.style.width = `${percent}%`;
    }
});