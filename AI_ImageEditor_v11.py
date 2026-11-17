#!/usr/bin/env python3
"""
AI Image Editor - Version 11 (AI_ImageEditor_v11.py)
A Dual-Layer Digital Darkroom & Stable Diffusion Compositor
Features:
- Permanent Bypass of Diffusers NSFW Safety Checker (Zero Blackout False Positives)
- Instant "New Canvas / Clear All" and Individual Layer Clear
- Left-to-Right Horizontal Flip on Layer 1 and Layer 2
- LCM Steps: 5 default; CFG: 1.5 default
- Diffusers 0.43+ safe VAE slicing / tiling compatibility
- Dedicated Img2Img on Individual Layers (Layer 1 & Layer 2 independent transforms)
- Target Resolution: 512x768 (Portrait Default)
- Mandatory RGBA conversion for all uploads and outputs
- Precision Position Sliders (Horizontal X & Vertical Y)
- Inpainting Engine (/api/inpaint)
- Pinned & Visible Live Running Log Console
- Immediate Stop / Abort Controller
- JSON Tracking (project_state.json & 0000X.json sidecars)
- Local ./models symlink resolution (AppImage ready)
- Output directly to ./novel_images/ for Tauri-VideoMaker
"""

import os
import sys
import gc
import json
import glob
import time
import base64
import signal
from collections import deque
from io import BytesIO
from pathlib import Path
from typing import Optional, Dict, Any, List

# Linux CPU Throttling & Priority Guard
try:
    os.nice(15)  # Yield priority to desktop UI and audio
except Exception as e:
    print(f"[Notice] os.nice(15) skipped: {e}")

import torch
# 4 threads on 8-core CPU
NUM_THREADS = 4
torch.set_num_threads(NUM_THREADS)

from PIL import Image, ImageOps
from flask import Flask, render_template, request, jsonify, send_from_directory

from diffusers import (
    StableDiffusionPipeline,
    StableDiffusionImg2ImgPipeline,
    StableDiffusionInpaintPipeline,
    LCMScheduler,
    EulerAncestralDiscreteScheduler
)

# Base Paths & Directories (AppImage / Portable Workspace Aware)
SCRIPT_DIR = Path(__file__).resolve().parent
HOST_DIR_ENV = os.environ.get("HOST_DIR")
WORKSPACE_DIR = Path(HOST_DIR_ENV).resolve() if HOST_DIR_ENV else SCRIPT_DIR

NOVEL_IMAGES_DIR = WORKSPACE_DIR / "novel_images"
NOVEL_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

VERSIONS_DIR = WORKSPACE_DIR / "versions"
VERSIONS_DIR.mkdir(parents=True, exist_ok=True)

PROJECT_STATE_FILE = WORKSPACE_DIR / "project_state.json"

# Model Directories (Generic across Linux computers + Local overrides)
user_home = Path.home()
CHECKPOINT_DIRS = [
    WORKSPACE_DIR / "models" / "checkpoints",
    WORKSPACE_DIR / "models" / "checkpoint",
    WORKSPACE_DIR / "models",
    SCRIPT_DIR / "models" / "checkpoints",
    SCRIPT_DIR / "models",
    user_home / "models" / "checkpoints",
    user_home / "models",
    user_home / "Desktop" / "models" / "checkpoints",
    user_home / "Desktop" / "ComfyUI" / "models" / "checkpoints",
    user_home / "ComfyUI" / "models" / "checkpoints",
    user_home / "stable-diffusion-webui" / "models" / "Stable-diffusion",
    Path("/media/jack/9930-14E1/models/checkpoints"),
    Path("/media/jack/9930-14E1/models/checkpoint")
]

if os.environ.get("MODELS_DIR"):
    custom_m = Path(os.environ["MODELS_DIR"]).resolve()
    CHECKPOINT_DIRS.insert(0, custom_m / "checkpoints")
    CHECKPOINT_DIRS.insert(1, custom_m)

VAE_DIRS = [
    WORKSPACE_DIR / "models" / "vae",
    SCRIPT_DIR / "models" / "vae",
    user_home / "models" / "vae",
    user_home / "Desktop" / "ComfyUI" / "models" / "vae",
    Path("/media/jack/9930-14E1/models/vae")
]

# Device & Pipeline Cache
DEVICE = "cpu"
DTYPE = torch.float32

_cached_pipe: Optional[Any] = None
_cached_pipe_type: Optional[str] = None
_cached_model_path: Optional[str] = None
_cached_vae_path: Optional[str] = None
_cached_is_lcm: bool = False

# Live Log Buffer & Abort Controller
_log_buffer = deque(maxlen=400)
_abort_requested = False
_is_generating = False

# Resource paths (templates & static inside AppImage or workspace)
TEMPLATE_DIR = SCRIPT_DIR / "templates" if (SCRIPT_DIR / "templates").exists() else WORKSPACE_DIR / "templates"
STATIC_DIR = SCRIPT_DIR / "static" if (SCRIPT_DIR / "static").exists() else WORKSPACE_DIR / "static"

app = Flask(
    __name__,
    template_folder=str(TEMPLATE_DIR),
    static_folder=str(STATIC_DIR)
)

def logit(msg: str):
    """Log to both terminal and in-memory ring buffer for the UI log console."""
    ts = time.strftime("%H:%M:%S")
    entry = f"[{ts}] {msg}"
    print(entry, flush=True)
    _log_buffer.append(entry)

logit("AI Image Editor v11 initialized.")
logit("Hardware: 4 CPU threads | os.nice(15) active | Ready for Txt2Img & Img2Img.")

def signal_handler(sig, frame):
    logit("Shutting down AI Image Editor cleanly...")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)


def get_available_checkpoints() -> List[str]:
    """Scan and list available .safetensors checkpoints."""
    models = []
    for c_dir in CHECKPOINT_DIRS:
        if c_dir.exists():
            for f in sorted(c_dir.glob("*.safetensors")):
                models.append(f.name)
    return list(dict.fromkeys(models))


def get_available_vaes() -> List[str]:
    """Scan and list available VAE files."""
    vaes = ["Default (Baked-in)"]
    for v_dir in VAE_DIRS:
        if v_dir.exists():
            for f in sorted(list(v_dir.glob("*.safetensors")) + list(v_dir.glob("*.ckpt"))):
                vaes.append(f.name)
    return list(dict.fromkeys(vaes))


def resolve_model_path(model_name: str) -> Optional[Path]:
    for c_dir in CHECKPOINT_DIRS:
        candidate = c_dir / model_name
        if candidate.exists():
            return candidate
    return None


def resolve_vae_path(vae_name: str) -> Optional[Path]:
    if not vae_name or vae_name == "Default (Baked-in)":
        return None
    for v_dir in VAE_DIRS:
        candidate = v_dir / vae_name
        if candidate.exists():
            return candidate
    return None


def load_pipeline(model_name: str, pipeline_mode: str = "img2img", vae_name: Optional[str] = None):
    """
    Load and cache Stable Diffusion pipeline on CPU with LCM support,
    memory optimizations, and attention slicing.
    """
    global _cached_pipe, _cached_pipe_type, _cached_model_path, _cached_vae_path, _cached_is_lcm

    model_path = resolve_model_path(model_name)
    if not model_path:
        raise FileNotFoundError(f"Checkpoint '{model_name}' not found in model directories.")

    vae_path = resolve_vae_path(vae_name) if vae_name else None
    is_lcm = "LCM" in model_name.upper()
    target_scheduler_cls = LCMScheduler if is_lcm else EulerAncestralDiscreteScheduler

    if (
        _cached_pipe is not None
        and _cached_model_path == str(model_path)
        and _cached_pipe_type == pipeline_mode
    ):
        if vae_path and _cached_vae_path != str(vae_path):
            logit(f"Swapping VAE: {vae_path.name}")
            _cached_pipe.vae = _cached_pipe.vae.from_single_file(str(vae_path)).to(DEVICE, dtype=DTYPE)
            _cached_vae_path = str(vae_path)
        return _cached_pipe

    logit(f"Loading {model_name} for {pipeline_mode} (LCM: {is_lcm}) on {DEVICE}...")
    _cached_pipe = None
    gc.collect()

    if pipeline_mode == "txt2img":
        pipe_cls = StableDiffusionPipeline
    elif pipeline_mode == "inpaint":
        pipe_cls = StableDiffusionInpaintPipeline
    else:
        pipe_cls = StableDiffusionImg2ImgPipeline

    pipe = pipe_cls.from_single_file(
        str(model_path),
        torch_dtype=DTYPE,
        safety_checker=None,
        requires_safety_checker=False,
        load_safety_checker=False
    )
    pipe = pipe.to(DEVICE)
    pipe.scheduler = target_scheduler_cls.from_config(pipe.scheduler.config)

    # Completely bypass safety checker to prevent false-positive black image returns
    pipe.safety_checker = None
    pipe.requires_safety_checker = False
    if hasattr(pipe, "run_safety_checker"):
        pipe.run_safety_checker = lambda image, device, dtype: (image, None)
    logit("[Pipeline] Safety checker permanently disabled (no black image false positives).")

    # CPU Memory and Speed optimizations
    try:
        pipe.enable_attention_slicing()
    except Exception as e:
        logit(f"[Notice] enable_attention_slicing skipped: {e}")

    try:
        if hasattr(pipe, "enable_vae_slicing"):
            pipe.enable_vae_slicing()
        elif hasattr(pipe, "vae") and hasattr(pipe.vae, "enable_slicing"):
            pipe.vae.enable_slicing()
    except Exception as e:
        logit(f"[Notice] VAE slicing skipped: {e}")

    try:
        if hasattr(pipe, "enable_vae_tiling"):
            pipe.enable_vae_tiling()
        elif hasattr(pipe, "vae") and hasattr(pipe.vae, "enable_tiling"):
            pipe.vae.enable_tiling()
    except Exception as e:
        logit(f"[Notice] VAE tiling skipped: {e}")

    if vae_path:
        logit(f"Applying custom VAE: {vae_path.name}")
        pipe.vae = pipe.vae.from_single_file(str(vae_path)).to(DEVICE, dtype=DTYPE)
        _cached_vae_path = str(vae_path)
    else:
        _cached_vae_path = None

    _cached_pipe = pipe
    _cached_pipe_type = pipeline_mode
    _cached_model_path = str(model_path)
    _cached_is_lcm = is_lcm

    logit(f"Model ready: {model_name} [{pipeline_mode}]")
    return _cached_pipe


def get_next_novel_image_filename() -> str:
    """Find next sequential filename like 00001.png, 00002.png for Tauri-VideoMaker."""
    existing = sorted(NOVEL_IMAGES_DIR.glob("[0-9][0-9][0-9][0-9][0-9].png"))
    if not existing:
        return "00001.png"
    last_num = int(existing[-1].stem)
    return f"{last_num + 1:05d}.png"


def pil_to_base64(img: Image.Image, format: str = "PNG") -> str:
    buffered = BytesIO()
    img.save(buffered, format=format)
    return base64.b64encode(buffered.getvalue()).decode("utf-8")


def base64_to_pil(data_str: str) -> Image.Image:
    if "," in data_str:
        data_str = data_str.split(",", 1)[1]
    image_bytes = base64.b64decode(data_str)
    return Image.open(BytesIO(image_bytes)).convert("RGBA")


# ==========================================
# FLASK WEB ROUTES
# ==========================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/status", methods=["GET"])
def get_status():
    """Return backend status, thread count, model state, and novel_images count."""
    files = sorted(list(NOVEL_IMAGES_DIR.glob("*.png")) + list(NOVEL_IMAGES_DIR.glob("*.jpg")))
    return jsonify({
        "status": "online",
        "version": "v5",
        "threads": torch.get_num_threads(),
        "device": DEVICE,
        "is_generating": _is_generating,
        "novel_images_count": len(files),
        "cached_model": Path(_cached_model_path).name if _cached_model_path else "None",
        "is_lcm": _cached_is_lcm,
        "models_symlink": (WORKSPACE_DIR / "models").is_symlink()
    })


@app.route("/api/logs", methods=["GET"])
def get_logs():
    """Fetch recent live logs for UI terminal drawer."""
    return jsonify({
        "logs": list(_log_buffer),
        "is_generating": _is_generating
    })


@app.route("/api/cancel", methods=["POST"])
def cancel_generation():
    """Trigger abort for ongoing diffusion generation."""
    global _abort_requested
    _abort_requested = True
    logit("🛑 STOP REQUESTED by user! Halting inference loop...")
    return jsonify({"success": True, "message": "Abort flag set"})


@app.route("/api/models", methods=["GET"])
def list_models():
    """List checkpoints and VAEs available on system."""
    checkpoints = get_available_checkpoints()
    vaes = get_available_vaes()
    return jsonify({
        "checkpoints": checkpoints,
        "vaes": vaes,
        "default_checkpoint": "dreamshaper_8LCM.safetensors" if "dreamshaper_8LCM.safetensors" in checkpoints else (checkpoints[0] if checkpoints else None)
    })


@app.route("/api/threads", methods=["POST"])
def set_threads():
    """Update CPU thread count dynamically."""
    data = request.json or {}
    threads = int(data.get("threads", 4))
    threads = max(1, min(8, threads))
    torch.set_num_threads(threads)
    logit(f"CPU threads adjusted to: {threads}")
    return jsonify({"success": True, "threads": torch.get_num_threads()})


@app.route("/api/project_state", methods=["GET", "POST"])
def handle_project_state():
    """Save or retrieve project state JSON (dual prompts, settings, history)."""
    if request.method == "POST":
        try:
            data = request.json or {}
            # Enforce 512x768 target
            if data.get("resolution") == "512x512":
                data["resolution"] = "512x768"
            with open(PROJECT_STATE_FILE, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        if PROJECT_STATE_FILE.exists():
            try:
                with open(PROJECT_STATE_FILE, "r", encoding="utf-8") as f:
                    state = json.load(f)
                if state.get("resolution") == "512x512":
                    state["resolution"] = "512x768"
                return jsonify({"exists": True, "state": state})
            except Exception as e:
                return jsonify({"exists": False, "error": str(e)})
        return jsonify({"exists": False, "state": {"resolution": "512x768"}})


@app.route("/api/generate_txt2img", methods=["POST"])
def generate_txt2img():
    """Run Text2Image generation with live step callbacks and stop button support."""
    global _abort_requested, _is_generating
    _abort_requested = False
    _is_generating = True

    try:
        data = request.json or {}
        model_name = data.get("model")
        prompt = data.get("prompt", "").strip()
        negative_prompt = data.get("negative_prompt", "").strip()
        layer_target = data.get("layer_target", 1)
        steps = int(data.get("steps", 5))
        cfg = float(data.get("cfg", 1.5))
        width = int(data.get("width", 512))
        height = int(data.get("height", 768))
        seed = data.get("seed")

        if not prompt:
            _is_generating = False
            return jsonify({"error": "Prompt cannot be empty"}), 400

        pipe = load_pipeline(model_name, pipeline_mode="txt2img")

        generator = None
        if seed is not None and str(seed).strip() != "":
            seed_val = int(seed)
            generator = torch.Generator(device=DEVICE).manual_seed(seed_val)
            logit(f"[Txt2Img] Layer {layer_target} | Fixed Seed: {seed_val}")
        else:
            logit(f"[Txt2Img] Layer {layer_target} | Random Seed")

        logit(f"[Txt2Img] Starting ({width}x{height}, {steps} steps, CFG {cfg})")
        logit(f"  Prompt: \"{prompt[:65]}...\"")
        start_t = time.time()

        def step_callback(pipe, step_index, timestep, callback_kwargs):
            global _abort_requested
            logit(f"  -> Txt2Img Step {step_index + 1}/{steps} complete")
            if _abort_requested:
                pipe._interrupt = True
                raise InterruptedError("Generation cancelled by user.")
            return callback_kwargs

        image = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt if negative_prompt else None,
            num_inference_steps=steps,
            guidance_scale=cfg,
            width=width,
            height=height,
            generator=generator,
            callback_on_step_end=step_callback
        ).images[0].convert("RGBA")

        duration = round(time.time() - start_t, 2)
        logit(f"[Txt2Img] Layer {layer_target} generated in {duration}s [RGBA]")
        b64_img = pil_to_base64(image)

        _is_generating = False
        return jsonify({
            "success": True,
            "image": f"data:image/png;base64,{b64_img}",
            "duration": duration,
            "width": image.width,
            "height": image.height
        })

    except InterruptedError:
        _is_generating = False
        logit("[Txt2Img] Generation successfully stopped by user.")
        return jsonify({"cancelled": True, "message": "Generation stopped by user"}), 200
    except Exception as e:
        _is_generating = False
        logit(f"[Txt2Img Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/layer_img2img", methods=["POST"])
def layer_img2img():
    """
    Direct Img2Img on an individual layer:
    Takes Layer 1 or Layer 2 image, applies that layer's prompt and denoise,
    and returns a newly transformed RGBA image for that specific layer!
    """
    global _abort_requested, _is_generating
    _abort_requested = False
    _is_generating = True

    try:
        data = request.json or {}
        layer_target = data.get("layer_target", 1)
        model_name = data.get("model")
        prompt = data.get("prompt", "").strip()
        negative_prompt = data.get("negative_prompt", "").strip()
        steps = int(data.get("steps", 5))
        cfg = float(data.get("cfg", 1.5))
        denoising = float(data.get("denoising", 0.50))
        image_data = data.get("image")
        seed = data.get("seed")

        if not image_data:
            _is_generating = False
            return jsonify({"error": f"No image found in Layer {layer_target} to transform"}), 400

        init_image = base64_to_pil(image_data)

        # Ensure dimensions multiple of 8
        w = (init_image.width // 8) * 8
        h = (init_image.height // 8) * 8
        if init_image.size != (w, h):
            init_image = init_image.resize((w, h), Image.Resampling.LANCZOS)

        pipe = load_pipeline(model_name, pipeline_mode="img2img")

        generator = None
        if seed is not None and str(seed).strip() != "":
            seed_val = int(seed)
            generator = torch.Generator(device=DEVICE).manual_seed(seed_val)
            logit(f"[Img2Img Layer {layer_target}] Fixed Seed: {seed_val}")

        logit(f"[Img2Img Layer {layer_target}] Starting ({init_image.size}, Denoise: {denoising}, Steps: {steps})")
        logit(f"  Prompt: \"{prompt[:65]}...\"")
        start_t = time.time()

        def step_callback(pipe, step_index, timestep, callback_kwargs):
            global _abort_requested
            logit(f"  -> Layer {layer_target} Img2Img Step {step_index + 1}/{steps} complete")
            if _abort_requested:
                pipe._interrupt = True
                raise InterruptedError("Img2Img cancelled by user.")
            return callback_kwargs

        # Pipe expects RGB tensor
        pipe_image = init_image.convert("RGB") if init_image.mode == "RGBA" else init_image

        result_image = pipe(
            prompt=prompt if prompt else "high quality masterpiece coherent detailed photography",
            negative_prompt=negative_prompt if negative_prompt else None,
            image=pipe_image,
            strength=denoising,
            num_inference_steps=steps,
            guidance_scale=cfg,
            generator=generator,
            callback_on_step_end=step_callback
        ).images[0].convert("RGBA")

        duration = round(time.time() - start_t, 2)
        logit(f"[Img2Img Layer {layer_target}] Completed in {duration}s [RGBA]")
        b64_img = pil_to_base64(result_image)

        _is_generating = False
        return jsonify({
            "success": True,
            "layer_target": layer_target,
            "image": f"data:image/png;base64,{b64_img}",
            "duration": duration,
            "width": result_image.width,
            "height": result_image.height
        })

    except InterruptedError:
        _is_generating = False
        logit(f"[Img2Img Layer {layer_target}] Stopped by user.")
        return jsonify({"cancelled": True, "message": "Img2Img stopped by user"}), 200
    except Exception as e:
        _is_generating = False
        logit(f"[Img2Img Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/harmonize_img2img", methods=["POST"])
def harmonize_img2img():
    """Run Img2Image Harmonization with step callbacks and stop button support."""
    global _abort_requested, _is_generating
    _abort_requested = False
    _is_generating = True

    try:
        data = request.json or {}
        model_name = data.get("model")
        prompt = data.get("prompt", "").strip()
        negative_prompt = data.get("negative_prompt", "").strip()
        steps = int(data.get("steps", 5))
        cfg = float(data.get("cfg", 1.5))
        denoising = float(data.get("denoising", 0.35))
        image_data = data.get("image")
        seed = data.get("seed")

        if not image_data:
            _is_generating = False
            return jsonify({"error": "No composite image provided for harmonization"}), 400

        init_image = base64_to_pil(image_data)

        # Dimensions multiple of 8
        w = (init_image.width // 8) * 8
        h = (init_image.height // 8) * 8
        if init_image.size != (w, h):
            init_image = init_image.resize((w, h), Image.Resampling.LANCZOS)

        pipe = load_pipeline(model_name, pipeline_mode="img2img")

        generator = None
        if seed is not None and str(seed).strip() != "":
            seed_val = int(seed)
            generator = torch.Generator(device=DEVICE).manual_seed(seed_val)
            logit(f"[Harmonize] Fixed Seed: {seed_val}")

        logit(f"[Harmonize] Running Img2Img ({init_image.size}, Denoise: {denoising}, Steps: {steps})...")
        start_t = time.time()

        def step_callback(pipe, step_index, timestep, callback_kwargs):
            global _abort_requested
            logit(f"  -> Harmonize Step {step_index + 1}/{steps} complete")
            if _abort_requested:
                pipe._interrupt = True
                raise InterruptedError("Harmonization cancelled by user.")
            return callback_kwargs

        pipe_image = init_image.convert("RGB") if init_image.mode == "RGBA" else init_image

        result_image = pipe(
            prompt=prompt if prompt else "coherent unified scene, seamless lighting and shadows, photorealistic, sharp focus, natural atmosphere, 8k",
            negative_prompt=negative_prompt if negative_prompt else None,
            image=pipe_image,
            strength=denoising,
            num_inference_steps=steps,
            guidance_scale=cfg,
            generator=generator,
            callback_on_step_end=step_callback
        ).images[0].convert("RGBA")

        duration = round(time.time() - start_t, 2)
        logit(f"[Harmonize] Completed in {duration}s [RGBA]")
        b64_img = pil_to_base64(result_image)

        _is_generating = False
        return jsonify({
            "success": True,
            "image": f"data:image/png;base64,{b64_img}",
            "duration": duration,
            "width": result_image.width,
            "height": result_image.height
        })

    except InterruptedError:
        _is_generating = False
        logit("[Harmonize] Harmonization stopped by user.")
        return jsonify({"cancelled": True, "message": "Harmonization stopped by user"}), 200
    except Exception as e:
        _is_generating = False
        logit(f"[Harmonize Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/inpaint", methods=["POST"])
def run_inpaint():
    """
    Dedicated inpainting route: Inpaints into the masked area using
    StableDiffusionInpaintPipeline.
    """
    global _abort_requested, _is_generating
    _abort_requested = False
    _is_generating = True

    try:
        data = request.json or {}
        model_name = data.get("model")
        prompt = data.get("prompt", "").strip()
        negative_prompt = data.get("negative_prompt", "").strip()
        steps = int(data.get("steps", 5))
        cfg = float(data.get("cfg", 1.5))
        image_data = data.get("image")
        mask_data = data.get("mask")
        seed = data.get("seed")

        if not image_data or not mask_data:
            _is_generating = False
            return jsonify({"error": "Image and mask are both required for inpainting"}), 400

        init_image = base64_to_pil(image_data)
        mask_image = base64_to_pil(mask_data).convert("L")

        w = (init_image.width // 8) * 8
        h = (init_image.height // 8) * 8
        init_image = init_image.resize((w, h), Image.Resampling.LANCZOS)
        mask_image = mask_image.resize((w, h), Image.Resampling.NEAREST)

        pipe = load_pipeline(model_name, pipeline_mode="inpaint")

        generator = None
        if seed is not None and str(seed).strip() != "":
            seed_val = int(seed)
            generator = torch.Generator(device=DEVICE).manual_seed(seed_val)
            logit(f"[Inpaint] Fixed Seed: {seed_val}")

        logit(f"[Inpaint] Running inpaint on mask ({init_image.size}, Steps: {steps})...")
        start_t = time.time()

        def step_callback(pipe, step_index, timestep, callback_kwargs):
            global _abort_requested
            logit(f"  -> Inpaint Step {step_index + 1}/{steps} complete")
            if _abort_requested:
                pipe._interrupt = True
                raise InterruptedError("Inpainting cancelled by user.")
            return callback_kwargs

        pipe_init = init_image.convert("RGB") if init_image.mode == "RGBA" else init_image

        result_image = pipe(
            prompt=prompt if prompt else "coherent unified scene, seamless lighting, 8k",
            negative_prompt=negative_prompt if negative_prompt else None,
            image=pipe_init,
            mask_image=mask_image,
            num_inference_steps=steps,
            guidance_scale=cfg,
            generator=generator,
            callback_on_step_end=step_callback
        ).images[0].convert("RGBA")

        duration = round(time.time() - start_t, 2)
        logit(f"[Inpaint] Completed in {duration}s [RGBA]")
        b64_img = pil_to_base64(result_image)

        _is_generating = False
        return jsonify({
            "success": True,
            "image": f"data:image/png;base64,{b64_img}",
            "duration": duration,
            "width": result_image.width,
            "height": result_image.height
        })

    except InterruptedError:
        _is_generating = False
        logit("[Inpaint] Inpainting stopped by user.")
        return jsonify({"cancelled": True, "message": "Inpainting stopped by user"}), 200
    except Exception as e:
        _is_generating = False
        logit(f"[Inpaint Error] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/save_novel_image", methods=["POST"])
def save_novel_image():
    """
    Save composite to ./novel_images/ with sequential 00001.png +
    comprehensive JSON tracking (Prompt A, Prompt B, settings, transforms).
    """
    try:
        data = request.json or {}
        image_data = data.get("image")
        metadata = data.get("metadata", {})

        if not image_data:
            return jsonify({"error": "No image data to save"}), 400

        pil_img = base64_to_pil(image_data)
        filename = get_next_novel_image_filename()
        save_path = NOVEL_IMAGES_DIR / filename

        pil_img.save(str(save_path), format="PNG", quality=95)

        # Full sidecar metadata JSON tracking both prompts and state
        json_path = save_path.with_suffix(".json")
        meta_record = {
            "filename": filename,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "resolution": f"{pil_img.width}x{pil_img.height}",
            "layer1_prompt": metadata.get("layer1_prompt", ""),
            "layer1_neg_prompt": metadata.get("layer1_neg_prompt", ""),
            "layer1_seed": metadata.get("layer1_seed", ""),
            "layer1_denoise": metadata.get("layer1_denoise", 0.50),
            "layer2_prompt": metadata.get("layer2_prompt", ""),
            "layer2_neg_prompt": metadata.get("layer2_neg_prompt", ""),
            "layer2_seed": metadata.get("layer2_seed", ""),
            "layer2_denoise": metadata.get("layer2_denoise", 0.50),
            "harmonize_prompt": metadata.get("harmonize_prompt", ""),
            "harmonize_denoise": metadata.get("harmonize_denoise", 0.35),
            "model": metadata.get("model", ""),
            "top_layer_id": metadata.get("top_layer_id", 2),
            "transforms": metadata.get("transforms", {})
        }
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(meta_record, f, indent=2)

        count = len(list(NOVEL_IMAGES_DIR.glob("*.png")))
        logit(f"💾 Saved {filename} and sidecar {json_path.name} (Total: {count} frames in ./novel_images)")

        return jsonify({
            "success": True,
            "filename": filename,
            "path": str(save_path),
            "total_count": count
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/novel_images", methods=["GET"])
def list_novel_images():
    """List saved images with sidecar JSON tracking for the reel gallery."""
    files = sorted(list(NOVEL_IMAGES_DIR.glob("*.png")) + list(NOVEL_IMAGES_DIR.glob("*.jpg")))
    results = []
    for f in files:
        meta_file = f.with_suffix(".json")
        meta_data = {}
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as jf:
                    meta_data = json.load(jf)
            except Exception:
                pass
        results.append({
            "name": f.name,
            "url": f"/novel_images/{f.name}",
            "size_kb": round(f.stat().st_size / 1024, 1),
            "metadata": meta_data
        })
    return jsonify({"images": results, "count": len(results)})


@app.route("/novel_images/<filename>")
def serve_novel_image(filename):
    return send_from_directory(str(NOVEL_IMAGES_DIR), filename)


@app.route("/api/upload", methods=["POST"])
def upload_image():
    """Handle raw image uploads for Layer 1 or Layer 2. Converts all uploads to RGBA."""
    if "file" not in request.files:
        return jsonify({"error": "No file part in request"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    try:
        raw_img = Image.open(file.stream)
        # Jack's requirement: ALL uploaded images must be converted to RGBA
        img = raw_img.convert("RGBA")
        b64_img = pil_to_base64(img)
        logit(f"📥 Uploaded image: {file.filename} -> Converted to RGBA ({img.width}x{img.height})")
        return jsonify({
            "success": True,
            "image": f"data:image/png;base64,{b64_img}",
            "width": img.width,
            "height": img.height,
            "mode": "RGBA",
            "name": file.filename
        })
    except Exception as e:
        logit(f"Upload error: {str(e)}")
        return jsonify({"error": f"Failed to process image: {str(e)}"}), 500



@app.route("/api/render_text_overlay", methods=["POST"])
def render_text_overlay():
    """Render custom text and optional card frame onto a transparent RGBA PNG canvas."""
    try:
        data = request.json or {}
        width = int(data.get("width", 512))
        height = int(data.get("height", 768))
        text_top = data.get("text_top", "").strip()
        text_bottom = data.get("text_bottom", "").strip()
        text_main = data.get("text_main", "").strip()
        
        # Color & styling
        text_color = data.get("text_color", "#ffe600")
        stroke_color = data.get("stroke_color", "#000000")
        stroke_width = int(data.get("stroke_width", 4))
        font_size = int(data.get("font_size", 38))
        draw_border = bool(data.get("draw_border", False))
        border_color = data.get("border_color", "#ffe600")
        border_width = int(data.get("border_width", 4))

        from PIL import ImageDraw, ImageFont
        img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)

        # Draw outer framing border if enabled
        if draw_border:
            margin = 8
            draw.rectangle([margin, margin, width - margin, height - margin], outline=border_color, width=border_width)
            draw.rectangle([margin + 5, margin + 5, width - margin - 5, height - margin - 5], outline=border_color, width=1)

        # Default font
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()

        def draw_centered_text(txt, y_pos):
            if not txt:
                return
            bbox = draw.textbbox((0, 0), txt, font=font, stroke_width=stroke_width)
            w = bbox[2] - bbox[0]
            x = (width - w) // 2
            draw.text((x, y_pos), txt, fill=text_color, font=font, stroke_width=stroke_width, stroke_fill=stroke_color)

        if text_main:
            # Center or lower-third
            draw_centered_text(text_main, height - 120)
        else:
            if text_top:
                draw_centered_text(text_top, 24)
            if text_bottom:
                draw_centered_text(text_bottom, height - 70)

        buf = BytesIO()
        img.save(buf, format="PNG")
        b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
        return jsonify({"success": True, "image": f"data:image/png;base64,{b64_str}"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/flip_image", methods=["POST"])
def flip_image():
    """Horizontally mirror an image (left-to-right)."""
    try:
        data = request.json or {}
        img_b64 = data.get("image", "")
        if not img_b64:
            return jsonify({"success": False, "error": "No image data provided"}), 400

        pil_img = base64_to_pil(img_b64)
        flipped = ImageOps.mirror(pil_img)
        b64_out = pil_to_base64(flipped)
        logit("[Flip] Image flipped horizontally (left-to-right mirror).")
        return jsonify({"success": True, "image": f"data:image/png;base64,{b64_out}"})
    except Exception as e:
        logit(f"[Flip] Error mirroring image: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    logit(f"=====================================================")
    logit(f"  AI Image Editor v11 (Esperanza Digital Darkroom)")
    logit(f"  Safety Checker Disabled | Zero Blackout False Positives")
    logit(f"  Default LCM Steps: 5 | Default CFG: 1.5")
    logit(f"  Target Canvas: 512x768 (Portrait)")
    logit(f"  Models: {WORKSPACE_DIR / 'models'} (Symlink Active)")
    logit(f"  Tauri-VideoMaker Output: {NOVEL_IMAGES_DIR}")
    logit(f"  CPU Threads: {torch.get_num_threads()} | os.nice(15) Active")
    logit(f"  Open in Browser: http://127.0.0.1:5000")
    logit(f"=====================================================")
    app.run(host="0.0.0.0", port=5000, debug=False)
