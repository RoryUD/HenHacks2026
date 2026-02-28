document.getElementById("create").addEventListener("click", async () => {
  const width = parseInt(document.getElementById("width").value, 10);
  const height = parseInt(document.getElementById("height").value, 10);

  if (!width || !height || width <= 0 || height <= 0) {
    alert("Invalid dimensions.");
    return;
  }

  await browser.runtime.sendMessage({ width, height });
  window.close();
});