document.getElementById("enlarge-btn").addEventListener("click", async () => {
  const numPages = parseInt(document.getElementById("num-pages").value, 10);

  if (!numPages || numPages < 1 || numPages > 100) {
    alert("Please enter a valid number of pages (1-100).");
    return;
  }

  await browser.runtime.sendMessage({
    action: "openResult",
    numPages: numPages
  });

  window.close();
});