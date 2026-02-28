import sys
import os
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import PIL.Image
import io

# Add comic-text-detector folder to path to allow import
sys.path.append(str(Path(__file__).parent / "comic-text-detector"))
from manga_ocr import MangaOcr
# Import Comic Text Detector
from inference import TextDetector

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from the browser extension

class MangaTextExtractor:
    def __init__(self, detector_model_path=None, device='cpu'):
        """
        Initialize the MangaTextExtractor by loading the models.
        """
        if detector_model_path is None:
            # Default path relative to this script
            base_path = Path(__file__).parent / "comic-text-detector"
            detector_model_path = str(base_path / "comictextdetector.pt")
        
        # Check if model file exists
        if not Path(detector_model_path).exists():
             raise FileNotFoundError(f"Model file not found: {detector_model_path}")

        print("Loading MangaOCR model...")
        self.mocr = MangaOcr()
        
        print("Loading TextDetector model...")
        # Initialization of TextDetector
        self.text_detector = TextDetector(model_path=detector_model_path, input_size=1024, device=device, act='leaky')
        print("Models loaded successfully.")

    def _get_boxes_from_detector(self, img_array):
        """
        Internal helper to get coordinates using Comic Text Detector.
        Changed to accept numpy array directly.
        """
        # Run inference to get speech bubble information
        mask, mask_refined, blk_list = self.text_detector(img_array)
        
        formatted_boxes = []
        
        # Extract coordinates from TextBlock
        for blk in blk_list:
            xmin, ymin, xmax, ymax = map(int, blk.xyxy)
            
            formatted_boxes.append({
                "position": [xmin, ymin, xmax, ymax],
                "font_size": int(blk.font_size),
                "lines": blk.lines_array().tolist(),
                "angle": int(blk.angle),
                "vertical": bool(blk.vertical),
                "fg_color": [int(blk.fg_r), int(blk.fg_g), int(blk.fg_b)],
                "bg_color": [int(blk.bg_r), int(blk.bg_g), int(blk.bg_b)],
                "line_spacing": float(blk.line_spacing),
                "alignment": int(blk.alignment()),
                "language": str(blk.language) 
            })
                
        return formatted_boxes

    def extract(self, image_path):
        """
        Extract text from a manga page image.
        """
        image_path = str(image_path)
        
        # Read image with OpenCV for detector
        cv_img = cv2.imread(image_path)
        if cv_img is None:
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Read the original image with Pillow for cropping (MangaOCR prefers PIL)
        try:
            original_img = PIL.Image.open(image_path).convert("RGB")
        except Exception as e:
            raise IOError(f"Failed to open image {image_path}: {e}")
        
        # 1. Get all speech bubble coordinates
        bubble_data_list = self._get_boxes_from_detector(cv_img) 
        
        results = []
        
        # 2. Loop through and process the number of found speech bubbles
        for i, data in enumerate(bubble_data_list):
            box = data["position"]
            # Crop only the speech bubble part using the coordinates
            cropped_img = original_img.crop(box)
            
            # Pass the cropped image to manga-ocr to recognize text
            text = self.mocr(cropped_img)
            
            data["id"] = i
            data["text"] = text
            results.append(data)
            
        return results

# Initialize Global Extractor
extractor = None

@app.before_request
def initialize():
    global extractor
    if extractor is None:
        # Initialize only once
        try:
            extractor = MangaTextExtractor()
        except Exception as e:
            print(f"Error initializing models: {e}")

@app.route('/process', methods=['POST'])
def process_image():
    global extractor
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    
    # Save temp file because cv2.imread reads from path
    temp_filename = "temp_upload.png"
    file.save(temp_filename)
    
    try:
        # Run extraction
        results = extractor.extract(temp_filename)
        
        # Clean up
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
            
        return jsonify({'results': results})
    
    except Exception as e:
        print(f"Processing error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def health():
    return "Manga Extractor Server is Running!"

if __name__ == '__main__':
    # Run the server on port 5000
    app.run(host='0.0.0.0', port=5001, debug=False)