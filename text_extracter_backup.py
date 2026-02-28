import sys
from pathlib import Path

# Add comic-text-detector folder to path to allow import
sys.path.append(str(Path(__file__).parent / "comic-text-detector"))

import cv2
import numpy as np
import PIL.Image
from manga_ocr import MangaOcr

# Import Comic Text Detector
from inference import TextDetector

def get_boxes_from_detector(detector, img_path):
    """
    Function to get coordinates using Comic Text Detector and convert them to a format usable by Pillow
    """
    # Read image with OpenCV
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"Image not found: {img_path}")
    
    # Run inference to get speech bubble information
    # TextDetector returns (mask, mask_refined, blk_list)
    _, _, blk_list = detector(img)
    
    formatted_boxes = []
    
    # Extract coordinates from TextBlock
    for blk in blk_list:
        # blk.xyxy is in the format [xmin, ymin, xmax, ymax]
        xmin, ymin, xmax, ymax = map(int, blk.xyxy)
        formatted_boxes.append((xmin, ymin, xmax, ymax))
            
    return formatted_boxes

def extract_manga_text_data(image_path, text_detector, mocr):
    # Read the original image with Pillow
    original_img = PIL.Image.open(image_path)
    
    # 2. Get all speech bubble coordinates (positions) with Comic Text Detector
    bounding_boxes = get_boxes_from_detector(text_detector, image_path) 
    
    results = []
    
    # 3. Loop through and process the number of found speech bubbles
    for box in bounding_boxes:
        # Crop only the speech bubble part using the coordinates with Pillow
        cropped_img = original_img.crop(box)
        
        # Pass the cropped image to manga-ocr to textify
        text = mocr(cropped_img)
        
        # Save position information and text as a set in the list
        results.append({
            "position": box,
            "text": text
        })
        
    return results

if __name__ == "__main__":
    # Specify image path for hackathon
    image_file = '/Users/mizuho/HenHacks2026/image.png'
    
    # Model path (assuming it is inside the comic-text-detector folder)
    model_path = str(Path(__file__).parent / "comic-text-detector/comictextdetector.pt")
    
    # 1. Preparation of OCR and detection model
    print("Loading models...")
    mocr = MangaOcr()
    
    # Initialization of TextDetector
    text_detector = TextDetector(model_path=model_path, input_size=1024, device='cpu', act='leaky')

    print("Processing image...")
    # Store data of the entire page in a variable
    page_data = extract_manga_text_data(image_file, text_detector, mocr)
    
    # Check results
    for i, data in enumerate(page_data):
        print(f"【Bubble {i+1}】")
        print(f"Position: {data['position']}")
        print(f"Text: {data['text']}\n")