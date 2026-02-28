browser.browserAction.onClicked.addListener(async () => {
  try {
    // Create canvas
    const canvas = new OffscreenCanvas(500, 300);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 500, 300);

    // Text
    ctx.fillStyle = "#000000";
    ctx.font = "30px Arial";
    ctx.fillText("Hello from Firefox Extension!", 50, 150);

    // Convert canvas to blob
    const blob = await canvas.convertToBlob({ type: "image/png" });

    // Create object URL
    const url = URL.createObjectURL(blob);

    // Download image
    await browser.downloads.download({
      url: url,
      filename: "BlankWithText.png",
      saveAs: false
    });

    console.log("Image downloaded successfully!");
  } catch (err) {
    console.error("Download failed:", err);
  }
});