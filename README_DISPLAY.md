# Translation Display Module (`display_img.js`)

This module allows for the rendering of translated text overlays on top of manga pages within the browser. It listens for OCR/Translation results and dynamically creates DOM elements to display the text.

## Features

- **Text Overlay**: Draws text boxes over the original speech bubbles.
- **Auto-Translation**: Can automatically translate Japanese text to English using Google Translate API.
- **Dyslexia-Friendly**: Uses the *OpenDyslexic* font when English mode is enabled.
- **Responsive**: Calculates positions relative to the canvas and handles scaling/offsets automatically.
- **Smart Wrapping**: Includes logic to wrap text appropriately for both Japanese (character-based) and English (word-based).

## Configuration

The behavior of the module is controlled by the `settings` object at the top of the file:

```javascript
const settings = { EN: true };
```

| Setting | Type    | Description |
| :--- | :--- | :--- |
| `EN` | `boolean` | **True**: Translates text to English, uses OpenDyslexic font, and expands text box width for better readability.<br>**False**: Displays original text (or server-provided translation) with standard comic fonts, keeping strictly to the original bounding box width. |

To change the language/mode, simply edit this line in `display_img.js`.

## Usage / Interpretation

This script is designed to be injected into the manga viewer page. It does not run on its own but waits for a specific custom event.

### 1. Triggering the Display

The module listens for the `MangaTextDetected` event. You (or the main logic script) must dispatch this event with the detection results.

**Example Code to Trigger:**

```javascript
const event = new CustomEvent("MangaTextDetected", {
    detail: {
        pageNum: 3,         // The page number (1-based index)
        pageWidth: 1200,    // Original width of the analyzed image
        pageHeight: 1600,   // Original height of the analyzed image
        results: [
            {
                text: "こんにちは",       // Original text
                english: "Hello",       // (Optional) Pre-translated text
                position: [100, 200, 300, 250], // [xmin, ymin, xmax, ymax]
                vertical: true,         // Whether text is vertical
                font_size: 24           // Estimated font size
            },
            // ... more text blocks
        ]
    }
});

document.dispatchEvent(event);
```

### 2. Logic Flow

1.  **Event Reception**: Receives `MangaTextDetected`.
2.  **Element Discovery**: Searches for the manga `<canvas>` element using IDs like `page2_0`, `page2`, or by checking canvas sizes.
3.  **Coordinate Calculation**:
    *   Computes the scale factor between the *original image size* (from server/event) and the *displayed canvas size* (in DOM).
    *   Calculates offsets if the canvas is centered or padded.
4.  **Translation (if `EN: true`)**:
    *   Checks if an `english` field exists in the result.
    *   If not, calls `translateToEnglish(text)` which hits the Google Translate public API.
5.  **Rendering**:
    *   Clears old overlays (`.manga-translation-overlay`).
    *   Creates absolute-positioned `<div>` elements for each text block.
    *   Applies appropriate fonts and line-wrapping optimization.

## Dependencies

- **OpenDyslexic Font**: The script dynamically injects a `<link>` to load the OpenDyslexic font from a CDN if it is missing.
- **Google Translate API**: Uses the free `translate.googleapis.com` endpoint. Note that this may have rate limits or CORS restrictions depending on the browser environment.
