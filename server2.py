import sys
import os
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import cv2
import numpy as np
import PIL.Image
from PIL import ImageDraw, ImageFont
import textwrap
import io
import time

# Add comic-text-detector folder to path to allow import
sys.path.append(str(Path(__file__).parent / "comic-text-detector"))
from manga_ocr import MangaOcr
# Import Comic Text Detector
# Note: comic-text-detector might have different import structure depending on version
# Assuming inference.py is in the root of comic-text-detector based on user provided context
try:
    from inference import TextDetector
except ImportError:
    # Fallback if inference is not directly importable, try adding to path again or check structure
    sys.path.append(str(Path(__file__).parent / "comic-text-detector"))
    from inference import TextDetector

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

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
             print(f"Warning: Model file not found at {detector_model_path}")
             # You might want to download it here or raise error

        print("Loading MangaOCR model...")
        self.mocr = MangaOcr()
        
        print("Loading TextDetector model...")
        # Initialization of TextDetector
        self.text_detector = TextDetector(model_path=detector_model_path, input_size=1024, device=device, act='leaky')
        print("Models loaded successfully.")

    def _get_boxes_from_detector(self, img_array):
        """
        Internal helper to get coordinates using Comic Text Detector.
        """
        # Run inference to get speech bubble information
        mask, mask_refined, blk_list = self.text_detector(img_array)
        
        formatted_boxes = []
        
        # Extract coordinates from TextBlock
        for blk in blk_list:
            if blk.xyxy is None: continue
            xmin, ymin, xmax, ymax = map(int, blk.xyxy)
            
            lines = blk.lines_array() if blk.lines_array() is not None else []
            
            formatted_boxes.append({
                "position": [xmin, ymin, xmax, ymax],
                "font_size": int(blk.font_size) if hasattr(blk, 'font_size') else 20,
                "lines": lines.tolist() if hasattr(lines, 'tolist') else lines,
                "angle": int(blk.angle) if hasattr(blk, 'angle') else 0,
                "vertical": bool(blk.vertical) if hasattr(blk, 'vertical') else True,
                "fg_color": [int(blk.fg_r), int(blk.fg_g), int(blk.fg_b)] if hasattr(blk, 'fg_r') else [0,0,0],
                "bg_color": [int(blk.bg_r), int(blk.bg_g), int(blk.bg_b)] if hasattr(blk, 'bg_r') else [255,255,255],
                "line_spacing": float(blk.line_spacing) if hasattr(blk, 'line_spacing') else 1.0,
                "alignment": int(blk.alignment) if hasattr(blk, 'alignment') else 1,
            })
                
        return formatted_boxes

    def extract_and_annotate(self, image_path, output_path):
        """
        Extract text from a manga page image and annotate it.
        """
        image_path = str(image_path)
        
        # Read image with OpenCV for detector
        cv_img = cv2.imread(image_path)
        if cv_img is None:
            raise FileNotFoundError(f"Image not found: {image_path}")

        # Read the original image with Pillow for cropping and drawing
        try:
            original_img = PIL.Image.open(image_path).convert("RGB")
        except Exception as e:
            raise IOError(f"Failed to open image {image_path}: {e}")
        
        # 1. Get all speech bubble coordinates
        bubble_data_list = self._get_boxes_from_detector(cv_img) 
        
        draw = ImageDraw.Draw(original_img)
        
        # Font settings
        font_path = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
        try:
            ImageFont.truetype(font_path, 20)
        except IOError:
            font_path = "/System/Library/Fonts/PingFang.ttc" 
            try:
                ImageFont.truetype(font_path, 20)
            except IOError:
                 font_path = "arial.ttf" # Fallback

        results = []
        
        # 2. Process each bubble
        for i, data in enumerate(bubble_data_list):
            box = data["position"]
            cropped_img = original_img.crop(box)
            
            # OCR
            text = self.mocr(cropped_img)
            data["id"] = i
            data["text"] = text
            results.append(data)

            # --- Annotation Logic ---
            xmin, ymin, xmax, ymax = data['position']
            width = xmax - xmin
            height = ymax - ymin
            
            is_vertical = data.get('vertical', height > width * 1.5)
            bg_color = data.get('bg_color', (255, 255, 255))
            
            # Simple logic: fill with white if background is light, black if dark
            bg_sum = sum(bg_color) if isinstance(bg_color, (list, tuple)) else 765
            fill_color = "white" if bg_sum > 600 else "black"
            text_color = "black" if fill_color == "white" else "white"
            
            draw.rectangle([xmin, ymin, xmax, ymax], fill=fill_color)

            estimated_size = data.get('font_size', -1)
            line_spacing_ratio = data.get('line_spacing', 1.0)
            alignment_val = data.get('alignment', 1)
            alignment_map = {0: "left", 1: "center", 2: "right"}
            alignment = alignment_map.get(alignment_val, "center")

            best_data, custom_font = fit_text(draw, text, width, height, font_path, is_vertical, estimated_font_size=estimated_size)
            
            current_font_size = custom_font.size
            pixel_spacing = int(current_font_size * line_spacing_ratio * 0.2)

            if is_vertical:
                draw_vertical_text_rtl(draw, best_data, custom_font, xmin, ymin, width, height, text_color=text_color, line_spacing=pixel_spacing)
            else:
                bbox = draw.multiline_textbbox((0, 0), best_data, font=custom_font, spacing=pixel_spacing)
                text_w = bbox[2] - bbox[0]
                text_h = bbox[3] - bbox[1]
                
                draw_x = xmin + width / 2 - text_w / 2
                draw_y = ymin + height / 2 - text_h / 2
                
                draw.multiline_text(
                    (draw_x, draw_y), 
                    best_data, 
                    fill=text_color, 
                    font=custom_font, 
                    align=alignment,
                    spacing=pixel_spacing
                )

        original_img.save(output_path)
        return results

# --- Helper Functions for Text Rendering ---

def get_vertical_lines(draw, text, font, box_height):
    lines = []
    current_line = ""
    current_h = 0
    char_spacing = int(font.size * 0.1) 
    
    for char in text:
        bbox = draw.textbbox((0, 0), char, font=font)
        char_h = bbox[3] - bbox[1]
        
        if current_h + char_h + char_spacing > box_height and current_line:
            lines.append(current_line)
            current_line = char
            current_h = char_h + char_spacing
        else:
            current_line += char
            current_h += char_h + char_spacing
            
    if current_line:
        lines.append(current_line)
    return lines

def fit_text(draw, text, box_width, box_height, font_path, is_vertical=False, estimated_font_size=None):
    min_font_size = 10
    max_font_size = 100
    
    if estimated_font_size and estimated_font_size > min_font_size:
        start_font_size = int(estimated_font_size * 1.5)
        start_font_size = min(start_font_size, max_font_size)
    else:
        start_font_size = max_font_size

    best_font = None
    best_data = None 

    for font_size in range(start_font_size, min_font_size - 1, -2):
        try:
            font = ImageFont.truetype(font_path, font_size)
        except IOError:
            font = ImageFont.load_default()
            best_font = font
            break

        if is_vertical:
            lines = get_vertical_lines(draw, text, font, box_height)
            
            bbox_a = draw.textbbox((0, 0), "あ", font=font)
            char_width = bbox_a[2] - bbox_a[0]
            line_spacing = int(font_size * 0.2)
            
            total_width = len(lines) * char_width + max(0, len(lines) - 1) * line_spacing
            
            if total_width <= box_width:
                best_font = font
                best_data = lines
                break
        else:
            target_width = box_width * 0.95
            avg_char_width = font_size
            if avg_char_width <= 0: continue
            
            chars_per_line = max(1, int(target_width / avg_char_width))
            wrapped_text = textwrap.fill(text, width=chars_per_line)
            
            bbox = draw.multiline_textbbox((0, 0), wrapped_text, font=font, spacing=4)
            w = bbox[2] - bbox[0]
            h = bbox[3] - bbox[1]
            
            if w <= box_width and h <= box_height:
                best_font = font
                best_data = wrapped_text
                break
    
    if best_font is None:
        try:
            best_font = ImageFont.truetype(font_path, min_font_size)
        except:
            best_font = ImageFont.load_default()
        if is_vertical:
            best_data = get_vertical_lines(draw, text, best_font, box_height)
        else:
            best_data = textwrap.fill(text, width=max(1, int(box_width*0.9/min_font_size)))
            
    return best_data, best_font

def draw_vertical_text_rtl(draw, lines, font, box_x, box_y, box_width, box_height, text_color="white", line_spacing=4):
    bbox_a = draw.textbbox((0, 0), "あ", font=font)
    char_width = bbox_a[2] - bbox_a[0]
    char_spacing = int(font.size * 0.1)
    
    total_width = len(lines) * char_width + max(0, len(lines) - 1) * line_spacing
    
    start_x = box_x + box_width / 2 + total_width / 2 - char_width
    
    for i, line in enumerate(lines):
        current_x = start_x - i * (char_width + line_spacing)
        
        line_height = sum([draw.textbbox((0, 0), c, font=font)[3] - draw.textbbox((0, 0), c, font=font)[1] + char_spacing for c in line])
        line_height -= char_spacing
        current_y = box_y + box_height / 2 - line_height / 2
        
        for char in line:
            draw.text((current_x, current_y), char, font=font, fill=text_color)
            bbox = draw.textbbox((0, 0), char, font=font)
            current_y += (bbox[3] - bbox[1]) + char_spacing

# --- App Logic ---

extractor = None

@app.before_request
def initialize():
    global extractor
    if extractor is None:
        try:
            extractor = MangaTextExtractor()
        except Exception as e:
            print(f"Error initializing models: {e}")

@app.route('/process_and_annotate', methods=['POST'])
def process_and_annotate():
    global extractor
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    
    temp_filename = f"temp_{int(time.time())}.png"
    output_filename = f"output_{int(time.time())}.png"
    file.save(temp_filename)
    
    try:
        extractor.extract_and_annotate(temp_filename, output_filename)
        
        # Clean up temp input
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        
        # Return the annotated image
        return send_file(output_filename, mimetype='image/png')
    
    except Exception as e:
        print(f"Processing error: {e}")
        # Clean up on error
        if os.path.exists(temp_filename):
            os.remove(temp_filename)
        return jsonify({'error': str(e)}), 500

@app.route('/', methods=['GET'])
def health():
    return "Manga Annotation Server is Running!"

if __name__ == '__main__':
    # Run on a different port (e.g., 5002) to avoid conflict with main server if running simultaneously
    app.run(host='0.0.0.0', port=5002, debug=False)
