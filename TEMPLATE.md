# 📋 Master Project Specification & System Reference Template

> **Instructions**: Use this template whenever you want to start a new script, video pipeline, or web app. Fill in the bracketed `[ ... ]` blanks in Part 1. Part 2 contains all verified system paths, hardware limits, model lists, and avatar tools for instant AI reference.

---

# PART 1: FILL-IN-THE-BLANK PROJECT SPECIFICATION

## 1. Project Concept & Goal
* **Project Name**: `[AI_ImageEditor Edit images using Stable Diffusion and outpainting]`
* **Primary Objective**: `[Image editor: Generate with txt2imge, img2img upload existing images to endpaint]`
* **Features of Editor create an images from the desired features on the two images. 
* **Continue process until desired results are obtained
* **Create two layers choose top image with an arrow
* **Overlay two images be able to erase parts of the top image with a feathered brush, before saving the results.  
* **Delivery Format**: `[Standalone Python Flask Web App or AppImage]`
* **Target Aspect Ratio & Resolution**: `[512x768 (Portrait 9:16) / 768x512 (Landscape 16:9) / 512x512 (Square) with option of a possible upscaled result]`

---

## 2. Diffusion, Model & Embedding Settings
* **Checkpoint Model Path**: `[/media/jack/9930-14E1/models/checkpoint/*.safetensors 
LCM and standard models]`
* **Custom VAE**: `PATH:/media/jack/9930-14E1/models/vae [vae-ft-mse-840000-ema-pruned.safetensors / None]`
* **LoRA Adapter**: `PATH: /media/jack/9930-14E1/models/loras/ [more_details.safetensors (Weight: 0.70) / None / other]`
* **POSSIBLE SLERP Step Size ($\Delta t$)**: `[0.04 (26 frames) / 0.02 (51 frames) / 0.01 (101 frames)]`
* **LCM Sampling Steps**: `[5 steps (Standard LCM) / 4 to 8 steps]`
* **CFG Scale (Guidance)**: `[1.5 (Standard LCM) / 1.0 to 2.0]`
* **Fixed Seed**: `Probably need fixed for outpainting [2525 / Random]`
* **Prompt Chunking**: `[Yes - Enable 75-token sub-block chunking for verbose prompts]`

---

## 3. Prompts & Narration Script
* **Prompt A (Start State)**:
  ```text
  [Enter initial scene description, subject anchors, lighting, and style keywords]
  ```
* **Prompt B (Destination State)**:
  ```text
  [Enter final transformed scene description, preserving identical subject anchors]
  ```
* **Voice Narration (Verbose Script)**:
  ```text
  [Enter the complete narrative script to be spoken by Kokoro-TTS]
  ```
* **Voice ID & Pacing**:
  * **Voice Name**: `[af_sarah (Female) / am_adam (Male) / af_nicole / am_michael / af_bella / am_fenrir]`
  * **Speed Factor**: `[1.0 (Normal) / 0.95 (Cinematic slow)]`

---

## 4. Possible: End-to-End Execution Pipeline
*Specify the execution flow:*
1. **Step 1 - Prompt Encoding**: `[Encode Prompt A and B into chunked (1, 77, 768) embeddings]`
2. **Step 2 - SLERP Interpolation**: `[Render N frames along the trajectory using token-wise SLERP]`
3. **Step 3 - High-Res Upscale**: `[Upscale frames 2x using RealESRGAN_x4 / PIL Lanczos]`
4. **Step 4 - Audio Synthesis**: `[Generate speech narration WAV using Kokoro-TTS]`
5. **Step 5 - Video Stitching**: `[Compile MP4 with FFmpeg, syncing frame durations to narration audio]`
6. **Step 6 - Memory Release**: `[Purge pipeline memory and invoke gc.collect()]`

---

## 5. UI / Frontend Preferences (If Web / GUI based)
* **Interface Layout**: `[Sleek Dark Mode, Glassmorphic cards, Modern typography / Headless]`
* **Controls & Features**:
  * `[Live image preview card for Prompt A & B]`
  * `[Interactive JSON preset manager (Load / Save / Edit)]`
  * `[Real-time frame generation progress bar]`
  * `[Integrated audio player and video viewer]`

---
# PART 2: SYSTEM HARDWARE & WORKSPACE REFERENCE GUIDE

## 💻 Hardware & System Constraints
* **Operating System**: Linux x86_64
* **CPU**: 8 Cores (CPU-Only inference)
* **RAM**: 13.59 GB Total (~11.9 GB available)
* **Swap**: 12.00 GB Total (~7.2 GB free)
* **Throttling Guard**: `os.nice(15)` + `torch.set_num_threads(2)` (Keeps Linux desktop UI 100% smooth)
* **Instant Exit**: `SIGINT` / `SIGTERM` handler calling `os._exit(0)`

---

## 📁 Model & Asset Directories

### 1. Stable Diffusion Checkpoints (`/home/jack/Desktop/Comfy-UI/models/checkpoints/`)
* `comiccraftLCM_beta4.safetensors` *(Graphic novel & comic illustration)*
* `dreamshaper_8LCM.safetensors` *(General purpose art & realism)*
* `cyberrealisticLCM_cyberrealistic42.safetensors` *(High-fidelity photorealism)*
* `epicphotogasmLCM_ultimatefidelity.safetensors` *(Photographic portraits)*
* `photonLCM_v10.safetensors` *(Realistic cinematic sci-fi)*
* `delusionsLCM_v20.safetensors` *(Surreal & fantasy art)*
* `frtMixmodelLCM_realisticV10.safetensors`
* `possibleLoveliesLCM_v10.safetensors`
* `silversRealmixLCM_v10.safetensors`
* `xenoxtcLCMEditionArtToon_v10.safetensors`

### 2. VAE Models (`/home/jack/Desktop/Comfy-UI/models/vae/`)
* `vae-ft-mse-840000-ema-pruned.safetensors` *(Standard clean SD 1.5 VAE)*
* `vae-ft-mse-840000-ema-pruned.ckpt`

### 3. LoRA Adapters (`/home/jack/Desktop/Comfy-UI/models/loras/`)
* `more_details.safetensors` *(Weight: 0.6–0.8, linked locally in `/home/jack/Desktop/overnight/`)*
* `Detail_Slider_V2_By_Stable .safetensors`
* `PAseer-SD15-LCM Quick.safetensors`
* `SW_PoeticV5preview3_sd.safetensors`
* `Ghibli_v6.safetensors`
* `Low_Poly_Art.safetensors`
* `DarkPunk_Style.safetensors`
* `Terror Tales.safetensors`
* `easynegative.safetensors`

### 4. Neural Upscalers (`/home/jack/Desktop/Comfy-UI/models/upscale_models/`)
* `RealESRGAN_x4.pth` *(Loaded via Spandrel on CPU with Lanczos fallback)*

---

## 🎙️ Kokoro-TTS Configuration (`/home/jack/Desktop/Kokoro-TTS-Pause/`)
* **Binary Executable**: `/home/jack/Desktop/Kokoro-TTS-Pause/venv/bin/kokoro-tts`
* **ONNX Model**: `/home/jack/Desktop/Kokoro-TTS-Pause/kokoro-v1.0.onnx`
* **Voices File**: `/home/jack/Desktop/Kokoro-TTS-Pause/voices-v1.0.bin`
* **Available Voices**:
  * **Female**: `af_sarah`, `af_nicole`, `af_sky`, `af_bella`, `bf_emma`
  * **Male**: `am_adam`, `am_michael`, `am_fenrir`, `bm_george`

---

## 🎭 Avatar, Talking Head & Video Studios
* **Avatar Maker**: `/home/jack/Desktop/avatar_maker/` (`mariana_avatar_gen.py`, `Stable-Face-Maker.py`, `avatar.py`)
* **LivePortrait**: `/home/jack/Desktop/LivePortrait/` (`app.py`, `app_animals.py`, `speed.py` - high-res reenactment)
* **Wav2Lip**: `/home/jack/Desktop/Wav2Lip-master/` (`audio.py`, `blink.py`, `hq_wav2lip_train.py` - lip sync)
* **ONE_STEP SLERP Studio**: `/home/jack/Desktop/ONE_STEP-Diffusion-SLERP/`
* **Comic Video Maker**: `/home/jack/Desktop/Comic_Book_Video_Maker/`

---

## 📐 Mathematical SLERP Formula Reference
```python
# Token-wise numerically stable SLERP (Preserves token magnitude & avoids zero-collapse)
@torch.no_grad()
def slerp(t: float, v0: torch.Tensor, v1: torch.Tensor, dot_threshold: float = 0.9995) -> torch.Tensor:
    t_val = float(max(0.0, min(1.0, t)))
    if t_val == 0.0: return v0.clone()
    if t_val == 1.0: return v1.clone()

    norm_v0, norm_v1 = torch.norm(v0, dim=-1, keepdim=True), torch.norm(v1, dim=-1, keepdim=True)
    target_norm = (1.0 - t_val) * norm_v0 + t_val * norm_v1

    v0_u, v1_u = v0 / (norm_v0 + 1e-8), v1 / (norm_v1 + 1e-8)
    dot = torch.clamp(torch.sum(v0_u * v1_u, dim=-1, keepdim=True), -1.0, 1.0)
    close_mask = (dot > dot_threshold)

    theta_0 = torch.acos(dot)
    safe_sin = torch.where(close_mask, torch.ones_like(theta_0), torch.sin(theta_0))
    s0 = torch.sin(theta_0 * (1.0 - t_val)) / safe_sin
    s1 = torch.sin(theta_0 * t_val) / safe_sin

    res_unit = torch.where(close_mask, (1.0 - t_val) * v0_u + t_val * v1_u, s0 * v0_u + s1 * v1_u)
    return (res_unit / (torch.norm(res_unit, dim=-1, keepdim=True) + 1e-8)) * target_norm
```

---

## 📦 Standalone Portable AppImage & Embedded Python Reference (`.standalone_python_cache`)

> **Why this exists**: Typical AppImages that call `python3` fail on other computers because vanilla Linux distros do not have PyTorch or Diffusers installed. By bundling an embedded, portable Python runtime into `AppDir/usr/python`, the AppImage becomes **100% self-contained and generic**—anyone on Ubuntu, Debian, Mint, Fedora, or Arch can download and double-click the AppImage with **zero setup**.

### 1. The Portable Python Cache (`.standalone_python_cache`)
* **Location**: Store in project root as `./.standalone_python_cache/` (keep it permanently for instant rebuilds in under 30 seconds).
* **Base Runtime**: Astral `python-build-standalone` (`cpython-3.11...-x86_64-unknown-linux-gnu-install_only.tar.gz`).
* **Compatibility**: Built on `glibc 2.17` (CentOS 7 base)—runs natively on any 64-bit Linux distribution released since 2014.
* **CPU-Optimized Size**: Using PyTorch CPU wheels keeps the entire bundled AppImage under **~400 MB** (instead of 3–5 GB CUDA bloat).

### 2. One-Time Setup Recipe (To Initialize `.standalone_python_cache`)
Run once in the project directory:
```bash
mkdir -p .standalone_python_cache && cd .standalone_python_cache

# 1. Download standalone portable Python
PYTHON_TAR="cpython-3.11.18+20261110-x86_64-unknown-linux-gnu-install_only.tar.gz"
URL="https://github.com/astral-sh/python-build-standalone/releases/download/20261110/${PYTHON_TAR}"
curl -LO "$URL"
tar -xzf "$PYTHON_TAR"

# 2. Install CPU PyTorch, Diffusers, and Web dependencies (no cache to save disk)
./python/bin/pip3 install --no-cache-dir \
    torch torchvision diffusers transformers accelerate safetensors flask pillow \
    --extra-index-url https://download.pytorch.org/whl/cpu

# 3. Verify clean execution
./python/bin/python3 -c "import torch, diffusers, transformers, flask, PIL; print('Portable AI Runtime Ready!')"
cd ..
```

### 3. How to Assemble into `build_standalone_appimage.sh`
When packaging with `appimagetool`:
```bash
APP_DIR="$ROOT_DIR/AppDir"
mkdir -p "$APP_DIR/usr/bin" "$APP_DIR/usr/python"

# 1. Copy desktop release binary (Tauri / Rust / Electron)
cp "$RELEASE_BIN" "$APP_DIR/usr/bin/app-window"

# 2. Copy Python backend and web assets
cp "$ROOT_DIR/backend.py" "$APP_DIR/usr/bin/"
cp -r "$ROOT_DIR/templates" "$ROOT_DIR/static" "$APP_DIR/usr/bin/"

# 3. Copy the cached portable Python runtime into the bundle
cp -a "$ROOT_DIR/.standalone_python_cache/python/"* "$APP_DIR/usr/python/"
```

### 4. Golden `AppRun` Launcher Recipe (Dual-Display & Port 5000 Failsafe)
Inside `AppDir/AppRun`:
```bash
#!/usr/bin/env bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}

# Set workspace to where the user launched or placed the AppImage
HOST_DIR="${PORTABLE_EXECUTABLE_DIR:-$PWD}"
export HOST_DIR && cd "$HOST_DIR"
mkdir -p "$HOST_DIR/novel_images" "$HOST_DIR/models/checkpoints"

LOG_FILE="/tmp/app_launcher.log"

# Internal Python environment configuration
INTERNAL_PYTHON="${HERE}/usr/python/bin/python3"
export PYTHONHOME="${HERE}/usr/python"
export PATH="${HERE}/usr/python/bin:${HERE}/bin:${PATH}:/usr/local/bin:/usr/bin:/bin"

SERVER_URL="http://127.0.0.1:5000"
BACKEND_PID=""

cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        kill -TERM "$BACKEND_PID" 2>/dev/null || true
        sleep 0.3
        kill -KILL "$BACKEND_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM HUP

# 1. Launch internal backend if port 5000 is not already running
if ! curl -s -m 1 "$SERVER_URL/api/status" > /dev/null 2>&1; then
    "$INTERNAL_PYTHON" -u "${HERE}/usr/bin/backend.py" >> "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
    for i in {1..60}; do
        kill -0 "$BACKEND_PID" 2>/dev/null || { echo "Backend crashed" && exit 1; }
        curl -s -m 1 "$SERVER_URL/api/status" > /dev/null 2>&1 && break
        sleep 0.5
    done
fi

# 2. Dual-Display Guarantee:
# Try native Tauri Webview; if host lacks WebKitGTK / glibc, fallback to browser app-mode
LAUNCH_SUCCESS=0
if [ -x "${HERE}/usr/bin/app-window" ]; then
    "${HERE}/usr/bin/app-window" "$@" 2>&1 | tee -a "$LOG_FILE"
    TAURI_EXIT=$?
    if [ $TAURI_EXIT -eq 0 ] || [ $TAURI_EXIT -gt 128 ]; then
        LAUNCH_SUCCESS=1
    fi
fi

if [ "$LAUNCH_SUCCESS" -ne 1 ]; then
    # Fallback: Chromeless app-window
    for browser in google-chrome chromium brave-browser microsoft-edge; do
        if command -v "$browser" >/dev/null 2>&1; then
            "$browser" --app="$SERVER_URL" "$@" &
            [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
            exit 0
        fi
    done
    xdg-open "$SERVER_URL" &
    [ -n "$BACKEND_PID" ] && wait "$BACKEND_PID" 2>/dev/null || wait
fi
```

### 5. Checkpoint Path Best Practices for Public Releases
In the Python backend, **never hardcode `/home/username/` paths**. Always use generic discovery:
```python
user_home = Path.home()
CHECKPOINT_DIRS = [
    WORKSPACE_DIR / "models" / "checkpoints",
    WORKSPACE_DIR / "models",
    SCRIPT_DIR / "models" / "checkpoints",
    user_home / "models" / "checkpoints",
    user_home / "Desktop" / "ComfyUI" / "models" / "checkpoints",
    user_home / "stable-diffusion-webui" / "models" / "Stable-diffusion",
]
if os.environ.get("MODELS_DIR"):
    p = Path(os.environ["MODELS_DIR"]).resolve()
    CHECKPOINT_DIRS.insert(0, p / "checkpoints")
```

