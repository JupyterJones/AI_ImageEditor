# 🌸 EsperanzaAI Image Editor (Final Standalone Release)

[![Platform](https://img.shields.io/badge/Platform-Linux%20x86__64-orange.svg)](#)
[![Python](https://img.shields.io/badge/Python-3.11.18%20(glibc%202.17)-blue.svg)](#)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.15.0%2Bcpu-red.svg)](#)
[![Diffusers](https://img.shields.io/badge/Diffusers-0.43.0-yellow.svg)](#)
[![Architecture](https://img.shields.io/badge/AppImage-100%25%20Standalone%20(401%20MB)-green.svg)](#)

A 100% self-contained, high-performance **Dual-Layer Digital Darkroom and Stable Diffusion Compositor** engineered for Linux desktop workstations.

Runs out-of-the-box on **any Linux distribution** (Ubuntu, Debian, Fedora, Mint, Arch, CentOS/RHEL 7+) without requiring pre-installed Python, PyTorch, CUDA, virtual environments, or system build tools.

Designed specifically for seamless integration with **`Tauri-VideoMaker-DEV-x86_64.AppImage`**, generating sequential story frames directly into `./novel_images/` with synchronized metadata sidecars.

---

## 🌟 Key Features

### 1. 100% Standalone & Universal Compatibility
- **Embedded Python 3.11 Runtime**: Built against `glibc 2.17` (CentOS 7 base) for universal portability across any modern or legacy Linux system.
- **Embedded CPU PyTorch 2.15 & Diffusers 0.43**: Fully bundled wheels with zero host dependencies.
- **Dual-Display Guarantee**: AppRun automatically launches the compiled native desktop window (`esperanza-editor`). If the host system lacks WebKitGTK, it seamlessly falls back to dedicated chromeless app-mode browser windows (`google-chrome --app`, `chromium`, `brave`, `edge`, `firefox`, or `xdg-open`).

### 2. Dual-Layer Darkroom Compositor
- **Layer 1 (Bottom / Base)** & **Layer 2 (Top / Foreground)** with instant layer swapping (`⇅ Swap Layers`).
- **Soft Feathered Radial Eraser**: Soft gradient brush with adjustable radius, feather softness (0–100%), and opacity.
- **Dual Brush Modes**: **Erase** (cuts transparent alpha windows) and **Restore** (paints back erased pixels).
- **Undo / Redo Stack**: Multi-level history for non-destructive mask editing.

### 3. Instant "New Canvas / Clear All" & Layer Clear
- **One-Click New Canvas**: Dedicated `✨ New Canvas` buttons located in the Header Toolbar, Canvas HUD, and Bottom Action Bar to immediately reset the canvas to a clean slate without restarting the application.
- **Individual Layer Clear**: `🗑️ Clear` buttons located directly on each layer card header to reset individual layers independently.

### 4. Horizontal Image Flipping (Left-to-Right Mirror)
- **Layer 1 & Layer 2 Horizontal Flip**: Mirror either layer horizontally with `⇄ Flip Horizontal` buttons in the layer cards and prompt bars.
- **Synchronized Mask Mirroring**: Inpainting and alpha masks mirror in lockstep with the image to keep erasures and composites pixel-perfect.
- **Client-Side Instant Render**: Zero latency transformations running locally on canvas, backed by `/api/flip_image`.

### 5. Optimized LCM Generation Defaults
- **LCM Steps**: Defaulted strictly to **`5` steps** (slider range 4–14) for fast, responsive CPU generation.
- **CFG Scale**: Defaulted strictly to **`1.5` guidance** (slider range 1.0–4.0) tuned specifically for Latent Consistency Models.
- **Diffusers 0.43 Safe VAE Slicing**: Hardened against deprecations with safe `pipe.vae.enable_slicing()` fallbacks.

### 6. Individual Layer Img2Img & Txt2Img
- Dedicated Prompt cards for Layer 1 and Layer 2:
  - `✨ Txt2Img` generates fresh layer content from text prompts.
  - `🎨 Img2Img` transforms the selected layer using an initial image while keeping the other layer untouched.
- Independent Denoise strength sliders per layer (`0.10` to `0.95`).

### 7. Seam Harmonization & Masked Inpainting
- **Harmonize**: Composite both layers and execute a controlled diffusion pass (default denoise `0.30`–`0.35`) to unify lighting, shadows, color temperature, and blend edges.
- **Inpaint**: Use the feathered eraser mask to target specific areas and regenerate them with custom prompts.

### 8. Multi-Line Caption & Transparent Text Studio
- Type multi-line headlines, narrative captions, or YouTube-style overlays.
- True newline rendering with customizable font sizes, stroke widths, text colors, and optional double-framed border cards.
- Sends rendered text directly to Layer 2 as transparent RGBA for instant compositing over background art.

### 9. Sequential Novel Images Reel
- Exports sequential 5-digit frames (`00001.png`, `00002.png`, etc.) directly into `./novel_images/`.
- Generates synchronized `.json` metadata sidecars storing prompt, seed, model, transforms, and layer configuration.
- Real-time interactive film strip at the bottom of the screen allowing instant reloading of previous frames.

### 10. Strict 512 × 768 Resolution & RGBA Format
- Defaulted strictly to **512 × 768** (Portrait) for mobile and vertical video pipelines, with **768 × 512** (Landscape) and **512 × 512** (Square) switchable.
- Enforces 4-channel RGBA on all uploaded, rendered, and saved images to preserve alpha transparency throughout the entire editing pipeline.

---

## 🚀 Quick Start

### Running the Standalone AppImage

Make the AppImage executable and launch it:

```bash
chmod +x EsperanzaAI-ImageEditor-Final-x86_64.AppImage
./EsperanzaAI-ImageEditor-Final-x86_64.AppImage
```

*(You can also double-click the AppImage in your Linux file manager!)*

---

## 🧠 Model Checkpoint Setup

AI model checkpoints (2 GB to 4 GB each) are stored on your local disk or external storage and discovered automatically by the AppImage upon launch.

### Automatic Discovery Paths
The application automatically scans for models in:
1. `./models/checkpoints/` (next to where you launch the AppImage)
2. `./models/`
3. `~/models/checkpoints/`
4. `~/Desktop/ComfyUI/models/checkpoints/`
5. `~/stable-diffusion-webui/models/Stable-diffusion/`
6. Any custom path specified by the `MODELS_DIR` environment variable.

### Option A: Create a Symlink (Recommended)
If you already have checkpoints in ComfyUI, WebUI, or on an external SSD:

```bash
# Link to external SSD:
ln -s /media/username/DriveName/models ./models

# Link to local ComfyUI:
ln -s ~/Desktop/ComfyUI/models ./models
```

### Option B: Create a Local Folder
If starting fresh on a new computer:

```bash
mkdir -p models/checkpoints
```
Drop any Stable Diffusion 1.5 `.safetensors` checkpoint file into `models/checkpoints/`.

### Recommended Checkpoints for Fast CPU Performance:
- **LCM (Latent Consistency Model) Checkpoints**: e.g. `dreamshaper_8LCM.safetensors`, `comiccraftLCM_beta4.safetensors`, `cyberrealisticLCM_cyberrealistic42.safetensors`.
- LCM checkpoints generate high-quality images in just **4 to 8 steps** (default is **5**), making CPU rendering fast and smooth without needing a dedicated GPU.

---

## 🔧 Port 5000 Troubleshooting

The backend server runs locally on `http://127.0.0.1:5000`. If an earlier session was terminated abruptly and port 5000 is still held open by a zombie process:

### The Fastest One-Liner (Recommended):
```bash
fuser -k 5000/tcp
```

### Alternative Methods:
```bash
# Force-kill whatever is on port 5000:
kill -9 $(lsof -t -i :5000)

# Or kill by process name:
pkill -9 -f "AI_ImageEditor"
```

---

## 📂 Project Structure

```
AI_ImageEditor/
├── EsperanzaAI-ImageEditor-Final-x86_64.AppImage # Final 100% Standalone AppImage (401 MB)
├── build_esperanza_ai_final_appimage.sh          # Packaging pipeline script
├── AI_ImageEditor_v10.py                         # Active backend with Safe VAE Slicing & Flip API
├── start_editor.sh                              # Standalone launch script
├── README.md                                    # Project overview & reference
├── INSTRUCTIONS.md                              # Verbose step-by-step master user guide
├── TEMPLATE.md                                  # Recipe for creating future standalone AppImages
├── project_state.json                           # Persistent session state & layout settings
├── models -> ...                                # Symlink to local checkpoints directory
├── templates/
│   └── index.html                               # Darkroom UI with New Canvas, Flip H, & Caption Studio
├── static/
│   ├── css/style.css                            # Obsidian dark theme, glowing badges, terminal styling
│   └── js/editor.js                             # Compositor, brush engine, flip transforms, new canvas
├── novel_images/                                # Sequential output frames & JSON metadata sidecars
│   ├── 00001.png / 00001.json
│   └── ...
└── versions/                                    # Archived milestone versions (v1 through v10)
```

---

## 🛡️ Version History & Milestone Preservation

In accordance with non-destructive versioning policies, all prior milestone versions are archived in `./versions/`:

- **v1**: Baseline dual-layer canvas and basic composite export.
- **v2**: Local model symlink decoupling and AppImage preparation.
- **v3**: Dual-layer independent prompts, feathered brush engine, and novel_images export.
- **v4**: Real-time terminal log viewer, cancel API, and wide-column UI redesign.
- **v5**: Direct Layer 1/2 Img2Img, Ingest Hub, RGBA upload enforcement, X/Y precision sliders, and 512×768 lock.
- **v6**: First native Tauri 2 AppImage bundle (`EsperanzaAI-ImageEditor-x86_64.AppImage`).
- **v7**: Multi-line Caption & Text Overlay Studio, YouTube card framing, and AppImage v2.
- **v8**: Portable generic model discovery, diffusers 0.43 safe VAE slicing fix, and LCM defaults (5 steps, 1.5 CFG).
- **v9**: Left-to-right horizontal image flipping for Layer 1 & Layer 2 with synchronized mask mirroring.
- **v10 / Final**: Dedicated "New Canvas / Clear All" workflow (Header, HUD, Action Bar) and individual layer clearing.
- **Final Release AppImage**: `EsperanzaAI-ImageEditor-Final-x86_64.AppImage` (401 MB self-contained).
