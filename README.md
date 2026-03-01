# HenHacks2026: Manga Text Extractor

Our submission to the Community Wellness & Social Connections category!

## Overview
This project extracts text from manga images using `comic-text-detector` for speech bubble detection and `manga-ocr` for Optical Character Recognition (OCR).

## Prerequisites

- Python 3.10+
- `pip`

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/HenHacks2026.git
    cd HenHacks2026
    ```

2.  **Create and activate a virtual environment (optional but recommended):**
    ```bash
    python3 -m venv .venv
    source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Install `manga-ocr`:**
    ```bash
    git clone https://github.com/kha-white/manga-ocr
    ```


4.  **Install `comic-text-detector`:**
    ```bash
    git clone https://github.com/dmMaze/comic-text-detector.git
    pip install -r comic-text-detector/requirements.txt
    ```

5.  **Download the text detection model:**
    - Download `comictextdetector.pt` from [manga-image-translator releases (beta-0.2.1)](https://github.com/zyddnys/manga-image-translator/releases/tag/beta-0.2.1).
    - Place the `comictextdetector.pt` file into the `comic-text-detector/` folder.

6.  **Apply Patch to `comic-text-detector` (if using newer numpy):**
    If you encounter `AttributeError: module 'numpy' has no attribute 'bool8'`, you need to modify `comic-text-detector/utils/io_utils.py`.
    
    Open `comic-text-detector/utils/io_utils.py` and replace/add the type definitions around line 12:
    ```python
    # ...existing code...
    NP_INT_TYPES = (np.uint8, np.int8, np.int16, np.int32, np.int64)
    NP_FLOAT_TYPES = (np.float16, np.float32, np.float64)
    NP_BOOL_TYPES = (bool, np.bool_)
    # ...existing code...
    ```

## Usage

1.  Place your manga image in the project root (e.g., `image.png`).
2.  Update the `image_file` path in `python3 server.py` if necessary.
3.  Run the extractor:
    ```bash
    python3 server.py
    ```

The script will output the detected speech bubbles' positions and the recognized text.

## Credits

- [comic-text-detector](https://github.com/dmMaze/comic-text-detector)
- [manga-ocr](https://github.com/kha-white/manga-ocr)