import sys
import os
import json
import time
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import PIL.Image
import io

# Import Google GenAI and load_dotenv
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from config.env
load_dotenv('config.env')

# Add comic-text-detector folder to path to allow import
sys.path.append(str(Path(__file__).parent / "comic-text-detector"))
from manga_ocr import MangaOcr
# Import Comic Text Detector
from inference import TextDetector

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests from the browser extension

# Configure Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if GOOGLE_API_KEY:
    genai.configure(api_key=GOOGLE_API_KEY)
else:
    print("WARNING: GOOGLE_API_KEY not found in config.env. Translation will be disabled.")

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
        
        # Initialize Gemini Model
        if GOOGLE_API_KEY:
            self.translation_model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.translation_model = None

    def translate_batch(self, texts):
        """
        Translates a list of Japanese texts to English using Gemini in a single batch request.
        """
        if not self.translation_model:
            return ["[Translation Skipped]"] * len(texts)
        
        valid_indices = [i for i, t in enumerate(texts) if t and t.strip()]
        if not valid_indices:
            return [""] * len(texts)

        # Prepare batch prompt
        joined_text = "\n".join([f"[{i}] {texts[i]}" for i in valid_indices])
        prompt = (
            "Translate the following Japanese manga lines to English. "
            "Maintain the original tone. "
            "Output the result as a JSON object where keys are the indices and values are the translations.\n"
            "Example format: {\"0\": \"Hello\", \"1\": \"World\"}\n\n"
            f"{joined_text}"
        )
        
        max_retries = 3
        wait_time = 2 

        for attempt in range(max_retries):
            try:
                response = self.translation_model.generate_content(
                    prompt, 
                    generation_config={"response_mime_type": "application/json"}
                )
                
                # Geminiがマークダウン（```json ... ```）をつけてきた場合に取り除く安全策
                raw_text = response.text.strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                elif raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                    
                translation_map = json.loads(raw_text.strip())
                
                # reconstruct list
                results = []
                for i in range(len(texts)):
                    if i in valid_indices:
                        # Convert key to string because JSON keys are always strings
                        results.append(translation_map.get(str(i), "[Translation Failed]"))
                    else:
                        results.append("")
                return results

            except Exception as e:
                error_str = str(e)
                if "429" in error_str:
                    print(f"Rate limit exceeded (429). Retrying in {wait_time}s... (Attempt {attempt + 1}/{max_retries})")
                    time.sleep(wait_time)
                    wait_time *= 2  # Exponential backoff (待機時間を倍にしていく)
                else:
                    print(f"Batch translation error: {e}")
                    break
        
        return ["[Translation Failed]"] * len(texts)

    def _get_boxes_from_detector(self, img_array):
        """
        Internal helper to get coordinates using Comic Text Detector.
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
        Extract text from a manga page image and translate it in batch.
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
        raw_texts = []
        
        # 2. First pass: Extract all text via OCR
        for i, data in enumerate(bubble_data_list):
            box = data["position"]
            if box[2] <= box[0] or box[3] <= box[1]: # valid check
                 continue

            # Crop only the speech bubble part using the coordinates
            cropped_img = original_img.crop((box[0], box[1], box[2], box[3]))
            
            # Pass the cropped image to manga-ocr to recognize text
            text = self.mocr(cropped_img)
            
            data["id"] = i
            data["text"] = text
            raw_texts.append(text)
            results.append(data)
            
        # 3. Batch Translate (ここで一括翻訳を実行！)
        if raw_texts:
            print(f"Translating {len(raw_texts)} bubbles in batch...")
            translations = self.translate_batch(raw_texts)
            for i, data in enumerate(results):
                data["english"] = translations[i]
            
        return results

# グローバル変数の定義
extractor = None

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
    # サーバーを起動する前に、ここで1回だけ重いモデルを読み込んでおく（タイムアウト対策）
    print("Initializing models before starting server...")
    try:
        extractor = MangaTextExtractor()
    except Exception as e:
        print(f"Error initializing models: {e}")
        
    # Run the server on port 5001
    print("Starting Flask server on port 5001...")
    app.run(host='0.0.0.0', port=5001, debug=False)