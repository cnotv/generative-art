#!/bin/bash

# Convert PNG images to WebP format
# Usage: ./webp-conversion.sh [directory]
# Default directory: src/assets/images


# Function to convert and resize PNGs to WebP, and resize existing WebPs
process_images() {
	local dir="${1:-./assets/images}"
	local max_width="${2:-1000}"

	echo "Processing PNGs in $dir..."
	for f in "$dir"/*.png; do
		[ -e "$f" ] || continue
		# Convert PNG to WebP, resize to max_width
		cwebp -q 80 -resize "$max_width" 0 "$f" -o "${f%.png}.webp" && rm "$f"
		echo "✓ Converted and resized: $f → ${f%.png}.webp (max width $max_width)"
	done

	echo "Processing existing WebPs in $dir..."
	for f in "$dir"/*.webp; do
		[ -e "$f" ] || continue
		# Resize WebP in-place to max_width
		cwebp -q 80 -resize "$max_width" 0 "$f" -o "$f.tmp" && mv "$f.tmp" "$f"
		echo "✓ Resized WebP: $f (max width $max_width)"
	done
}

# Usage: ./webp-conversion.sh [directory] [max_width]
process_images "$1" "$2"
