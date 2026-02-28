console.log("%c[HenHacks Extension] Loaded!", "color: green; font-size: 20px; font-weight: bold;");

// Wait for the page to fully load
// window.addEventListener('load') might not fire if the extension loads after the page.
// Check document.readyState instead.

processAllPages(10).then(() => console.log("Done!"));
