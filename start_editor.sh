#!/usr/bin/env bash
# AI Image Editor - Start Script (Final Release)
cd "$(dirname "$0")"

echo "=========================================================="
echo "  🌸 Launching AI Image Editor Final (Esperanza Darkroom)  "
echo "  Direct Layer Img2Img | Instant New Canvas | Flip H      "
echo "  Caption & Transparent Multi-line Overlay Studio         "
echo "  Models via ./models symlink (AppImage Ready)            "
echo "  Direct integration with ./novel_images                  "
echo "  4 CPU Threads | os.nice(15) Throttling Active           "
echo "=========================================================="

python3 AI_ImageEditor_v11.py
