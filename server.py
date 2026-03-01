import sys
import os
import glob
import threading
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
import textwrap
import webbrowser

# Add comic-text-detector folder to path to allow import
sys.path.append(str(Path(__file__).parent / "comic-text-detector"))
from text_extracter import MangaTextExtractor

app = Flask(__name__)
CORS(app)

# ----------------------------------------
# Helper Functions
# ----------------------------------------

def get_vertical_lines(draw, text, font, box_height):
    lines = []
    current_line = ""
    current_h = 0
    char_spacing = int(font.size * 0.2)

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
        start_font_size = min(int(estimated_font_size * 1.5), max_font_size)
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
            if avg_char_width <= 0:
                continue

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
            best_data = textwrap.fill(text, width=max(1, int(box_width * 0.9 / min_font_size)))

    return best_data, best_font


def draw_vertical_text_rtl(draw, lines, font, box_x, box_y, box_width, box_height, text_color="white", line_spacing=4):
    bbox_a = draw.textbbox((0, 0), "あ", font=font)
    char_width = bbox_a[2] - bbox_a[0]
    char_spacing = int(font.size * 0.1)

    total_width = len(lines) * char_width + max(0, len(lines) - 1) * line_spacing
    start_x = box_x + box_width / 2 + total_width / 2 - char_width

    for i, line in enumerate(lines):
        current_x = start_x - i * (char_width + line_spacing)
        line_height = sum([
            draw.textbbox((0, 0), c, font=font)[3] - draw.textbbox((0, 0), c, font=font)[1] + char_spacing
            for c in line
        ])
        line_height -= char_spacing
        current_y = box_y + box_height / 2 - line_height / 2

        for char in line:
            draw.text((current_x, current_y), char, font=font, fill=text_color)
            bbox = draw.textbbox((0, 0), char, font=font)
            current_y += (bbox[3] - bbox[1]) + char_spacing


def process_image(image_path, extractor, font_path, output_dir):
    print(f"\n{'='*40}")
    print(f"Processing: {image_path}")

    results = extractor.extract(image_path)

    img = Image.open(image_path).convert("RGB")
    draw = ImageDraw.Draw(img)

    alignment_map = {0: "left", 1: "center", 2: "right"}

    for item in results:
        print(f"  ID: {item['id']} | Text: {item['text'][:30]}...")

        xmin, ymin, xmax, ymax = item['position']
        text = item['text']
        width = xmax - xmin
        height = ymax - ymin

        is_vertical = item.get('vertical', height > width * 1.5)
        bg_color = item.get('bg_color', (0, 0, 0))
        line_spacing_ratio = item.get('line_spacing', 1.0)
        alignment = alignment_map.get(item.get('alignment', 1), "center")

        if not isinstance(bg_color, tuple):
            bg_color = tuple(map(int, bg_color)) if hasattr(bg_color, '__iter__') else (0, 0, 0)

        fill_color = "white" if sum(bg_color) > 600 else "black"
        text_color = "black" if fill_color == "white" else "white"

        draw.rectangle([xmin, ymin, xmax, ymax], fill=fill_color)

        estimated_size = item.get('font_size', -1)
        best_data, custom_font = fit_text(
            draw, text, width, height, font_path, is_vertical, estimated_font_size=estimated_size
        )

        current_font_size = custom_font.size
        pixel_spacing = int(current_font_size * line_spacing_ratio * 0.2)

        if is_vertical:
            draw_vertical_text_rtl(
                draw, best_data, custom_font, xmin, ymin, width, height,
                text_color=text_color, line_spacing=pixel_spacing
            )
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

    filename = Path(image_path).name
    output_path = output_dir / filename
    img.save(output_path)
    print(f"  Saved -> {output_path}")


def main(num_pages=0):
    downloads_dir = Path.home() / "Downloads"
    output_dir = Path(__file__).parent / "processed"
    output_dir.mkdir(exist_ok=True)

    font_path = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
    try:
        ImageFont.truetype(font_path, 20)
    except IOError:
        font_path = "/System/Library/Fonts/PingFang.ttc"

    pattern = str(downloads_dir / "manga_page_*.png")
    image_files = sorted(glob.glob(pattern))

    if not image_files:
        print(f"No files found in {downloads_dir}")
        return

    if num_pages > 0:
        image_files = image_files[:num_pages]

    print(f"Processing {len(image_files)} file(s)...")

    extractor = MangaTextExtractor()

    for image_path in image_files:
        try:
            process_image(image_path, extractor, font_path, output_dir)
        except Exception as e:
            print(f"  [ERROR] {image_path}: {e}")

    print(f"\nAll done! Saved in: {output_dir}")
    # webbrowser.open("http://localhost:5001/viewer")


# ----------------------------------------
# Flask Endpoints
# ----------------------------------------

@app.route('/', methods=['GET'])
def health():
    return "Manga Server is Running!"


@app.route('/run', methods=['POST'])
def run_processing():
    """
    JS からダウンロード完了後に呼ばれるエンドポイント。
    body (JSON): { "num_pages": 3 }  ← 省略時は全件処理
    """
    data = request.get_json(silent=True) or {}
    num_pages = int(data.get("num_pages", 0))

    # バックグラウンドで実行（レスポンスをすぐ返すため）
    thread = threading.Thread(target=main, args=(num_pages,))
    thread.start()

    return jsonify({
        "status": "started",
        "num_pages": num_pages if num_pages > 0 else "all"
    })

@app.route('/pages', methods=['GET'])
def get_pages():
    output_dir = Path(__file__).parent / "processed"
    files = sorted(output_dir.glob("manga_page_*.png"))
    filenames = [f.name for f in files]
    return jsonify({"pages": filenames})

@app.route('/pages/<filename>', methods=['GET'])
def get_page_image(filename):
    from flask import send_from_directory
    output_dir = Path(__file__).parent / "processed"
    return send_from_directory(str(output_dir), filename)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)