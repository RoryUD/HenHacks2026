console.log("%c[HenHacks Extension] Loaded!", "color: green; font-size: 20px; font-weight: bold;");

// Wait for the page to fully load
// window.addEventListener('load') might not fire if the extension loads after the page.
// Check document.readyState instead.

downloadAllShonenPages(20);
processAllPages(20).then(() => console.log("Done!"));
