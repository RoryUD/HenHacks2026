async function downloadShonenJumpPages(limit) {

	const DIVIDE_NUM = 4;
	const imageDataUrls = []; // Array to collect all data URLs
	console.log(`Starting download for all pages using DIVIDE_NUM = ${DIVIDE_NUM}...`);

	// 1. Get Metadata
	const jsonEl = document.getElementById('episode-json');
	if (!jsonEl) {
		console.error("Could not find the manga data element.");
		return;
	}

	const data = JSON.parse(jsonEl.getAttribute('data-value'));
	const mainPages = data.readableProduct.pageStructure.pages.filter(p => p.type === 'main');

	console.log(`Found ${mainPages.length} pages to download.`);
	const actualLimit = (limit === 0 || !limit) ? mainPages.length : limit;
	// 2. Loop through pages sequentially (using for...of to allow await)
	for (let index = 0; index < actualLimit; index++) {
		const page = mainPages[index];
		const pageNum = (index + 1).toString().padStart(3, '0'); // Format: 001, 002...

		console.log(`Processing page ${pageNum}...`);

		try {
			const response = await fetch(page.src);
			const blob = await response.blob();

			const objectURL = URL.createObjectURL(blob);

			// Load Scrambled Image
			const img = new Image();
			const imageLoaded = new Promise((res, rej) => {
    			img.onload = () => {
        			URL.revokeObjectURL(objectURL); // Clean up memory
        			res();
    			};
    			img.onerror = rej;
			});

			img.src = objectURL;
			await imageLoaded;

			// Setup Canvas
			const canvas = document.createElement('canvas');
			canvas.width = page.width;
			canvas.height = page.height;
			const ctx = canvas.getContext('2d');
			ctx.imageSmoothingEnabled = false;

			// Cell math based on DIVIDE_NUM
			const cell_width = Math.floor(page.width / (DIVIDE_NUM * 8)) * 8;
			const cell_height = Math.floor(page.height / (DIVIDE_NUM * 8)) * 8;

			// Step 1: Initial draw to handle edges (from site's solve() logic)
			ctx.drawImage(img, 0, 0, page.width, page.height, 0, 0, page.width, page.height);

			// Step 2: Loop through the grid (DIVIDE_NUM x DIVIDE_NUM)
			for (let e = 0; e < DIVIDE_NUM * DIVIDE_NUM; e++) {
				// Source coordinates (i, t)
				const t = Math.floor(e / DIVIDE_NUM) * cell_height;
				const i = (e % DIVIDE_NUM) * cell_width;

				// The Permutation Math
				const r = Math.floor(e / DIVIDE_NUM);
				const n = (e % DIVIDE_NUM) * DIVIDE_NUM + r;

				// Destination coordinates (s, o)
				const s = (n % DIVIDE_NUM) * cell_width;
				const o = Math.floor(n / DIVIDE_NUM) * cell_height;

				ctx.drawImage(img, i, t, cell_width, cell_height, s, o, cell_width, cell_height);
			}

			// // Step 3: Trigger Download
			// const dataUrl = canvas.toDataURL("image/png");
			// const link = document.createElement('a');
			// link.download = `manga_page_${pageNum}.png`;
			// link.href = dataUrl;
			// link.click();

			// // Step 4: Small delay to prevent browser download congestion
			// await new Promise(r => setTimeout(r, 300));

			// Step 3: Store data URL in array
  			const dataUrl = canvas.toDataURL("image/png");
  			imageDataUrls.push(dataUrl);
  			console.log(`Stored page ${pageNum} in memory`);

  			// Send progress update
  			browser.runtime.sendMessage({
    			action: "DOWNLOAD_PROGRESS",
    			current: index + 1,
    			total: actualLimit
  			});

  			// Step 4: Small delay between processing
  			await new Promise(r => setTimeout(r, 100));

		} catch (err) {
			console.error(`Error on page ${pageNum}:`, err);
		}
	}

	console.log("Finished processing all pages. Saving to storage...");

      // Save all data URLs to browser storage
      await browser.storage.local.set({ mangaPages: imageDataUrls });
      console.log(`Saved ${imageDataUrls.length} pages to browser storage.`);

      // Also trigger server processing if available
      try {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "http://localhost:5001/run", true);
          xhr.setRequestHeader("Content-Type", "application/json");
          xhr.onload = () => console.log("Server processing started:", xhr.responseText);
          xhr.onerror = () => console.error("Server not available, using storage only");
          xhr.send(JSON.stringify({ num_pages: actualLimit }));
      } catch (err) {
          console.error("Failed to signal server:", err);
      }

      return imageDataUrls; // Return for confirmation
  }

  // Make it globally available
  window.downloadShonenJumpPages = downloadShonenJumpPages;

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "START_DOWNLOAD") {
          console.log("Message received! Starting download...");

          // Call async function and send response when done
          downloadShonenJumpPages(message.limit || 0)
              .then(imageDataUrls => {
                  console.log("Download complete, sending response");
                  sendResponse({ status: "complete", count: imageDataUrls.length });
              })
              .catch(err => {
                  console.error("Download failed:", err);
                  sendResponse({ status: "error", error: err.message });
              });

          return true; // Keep message channel open for async responses
      }

});
