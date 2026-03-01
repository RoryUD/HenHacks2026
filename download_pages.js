async function downloadShonenJumpPages(limit) {

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
	const actualLimit = (limit === 0 || !limit) ? mainPages.length : limit;

	// 2. Loop through pages sequentially
	for (let index = 0; index < actualLimit; index++) {
		const page = mainPages[index];
		const pageNum = (index + 1).toString().padStart(3, '0');

		console.log(`Processing page ${pageNum}...`);

		try {
			const response = await fetch(page.src);
			const blob = await response.blob();

			const objectURL = URL.createObjectURL(blob);

			const img = new Image();
			const imageLoaded = new Promise((res, rej) => {
				img.onload = () => {
					URL.revokeObjectURL(objectURL);
					res();
				};
				img.onerror = rej;
			});

			img.src = objectURL;
			await imageLoaded;

			const canvas = document.createElement('canvas');
			canvas.width = page.width;
			canvas.height = page.height;
			const ctx = canvas.getContext('2d');
			ctx.imageSmoothingEnabled = false;

			const cell_width = Math.floor(page.width / (DIVIDE_NUM * 8)) * 8;
			const cell_height = Math.floor(page.height / (DIVIDE_NUM * 8)) * 8;

			ctx.drawImage(img, 0, 0, page.width, page.height, 0, 0, page.width, page.height);

			for (let e = 0; e < DIVIDE_NUM * DIVIDE_NUM; e++) {
				const t = Math.floor(e / DIVIDE_NUM) * cell_height;
				const i = (e % DIVIDE_NUM) * cell_width;
				const r = Math.floor(e / DIVIDE_NUM);
				const n = (e % DIVIDE_NUM) * DIVIDE_NUM + r;
				const s = (n % DIVIDE_NUM) * cell_width;
				const o = Math.floor(n / DIVIDE_NUM) * cell_height;
				ctx.drawImage(img, i, t, cell_width, cell_height, s, o, cell_width, cell_height);
			}

			// ダウンロード
			const dataUrl = canvas.toDataURL("image/png");
			const link = document.createElement('a');
			link.download = `manga_page_${pageNum}.png`;
			link.href = dataUrl;
			link.click();

			await new Promise(r => setTimeout(r, 300));

		} catch (err) {
			console.error(`Error on page ${pageNum}:`, err);
		}
	}

	console.log("Finished downloading all pages.");

	// server.py へシグナル送信
	const xhr = new XMLHttpRequest();
	xhr.open("POST", "http://localhost:5001/run", true);
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.onload = () => {
		const result = JSON.parse(xhr.responseText);
		if (result.status === "done") {
			// 処理完了 → viewerを開く
			browser.runtime.sendMessage({ action: "openViewer" });
		}
	};
	xhr.onerror = () => console.error("Failed to signal server");
	xhr.send(JSON.stringify({ num_pages: actualLimit }));
}

// Make it globally available
window.downloadShonenJumpPages = downloadShonenJumpPages;

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "START_DOWNLOAD") {
		console.log("Message received! Starting download...");

		downloadShonenJumpPages(message.limit || 0)
			.then(() => sendResponse({ status: "complete" }))
			.catch(err => sendResponse({ status: "error", error: err.message }));

		return true;
	}
});