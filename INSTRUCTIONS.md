# 📖 EsperanzaAI Image Editor — Master User Manual & Verbose Instructions

Welcome to the comprehensive, step-by-step user manual for the **EsperanzaAI Image Editor (Final Standalone Release)**. This document covers every feature, workflow, shortcut, and operational principle in detail.

---

## 📑 Table of Contents
1. [Introduction & System Philosophy](#1-introduction--system-philosophy)
2. [Hardware Optimization & Standalone Architecture](#2-hardware-optimization--standalone-architecture)
3. [First-Time Setup & Model Discovery](#3-first-time-setup--model-discovery)
4. [Visual Tour of the User Interface](#4-visual-tour-of-the-user-interface)
   - [Header Toolbar](#41-header-toolbar)
   - [Left Panel: Generation & Studio](#42-left-panel-generation--studio)
   - [Center Panel: Canvas Workspace & HUD](#43-center-panel-canvas-workspace--hud)
   - [Right Panel: Layers & Precision Sliders](#44-right-panel-layers--precision-sliders)
   - [Bottom Panel: Sequential Film Strip Reel](#45-bottom-panel-sequential-film-strip-reel)
5. [Step-by-Step User Workflows](#5-step-by-step-user-workflows)
   - [Workflow 1: Starting a Brand New Image (New Canvas)](#workflow-1-starting-a-brand-new-image-new-canvas)
   - [Workflow 2: Generating Content from Text (Txt2Img)](#workflow-2-generating-content-from-text-txt2img)
   - [Workflow 3: Dual-Layer Cutouts & Feathered Masking](#workflow-3-dual-layer-cutouts--feathered-masking)
   - [Workflow 4: Horizontal Image Flipping (Left-to-Right Mirror)](#workflow-4-horizontal-image-flipping-left-to-right-mirror)
   - [Workflow 5: Precision Alignment with X/Y Sliders](#workflow-5-precision-alignment-with-xy-sliders)
   - [Workflow 6: Transforming a Single Layer (Layer Img2Img)](#workflow-6-transforming-a-single-layer-layer-img2img)
   - [Workflow 7: Seam Harmonization (Lighting & Color Blending)](#workflow-7-seam-harmonization-lighting--color-blending)
   - [Workflow 8: Masked Inpainting (Targeted Area Regeneration)](#workflow-8-masked-inpainting-targeted-area-regeneration)
   - [Workflow 9: Multi-Line Caption & Transparent Title Studio](#workflow-9-multi-line-caption--transparent-title-studio)
   - [Workflow 10: Saving & Exporting for Tauri-VideoMaker](#workflow-10-saving--exporting-for-tauri-videomaker)
6. [Keyboard & Mouse Controls Reference](#6-keyboard--mouse-controls-reference)
7. [Recommended Model Checkpoints & Settings](#7-recommended-model-checkpoints--settings)
8. [Troubleshooting & Frequently Asked Questions](#8-troubleshooting--frequently-asked-questions)

---

## 1. Introduction & System Philosophy

**EsperanzaAI Image Editor** is a standalone dual-layer digital darkroom and Stable Diffusion compositor designed specifically for Linux creators, digital artists, and storytellers. 

Traditional AI generation tools produce flat, one-shot images. EsperanzaAI treats AI generation like a traditional photo darkroom:
* You have two distinct layers: **Layer 1 (Background / Base)** and **Layer 2 (Foreground / Subject)**.
* Each layer can be independently generated, uploaded, transformed, flipped, or transformed via Img2Img without disturbing the other.
* You can erase through the top layer using a feathered, soft-edged brush to create natural composite windows.
* Once composed, a specialized **Harmonizer** passes a low-denoise diffusion sweep over the entire image to unify lighting, shadows, colors, and blend the seam lines into a coherent single piece of art.
* Output frames and rich JSON sidecars are exported sequentially (`00001.png`, `00002.png`...) directly into `./novel_images/` for instant morphing and video generation inside **`Tauri-VideoMaker-DEV-x86_64.AppImage`**.

---

## 2. Hardware Optimization & Standalone Architecture

### 100% Self-Contained AppImage
The application is delivered as `EsperanzaAI-ImageEditor-Final-x86_64.AppImage` (401 MB). It contains:
1. **Embedded Portable Python 3.11 Runtime**: Built against `glibc 2.17` (CentOS 7 base) for universal binary compatibility on any Linux distribution (Ubuntu 16.04–24.04, Debian, Fedora, Mint, Arch, Manjaro, openSUSE).
2. **CPU PyTorch 2.15 & Diffusers 0.43**: Pre-installed and optimized for CPU execution. No CUDA drivers or NVIDIA GPUs required.
3. **Dual-Display Guarantee**: AppRun first launches the compiled native Tauri release binary (`esperanza-editor`). If the host system is missing WebKitGTK libraries, it automatically falls back to chromeless app-mode browser windows (`google-chrome --app`, `chromium`, `brave`, `edge`, `firefox`, or `xdg-open`).

### CPU Throttling Protection
During diffusion runs, CPU usage can spike to 100% across all cores if unchecked, causing the mouse cursor and music to stutter. EsperanzaAI implements two hardware protections:
* **Thread Limiting**: PyTorch is strictly clamped to **4 CPU threads** by default (configurable to 2, 4, or 6 threads via the header dropdown).
* **Process Priority Nice (`os.nice(15)`)**: The backend runs at reduced scheduling priority, ensuring desktop audio, web browsing, and system responsiveness remain buttery smooth while generating in the background.

---

## 3. First-Time Setup & Model Discovery

AI model checkpoints (`.safetensors` files, typically 2 GB to 4 GB each) are stored on your local disk or external storage. When launched, the AppImage dynamically scans for models in:

1. `./models/checkpoints/` *(next to the AppImage)*
2. `./models/`
3. `~/models/checkpoints/`
4. `~/Desktop/ComfyUI/models/checkpoints/`
5. `~/stable-diffusion-webui/models/Stable-diffusion/`
6. Any directory specified by the `MODELS_DIR` environment variable.

### Linking an Existing Model Library
If you already have checkpoints in ComfyUI, AUTOMATIC1111, or an external drive:
```bash
# Example: Symlink an external SSD
ln -s /media/jack/MyPassport/models ./models

# Example: Symlink local ComfyUI models
ln -s ~/Desktop/ComfyUI/models ./models
```

### Launching the Application
```bash
cd /path/to/appimage/folder
chmod +x EsperanzaAI-ImageEditor-Final-x86_64.AppImage
./EsperanzaAI-ImageEditor-Final-x86_64.AppImage
```

---

## 4. Visual Tour of the User Interface

```
+----------------------------------------------------------------------------------------------------+
|  🌸 AI Image Editor [Online | dreamshaper_8LCM]  [✨ New Canvas] [+Upload L1] [+Upload L2]  [🛑 STOP] |
+------------------------------------+----------------------------------+----------------------------+
| LEFT PANEL: GENERATION STUDIO      | CENTER PANEL: WORKSPACE          | RIGHT PANEL: LAYERS        |
| - SD Model & VAE Selector          | - HUD: Tool (Erase/Restore)      | - LAYER 2 (TOP) CARD       |
| - Target Resolution (512x768)      | - Brush Size, Feather, Opacity   |   [📁 Choose File] [⇄ Flip]|
| - LCM Steps: 5 | CFG: 1.5          | - [↶ Undo] [↷ Redo] [Reset Mask] |   [X Slider] [Y Slider]    |
| - LAYER 1 PROMPT BOX               | - [✨ New Canvas]                 |   [Scale %] [Opacity %]    |
|   [Txt2Img] [Img2Img] [⇄ Flip H]   | -------------------------------- |   [Center] [Fit Canvas]    |
| - LAYER 2 PROMPT BOX               | MAIN CANVAS VIEWPORT             | -------------------------- |
|   [Txt2Img] [Img2Img] [⇄ Flip H]   | (Interactive Dual Composite)     | [⇅ Swap Top & Bottom]      |
| - HARMONIZE & INPAINT BOX          | -------------------------------- | -------------------------- |
|   [Harmonize Pass] [Inpaint Mask]  | BOTTOM ACTION BAR:               | - LAYER 1 (BOTTOM) CARD    |
| - CAPTION & TEXT OVERLAY STUDIO    | [💾 Save to novel_images]        |   [📁 Choose File] [⇄ Flip]|
|   (Multiline text, colors, frame)  | [🔄 Flatten -> L1] [🔄 -> L2]    | - 🎬 NOVEL IMAGES REEL     |
| - LIVE TERMINAL LOG CONSOLE        | [📄 New Canvas]                  |   (Filmstrip of saved frames)
+------------------------------------+----------------------------------+----------------------------+
```

### 4.1. Header Toolbar
* **System Status Pill**: Displays connection state (`Online`) and currently loaded checkpoint model.
* **Direct Upload Shortcuts**: Quick buttons to upload files directly into Layer 1 or Layer 2.
* **✨ New Canvas**: Instantly clears active layers and masks to begin a fresh image.
* **🛑 STOP GENERATION**: Glows and pulses red during diffusion runs; clicking it immediately sends an abort signal to cancel the generation.
* **CPU Threads Selector**: Lets you dynamically switch between 2 Threads (ultra light), 4 Threads (recommended), or 6 Threads.
* **Reel Counter Badge**: Live counter showing the number of finished frames saved in `./novel_images/`.

### 4.2. Left Panel: Generation & Studio
* **SD Model Checkpoint**: Dropdown dynamically populated with all discovered `.safetensors` files.
* **Target Resolution**: Defaulted to **512 × 768** (Portrait). Can be switched to 768 × 512 (Landscape) or 512 × 512 (Square).
* **LCM Steps Slider**: Defaulted to **5 steps** (range 4 to 14).
* **CFG Guidance Slider**: Defaulted to **1.5** (range 1.0 to 4.0).
* **Layer 1 & 2 Prompt Cards**: Each layer features its own Prompt, Negative Prompt, Seed, and Denoise inputs.
* **Harmonize & Inpaint Card**: Denoise control (0.10 to 0.70) with one-click quick presets (`0.25 Gentle`, `0.35 Balanced`, `0.50 Strong`).
* **Caption Studio**: Collapsible accordion for designing stylized text overlays.
* **Live Terminal Log**: Pinned console displaying real-time step progress (`[06:14:02] Step 3/5 complete...`).

### 4.3. Center Panel: Canvas Workspace & HUD
* **Top Brush HUD**: Toggle between **Erase** (default) and **Restore** brush modes. Adjust **Size** (5–200px), **Feather** (0–100% softness), and **Opacity**.
* **Canvas Viewport**: High-DPI canvas showing the live blended composite.
* **Bottom Action Bar**:
  * `💾 Save to ./novel_images`: Exports `0000X.png` and sidecar `0000X.json`.
  * `🔄 Flatten & Send to Layer 1`: Merges the visible composite down into Layer 1 as a single base plate.
  * `🔄 Flatten & Send to Layer 2`: Merges the visible composite into Layer 2.
  * `📄 New Canvas`: Wipes the canvas clean for a new project.

### 4.4. Right Panel: Layers & Precision Sliders
* **Layer 2 (Top / Foreground)**:
  * Horizontal Position slider (`X: -512px to +512px`).
  * Vertical Position slider (`Y: -768px to +768px`).
  * Scale slider (`10% to 300%`).
  * Opacity slider (`0% to 100%`).
  * Quick buttons: `Center (X=0, Y=0)`, `Fit Canvas`, and `⇄ Flip Horizontal`.
* **Layer Swap Container**: Prominent `⇅ Swap Top & Bottom Layers` button to reverse layer stack order.
* **Layer 1 (Bottom / Base)**: Thumbnail preview, file upload button, and `⇄ Flip Horizontal`.

### 4.5. Bottom Panel: Sequential Film Strip Reel
* Displays scrollable thumbnail previews of every image saved in `./novel_images/`.
* Clicking any thumbnail instantly loads that frame and its exact prompt metadata back into the editor.

---

## 5. Step-by-Step User Workflows

### Workflow 1: Starting a Brand New Image (New Canvas)
You **never need to restart the application** to create another image.
1. Click any **`✨ New Canvas`** button (available in the Header, Canvas HUD, or Bottom Action Bar).
2. A confirmation prompt will ask: *"Start a new image? This will clear active layers and masks from the canvas."*
3. Click **OK**.
4. Both layers are reset to blank, masks and histories are cleared, sliders reset to default (X=0, Y=0, Scale=100%, Opacity=100%), and the canvas clears immediately.
5. Your prompt texts and settings remain intact so you can adjust them or type fresh ones.

---

### Workflow 2: Generating Content from Text (Txt2Img)
1. Select an LCM checkpoint from the model dropdown (e.g. `dreamshaper_8LCM.safetensors`).
2. In the **Layer 1 (Base)** card:
   - Type your scene description: `e.g. ancient misty bamboo forest at dawn, ethereal god rays, photorealistic 8k`.
   - Leave Seed blank for a random seed, or enter a number for reproducible results.
3. Verify **LCM Steps** is set to **`5`** and **CFG Guidance** is set to **`1.5`**.
4. Click **`✨ Txt2Img`** in the Layer 1 box.
5. Watch the Live Terminal Log as the 5 diffusion steps complete.
6. The new background appears instantly on the canvas.
7. Next, in the **Layer 2 (Top)** card:
   - Type a subject prompt: `e.g. majestic golden dragon curled around a stone pagoda, detailed scales, dramatic lighting`.
   - Click **`✨ Txt2Img`** in the Layer 2 box.
8. Layer 2 generates and lands on top of Layer 1.

---

### Workflow 3: Dual-Layer Cutouts & Feathered Masking
Once Layer 2 is resting on top of Layer 1:
1. Ensure the brush mode is set to **Erase** in the HUD above the canvas.
2. Adjust the **Brush Size** slider (e.g., 45px) and **Feather** slider (e.g., 80% for soft, seamless edges).
3. Click and drag your mouse directly over the canvas to paint away the background of Layer 2.
4. As you paint, transparent cutouts appear in Layer 2, revealing Layer 1 underneath.
5. **Made a mistake?**
   - Click **`↶ Undo`** in the HUD (supports 15 levels of undo).
   - Or switch the brush tool to **Restore** mode and paint over the area to bring erased pixels back!
6. Click **`Reset Mask`** at any time if you want to restore the entire top layer to 100% visibility.

---

### Workflow 4: Horizontal Image Flipping (Left-to-Right Mirror)
Often, an AI-generated subject faces the wrong direction (e.g., looking left instead of right into the frame).
1. To flip the top subject:
   - Click **`⇄ Flip Horizontal`** in the Layer 2 transform controls (or **`⇄ Flip H`** in the Layer 2 prompt bar).
   - Layer 2 immediately mirrors left-to-right on canvas.
   - Any feathered masks or erasures you already painted automatically flip in lockstep, remaining aligned.
2. To flip the background plate:
   - Click **`⇄ Flip Horizontal`** in the Layer 1 card.
   - The entire base background mirrors horizontally.

---

### Workflow 5: Precision Alignment with X/Y Sliders
Instead of guessing with mouse dragging, use the precision sliders in the right sidebar:
* **Horizontal (X)**: Move Layer 2 left or right (`-512px` to `+512px`).
* **Vertical (Y)**: Move Layer 2 up or down (`-768px` to `+768px`).
* **Scale**: Zoom Layer 2 from 10% (tiny) to 300% (giant).
* **Opacity**: Blend Layer 2 semi-transparently (0% to 100%) for ghosting or double-exposure effects.
* **Center (X=0, Y=0)**: Instantly re-centers Layer 2 on the canvas.
* **Fit Canvas**: Automatically scales Layer 2 so its longest edge fits the canvas boundaries.

---

### Workflow 6: Transforming a Single Layer (Layer Img2Img)
Want to restyle just the background or just the foreground without touching the other?
1. To restyle Layer 1:
   - Update the prompt in the Layer 1 box.
   - Adjust **Img2Img Denoise** (e.g., `0.35` for subtle color shifts; `0.65` for major stylistic overhaul).
   - Click **`🎨 Img2Img`** in the Layer 1 card.
   - Only Layer 1 is transformed; Layer 2 and its cutouts remain identical.
2. To restyle Layer 2:
   - Use the **`🎨 Img2Img`** button in the Layer 2 card.

---

### Workflow 7: Seam Harmonization (Lighting & Color Blending)
After cutting out Layer 2 and positioning it over Layer 1, the lighting or color temperatures might not match perfectly.
1. Scroll to the **Harmonization & Inpainting** card in the left sidebar.
2. Enter a prompt describing the desired unified atmosphere:
   `e.g. coherent unified cinematic scene, warm sunset lighting, matching ambient occlusion, 8k`.
3. Set **Harmonize Denoise**:
   - `0.25 (Gentle)`: Keeps all composition shapes crisp while harmonizing color palette and lighting tones.
   - `0.35 (Balanced - Recommended)`: Blends seam lines naturally and casts believable shadows between layers.
   - `0.50 (Strong)`: Re-synthesizes the elements together into a completely cohesive new painting.
4. Click **`✨ Harmonize Image (Img2Img)`**.
5. The combined composite is rendered into a harmonious final piece.

---

### Workflow 8: Masked Inpainting (Targeted Area Regeneration)
Want to replace a specific object in the scene?
1. Use the **Erase** brush on the canvas to paint over the exact object you want to change (e.g., erase a hat or a sword).
2. In the Harmonize card, type what should appear in that erased area:
   `e.g. glowing ornate magical crystal orb, emitting purple particles, sharp focus`.
3. Click **`🎨 Inpaint Masked Area`**.
4. The diffusion engine targets only the erased pixels, blending the new object into the scene.

---

### Workflow 9: Multi-Line Caption & Transparent Title Studio
1. In the left panel, click **Caption & Title Studio** to expand the accordion.
2. Enter your text in **Main Caption (Multiline)**:
   ```text
   CHAPTER 1: THE DISCOVERY
   Deep beneath the forgotten ruins,
   the ancient relic began to glow.
   ```
3. Customize styling:
   - **Text Color**: Choose yellow (`#ffe600`), white (`#ffffff`), cyan (`#00e5ff`), etc.
   - **Outline / Stroke**: Adjust width (e.g., 4px) to ensure crisp readability over any background.
   - **Font Size**: Range from 16px to 72px.
   - **Card Frame Border**: Check to draw a double-framed cinematic border around the image.
4. Click **`✨ Apply Caption to Layer 2`**.
5. The text renders as a transparent RGBA layer directly on Layer 2, overlaying your background art!

---

### Workflow 10: Saving & Exporting for Tauri-VideoMaker
1. When your composition is complete, click **`💾 Save to ./novel_images`** in the bottom action bar.
2. The editor automatically:
   - Finds the next sequential frame number (e.g. `00001.png`, `00002.png`).
   - Flattens the canvas to a full-resolution 512×768 PNG.
   - Writes a synchronized JSON sidecar (e.g. `00001.json`) containing prompts, seeds, denoise values, model name, and layer positions.
   - Adds the new thumbnail to the interactive film strip reel at the bottom of the window.
3. **Launch Tauri-VideoMaker**: The `./novel_images/` folder is pre-formatted for instant ingestion by `Tauri-VideoMaker-DEV-x86_64.AppImage` to generate video morphs and continuous narrative videos.

---

## 6. Keyboard & Mouse Controls Reference

| Control | Action |
| :--- | :--- |
| **Left Click + Drag on Canvas** | Paint with active brush tool (Erase or Restore) |
| **Right Click + Drag on Canvas** | Pan canvas viewport |
| **Mouse Wheel on Canvas** | Zoom in / Zoom out |
| **X Slider / Y Slider** | Precision sub-pixel positioning of Layer 2 |
| **`↶ Undo` / `↷ Redo`** | Step backward / forward through brush history |
| **`Reset Mask`** | Restore top layer to 100% full opacity |
| **`⇅ Swap Layers`** | Swap Top and Bottom layers |
| **`⇄ Flip Horizontal`** | Mirror Layer 1 or Layer 2 left-to-right |
| **`✨ New Canvas`** | Clear canvas layers to begin a fresh image |
| **`🛑 STOP GENERATION`** | Abort ongoing diffusion generation |

---

## 7. Recommended Model Checkpoints & Settings

### Optimal LCM Checkpoints
For CPU rendering, always use **LCM (Latent Consistency Model)** checkpoints. They achieve near-instant rendering in 4–8 steps without sacrificing detail:
* **`dreamshaper_8LCM.safetensors`**: Versatile, cinematic fantasy and realism.
* **`comiccraftLCM_beta4.safetensors`**: Graphic novel, anime, and comic illustration.
* **`cyberrealisticLCM_cyberrealistic42.safetensors`**: Photorealism, portraits, and urban scenes.

### Settings Cheat Sheet:
* **LCM Sampling Steps**: **`5`** *(4 is faster; 8 is maximum fine detail)*.
* **CFG Guidance**: **`1.5`** *(Keep between 1.2 and 1.8 for LCM models)*.
* **Layer Img2Img Denoise**:
  * Light adjustment: `0.30`
  * Moderate transformation: `0.50`
  * Complete restyle: `0.70`
* **Harmonize Denoise**:
  * Seamless blending: `0.30`–`0.35`
* **CPU Threads**: **`4 Threads`** *(best balance of speed and system responsiveness)*.

---

## 8. Troubleshooting & Frequently Asked Questions

### Q1: What should I do if port 5000 is blocked or connection is refused?
If an earlier session exited abnormally, Python may still occupy port 5000. Open a terminal and run the one-liner:
```bash
fuser -k 5000/tcp
```
Then re-launch the AppImage.

### Q2: How do I create a new image without closing the app?
Simply click the **`✨ New Canvas`** button in the header toolbar, canvas HUD, or bottom action bar. Both layers will be cleared and you can begin a new image immediately.

### Q3: Why is my generation taking longer than expected?
Check that **LCM Steps** is set to **`5`** (not 20 or 50) and that you are using an LCM checkpoint. Standard SD 1.5 checkpoints require 20–30 steps and will take significantly longer on CPU.

### Q4: How do I know if models were detected?
Check the **System Status Pill** in the top header. It will display the active model name. You can also view the dropdown list of models in the left panel under *"SD Model Checkpoint"*.

### Q5: Can I run this AppImage on a computer without an internet connection?
**Yes!** The AppImage is 100% self-contained. Once downloaded along with your `.safetensors` model files, it operates completely offline with zero internet access required.
