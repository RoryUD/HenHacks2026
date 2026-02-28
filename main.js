console.log("HenHacks Manga Extractor Loaded");

// Server URL (Port 5001)
const API_URL = "http://127.0.0.1:5001/process";

// Create a selection button
const btn = document.createElement("button");
btn.innerText = "Select Area";
btn.style.position = "fixed";
btn.style.top = "10px";
btn.style.right = "10px";
btn.style.zIndex = "100000";
btn.style.padding = "10px 20px";
btn.style.backgroundColor = "#ff4444";
btn.style.color = "white";
btn.style.border = "none";
btn.style.borderRadius = "5px";
btn.style.cursor = "pointer";
btn.onclick = startSelection;
document.body.appendChild(btn);

let isSelecting = false;
let startX, startY;
let selectionBox = null;

function startSelection() {
    if (isSelecting) return;
    isSelecting = true;
    document.body.style.cursor = "crosshair";
    btn.innerText = "Drag to Select";

    // Create selection box element
    selectionBox = document.createElement("div");
    selectionBox.style.position = "fixed"; // Changed to fixed to follow viewport
    selectionBox.style.border = "2px dashed red";
    selectionBox.style.backgroundColor = "rgba(255, 0, 0, 0.1)";
    selectionBox.style.zIndex = "99999";
    selectionBox.style.pointerEvents = "none";
    document.body.appendChild(selectionBox);

    document.addEventListener("mousedown", onMouseDown);
}

function onMouseDown(e) {
    startX = e.clientX;
    startY = e.clientY;
    
    // Initialize box
    selectionBox.style.left = startX + "px";
    selectionBox.style.top = startY + "px";
    selectionBox.style.width = "0px";
    selectionBox.style.height = "0px";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e) {
    const currentX = e.clientX;
    const currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    selectionBox.style.width = width + "px";
    selectionBox.style.height = height + "px";
    selectionBox.style.left = left + "px";
    selectionBox.style.top = top + "px";
}

async function onMouseUp(e) {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("mousedown", onMouseDown);
    
    isSelecting = false;
    document.body.style.cursor = "default";
    btn.innerText = "Select Area";

    const rect = selectionBox.getBoundingClientRect();
    
    // Remove selection box after a short delay or immediately
    selectionBox.remove();
    
    if (rect.width < 10 || rect.height < 10) return; // Ignore small clicks

    await captureAndProcess(rect);
}

async function captureAndProcess(rect) {
    btn.innerText = "Processing...";
    
    // Check multiple points to find the image (center, and slightly offset)
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Instead of elementFromPoint, use elementsFromPoint to pierce through overlays
    const elements = document.elementsFromPoint(centerX, centerY);
    
    // Look for an IMG tag in the stack of elements at that point
    // We also look for canvas elements just in case the viewer uses canvas
    let element = elements.find(el => el.tagName === "IMG"); // || el.tagName === "CANVAS"

    // If not found, try searching strictly inside the rect for any image
    if (!element) {
         // Fallback: Check all images on page and see if one intersects significantly with our rect
         const allImages = document.querySelectorAll("img");
         for (let img of allImages) {
             const imgRect = img.getBoundingClientRect();
             if (
                 imgRect.left < rect.right &&
                 imgRect.right > rect.left &&
                 imgRect.top < rect.bottom &&
                 imgRect.bottom > rect.top
             ) {
                 // Check if it effectively contains the center of our selection
                 if (centerX >= imgRect.left && centerX <= imgRect.right && 
                     centerY >= imgRect.top && centerY <= imgRect.bottom) {
                     element = img;
                     break;
                 }
             }
         }
    }
    
    if (element && element.tagName === "IMG") {
        console.log("Found image under selection:", element.src);
        await processCroppedImage(element, rect);
    } else {
        console.log("Elements found at point:", elements.map(e => e.tagName));
        alert("Please select an area inside an image.");
        btn.innerText = "Select Area";
    }
}

async function processCroppedImage(imgElement, cropRect) {
    try {
        // 1. Load image into canvas to crop
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imgElement.src;
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const imgRect = imgElement.getBoundingClientRect();
        
        // Calculate scaling
        const scaleX = img.naturalWidth / imgRect.width;
        const scaleY = img.naturalHeight / imgRect.height;

        // Calculate crop coordinates relative to the image
        const cropX = (cropRect.left - imgRect.left) * scaleX;
        const cropY = (cropRect.top - imgRect.top) * scaleY;
        const cropWidth = cropRect.width * scaleX;
        const cropHeight = cropRect.height * scaleY;

        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = cropWidth;
        canvas.height = cropHeight;
        const ctx = canvas.getContext("2d");
        
        // Draw cropped area
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        // Convert to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));

        // 2. Send to server
        const formData = new FormData();
        formData.append("image", blob, "crop.png");

        const apiResponse = await fetch(API_URL, {
            method: "POST",
            body: formData
        });

        if (!apiResponse.ok) throw new Error("Server Error");

        const data = await apiResponse.json();
        console.log("Result:", data);

        // 3. Draw overlay (Adjust coordinates to be relative to the viewport)
        drawOverlayAbsolute(cropRect.left, cropRect.top, cropWidth / cropRect.width, cropHeight / cropRect.height, data.results);

    } catch (e) {
        console.error(e);
        alert("Error: " + e.message);
    } finally {
        btn.innerText = "Select Area";
    }
}

function drawOverlayAbsolute(baseX, baseY, scaleX_inv, scaleY_inv, results) {
    // scaleX_inv is actually (natural / display), so to go back to display sets:
    // display_size = natural_size / scale
    const scaleX = 1 / scaleX_inv;
    const scaleY = 1 / scaleY_inv;
    
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = (baseY + scrollTop) + "px";
    container.style.left = (baseX + scrollLeft) + "px";
    container.style.pointerEvents = "none";
    container.style.zIndex = "10000";
    document.body.appendChild(container);

    results.forEach(item => {
        const [xmin, ymin, xmax, ymax] = item.position;
        const text = item.text;

        const box = document.createElement("div");
        box.style.position = "absolute";
        box.style.left = (xmin * scaleX) + "px";
        box.style.top = (ymin * scaleY) + "px";
        box.style.width = ((xmax - xmin) * scaleX) + "px";
        box.style.height = ((ymax - ymin) * scaleY) + "px";
        
        box.style.border = "2px solid red";
        box.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
        box.style.color = "black";
        box.style.fontSize = "12px"; // Adjusted font size
        box.style.overflow = "hidden";
        box.style.whiteSpace = "pre-wrap";
        box.style.padding = "2px";
        box.innerText = text;

        container.appendChild(box);
    });
}