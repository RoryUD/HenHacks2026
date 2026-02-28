// process_manga.js
// Logic adapted from valid descramble algorithm + upload to server

async function processAllPages(limit) {
    const DIVIDE_NUM = 4;
    console.log(`[process_manga]Starting processing for all pages using DIVIDE_NUM = ${DIVIDE_NUM}...`);

    // 1. Get Metadata
    const jsonEl = document.getElementById('episode-json');
    if (!jsonEl) {
        console.error("[process_manga]Could not find the manga data element.");
        return;
    }

    const data = JSON.parse(jsonEl.getAttribute('data-value'));
    const mainPages = data.readableProduct.pageStructure.pages.filter(p => p.type === 'main');

    console.log(`[process_manga]Found ${mainPages.length} pages to process.`);
    const actualLimit = (limit === 0 || !limit) ? mainPages.length : limit;

    // 2. Loop through pages sequentially
    for (let index = 0; index < actualLimit; index++) {
        const page = mainPages[index];
        const pageNum = (index + 1).toString().padStart(3, '0'); // Format: 001, 002...

        console.log(`[process_manga]Processing page ${pageNum}...`);

        try {
            // Fetch the raw scrambled image
            const response = await fetch(page.src);
            const blob = await response.blob();
            const objectURL = URL.createObjectURL(blob);

            // Load Image
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = objectURL;
            });
            URL.revokeObjectURL(objectURL);

            // --- DESCRAMBLE ---
            const canvas = document.createElement('canvas');
            canvas.width = page.width;   // Use metadata width
            canvas.height = page.height; // Use metadata height
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false; // Keep pixels sharp

            // Cell math based on DIVIDE_NUM
            const cell_width = Math.floor(page.width / (DIVIDE_NUM * 8)) * 8;
            const cell_height = Math.floor(page.height / (DIVIDE_NUM * 8)) * 8;

            // Step 1: Draw the full scrambled image first (background)
            ctx.drawImage(img, 0, 0, page.width, page.height);

            // Step 2: Loop through the grid (DIVIDE_NUM x DIVIDE_NUM) to reorder blocks
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

                // Copy block from Source to Destination
                ctx.drawImage(img, i, t, cell_width, cell_height, s, o, cell_width, cell_height);
            }

            // Step 3: Convert descrambled canvas to dataUrl for upload
            // Use 'image/png' for best text detection results
            const dataUrl = canvas.toDataURL("image/png");

            // --- DEBUG: Save Descrambled Image Locally ---
            // try {
            //     const link = document.createElement('a');
            //     link.download = `debug_ready_${pageNum}.png`;
            //     link.href = dataUrl;
            //     document.body.appendChild(link); // Firefox requires adding to DOM
            //     link.click();
            //     link.remove();
            //     console.log(`Saved debug image for page ${pageNum}`);
            // } catch (e) {
            //     console.warn(`Failed to save debug image for page ${pageNum}:`, e);
            // }
            // ---------------------------------------------

            console.log(`[process_manga]Sending page ${pageNum} to server (Descrambled)...`);

            // Step 4: Send to Background Script -> Python Server
            const result = await new Promise((resolve) => {
                const sendMessage = (typeof browser !== 'undefined') ? browser.runtime.sendMessage : chrome.runtime.sendMessage;
                sendMessage({
                    action: "uploadImage",
                    imageSrc: dataUrl,
                    filename: `page-${pageNum}.png`
                }, (response) => {
                    resolve(response);
                });
            });

            // Step 5: Handle Results
            if (result && result.success) {
                console.log(`[process_manga]Analysis Result for Page ${pageNum}:`, result.data);

                // If text found, log it nicely
                if (result.data.results && result.data.results.length > 0) {
                     const texts = result.data.results.map(r => r.text).join("\n");
                     console.log(`%c[Page ${pageNum} Found Text]:\n${texts}`, "color: blue; font-weight: bold; font-size: 14px;");
                } else {
                    console.warn(`[process_manga]No text found on page ${pageNum}. (Maybe just artwork?)`);
                }

                // ★ ここでイベントを発火
                const event = new CustomEvent("MangaTextDetected", {
                    detail: {
                        pageNum: pageNum,
                        results: result.data.results,
                        pageWidth: page.width,
                        pageHeight: page.height
                    }
                });
                document.dispatchEvent(event);


            } else {
                console.error(`[process_manga]Error processing page ${pageNum}:`, result ? result.error : "Unknown error");
            }

        } catch (error) {
            console.error(`[process_manga]Error processing page ${pageNum}:`, error);
        }
        
        // Safety delay
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("[process_manga]Finished processing all pages.");
}