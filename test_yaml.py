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

# 元画像を開く
img = Image.open(image_path).convert("RGB")
draw = ImageDraw.Draw(img)

def get_vertical_lines(draw, text, font, box_height):
    """縦書き用にテキストを指定された高さで分割してリスト化する"""
    lines = []
    current_line = ""
    current_h = 0
    char_spacing = int(font.size * 0.2) # 縦書きの文字間：少し空ける (10%)
    
    for char in text:
        bbox = draw.textbbox((0, 0), char, font=font)
        char_h = bbox[3] - bbox[1]
        
        # 枠の高さを超える場合は次の列へ
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
    """指定された枠に収まるようにテキストのフォントサイズと折り返しを調整する"""
    min_font_size = 10
    max_font_size = 100
    
    # 推定フォントサイズがあれば、そこから探索を開始する (精度向上と高速化)
    if estimated_font_size and estimated_font_size > min_font_size:
        start_font_size = int(estimated_font_size * 1.5) # 推定値より少し大きめからスタート
        start_font_size = min(start_font_size, max_font_size)
    else:
        start_font_size = max_font_size

    best_font = None
    best_data = None # 横書きは文字列、縦書きは列のリストを入れる

    for font_size in range(start_font_size, min_font_size - 1, -2):
        try:
            font = ImageFont.truetype(font_path, font_size)
        except IOError:
            font = ImageFont.load_default()
            best_font = font
            break

        if is_vertical:
            # 縦書き：高さを基準にテキストを列に分割
            lines = get_vertical_lines(draw, text, font, box_height)
            
            # フォントの平均的な幅を取得
            bbox_a = draw.textbbox((0, 0), "あ", font=font)
            char_width = bbox_a[2] - bbox_a[0]
            line_spacing = int(font_size * 0.2) # 行間はフォントサイズの20%程度
            
            # 全体の幅を計算 (列数 * (文字幅 + 行間))
            total_width = len(lines) * char_width + max(0, len(lines) - 1) * line_spacing
            
            # 全体の幅が枠に収まるかチェック
            if total_width <= box_width:
                best_font = font
                best_data = lines
                break
        else:
            # 横書き：幅に合わせて折り返しを計算
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
    
    # 最小サイズでも収まらなかった場合のフォールバック
    if best_font is None:
        try:
            best_font = ImageFont.truetype(font_path, min_font_size)
        except:
            best_font = ImageFont.load_default()
        
        # 簡易的なフォールバック（ここは改善の余地あり）
        if is_vertical:
            best_data = get_vertical_lines(draw, text, best_font, box_height)
        else:
            best_data = textwrap.fill(text, width=max(1, int(box_width*0.9/min_font_size)))
        
        return best_data, best_font
            
    return best_data, best_font

def draw_vertical_text_rtl(draw, lines, font, box_x, box_y, box_width, box_height, text_color="white", line_spacing=4):
    """複数行の縦書きテキストを右から左へ描画する（中央揃え対応）"""
    bbox_a = draw.textbbox((0, 0), "あ", font=font)
    char_width = bbox_a[2] - bbox_a[0]
    char_spacing = int(font.size * 0.1) # 描画時の文字間隔
    
    # テキストブロック全体の幅を計算
    total_width = len(lines) * char_width + max(0, len(lines) - 1) * line_spacing
    
    # 最初の列のX座標（枠の中央に配置しつつ、一番右の列の開始位置を計算）
    start_x = box_x + box_width / 2 + total_width / 2 - char_width
    
    for i, line in enumerate(lines):
        # 列が進むごとに左へずらす
        current_x = start_x - i * (char_width + line_spacing)
        
        # この列の全体の高さを計算して、縦方向の中央揃え開始位置を決める
        line_height = sum([draw.textbbox((0, 0), c, font=font)[3] - draw.textbbox((0, 0), c, font=font)[1] + char_spacing for c in line])
        line_height -= char_spacing # 最後の文字の後ろのスペースはカウントしない
        current_y = box_y + box_height / 2 - line_height / 2
        
        # 1文字ずつ縦に描画
        for char in line:
            draw.text((current_x, current_y), char, font=font, fill=text_color)
            bbox = draw.textbbox((0, 0), char, font=font)
            current_y += (bbox[3] - bbox[1]) + char_spacing

# ----------------------------------------
# メイン処理
# ----------------------------------------
font_path = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
# もし上記のフォントがない場合はデフォルトを使用
try:
    ImageFont.truetype(font_path, 20)
except IOError:
    font_path = "/System/Library/Fonts/PingFang.ttc" # Macの別の日本語フォント候補

# もしPingFangもなければデフォルトにフォールバック（try-except内で処理）

for item in results:
    print(f"ID: {item['id']}")
    print(f"Position: {item['position']}")
    print(f"Text: {item['text']}")
    print("-" * 20)

    xmin, ymin, xmax, ymax = item['position']
    text = item['text']
    
    width = xmax - xmin
    height = ymax - ymin
    
    # TextBlockから取得した詳細情報を使用
    # YAMLから読み込むため、キーが存在するか確認しつつ取得
    is_vertical = item.get('vertical', height > width * 1.5)
    bg_color = item.get('bg_color', (0, 0, 0)) # 背景色は黒で塗りつぶす (マスク処理の代わり)
    fg_color = item.get('fg_color', (255, 255, 255)) # 文字色は白
    
    # 行間 (line_spacingは1.0が基準倍率なので、ピクセル換算が必要だが、ここでは簡易的に係数として使う)
    # TextBlockのline_spacingは行間隔/文字サイズの比率に近い
    line_spacing_ratio = item.get('line_spacing', 1.0)
    if line_spacing_ratio is None: line_spacing_ratio = 1.0
    
    # 文字寄せ (0:左, 1:中, 2:右) -> PILは "left", "center", "right"
    # YAMLでは数値で保存されている想定
    align_val = item.get('alignment', 1)
    alignment_map = {0: "left", 1: "center", 2: "right"}
    alignment = alignment_map.get(align_val, "center")

    # タプルがnumpy配列やリストの場合があるので変換
    if not isinstance(bg_color, tuple):
        bg_color = tuple(map(int, bg_color)) if hasattr(bg_color, '__iter__') else (0,0,0)

    # 元の枠を黒で塗りつぶす (本来はインペイントで消すべきだが、ここでは黒塗り)
    # 背景色が白に近い場合は白で、それ以外は黒で塗りつぶす簡易ロジック
    fill_color = "white" if sum(bg_color) > 600 else "black"
    text_color = "black" if fill_color == "white" else "white"
    
    draw.rectangle([xmin, ymin, xmax, ymax], fill=fill_color)

    # 最適なフォントサイズと配置データを取得
    # 推定フォントサイズを渡す
    estimated_size = item.get('font_size', -1)
    best_data, custom_font = fit_text(draw, text, width, height, font_path, is_vertical, estimated_font_size=estimated_size)
    
    # 決定したフォントサイズを取得
    current_font_size = custom_font.size
    pixel_spacing = int(current_font_size * line_spacing_ratio * 0.2) # 少し控えめに行間を設定

    if is_vertical:
        # 縦書きの場合（best_dataは列のリスト）
        draw_vertical_text_rtl(draw, best_data, custom_font, xmin, ymin, width, height, text_color=text_color, line_spacing=pixel_spacing)
    else:
        # 横書きの場合（best_dataは改行済みの文字列）
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

# 画像を保存
output_path = "/Users/mizuho/HenHacks2026/annotated_image.png"
img.save(output_path)
print(f"Saved annotated image to {output_path}")