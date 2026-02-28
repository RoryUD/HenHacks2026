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


class MangaTextExtractor:
    def __init__(self, detector_model_path=None, device='cpu'):
        """
        Initialize the MangaTextExtractor by loading the models.
        
        Args:
            detector_model_path (str, optional): Path to the comic-text-detector model file.
                                                 Defaults to 'comic-text-detector/comictextdetector.pt' in the project directory.
            device (str): Device to run the detector on ('cpu' or 'cuda'). Defaults to 'cpu'.
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
        # Note: TextDetector requires 'act' parameter to be 'leaky' for this specific model
        self.text_detector = TextDetector(model_path=detector_model_path, input_size=1024, device=device, act='leaky')
        print("Models loaded successfully.")

    def _get_boxes_from_detector(self, img_path):
        """
        Internal helper to get coordinates using Comic Text Detector.
        """
        # Read image with OpenCV
        img = cv2.imread(str(img_path))
        if img is None:
            raise FileNotFoundError(f"Image not found: {img_path}")
        
        # Run inference to get speech bubble information
        # TextDetector returns (mask, mask_refined, blk_list)
        _, _, blk_list = self.text_detector(img)
        
        formatted_boxes = []
        
        # Extract coordinates from TextBlock
        for blk in blk_list:
            # blk.xyxy is in the format [xmin, ymin, xmax, ymax]
            xmin, ymin, xmax, ymax = map(int, blk.xyxy)
            formatted_boxes.append({
                "position": (xmin, ymin, xmax, ymax),
                "font_size": blk.font_size,
                "lines": blk.lines_array().tolist(),
                "angle": blk.angle,
                "vertical": blk.vertical,
                "fg_color": (blk.fg_r, blk.fg_g, blk.fg_b),
                "bg_color": (blk.bg_r, blk.bg_g, blk.bg_b)
            })
                
        return formatted_boxes

    def extract(self, image_path):
        """
        Extract text from a manga page image.

        Args:
            image_path (str or Path): Path to the image file.

        Returns:
            list[dict]: A list of dictionaries containing detected text and position.
                        Example:
                        [
                            {
                                "position": (xmin, ymin, xmax, ymax),
                                "text": "Hello World",
                                "font_size": 24.5,
                                "lines": [[...], ...],
                                "angle": 0,
                                "vertical": True,
                                "fg_color": (0, 0, 0),
                                "bg_color": (255, 255, 255)
                            },
                            ...
                        ]
        """
        image_path = str(image_path) # Ensure path is string for cv2 and PIL
        
        # Read the original image with Pillow for cropping
        try:
            original_img = PIL.Image.open(image_path)
        except Exception as e:
            raise IOError(f"Failed to open image {image_path}: {e}")
        
        # 1. Get all speech bubble coordinates (positions) and metadata
        bubble_data_list = self._get_boxes_from_detector(image_path) 
        
        results = []
        
        # 2. Loop through and process the number of found speech bubbles
        for i, data in enumerate(bubble_data_list):
            box = data["position"]
            # Crop only the speech bubble part using the coordinates
            cropped_img = original_img.crop(box)
            
            # Pass the cropped image to manga-ocr to recognize text
            text = self.mocr(cropped_img)
            
            # Save position information and text
            results.append({
                "id": i,
                "position": box,
                "font_size": data["font_size"],
                # "lines": data["lines"],
                "angle": data["angle"],
                "vertical": data["vertical"],
                "fg_color": data["fg_color"],
                "bg_color": data["bg_color"],
                "text": text
            })
            
        return results

if __name__ == "__main__":
    # Specify image path for hackathon
    image_file = '/Users/mizuho/HenHacks2026/image.png'
    
    try:
        # Initialize the extractor
        extractor = MangaTextExtractor()

        print(f"Processing image: {image_file}")
        # Extract text from the page
        page_data = extractor.extract(image_file)
        
        # Check results
        for i, data in enumerate(page_data):
            print(f"【Bubble {i+1}】")
            print(f"Position: {data['position']}")
            print(f"Font Size: {data['font_size']}")
            print(f"Vertical: {data['vertical']}")
            print(f"Angle: {data['angle']}")
            print(f"Text: {data['text']}\n")
            
    except Exception as e:
        print(f"An error occurred: {e}")