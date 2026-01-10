#!/bin/bash

# Convert PNG images to WebP format
# Usage: ./webp-conversion.sh [directory]
# Default directory: src/assets/images

DIR="${1:-src/assets/images}"

if [ ! -d "$DIR" ]; then
  echo "Error: Directory '$DIR' does not exist"
  exit 1
fi

cd "$DIR" || exit 1

PNG_COUNT=$(find . -maxdepth 1 -name "*.png" | wc -l)

if [ "$PNG_COUNT" -eq 0 ]; then
  echo "No PNG files found in $DIR"
  exit 0
fi

echo "Converting $PNG_COUNT PNG file(s) in $DIR to WebP..."

for f in *.png; do
  if [ -f "$f" ]; then
    cwebp -q 80 "$f" -o "${f%.png}.webp" && rm "$f"
    echo "✓ Converted: $f → ${f%.png}.webp"
  fi
done

echo "Conversion complete!"
