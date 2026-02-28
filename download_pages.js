(async function downloadAllShonenPages() {
    const DIVIDE_NUM = 4;
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

    // 2. Loop through pages sequentially (using for...of to allow await)
    for (let index = 0; index < mainPages.length; index++) {
        const page = mainPages[index];
        const pageNum = (index + 1).toString().padStart(3, '0'); // Format: 001, 002...

        console.log(`Processing page ${pageNum}...`);

        try {
            // Load Scrambled Image
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = page.src;

            await new Promise((res, rej) => {
                img.onload = res;
                img.onerror = () => rej(`Failed to load page ${pageNum}`);
            });

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

            // Step 3: Trigger Download
            const dataUrl = canvas.toDataURL("image/png");
            const link = document.createElement('a');
            link.download = `manga_page_${pageNum}.png`;
            link.href = dataUrl;
            link.click();

            // Step 4: Small delay to prevent browser download congestion
            await new Promise(r => setTimeout(r, 300));

        } catch (err) {
            console.error(`Error on page ${pageNum}:`, err);
        }
    }

    console.log("Finished downloading all pages.");
})();
