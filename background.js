browser.runtime.onMessage.addListener(async (message) => {
  try {
    const { width, height } = message;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#000000";
    ctx.font = `${Math.floor(height / 10)}px Arial`;

    const text = "Hello from Firefox Extension!";
    const textWidth = ctx.measureText(text).width;

    ctx.fillText(text, (width - textWidth) / 2, height / 2);

    const blob = await canvas.convertToBlob({ type: "image/png" });
    const url = URL.createObjectURL(blob);

    await browser.downloads.download({
      url,
      filename: `BlankWithText_${width}x${height}.png`,
      saveAs: false
    });

  } catch (err) {
    console.error("Download failed:", err);
  }
});