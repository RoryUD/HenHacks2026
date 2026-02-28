document.getElementById("create").addEventListener("click", async () => {
  const width = parseInt(document.getElementById("width").value, 10);
  const height = parseInt(document.getElementById("height").value, 10);

  const text = document.getElementById("text").value.trim();

  const x1 = parseInt(document.getElementById("x1").value, 10);
  const y1 = parseInt(document.getElementById("y1").value, 10);
  const x2 = parseInt(document.getElementById("x2").value, 10);
  const y2 = parseInt(document.getElementById("y2").value, 10);

  if (
    !width || !height ||
    !text ||
    x1 >= x2 || y1 >= y2 ||
    x1 < 0 || y1 < 0 ||
    x2 > width || y2 > height
  ) {
    alert("Invalid input values.");
    return;
  }

  await browser.runtime.sendMessage({
    width,
    height,
    text,
    x1,
    y1,
    x2,
    y2
  });

  window.close();
});

// New Tab event listener
document.getElementById("openResult").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ action: "openResult" });
  window.close()
});