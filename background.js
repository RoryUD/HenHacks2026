browser.runtime.onMessage.addListener(async (message) => {
  try {
    const { width, height, text, x1, y1, x2, y2 } = message;

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const boxWidth = x2 - x1;
    const boxHeight = y2 - y1;

    ctx.fillStyle = "#000000";

    // --- Function to wrap text into lines ---
    function wrapText(context, text, maxWidth) {
      const words = text.split(" ");
      const lines = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + " " + words[i];
        const metrics = context.measureText(testLine);

        if (metrics.width > maxWidth) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }

      lines.push(currentLine);
      return lines;
    }

    // --- Auto-scale font size to fit box ---
    let fontSize = boxHeight;
    let lines;
    let lineHeight;

    while (fontSize > 5) {
      ctx.font = `${fontSize}px Arial`;
      lines = wrapText(ctx, text, boxWidth);
      lineHeight = fontSize * 1.2;

      const totalTextHeight = lines.length * lineHeight;

      if (totalTextHeight <= boxHeight) {
        break;
      }

      fontSize--;
    }

    // --- Center text vertically ---
    const totalHeight = lines.length * lineHeight;
    let textY = y1 + (boxHeight - totalHeight) / 2 + fontSize;

    // --- Draw each line centered ---
    for (const line of lines) {
      const textWidth = ctx.measureText(line).width;
      const textX = x1 + (boxWidth - textWidth) / 2;
      ctx.fillText(line, textX, textY);
      textY += lineHeight;
    }

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