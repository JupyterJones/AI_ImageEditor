#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

APP_DIR="$ROOT_DIR/AppDir_Final"
OUTPUT_APPIMAGE="$ROOT_DIR/EsperanzaAI-ImageEditor-Final-x86_64.AppImage"
PYTHON_CACHE_DIR="$ROOT_DIR/.standalone_python_cache/python"

echo "=========================================================="
echo "   🌸 BUILDING ESPERANZAAI IMAGE EDITOR FINAL APPIMAGE    "
echo "   Self-Contained Embedded Python + CPU PyTorch Engine    "
echo "   Features: New Canvas, Dual Flip H, 5 Steps, 1.5 CFG   "
echo "=========================================================="

if [ ! -d "$PYTHON_CACHE_DIR" ]; then
    echo "ERROR: Standalone Python environment not found at $PYTHON_CACHE_DIR"
    exit 1
fi

echo "==> [1/5] Checking Tauri native release binary..."
RELEASE_BIN="$ROOT_DIR/tauri_app/src-tauri/target/release/esperanza-editor"
if [ ! -f "$RELEASE_BIN" ]; then
    if [ -f "$ROOT_DIR/tauri_app/src-tauri/target/release/app" ]; then
        RELEASE_BIN="$ROOT_DIR/tauri_app/src-tauri/target/release/app"
    else
        echo "Release binary not found. Building with cargo..."
        cd "$ROOT_DIR/tauri_app/src-tauri"
        cargo build --release
        cd "$ROOT_DIR"
        RELEASE_BIN="$ROOT_DIR/tauri_app/src-tauri/target/release/esperanza-editor"
    fi
fi
echo "    -> Found compiled release binary: $(ls -lh "$RELEASE_BIN" | awk '{print $5}')"

echo "==> [2/5] Creating AppDir structure & copying assets..."
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/usr/bin"
mkdir -p "$APP_DIR/bin"
mkdir -p "$APP_DIR/usr/python"

# Copy compiled Tauri binary
cp "$RELEASE_BIN" "$APP_DIR/usr/bin/esperanza-editor"
chmod +x "$APP_DIR/usr/bin/esperanza-editor"

# Bundle Python backend (v11) and web assets
cp "$ROOT_DIR/AI_ImageEditor_v11.py" "$APP_DIR/usr/bin/"
cp -r "$ROOT_DIR/templates" "$APP_DIR/usr/bin/"
cp -r "$ROOT_DIR/static" "$APP_DIR/usr/bin/"

# Copy embedded standalone Python runtime into AppDir
echo "    -> Copying self-contained Python runtime into AppDir..."
cp -a "$PYTHON_CACHE_DIR/"* "$APP_DIR/usr/python/"

# Copy Desktop Icon (Esperanza Portrait)
if [ -f "$ROOT_DIR/icon.png" ]; then
    cp "$ROOT_DIR/icon.png" "$APP_DIR/esperanza.png"
    cp "$ROOT_DIR/icon.png" "$APP_DIR/.DirIcon"
elif [ -f "$ROOT_DIR/tauri_app/src-tauri/icons/icon.png" ]; then
    cp "$ROOT_DIR/tauri_app/src-tauri/icons/icon.png" "$APP_DIR/esperanza.png"
    cp "$ROOT_DIR/tauri_app/src-tauri/icons/icon.png" "$APP_DIR/.DirIcon"
fi

echo "==> [3/5] Generating Desktop Entry and AppRun..."
cat << 'EOF' > "$APP_DIR/esperanza-ai-image-editor.desktop"
[Desktop Entry]
Type=Application
Name=EsperanzaAI Image Editor Final
GenericName=AI Dual-Layer Darkroom & Stable Diffusion Compositor
Comment=100% Standalone native desktop AI image editor with embedded PyTorch engine, dual-layer darkroom, multiline caption studio, feathered brush, horizontal flip, and instant new canvas
Exec=AppRun %F
Icon=esperanza
Categories=Graphics;2DGraphics;Photography;
Terminal=false
StartupNotify=true
EOF

cat << 'EOF' > "$APP_DIR/AppRun"
#!/usr/bin/env bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}

# Determine host workspace directory (where user launched or placed the AppImage)
if [ -n "$PORTABLE_EXECUTABLE_DIR" ]; then
    HOST_DIR="$PORTABLE_EXECUTABLE_DIR"
else
    HOST_DIR="$PWD"
fi
export HOST_DIR
cd "$HOST_DIR"

LOG_FILE="/tmp/esperanza_ai_image_editor.log"
echo "==========================================================" | tee -a "$LOG_FILE"
echo "  🌸 ESPERANZAAI FINAL STANDALONE IMAGE EDITOR LAUNCHER" | tee -a "$LOG_FILE"
echo "  Date:     $(date)" | tee -a "$LOG_FILE"
echo "  HOST_DIR: $HOST_DIR" | tee -a "$LOG_FILE"
echo "  PWD:      $PWD" | tee -a "$LOG_FILE"
echo "  Logging:  $LOG_FILE" | tee -a "$LOG_FILE"
echo "==========================================================" | tee -a "$LOG_FILE"

# Ensure host novel_images and models directories exist
mkdir -p "$HOST_DIR/novel_images"
mkdir -p "$HOST_DIR/models/checkpoints"

# Configure embedded portable Python environment
INTERNAL_PYTHON="${HERE}/usr/python/bin/python3"
export PYTHONHOME="${HERE}/usr/python"
export PATH="${HERE}/usr/python/bin:${HERE}/bin:${PATH}:/usr/local/bin:/usr/bin:/bin"

SERVER_URL="http://127.0.0.1:5000"
BACKEND_PID=""

cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        echo "Closing Python backend (PID $BACKEND_PID)..." | tee -a "$LOG_FILE"
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
        sleep 0.3
        kill -KILL "$BACKEND_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM HUP

# Start backend if not already running
if ! curl -s -m 1 "$SERVER_URL/api/status" > /dev/null 2>&1; then
    echo "Starting embedded standalone Python backend..." | tee -a "$LOG_FILE"
    echo "Using internal Python: $INTERNAL_PYTHON" | tee -a "$LOG_FILE"

    "$INTERNAL_PYTHON" -u "${HERE}/usr/bin/AI_ImageEditor_v11.py" >> "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
    echo "Backend launched with PID $BACKEND_PID" | tee -a "$LOG_FILE"

    BACKEND_OK=0
    for i in {1..60}; do
        if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
            echo "ERROR: Backend process (PID $BACKEND_PID) exited unexpectedly!" | tee -a "$LOG_FILE"
            break
        fi

        if curl -s -m 1 "$SERVER_URL/api/status" > /dev/null 2>&1; then
            echo "Backend ready on port 5000!" | tee -a "$LOG_FILE"
            BACKEND_OK=1
            break
        fi
        sleep 0.5
    done

    if [ "$BACKEND_OK" -ne 1 ]; then
        echo "ERROR: Backend failed to initialize on $SERVER_URL." | tee -a "$LOG_FILE"
        if command -v zenity >/dev/null 2>&1; then
            zenity --error --title="EsperanzaAI Image Editor Error" \
                --text="Backend failed to start on $SERVER_URL.\n\nPlease check log file: $LOG_FILE" &
        fi
        exit 1
    fi
else
    echo "Existing backend detected on port 5000. Reusing active instance." | tee -a "$LOG_FILE"
fi

# Dual-Display Guarantee:
# 1) Try native Tauri Webview window
# 2) Gracefully fallback to dedicated app-mode browser window if WebKitGTK / GLIBC is missing
LAUNCH_SUCCESS=0
if [ -x "${HERE}/usr/bin/esperanza-editor" ]; then
    echo "Launching native desktop window..." | tee -a "$LOG_FILE"
    "${HERE}/usr/bin/esperanza-editor" "$@" 2>&1 | tee -a "$LOG_FILE"
    TAURI_EXIT=$?
    if [ $TAURI_EXIT -eq 0 ] || [ $TAURI_EXIT -gt 128 ]; then
        LAUNCH_SUCCESS=1
    fi
fi

if [ "$LAUNCH_SUCCESS" -ne 1 ]; then
    echo "Native window not supported on this host (code $TAURI_EXIT). Falling back to dedicated app-mode window..." | tee -a "$LOG_FILE"
    if command -v google-chrome >/dev/null 2>&1; then
        google-chrome --app="$SERVER_URL" "$@" &
        [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
    elif command -v chromium >/dev/null 2>&1; then
        chromium --app="$SERVER_URL" "$@" &
        [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
    elif command -v brave-browser >/dev/null 2>&1; then
        brave-browser --app="$SERVER_URL" "$@" &
        [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
    elif command -v microsoft-edge >/dev/null 2>&1; then
        microsoft-edge --app="$SERVER_URL" "$@" &
        [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
    elif command -v firefox >/dev/null 2>&1; then
        firefox "$SERVER_URL" &
        [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$SERVER_URL" &
        [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
    fi
fi

# Clean exit
if [ -n "$BACKEND_PID" ]; then
    echo "Closing Python backend (PID $BACKEND_PID)..." | tee -a "$LOG_FILE"
    kill -TERM "$BACKEND_PID" 2>/dev/null || true
    sleep 0.5
    kill -KILL "$BACKEND_PID" 2>/dev/null || true
fi

exit 0
EOF

chmod +x "$APP_DIR/AppRun"

echo "==> [4/5] Locating appimagetool..."
APPIMAGETOOL=""
if command -v appimagetool >/dev/null 2>&1; then
    APPIMAGETOOL="$(command -v appimagetool)"
elif [ -x "/home/jack/Desktop/SCRIPTS/bin/appimagetool" ]; then
    APPIMAGETOOL="/home/jack/Desktop/SCRIPTS/bin/appimagetool"
elif [ -x "$HOME/.local/bin/appimagetool" ]; then
    APPIMAGETOOL="$HOME/.local/bin/appimagetool"
elif [ -x "/usr/local/bin/appimagetool" ]; then
    APPIMAGETOOL="/usr/local/bin/appimagetool"
else
    echo "ERROR: appimagetool not found!"
    exit 1
fi
echo "    -> Using appimagetool at $APPIMAGETOOL"

echo "==> [5/5] Packaging Final Standalone AppImage..."
ARCH=x86_64 "$APPIMAGETOOL" "$APP_DIR" "$OUTPUT_APPIMAGE"

chmod +x "$OUTPUT_APPIMAGE"
rm -rf "$APP_DIR"

# Also sync Standalone-v5 and Standalone-v4 copies for backward compatibility
cp "$OUTPUT_APPIMAGE" "$ROOT_DIR/EsperanzaAI-ImageEditor-Standalone-v5-x86_64.AppImage"
cp "$OUTPUT_APPIMAGE" "$ROOT_DIR/EsperanzaAI-ImageEditor-Standalone-v4-x86_64.AppImage"

echo "=========================================================="
echo "   ✅ ESPERANZAAI FINAL APPIMAGE READY!"
echo "   Location: $OUTPUT_APPIMAGE"
echo "   Size:     $(ls -lh "$OUTPUT_APPIMAGE" | awk '{print $5}')"
echo "   Log File: /tmp/esperanza_ai_image_editor.log"
echo "=========================================================="
