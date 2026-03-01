// display_results2.js
// Handles displaying the translation results on the screen
// -- Page-by-page mode: render one page at a time, navigate with buttons or click zones --

console.log("[display] Translation Display Module Loaded.");

// ─── State ───────────────────────────────────────────────────────────────────
let currentDisplayPage = 1;       // 1-based, currently shown page
let totalPages = 0;                // filled in after reader initialises
const resultCache = new Map();     // pageNum(int) → data   (cache processed results)

// ─── Event: receive detection results ────────────────────────────────────────
document.addEventListener("MangaTextDetected", (e) => {
    const data = e.detail;
    const pageNumInt = parseInt(data.pageNum, 10);

    console.log(`[display] Received results for page ${pageNumInt}`);

    // Cache the result
    resultCache.set(pageNumInt, data);

    // Only render if this is the currently requested page
    if (pageNumInt === currentDisplayPage) {
        renderTranslationOverlay(data);
    }
});

// ─── Navigation ──────────────────────────────────────────────────────────────

/**
 * Move to a specific page.
 * - Clears the previous overlay
 * - Uses cache if available, otherwise fires MangaRequestPage to ask the backend
 */
function goToPage(pageNum) {
    if (pageNum < 1) pageNum = 1;
    if (totalPages > 0 && pageNum > totalPages) pageNum = totalPages;

    console.log(`[display] Navigating to page ${pageNum}`);
    currentDisplayPage = pageNum;

    // Clear all overlays first
    document.querySelectorAll('.manga-translation-overlay').forEach(el => el.remove());

    if (resultCache.has(pageNum)) {
        // Already processed — render immediately
        renderTranslationOverlay(resultCache.get(pageNum));
    } else {
        // Ask the pipeline to process this page
        document.dispatchEvent(new CustomEvent("MangaRequestPage", {
            detail: { pageNum }
        }));
        console.log(`[display] Requested processing for page ${pageNum}`);
    }
}

function nextPage() { goToPage(currentDisplayPage + 1); }
function prevPage() { goToPage(currentDisplayPage - 1); }

// ─── Keyboard navigation (← →) ───────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") nextPage();
    if (e.key === "ArrowLeft")  prevPage();
});

// ─── Click-zone navigation (left 30% / right 30% of window) ──────────────────
document.addEventListener("click", (e) => {
    // Ignore clicks on UI buttons / overlays themselves
    if (e.target.closest('.manga-nav-btn') ||
        e.target.closest('.manga-translation-overlay')) return;

    const x = e.clientX;
    const w = window.innerWidth;

    if (x < w * 0.30) {
        prevPage();   // Click left side → previous page
    } else if (x > w * 0.70) {
        nextPage();   // Click right side → next page
    }
});

// ─── On-screen navigation buttons ────────────────────────────────────────────
function injectNavButtons() {
    if (document.getElementById('manga-nav-container')) return; // already injected

    const container = document.createElement('div');
    container.id = 'manga-nav-container';
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 99999;
        display: flex;
        gap: 16px;
        pointer-events: none;
    `;

    const btnStyle = `
        pointer-events: all;
        padding: 8px 20px;
        font-size: 14px;
        font-weight: bold;
        background: rgba(30,30,30,0.80);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.3);
        border-radius: 6px;
        cursor: pointer;
        user-select: none;
    `;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'manga-nav-btn';
    prevBtn.style.cssText = btnStyle;
    prevBtn.innerText = '◀ Prev';
    prevBtn.addEventListener('click', prevPage);

    const pageLabel = document.createElement('span');
    pageLabel.id = 'manga-page-label';
    pageLabel.style.cssText = `
        pointer-events: none;
        padding: 8px 12px;
        font-size: 14px;
        font-weight: bold;
        background: rgba(30,30,30,0.80);
        color: #fff;
        border-radius: 6px;
        min-width: 60px;
        text-align: center;
    `;
    updatePageLabel();

    const nextBtn = document.createElement('button');
    nextBtn.className = 'manga-nav-btn';
    nextBtn.style.cssText = btnStyle;
    nextBtn.innerText = 'Next ▶';
    nextBtn.addEventListener('click', nextPage);

    container.appendChild(prevBtn);
    container.appendChild(pageLabel);
    container.appendChild(nextBtn);
    document.body.appendChild(container);
}

function updatePageLabel() {
    const label = document.getElementById('manga-page-label');
    if (label) {
        label.innerText = totalPages > 0
            ? `${currentDisplayPage} / ${totalPages}`
            : `Page ${currentDisplayPage}`;
    }
}

// ─── Initialise: trigger processing of page 1 ────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    injectNavButtons();

    // Let the reader know how many pages exist (optional — reader should fire this)
    document.addEventListener("MangaTotalPages", (e) => {
        totalPages = e.detail.total;
        console.log(`[display] Total pages: ${totalPages}`);
        updatePageLabel();
    });

    // Kick off page 1
    goToPage(1);
});

// ─── Render overlay for one page ─────────────────────────────────────────────
async function renderTranslationOverlay(data) {
    updatePageLabel();

    const pageNumInt = parseInt(data.pageNum, 10);
    const pageInd0   = pageNumInt - 1;

    // ── Find canvas ──
    const possibleIds = [
        `page${pageInd0}_0`,
        `page${pageInd0}`,
        `page${data.pageNum}_0`,
        `page${data.pageNum}`,
        `canvas-${pageInd0}`
    ];

    let canvas = null;
    for (const id of possibleIds) {
        canvas = document.getElementById(id);
        if (canvas) { console.log(`[display] Found canvas: ${id}`); break; }
    }
    if (!canvas) {
        canvas = document.querySelector(`canvas[id*="page${pageInd0}"]`) ||
                 document.querySelector(`canvas[id*="page${data.pageNum}"]`);
    }
    if (!canvas) {
        const big = Array.from(document.querySelectorAll('canvas'))
                         .filter(c => c.width > 200 && c.height > 200);
        if (pageInd0 < big.length) {
            canvas = big[pageInd0];
            console.log(`[display] Fallback canvas by index ${pageInd0}`);
        }
    }
    if (!canvas) {
        console.warn(`[display] Canvas for page ${data.pageNum} not found.`);
        return;
    }

    // ── Parent positioning ──
    const parent = canvas.parentElement;
    if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }

    // Remove old overlays in this parent only
    parent.querySelectorAll('.manga-translation-overlay').forEach(el => el.remove());

    if (!data.results || data.results.length === 0) {
        console.log(`[display] No text on page ${data.pageNum}.`);
        return;
    }

    // ── Scale factors ──
    const serverW = data.pageWidth  || canvas.width;
    const serverH = data.pageHeight || canvas.height;
    const scaleX  = canvas.clientWidth  / serverW;
    const scaleY  = canvas.clientHeight / serverH;
    const offsetX = canvas.offsetLeft;
    const offsetY = canvas.offsetTop;

    console.log(`[display] Scale: ${scaleX.toFixed(3)}, ${scaleY.toFixed(3)} | Offset: (${offsetX}, ${offsetY})`);

    // ── Build overlays ──
    data.results.forEach((item) => {
        let xmin = item.position[0] * scaleX;
        let ymin = item.position[1] * scaleY;
        let xmax = item.position[2] * scaleX;
        let ymax = item.position[3] * scaleY;

        // Expand box slightly
        const padX = (xmax - xmin) * 0.1;
        const padY = (ymax - ymin) * 0.1;
        xmin -= padX;  xmax += padX;
        ymin -= padY;  ymax += padY;

        // Apply canvas offset within parent
        xmin += offsetX; xmax += offsetX;
        ymin += offsetY; ymax += offsetY;

        const width  = xmax - xmin;
        const height = ymax - ymin;

        let fontSize = height * 0.13;
        if (fontSize < 11) fontSize = 11;
        if (fontSize > 30) fontSize = 30;

        const div = document.createElement('div');
        div.className = 'manga-translation-overlay';
        div.style.cssText = `
            position: absolute;
            left: ${xmin}px;
            top: ${ymin}px;
            width: ${width}px;
            height: ${height}px;
            background: transparent;
            overflow: visible;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            box-sizing: border-box;
        `;
        div.title = `Original: ${item.text}`;

        const span = document.createElement('span');
        span.style.cssText = `
            display: block;
            width: ${width}px;
            max-width: ${width}px;
            background: rgba(255,255,255,0.92);
            border-radius: 3px;
            padding: 2px 4px;
            box-sizing: border-box;
            color: black;
            font-weight: bold;
            font-size: ${fontSize}px;
            font-family: "Comic Sans MS", "Chalkboard SE", sans-serif;
            word-break: break-word;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            line-height: 1.4;
            text-align: center;
        `;
        span.innerText = item.english || item.text;

        div.appendChild(span);
        parent.appendChild(div);
    });

    console.log(`[display] Rendered ${data.results.length} overlays for page ${data.pageNum}.`);
}