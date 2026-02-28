from text_extracter import MangaTextExtractor

extractor = MangaTextExtractor()
results = extractor.extract("image.png")

for item in results:
    print(f"ID: {item['id']}")
    print(f"Position: {item['position']}")
    print(f"Text: {item['text']}")
    print("-" * 20)