// display_results2.js
// Handles displaying the translation results on the screen

console.log("[display]Translation Display Module Loaded.");

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
    
    // Parse pageNum to integer to handle "001" -> 1
    const pageNumInt = parseInt(data.pageNum, 10);
    const pageInd0 = pageNumInt - 1; // 0-based index
    
    // Try various ID patterns commonly used
    const possibleIds = [
        `page${pageInd0}_0`,       // page0_0 (common)
        `page${pageInd0}`,         // page0
        `page${data.pageNum}_0`,   // page001_0
        `page${data.pageNum}`,     // page001
        `canvas-${pageInd0}`       // generic guess
    ];

    let canvas = null;
    for (const id of possibleIds) {
        canvas = document.getElementById(id);
        if (canvas) {
            console.log(`[display] Found canvas with ID: ${id}`);
            break;
        }
    }

    // Fallback: Query selector for partial match if ID lookup fails
    if (!canvas) {
        canvas = document.querySelector(`canvas[id*="page${pageInd0}"]`) || 
                 document.querySelector(`canvas[id*="page${data.pageNum}"]`);
    }

    // FINAL FALLBACK
    if (!canvas) {
         const allCanvases = document.querySelectorAll('canvas');
         const bigCanvases = Array.from(allCanvases).filter(c => c.width > 200 && c.height > 200);
         
         if (pageInd0 < bigCanvases.length) {
             canvas = bigCanvases[pageInd0];
             console.log(`[display] Fallback: Found canvas by index ${pageInd0} in large canvases list.`);
         }
    }

    if (!canvas) {
        console.warn(`[display] Canvas for page ${data.pageNum} not found. Cannot render overlay.`);
        return;
    }

    // 2. Calculate Scale Factor and Offsets correctly
    const canvasRect = canvas.getBoundingClientRect();
    
    // Ensure parent is relative
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

    // 3. Remove existing overlays if any (to avoid duplicates)
    const existingOverlays = parent.querySelectorAll('.manga-translation-overlay');
    existingOverlays.forEach(el => el.remove());

    // 4. Create overlays for each text block
    if (data.results && data.results.length > 0) {
        data.results.forEach((item) => {
            // Apply Scaling
            let xmin = item.position[0] * scaleX;
            let ymin = item.position[1] * scaleY;
            let xmax = item.position[2] * scaleX;
            let ymax = item.position[3] * scaleY;
            
            // EXPAND BOX
            const paddingX = (xmax - xmin) * 0.1;
            const paddingY = (ymax - ymin) * 0.1;
            
            xmin -= paddingX;
            xmax += paddingX;
            ymin -= paddingY;
            ymax += paddingY;

            // Apply Offset
            xmin += offsetX;
            xmax += offsetX;
            ymin += offsetY;
            ymax += offsetY;

            const width = xmax - xmin;
            const height = ymax - ymin;

            // ADJUST FONT SIZE
            // サーバーのfont_sizeをスケール換算して使用、なければ従来のフォールバック
            let fontSize = item.font_size
                ? item.font_size * Math.min(scaleX, scaleY)
                : height * 0.13;
            if (fontSize < 11) fontSize = 11;
            if (fontSize > 30) fontSize = 30;

            // 表示テキスト: 英訳があれば優先
            const displayText = item.english || item.text;

            // 改行処理
            const isVertical = item.vertical;
            const lineCount = (item.lines && item.lines.length > 0) ? item.lines.length : null;
            let formattedText;
            if (isVertical) {
                // 縦書き: ボックス幅に収まる文字数で折り返す
                const charsPerLine = Math.max(1, Math.floor((width - 10) / fontSize));
                formattedText = insertLineBreaks(displayText, charsPerLine);
            } else if (lineCount && lineCount > 1) {
                // 横書き複数行: サーバーのlines数をもとに折り返す
                const charsPerLine = Math.max(1, Math.ceil(displayText.length / lineCount));
                formattedText = insertLineBreaks(displayText, charsPerLine);
            } else {
                formattedText = displayText;
            }

            // Outer div: transparent container, overflow visible so text shows
            const div = document.createElement('div');
            div.className = 'manga-translation-overlay';
            div.style.position = 'absolute';
            div.style.left = `${xmin}px`;
            div.style.top = `${ymin}px`;
            div.style.width = `${width}px`;
            div.style.height = `${height}px`;
            div.style.backgroundColor = 'transparent';
            div.style.overflow = 'visible'; // visible のまま（hidden にすると flex 内で消える）
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.justifyContent = 'center';
            div.style.zIndex = '9999';
            div.style.boxSizing = 'border-box';
            div.title = `Original: ${item.text}`;

            // Inner span: white background fitted to text, width constrained to box
            const span = document.createElement('span');
            span.style.display = 'inline-block';
            span.style.maxWidth = `${width}px`;
            span.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
            span.style.borderRadius = '3px';
            span.style.padding = '2px 4px';
            span.style.boxSizing = 'border-box';
            span.style.color = 'black';
            span.style.fontWeight = 'bold';
            span.style.fontSize = `${fontSize}px`;
            span.style.fontFamily = '"Comic Sans MS", "Chalkboard SE", sans-serif';
            span.style.wordBreak = 'break-word';
            span.style.overflowWrap = 'break-word';
            span.style.whiteSpace = 'pre-wrap';
            span.style.lineHeight = '1.4';
            span.style.textAlign = 'center';

            span.innerText = formattedText;

            div.appendChild(span);
            parent.appendChild(div);
        });
        console.log(`[display] Rendered ${data.results.length} overlays.`);
    }
}

/**
 * 指定文字数ごとに改行を挿入するヘルパー関数
 */
function insertLineBreaks(text, charsPerLine) {
    if (!text || charsPerLine <= 0) return text;

    // すでに改行が含まれている場合はそのまま
    if (text.includes('\n')) return text;

    // 英語テキストは単語単位で折り返す
    const isEnglish = /^[a-zA-Z0-9\s.,!?'"()\-:;]+$/.test(text.trim());
    if (isEnglish) {
        return wrapEnglishWords(text, charsPerLine);
    }

    // 日本語など: 文字数で単純に折り返す
    let result = '';
    for (let i = 0; i < text.length; i++) {
        result += text[i];
        if ((i + 1) % charsPerLine === 0 && i + 1 < text.length) {
            result += '\n';
        }
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
        if (currentLine === '') {
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