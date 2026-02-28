from PIL import Image, ImageDraw, ImageFont
import textwrap
import yaml
import os

# extraction is done via yaml file now
image_path = "/Users/mizuho/HenHacks2026/image.png"
yaml_path = os.path.splitext(image_path)[0] + ".yaml"

print(f"Loading metadata from {yaml_path}...")
with open(yaml_path, "r", encoding="utf-8") as f:
    results = yaml.safe_load(f)

# Open original image
img = Image.open(image_path).convert("RGB")
draw = ImageDraw.Draw(img)

def get_vertical_lines(draw, text, font, box_height):
    """Split text into a list for vertical writing at the specified height"""
    lines = []
    current_line = ""
    current_h = 0
    char_spacing = int(font.size * 0.2) # Vertical character spacing: leave a little space (10%)
    
    for char in text:
        bbox = draw.textbbox((0, 0), char, font=font)
        char_h = bbox[3] - bbox[1]
        
        # Move to the next column if the height of the frame is exceeded
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
    """Adjust text font size and wrapping to fit within the specified frame"""
    min_font_size = 10
    max_font_size = 100
    
    # If there is an estimated font size, start searching from there (improves accuracy and speed)
    if estimated_font_size and estimated_font_size > min_font_size:
        start_font_size = int(estimated_font_size * 1.5) # Start a little larger than the estimated value
        start_font_size = min(start_font_size, max_font_size)
    else:
        start_font_size = max_font_size

    best_font = None
    best_data = None # Horizontal writing contains a string, vertical writing contains a list of columns

    for font_size in range(start_font_size, min_font_size - 1, -2):
        try:
            font = ImageFont.truetype(font_path, font_size)
        except IOError:
            font = ImageFont.load_default()
            best_font = font
            break

        if is_vertical:
            # Vertical writing: Split text into columns based on height
            lines = get_vertical_lines(draw, text, font, box_height)
            
            # Get average font width
            bbox_a = draw.textbbox((0, 0), "あ", font=font)
            char_width = bbox_a[2] - bbox_a[0]
            line_spacing = int(font_size * 0.2) # Line spacing is about 20% of font size
            
            # Calculate total width (number of columns * (character width + line spacing))
            total_width = len(lines) * char_width + max(0, len(lines) - 1) * line_spacing
            
            # Check if total width fits within the frame
            if total_width <= box_width:
                best_font = font
                best_data = lines
                break
        else:
            # Horizontal writing: Calculate wrapping according to width
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
    
    # Fallback if it doesn't fit even at minimum size
    if best_font is None:
        try:
            best_font = ImageFont.truetype(font_path, min_font_size)
        except:
            best_font = ImageFont.load_default()
        
        # Simple fallback (room for improvement here)
        if is_vertical:
            best_data = get_vertical_lines(draw, text, best_font, box_height)
        else:
            best_data = textwrap.fill(text, width=max(1, int(box_width*0.9/min_font_size)))
        
        return best_data, best_font
            
    return best_data, best_font

def draw_vertical_text_rtl(draw, lines, font, box_x, box_y, box_width, box_height, text_color="white", line_spacing=4):
    """Draw multiple lines of vertical text from right to left (supports centering)"""
    bbox_a = draw.textbbox((0, 0), "あ", font=font)
    char_width = bbox_a[2] - bbox_a[0]
    char_spacing = int(font.size * 0.1) # Character spacing when drawing
    
    # Calculate the width of the entire text block
    total_width = len(lines) * char_width + max(0, len(lines) - 1) * line_spacing
    
    # X coordinate of the first column (place in the center of the frame and calculate the start position of the rightmost column)
    start_x = box_x + box_width / 2 + total_width / 2 - char_width
    
    for i, line in enumerate(lines):
        # Shift to the left as the column progresses
        current_x = start_x - i * (char_width + line_spacing)
        
        # Calculate the total height of this column and determine the vertical centering start position
        line_height = sum([draw.textbbox((0, 0), c, font=font)[3] - draw.textbbox((0, 0), c, font=font)[1] + char_spacing for c in line])
        line_height -= char_spacing # Do not count the space after the last character
        current_y = box_y + box_height / 2 - line_height / 2
        
        # Draw one character at a time vertically
        for char in line:
            draw.text((current_x, current_y), char, font=font, fill=text_color)
            bbox = draw.textbbox((0, 0), char, font=font)
            current_y += (bbox[3] - bbox[1]) + char_spacing

# ----------------------------------------
# Main Process
# ----------------------------------------
font_path = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
# If the above font does not exist, use the default
try:
    ImageFont.truetype(font_path, 20)
except IOError:
    font_path = "/System/Library/Fonts/PingFang.ttc" # Another candidate for Japanese font on Mac

# If PingFang is also missing, fallback to default (handled within try-except)

for item in results:
    print(f"ID: {item['id']}")
    print(f"Position: {item['position']}")
    print(f"Text: {item['text']}")
    print("-" * 20)

    xmin, ymin, xmax, ymax = item['position']
    text = item['text']
    
    width = xmax - xmin
    height = ymax - ymin
    
    # Use detailed information obtained from TextBlock
    # Since reading from YAML, get while checking if key exists
    is_vertical = item.get('vertical', height > width * 1.5)
    bg_color = item.get('bg_color', (0, 0, 0)) # Background color is filled with black (instead of mask processing)
    fg_color = item.get('fg_color', (255, 255, 255)) # Text color is white
    
    # Line spacing (line_spacing is 1.0 based magnification, pixel conversion is required, but used as coefficient simply here)
    # TextBlock's line_spacing is close to line spacing / character size ratio
    line_spacing_ratio = item.get('line_spacing', 1.0)
    if line_spacing_ratio is None: line_spacing_ratio = 1.0
    
    # Text alignment (0: left, 1: center, 2: right) -> PIL is "left", "center", "right"
    # Assumed to be saved as a number in YAML
    align_val = item.get('alignment', 1)
    alignment_map = {0: "left", 1: "center", 2: "right"}
    alignment = alignment_map.get(align_val, "center")

    # Convert if tuple is numpy array or list
    if not isinstance(bg_color, tuple):
        bg_color = tuple(map(int, bg_color)) if hasattr(bg_color, '__iter__') else (0,0,0)

    # Fill original frame with black (Should be removed by inpainting originally, but black filled here)
    # Simple logic to fill with white if background color is close to white, otherwise black
    fill_color = "white" if sum(bg_color) > 600 else "black"
    text_color = "black" if fill_color == "white" else "white"
    
    draw.rectangle([xmin, ymin, xmax, ymax], fill=fill_color)

    # Get optimal font size and layout data
    # Pass estimated font size
    estimated_size = item.get('font_size', -1)
    best_data, custom_font = fit_text(draw, text, width, height, font_path, is_vertical, estimated_font_size=estimated_size)
    
    # Get determined font size
    current_font_size = custom_font.size
    pixel_spacing = int(current_font_size * line_spacing_ratio * 0.2) # Set line spacing a little modestly

    if is_vertical:
        # Vertical writing (best_data is a list of columns)
        draw_vertical_text_rtl(draw, best_data, custom_font, xmin, ymin, width, height, text_color=text_color, line_spacing=pixel_spacing)
    else:
        # Horizontal writing (best_data is a string with line breaks)
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

# Save image
output_path = "/Users/mizuho/HenHacks2026/annotated_image.png"
img.save(output_path)
print(f"Saved annotated image to {output_path}")