// display_results2.js
// Handles displaying the translation results on the screen

console.log("[display]Translation Display Module Loaded.");

// ─── 追加① フォント読み込み ───────────────────────────────────────────────────
if (!document.getElementById('font-opendyslexic')) {
    const link = document.createElement('link');
    link.id = 'font-opendyslexic';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.cdnfonts.com/css/opendyslexic';
    document.head.appendChild(link);
}

// ─── 追加② EN設定 + Google Translate ─────────────────────────────────────────
const settings = { 
    EN: false,
    fontSizeEN: 1.3,  // 英語を1.3倍に
    fontSizeJP: 0.9,  // 日本語を少し小さく
};

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single'
    + '?client=gtx&sl=ja&tl=en&dt=t&q=';

async function translateToEnglish(text) {
    try {
        const res  = await fetch(TRANSLATE_URL + encodeURIComponent(text));
        const json = await res.json();
        return json[0].map(chunk => chunk[0]).join('') || text;
    } catch (e) {
        console.warn('[display] Translation failed:', e);
        return text;
    }
}

// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("MangaTextDetected", (e) => {
    const data = e.detail;
    console.log(`[display]Page ${data.pageNum}`, "color: magenta; font-weight: bold;");
    console.log("[display]Original Image Size:", data.pageWidth, "x", data.pageHeight);
    // console.log("[display]Detected Texts:", data.results);
    
    if (data.results && data.results.length > 0) {
        data.results.forEach((item, index) => {
            console.log(`[Text Block ${index + 1}]`);
            console.log(`  Content:  ${item.text}`);
            console.log(`  Position: [Left:${item.position[0]}, Top:${item.position[1]}, Right:${item.position[2]}, Bottom:${item.position[3]}]`);
            console.log(`  Size:     ${item.font_size}`);
            console.log(`  Vertical: ${item.vertical}`);
            console.log('-----------------------------');
        });
    } else {
        console.log("[display] No text detected on this page.");
    }

    // Placeholder for UI rendering logic
    renderTranslationOverlay(data);
});

async function renderTranslationOverlay(data) {
    // 1. Find the canvas element (the manga page)
    
    const pageNumInt = parseInt(data.pageNum, 10);
    const pageInd0 = pageNumInt - 1;
    
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
        if (canvas) { console.log(`[display] Found canvas with ID: ${id}`); break; }
    }
    if (!canvas) {
        canvas = document.querySelector(`canvas[id*="page${pageInd0}"]`) || 
                 document.querySelector(`canvas[id*="page${data.pageNum}"]`);
    }
    if (!canvas) {
        const bigCanvases = Array.from(document.querySelectorAll('canvas')).filter(c => c.width > 200 && c.height > 200);
        if (pageInd0 < bigCanvases.length) {
            canvas = bigCanvases[pageInd0];
            console.log(`[display] Fallback: Found canvas by index ${pageInd0} in large canvases list.`);
        }
    }
    if (!canvas) {
        console.warn(`[display] Canvas for page ${data.pageNum} not found. Cannot render overlay.`);
        return;
    }

    // 2. Calculate Scale Factor and Offsets
    const canvasRect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement;
    if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
    }

    const parentRect = parent.getBoundingClientRect();
    const offsetX = canvas.offsetLeft;
    const offsetY = canvas.offsetTop;
    const serverW = data.pageWidth || canvas.width;
    const serverH = data.pageHeight || canvas.height;
    const scaleX = canvas.clientWidth / serverW;
    const scaleY = canvas.clientHeight / serverH;
    
    console.log(`[display] Canvas Client: ${canvas.clientWidth}x${canvas.clientHeight}`);
    console.log(`[display] Server Size: ${serverW}x${serverH}`);
    console.log(`[display] Offset in Parent: (${offsetX}, ${offsetY})`);
    console.log(`[display] Scaling: ${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}`);

    // 3. Remove existing overlays
    parent.querySelectorAll(`.manga-translation-overlay[data-page='${pageNumInt}']`).forEach(el => el.remove());

    if (!data.results || data.results.length === 0) return;

    // ─── 追加③ EN=true なら全テキストを並列翻訳 ──────────────────────────────
    let translatedTexts = [];
    if (settings.EN) {
        console.log('[display] Translating...');
        translatedTexts = await Promise.all(
            data.results.map(item =>
                item.english ? Promise.resolve(item.english) : translateToEnglish(item.text)
            )
        );
        console.log('[display] Translation complete.');
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 4. Create overlays for each text block
    data.results.forEach((item, idx) => {
        let xmin = item.position[0] * scaleX;
        let ymin = item.position[1] * scaleY;
        let xmax = item.position[2] * scaleX;
        let ymax = item.position[3] * scaleY;
        
        const paddingX = (xmax - xmin) * 0.1;
        const paddingY = (ymax - ymin) * 0.1;
        xmin -= paddingX; xmax += paddingX;
        ymin -= paddingY; ymax += paddingY;

        xmin += offsetX; xmax += offsetX;
        ymin += offsetY; ymax += offsetY;

        const width  = xmax - xmin;
        const height = ymax - ymin;

        let fontSize = item.font_size
            ? item.font_size * Math.min(scaleX, scaleY)
            : height * 0.13;
        if (fontSize < 11) fontSize = 11;
        if (fontSize > 30) fontSize = 30;

        // 表示テキスト: EN=true なら翻訳済み、false なら原文
        const displayText = settings.EN ? translatedTexts[idx] : (item.english || item.text);

        // 改行処理
        // EN=true: 改行を一切挿入しない（white-space:normalで自動折り返し）
        // EN=false: 縦書き/lines数をもとに折り返す
        const isVertical = item.vertical;
        const lineCount = (item.lines && item.lines.length > 0) ? item.lines.length : null;
        let formattedText;
        if (settings.EN) {
            formattedText = displayText; // 改行なし、そのまま
        } else if (isVertical) {
            const charsPerLine = Math.max(1, Math.floor((width - 10) / fontSize));
            formattedText = insertLineBreaks(displayText, charsPerLine);
        } else if (lineCount && lineCount > 1) {
            const charsPerLine = Math.max(1, Math.ceil(displayText.length / lineCount));
            formattedText = insertLineBreaks(displayText, charsPerLine);
        } else {
            formattedText = displayText;
        }

        const div = document.createElement('div');
        div.className = 'manga-translation-overlay';
        div.dataset.page = pageNumInt;
        div.style.position = 'absolute';
        // divは常に検出ボックスのサイズ・位置そのまま（位置ずれ防止）
        div.style.left = `${xmin}px`;
        div.style.top = `${ymin}px`;
        div.style.width = `${width}px`;
        div.style.height = `${height}px`;
        div.style.backgroundColor = 'transparent';
        div.style.overflow = 'visible';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.justifyContent = 'center';
        div.style.zIndex = '9999';
        div.style.boxSizing = 'border-box';
        div.title = `Original: ${item.text}`;

        const span = document.createElement('span');
        span.style.display = 'inline-block';
        // EN=true: ボックスの2.5倍まで横に広げてOK（縦長になるのを防ぐ）
        // EN=false: ボックス幅に収める
        span.style.maxWidth = settings.EN ? `${Math.max(width, height) * 3}px` : `${width}px`;
        span.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
        span.style.borderRadius = '3px';
        span.style.padding = '2px 4px';
        span.style.boxSizing = 'border-box';
        span.style.color = 'black';
        span.style.fontWeight = 'bold';
        span.style.fontSize = `${fontSize}px`;
        span.style.wordBreak = 'break-word';
        span.style.overflowWrap = 'break-word';
        // EN=true: normal にして横に自然に広がらせる / EN=false: pre-wrap で改行維持
        span.style.whiteSpace = settings.EN ? 'nowrap' : 'pre-wrap';
        span.style.lineHeight = '1.4';
        span.style.textAlign = 'center';

        // ─── 追加④ EN=true なら OpenDyslexic、false なら元のフォント ──────────
        span.style.fontFamily = settings.EN
            ? '"OpenDyslexic", "Comic Sans MS", sans-serif'
            : '"Comic Sans MS", "Chalkboard SE", sans-serif';

        span.innerText = formattedText;

        div.appendChild(span);
        parent.appendChild(div);
    });

    console.log(`[display] Rendered ${data.results.length} overlays.`);
}

/**
 * 指定文字数ごとに改行を挿入するヘルパー関数
 */
function insertLineBreaks(text, charsPerLine) {
    if (!text || charsPerLine <= 0) return text;
    if (text.includes('\n')) return text;

    const isEnglish = /^[a-zA-Z0-9\s.,!?'"()\-:;]+$/.test(text.trim());
    if (isEnglish) return wrapEnglishWords(text, charsPerLine);

    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += text[i];
        if ((i + 1) % charsPerLine === 0 && i + 1 < text.length) result += '\n';
    }
    return result;
}

/**
 * 英語テキストを単語単位で折り返す
 */
function wrapEnglishWords(text, charsPerLine) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
        if (!currentLine) {
            currentLine = word;
        } else if ((currentLine + ' ' + word).length <= charsPerLine) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines.join('\n');
}