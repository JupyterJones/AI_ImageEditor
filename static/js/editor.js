/**
 * AI Image Editor v4 - Esperanza Digital Darkroom
 * Dual Prompts &bull; X/Y Positioning Sliders &bull; Inpainting &bull; Live Log &bull; JSON Tracker
 */

document.addEventListener("DOMContentLoaded", () => {
  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const state = {
    canvasWidth: 512,
    canvasHeight: 768, // Default 512x768 Portrait
    
    // Top layer designation: 2 means Layer 2 is on top; 1 means Layer 1 is on top
    topLayerId: 2,
    
    layers: {
      1: {
        img: null,
        visible: true,
        name: "Layer 1",
        x: 0,
        y: 0,
        scale: 1.0,
        opacity: 1.0,
        maskCanvas: null,
        maskCtx: null,
        history: [],
        historyIndex: -1
      },
      2: {
        img: null,
        visible: true,
        name: "Layer 2",
        x: 0,
        y: 0,
        scale: 1.0,
        opacity: 1.0,
        maskCanvas: null,
        maskCtx: null,
        history: [],
        historyIndex: -1
      }
    },
    
    currentTool: "erase", // 'erase' | 'restore' | 'move'
    brushSize: 45,
    brushFeather: 80,
    brushOpacity: 1.0,
    
    isInteracting: false,
    lastMouseX: 0,
    lastMouseY: 0,
    
    selectedModel: "",
    isGenerating: false
  };

  // Canvas elements
  const mainCanvas = document.getElementById("main-canvas");
  const ctx = mainCanvas.getContext("2d");
  const viewport = document.getElementById("viewport");
  const brushCursor = document.getElementById("brush-cursor");
  const globalAbortBtn = document.getElementById("btn-global-abort");
  const terminalLog = document.getElementById("terminal-log");

  // Set default canvas dimensions
  mainCanvas.width = state.canvasWidth;
  mainCanvas.height = state.canvasHeight;

  // Helper getters
  function getTopLayer() {
    return state.layers[state.topLayerId];
  }

  function getBottomLayer() {
    const bottomId = state.topLayerId === 2 ? 1 : 2;
    return state.layers[bottomId];
  }

  // ==========================================
  // RESOLUTION CHANGE HANDLER
  // ==========================================
  const resSelect = document.getElementById("txt-resolution");
  resSelect.addEventListener("change", (e) => {
    const parts = e.target.value.split("x");
    const newW = parseInt(parts[0]);
    const newH = parseInt(parts[1]);
    
    state.canvasWidth = newW;
    state.canvasHeight = newH;
    mainCanvas.width = newW;
    mainCanvas.height = newH;

    const hudBadge = document.getElementById("hud-res-badge");
    if (hudBadge) hudBadge.innerText = `📐 Target: ${newW} × ${newH}`;

    // Update X/Y slider max ranges to match new canvas
    const sliderX = document.getElementById("slider-pos-x");
    const sliderY = document.getElementById("slider-pos-y");
    if (sliderX) {
      sliderX.min = -newW;
      sliderX.max = newW;
    }
    if (sliderY) {
      sliderY.min = -newH;
      sliderY.max = newH;
    }

    render();
    saveProjectStateDebounced();
  });

  // ==========================================
  // MASK & CANVAS INITIALIZATION
  // ==========================================
  function initMaskCanvas(layer) {
    if (!layer.img) return;
    
    const mask = document.createElement("canvas");
    mask.width = layer.img.width;
    mask.height = layer.img.height;
    const mCtx = mask.getContext("2d");
    
    // Initially fully opaque white (everything visible)
    mCtx.fillStyle = "#ffffff";
    mCtx.fillRect(0, 0, mask.width, mask.height);
    
    layer.maskCanvas = mask;
    layer.maskCtx = mCtx;
    
    layer.history = [];
    layer.historyIndex = -1;
    saveMaskHistory(layer);
  }

  function saveMaskHistory(layer) {
    if (!layer.maskCtx) return;
    if (layer.historyIndex < layer.history.length - 1) {
      layer.history = layer.history.slice(0, layer.historyIndex + 1);
    }
    if (layer.history.length >= 15) {
      layer.history.shift();
    } else {
      layer.historyIndex++;
    }
    const snapshot = layer.maskCtx.getImageData(0, 0, layer.maskCanvas.width, layer.maskCanvas.height);
    layer.history.push(snapshot);
    layer.historyIndex = layer.history.length - 1;
  }

  function undoMask(layer) {
    if (!layer || !layer.maskCtx || layer.historyIndex <= 0) return;
    layer.historyIndex--;
    const snapshot = layer.history[layer.historyIndex];
    layer.maskCtx.putImageData(snapshot, 0, 0);
    render();
  }

  function redoMask(layer) {
    if (!layer || !layer.maskCtx || layer.historyIndex >= layer.history.length - 1) return;
    layer.historyIndex++;
    const snapshot = layer.history[layer.historyIndex];
    layer.maskCtx.putImageData(snapshot, 0, 0);
    render();
  }

  function resetMask(layer) {
    if (!layer || !layer.maskCtx) return;
    layer.maskCtx.globalCompositeOperation = "source-over";
    layer.maskCtx.fillStyle = "#ffffff";
    layer.maskCtx.fillRect(0, 0, layer.maskCanvas.width, layer.maskCanvas.height);
    saveMaskHistory(layer);
    render();
  }

  // ==========================================
  // RENDERING PIPELINE
  // ==========================================
  function render() {
    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    const bottom = getBottomLayer();
    const top = getTopLayer();

    // 1. Render Bottom Layer (Scaled to fill/fit base canvas)
    if (bottom.img && bottom.visible) {
      ctx.save();
      ctx.drawImage(bottom.img, 0, 0, mainCanvas.width, mainCanvas.height);
      ctx.restore();
    }

    // 2. Render Top Layer (Transformed, Scaled, Positioned & Masked)
    if (top.img && top.visible) {
      ctx.save();
      ctx.globalAlpha = top.opacity;

      const offscreen = document.createElement("canvas");
      offscreen.width = top.img.width;
      offscreen.height = top.img.height;
      const oCtx = offscreen.getContext("2d");

      oCtx.drawImage(top.img, 0, 0);

      // Apply the alpha mask with destination-in
      if (top.maskCanvas) {
        oCtx.globalCompositeOperation = "destination-in";
        oCtx.drawImage(top.maskCanvas, 0, 0);
      }

      const scaledW = top.img.width * top.scale;
      const scaledH = top.img.height * top.scale;
      const drawX = top.x;
      const drawY = top.y;

      ctx.drawImage(offscreen, drawX, drawY, scaledW, scaledH);
      ctx.restore();
    }

    syncPositionSliders();
  }

  function syncPositionSliders() {
    const top = getTopLayer();
    const posX = document.getElementById("slider-pos-x");
    const posY = document.getElementById("slider-pos-y");
    const valX = document.getElementById("val-pos-x");
    const valY = document.getElementById("val-pos-y");

    if (posX && Math.round(top.x) !== parseInt(posX.value)) {
      posX.value = Math.round(top.x);
    }
    if (posY && Math.round(top.y) !== parseInt(posY.value)) {
      posY.value = Math.round(top.y);
    }
    if (valX) valX.innerText = `${Math.round(top.x)}px`;
    if (valY) valY.innerText = `${Math.round(top.y)}px`;
  }

  // ==========================================
  // BRUSH ERASING / RESTORING LOGIC
  // ==========================================
  function paintOnMask(canvasX, canvasY) {
    const top = getTopLayer();
    if (!top.img || !top.maskCtx) return;

    const localX = (canvasX - top.x) / top.scale;
    const localY = (canvasY - top.y) / top.scale;
    const localRadius = (state.brushSize / 2) / top.scale;

    if (localRadius <= 0) return;

    const mCtx = top.maskCtx;
    mCtx.save();

    const featherRatio = Math.max(0, Math.min(100, state.brushFeather)) / 100;
    const innerRadius = localRadius * (1 - featherRatio);

    const grad = mCtx.createRadialGradient(
      localX, localY, innerRadius,
      localX, localY, localRadius
    );

    if (state.currentTool === "erase") {
      mCtx.globalCompositeOperation = "destination-out";
      grad.addColorStop(0, `rgba(0, 0, 0, ${state.brushOpacity})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    } else if (state.currentTool === "restore") {
      mCtx.globalCompositeOperation = "source-over";
      grad.addColorStop(0, `rgba(255, 255, 255, ${state.brushOpacity})`);
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    }

    mCtx.fillStyle = grad;
    mCtx.beginPath();
    mCtx.arc(localX, localY, localRadius, 0, Math.PI * 2);
    mCtx.fill();

    mCtx.restore();
    render();
  }

  function interpolateStroke(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const step = Math.max(2, state.brushSize / 8);
    const numSteps = Math.ceil(dist / step);

    for (let i = 0; i <= numSteps; i++) {
      const t = numSteps === 0 ? 0 : i / numSteps;
      const curX = x1 + (x2 - x1) * t;
      const curY = y1 + (y2 - y1) * t;
      paintOnMask(curX, curY);
    }
  }

  // ==========================================
  // MOUSE & CANVAS INTERACTION
  // ==========================================
  function getCanvasCoords(e) {
    const rect = mainCanvas.getBoundingClientRect();
    const scaleX = mainCanvas.width / rect.width;
    const scaleY = mainCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  viewport.addEventListener("mousedown", (e) => {
    state.isInteracting = true;
    const coords = getCanvasCoords(e);
    state.lastMouseX = coords.x;
    state.lastMouseY = coords.y;

    if (state.currentTool === "erase" || state.currentTool === "restore") {
      paintOnMask(coords.x, coords.y);
    }
  });

  window.addEventListener("mousemove", (e) => {
    const rect = viewport.getBoundingClientRect();
    const inside = (
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom
    );

    if (inside && (state.currentTool === "erase" || state.currentTool === "restore")) {
      brushCursor.style.display = "block";
      brushCursor.style.left = `${e.clientX - rect.left}px`;
      brushCursor.style.top = `${e.clientY - rect.top}px`;
      brushCursor.style.width = `${state.brushSize}px`;
      brushCursor.style.height = `${state.brushSize}px`;
      
      const featherPct = state.brushFeather;
      brushCursor.style.background = `radial-gradient(circle, rgba(0,229,255,0.4) ${100 - featherPct}%, rgba(0,229,255,0.05) 100%)`;
    } else {
      brushCursor.style.display = "none";
    }

    if (!state.isInteracting) return;

    const coords = getCanvasCoords(e);

    if (state.currentTool === "erase" || state.currentTool === "restore") {
      interpolateStroke(state.lastMouseX, state.lastMouseY, coords.x, coords.y);
    } else if (state.currentTool === "move") {
      const top = getTopLayer();
      top.x += (coords.x - state.lastMouseX);
      top.y += (coords.y - state.lastMouseY);
      render();
    }

    state.lastMouseX = coords.x;
    state.lastMouseY = coords.y;
  });

  window.addEventListener("mouseup", () => {
    if (state.isInteracting) {
      state.isInteracting = false;
      const top = getTopLayer();
      if (state.currentTool === "erase" || state.currentTool === "restore") {
        saveMaskHistory(top);
      }
      saveProjectStateDebounced();
    }
  });

  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const top = getTopLayer();
    if (!top.img) return;

    const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
    top.scale = Math.max(0.1, Math.min(3.0, top.scale * zoomFactor));

    const scaleSlider = document.getElementById("scale-l2");
    if (scaleSlider) {
      scaleSlider.value = Math.round(top.scale * 100);
      document.getElementById("val-scale-l2").innerText = `${Math.round(top.scale * 100)}%`;
    }
    render();
    saveProjectStateDebounced();
  }, { passive: false });

  // ==========================================
  // POSITION SLIDERS (JACK'S PREFERRED CONTROLS)
  // ==========================================
  const sliderPosX = document.getElementById("slider-pos-x");
  const sliderPosY = document.getElementById("slider-pos-y");

  sliderPosX.addEventListener("input", (e) => {
    const top = getTopLayer();
    top.x = parseInt(e.target.value);
    document.getElementById("val-pos-x").innerText = `${top.x}px`;
    render();
    saveProjectStateDebounced();
  });

  sliderPosY.addEventListener("input", (e) => {
    const top = getTopLayer();
    top.y = parseInt(e.target.value);
    document.getElementById("val-pos-y").innerText = `${top.y}px`;
    render();
    saveProjectStateDebounced();
  });

  document.getElementById("btn-reset-pos-l2").addEventListener("click", () => {
    const top = getTopLayer();
    top.x = 0;
    top.y = 0;
    sliderPosX.value = 0;
    sliderPosY.value = 0;
    document.getElementById("val-pos-x").innerText = "0px";
    document.getElementById("val-pos-y").innerText = "0px";
    render();
    saveProjectStateDebounced();
  });

  // ==========================================
  // LAYER MANAGEMENT & SWAP
  // ==========================================
  function setLayerImage(layerId, imageElement) {
    const layer = state.layers[layerId];
    layer.img = imageElement;
    
    // Auto-fit scale and center initially
    layer.scale = Math.min(mainCanvas.width / imageElement.width, mainCanvas.height / imageElement.height);
    layer.x = (mainCanvas.width - imageElement.width * layer.scale) / 2;
    layer.y = (mainCanvas.height - imageElement.height * layer.scale) / 2;
    
    initMaskCanvas(layer);
    updateLayerUI();
    render();
    saveProjectStateDebounced();
  }

  function swapLayers() {
    state.topLayerId = state.topLayerId === 2 ? 1 : 2;
    updateLayerUI();
    render();
    saveProjectStateDebounced();
  }

  function updateLayerUI() {
    const isL2Top = state.topLayerId === 2;

    const badgeL2 = document.getElementById("badge-l2");
    const badgeL1 = document.getElementById("badge-l1");
    const cardL2 = document.getElementById("card-layer2");
    const cardL1 = document.getElementById("card-layer1");

    if (isL2Top) {
      badgeL2.className = "layer-badge top-badge";
      badgeL2.innerText = "TOP (Foreground)";
      cardL2.classList.add("active-layer");

      badgeL1.className = "layer-badge bottom-badge";
      badgeL1.innerText = "BOTTOM (Base)";
      cardL1.classList.remove("active-layer");
    } else {
      badgeL1.className = "layer-badge top-badge";
      badgeL1.innerText = "TOP (Foreground)";
      cardL1.classList.add("active-layer");

      badgeL2.className = "layer-badge bottom-badge";
      badgeL2.innerText = "BOTTOM (Base)";
      cardL2.classList.remove("active-layer");
    }

    updateThumbnail(1);
    updateThumbnail(2);
  }

  function updateThumbnail(layerId) {
    const layer = state.layers[layerId];
    const thumb = document.getElementById(`thumb-l${layerId}`);
    const empty = document.getElementById(`empty-l${layerId}`);

    if (layer.img) {
      thumb.src = layer.img.src;
      thumb.style.display = "block";
      empty.style.display = "none";
    } else {
      thumb.style.display = "none";
      empty.style.display = "flex";
    }
  }

  // ==========================================
  // HORIZONTAL IMAGE FLIP (LEFT-TO-RIGHT MIRROR)
  // ==========================================
  function flipLayerHorizontal(layerId) {
    const layer = state.layers[layerId];
    if (!layer || !layer.img) {
      alert(`Layer ${layerId} does not have an image yet! Upload or generate an image first.`);
      return;
    }

    const w = layer.img.naturalWidth || layer.img.width;
    const h = layer.img.naturalHeight || layer.img.height;
    if (!w || !h) return;

    // 1. Create offscreen canvas for mirroring
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const oCtx = offscreen.getContext("2d");

    // Mirror horizontally: translate by width and scale(-1, 1)
    oCtx.save();
    oCtx.translate(w, 0);
    oCtx.scale(-1, 1);
    oCtx.drawImage(layer.img, 0, 0);
    oCtx.restore();

    // 2. Mirror mask if present
    if (layer.maskCanvas && layer.maskCtx) {
      const tempMask = document.createElement("canvas");
      tempMask.width = layer.maskCanvas.width;
      tempMask.height = layer.maskCanvas.height;
      const tCtx = tempMask.getContext("2d");
      tCtx.drawImage(layer.maskCanvas, 0, 0);

      layer.maskCtx.clearRect(0, 0, layer.maskCanvas.width, layer.maskCanvas.height);
      layer.maskCtx.save();
      layer.maskCtx.translate(layer.maskCanvas.width, 0);
      layer.maskCtx.scale(-1, 1);
      layer.maskCtx.drawImage(tempMask, 0, 0);
      layer.maskCtx.restore();
      saveMaskHistory(layer);
    }

    // 3. Update layer image src and re-render
    const flippedDataUrl = offscreen.toDataURL("image/png");
    const newImg = new Image();
    newImg.onload = () => {
      layer.img = newImg;
      updateThumbnail(layerId);
      render();
      saveProjectStateDebounced();
      if (terminalLog) {
        terminalLog.innerHTML += `<div class="terminal-line info">[Transform] Layer ${layerId} flipped horizontally (left-to-right mirror).</div>`;
        terminalLog.scrollTop = terminalLog.scrollHeight;
      }
    };
    newImg.src = flippedDataUrl;
  }

  // ==========================================
  // NEW CANVAS & LAYER CLEAR ACTIONS
  // ==========================================
  function clearLayerImage(layerId, skipConfirm = false) {
    const layer = state.layers[layerId];
    if (!layer || !layer.img) return;

    if (!skipConfirm) {
      const ok = confirm(`Clear ${layer.name} image?`);
      if (!ok) return;
    }

    layer.img = null;
    layer.x = 0;
    layer.y = 0;
    layer.scale = 1.0;
    layer.opacity = 1.0;
    layer.maskCanvas = null;
    layer.maskCtx = null;
    layer.history = [];
    layer.historyIndex = -1;

    updateThumbnail(layerId);
    render();
    saveProjectStateDebounced();

    if (terminalLog) {
      terminalLog.innerHTML += `<div class="terminal-line info">[Layer] ${layer.name} cleared.</div>`;
      terminalLog.scrollTop = terminalLog.scrollHeight;
    }
  }

  function clearCanvasAndNewProject(skipConfirm = false) {
    const hasImage = state.layers[1].img || state.layers[2].img;
    if (hasImage && !skipConfirm) {
      const ok = confirm("Start a new image? This will clear active layers and masks from the canvas.");
      if (!ok) return;
    }

    // 1. Reset Layer 1
    state.layers[1].img = null;
    state.layers[1].visible = true;
    state.layers[1].x = 0;
    state.layers[1].y = 0;
    state.layers[1].scale = 1.0;
    state.layers[1].opacity = 1.0;
    state.layers[1].maskCanvas = null;
    state.layers[1].maskCtx = null;
    state.layers[1].history = [];
    state.layers[1].historyIndex = -1;

    // 2. Reset Layer 2
    state.layers[2].img = null;
    state.layers[2].visible = true;
    state.layers[2].x = 0;
    state.layers[2].y = 0;
    state.layers[2].scale = 1.0;
    state.layers[2].opacity = 1.0;
    state.layers[2].maskCanvas = null;
    state.layers[2].maskCtx = null;
    state.layers[2].history = [];
    state.layers[2].historyIndex = -1;

    state.topLayerId = 2;

    // Reset sliders
    const posX = document.getElementById("slider-pos-x");
    const posY = document.getElementById("slider-pos-y");
    const scaleL2 = document.getElementById("scale-l2");
    const opacityL2 = document.getElementById("opacity-l2");
    if (posX) posX.value = 0;
    if (posY) posY.value = 0;
    if (scaleL2) scaleL2.value = 100;
    if (opacityL2) opacityL2.value = 100;
    if (document.getElementById("val-pos-x")) document.getElementById("val-pos-x").innerText = "0px";
    if (document.getElementById("val-pos-y")) document.getElementById("val-pos-y").innerText = "0px";
    if (document.getElementById("val-scale-l2")) document.getElementById("val-scale-l2").innerText = "100%";
    if (document.getElementById("val-opacity-l2")) document.getElementById("val-opacity-l2").innerText = "100%";

    updateThumbnail(1);
    updateThumbnail(2);
    updateLayerUI();

    ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    saveProjectStateDebounced();

    if (terminalLog) {
      terminalLog.innerHTML += `<div class="terminal-line success">[New Canvas] Layers cleared. Ready to start and create another image!</div>`;
      terminalLog.scrollTop = terminalLog.scrollHeight;
    }
  }

  // ==========================================
  // EXPORT & FLATTEN ACTIONS
  // ==========================================
  function getFlattenedImageData() {
    return mainCanvas.toDataURL("image/png");
  }

  function getInpaintMaskData() {
    const top = getTopLayer();
    if (!top.maskCanvas) return null;

    // Create binary/grayscale inpaint mask where erased area is white (255)
    const maskOut = document.createElement("canvas");
    maskOut.width = mainCanvas.width;
    maskOut.height = mainCanvas.height;
    const mCtx = maskOut.getContext("2d");

    // Default black (unmasked)
    mCtx.fillStyle = "#000000";
    mCtx.fillRect(0, 0, maskOut.width, maskOut.height);

    // Draw top mask transformed
    const offscreen = document.createElement("canvas");
    offscreen.width = top.img.width;
    offscreen.height = top.img.height;
    const oCtx = offscreen.getContext("2d");
    oCtx.drawImage(top.maskCanvas, 0, 0);

    // Invert: areas erased in maskCanvas become white in maskOut
    mCtx.save();
    mCtx.drawImage(offscreen, top.x, top.y, top.img.width * top.scale, top.img.height * top.scale);
    mCtx.restore();

    return maskOut.toDataURL("image/png");
  }

  async function saveToNovelImages() {
    const dataUrl = getFlattenedImageData();
    const btn = document.getElementById("btn-save-novel");
    const originalText = btn.innerHTML;
    btn.innerHTML = "<span>💾 Saving frame & JSON...</span>";

    const top = getTopLayer();
    const metadata = {
      layer1_prompt: document.getElementById("prompt-l1").value.trim(),
      layer1_neg_prompt: document.getElementById("neg-prompt-l1").value.trim(),
      layer1_seed: document.getElementById("seed-l1").value,
      layer2_prompt: document.getElementById("prompt-l2").value.trim(),
      layer2_neg_prompt: document.getElementById("neg-prompt-l2").value.trim(),
      layer2_seed: document.getElementById("seed-l2").value,
      harmonize_prompt: document.getElementById("prompt-harm").value.trim(),
      harmonize_denoise: parseFloat(document.getElementById("harm-denoise").value),
      model: document.getElementById("checkpoint-select").value,
      top_layer_id: state.topLayerId,
      transforms: {
        scale: top.scale,
        x: top.x,
        y: top.y,
        opacity: top.opacity
      }
    };

    try {
      const res = await fetch("/api/save_novel_image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          metadata: metadata
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Saved ${data.filename} and sidecar JSON to ./novel_images/!\nTotal ready for Tauri-VideoMaker: ${data.total_count}`);
        loadNovelImagesReel();
        loadSystemStatus();
      } else {
        alert(`Save failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error saving image: ${err.message}`);
    } finally {
      btn.innerHTML = originalText;
    }
  }

  function flattenToLayer(targetLayerId) {
    const dataUrl = getFlattenedImageData();
    const newImg = new Image();
    newImg.onload = () => {
      setLayerImage(targetLayerId, newImg);
    };
    newImg.src = dataUrl;
  }

  // ==========================================
  // PROJECT STATE (JSON TRACKING)
  // ==========================================
  let saveTimer = null;
  function saveProjectStateDebounced() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const top = getTopLayer();
      const payload = {
        prompt_l1: document.getElementById("prompt-l1").value,
        neg_prompt_l1: document.getElementById("neg-prompt-l1").value,
        seed_l1: document.getElementById("seed-l1").value,
        prompt_l2: document.getElementById("prompt-l2").value,
        neg_prompt_l2: document.getElementById("neg-prompt-l2").value,
        seed_l2: document.getElementById("seed-l2").value,
        prompt_harm: document.getElementById("prompt-harm").value,
        denoise_harm: document.getElementById("harm-denoise").value,
        denoise_l1: document.getElementById("denoise-l1") ? document.getElementById("denoise-l1").value : "0.50",
        denoise_l2: document.getElementById("denoise-l2") ? document.getElementById("denoise-l2").value : "0.50",
        steps: document.getElementById("txt-steps").value,
        cfg: document.getElementById("txt-cfg").value,
        resolution: document.getElementById("txt-resolution").value,
        model: document.getElementById("checkpoint-select").value,
        top_layer_id: state.topLayerId,
        transforms: {
          scale: top.scale,
          x: top.x,
          y: top.y,
          opacity: top.opacity
        }
      };

      try {
        await fetch("/api/project_state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.warn("Failed to auto-save project state:", e);
      }
    }, 600);
  }

  async function loadProjectState() {
    try {
      const res = await fetch("/api/project_state");
      const data = await res.json();
      if (data.exists && data.state) {
        const s = data.state;
        if (s.prompt_l1) document.getElementById("prompt-l1").value = s.prompt_l1;
        if (s.neg_prompt_l1) document.getElementById("neg-prompt-l1").value = s.neg_prompt_l1;
        if (s.seed_l1) document.getElementById("seed-l1").value = s.seed_l1;
        if (s.prompt_l2) document.getElementById("prompt-l2").value = s.prompt_l2;
        if (s.neg_prompt_l2) document.getElementById("neg-prompt-l2").value = s.neg_prompt_l2;
        if (s.seed_l2) document.getElementById("seed-l2").value = s.seed_l2;
        if (s.prompt_harm) document.getElementById("prompt-harm").value = s.prompt_harm;
        if (s.denoise_harm) {
          document.getElementById("harm-denoise").value = s.denoise_harm;
          document.getElementById("harm-denoise-val").innerText = s.denoise_harm;
        }
        if (s.denoise_l1 && document.getElementById("denoise-l1")) {
          document.getElementById("denoise-l1").value = s.denoise_l1;
          document.getElementById("val-denoise-l1").innerText = parseFloat(s.denoise_l1).toFixed(2);
        }
        if (s.denoise_l2 && document.getElementById("denoise-l2")) {
          document.getElementById("denoise-l2").value = s.denoise_l2;
          document.getElementById("val-denoise-l2").innerText = parseFloat(s.denoise_l2).toFixed(2);
        }
        if (s.steps) {
          document.getElementById("txt-steps").value = s.steps;
          document.getElementById("txt-steps-val").innerText = s.steps;
        }
        if (s.cfg) {
          document.getElementById("txt-cfg").value = s.cfg;
          document.getElementById("txt-cfg-val").innerText = s.cfg;
        }
        // Target resolution is 512x768 (Portrait)
        const targetRes = (s.resolution && s.resolution !== "512x512") ? s.resolution : "512x768";
        document.getElementById("txt-resolution").value = targetRes;
        const p = targetRes.split("x");
        state.canvasWidth = parseInt(p[0]);
        state.canvasHeight = parseInt(p[1]);
        mainCanvas.width = state.canvasWidth;
        mainCanvas.height = state.canvasHeight;
        const sliderX = document.getElementById("slider-pos-x");
        const sliderY = document.getElementById("slider-pos-y");
        if (sliderX) { sliderX.min = -state.canvasWidth; sliderX.max = state.canvasWidth; }
        if (sliderY) { sliderY.min = -state.canvasHeight; sliderY.max = state.canvasHeight; }
        const hudBadge = document.getElementById("hud-res-badge");
        if (hudBadge) hudBadge.innerText = `📐 Target: ${state.canvasWidth} × ${state.canvasHeight}`;
      }
    } catch (e) {
      console.warn("Failed to load project state:", e);
    }
  }

  // ==========================================
  // LIVE TERMINAL LOGS & STOP CONTROLLER
  // ==========================================
  async function fetchLogs() {
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      
      if (data.logs && data.logs.length > 0) {
        terminalLog.innerHTML = "";
        data.logs.forEach(line => {
          const div = document.createElement("div");
          div.className = "terminal-line";
          if (line.includes("Error") || line.includes("failed")) div.classList.add("error");
          else if (line.includes("Saved") || line.includes("complete") || line.includes("generated") || line.includes("Completed")) div.classList.add("success");
          else div.classList.add("info");
          div.innerText = line;
          terminalLog.appendChild(div);
        });
        terminalLog.scrollTop = terminalLog.scrollHeight;
      }

      setGeneratingState(data.is_generating);
    } catch (e) {
      console.error("Log fetch error:", e);
    }
  }

  function setGeneratingState(generating) {
    state.isGenerating = generating;
    if (generating) {
      globalAbortBtn.style.display = "flex";
      document.getElementById("terminal-live-dot").innerText = "● Generating...";
      document.getElementById("terminal-live-dot").style.color = "#f43f5e";
    } else {
      globalAbortBtn.style.display = "none";
      document.getElementById("terminal-live-dot").innerText = "● Ready";
      document.getElementById("terminal-live-dot").style.color = "#10b981";
    }
  }

  async function abortGeneration() {
    globalAbortBtn.innerHTML = "<span>Halting diffusion...</span>";
    try {
      await fetch("/api/cancel", { method: "POST" });
    } catch (e) {
      console.error("Cancel failed:", e);
    } finally {
      setTimeout(() => {
        globalAbortBtn.innerHTML = '<span class="pulse-dot"></span> 🛑 STOP GENERATION';
        fetchLogs();
      }, 500);
    }
  }

  globalAbortBtn.addEventListener("click", abortGeneration);

  document.getElementById("btn-clear-terminal").addEventListener("click", () => {
    terminalLog.innerHTML = '<div class="terminal-line info">[Console cleared]</div>';
  });

  setInterval(fetchLogs, 1000);

  // ==========================================
  // API INTEGRATIONS & GENERATION
  // ==========================================
  async function loadModels() {
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      const select = document.getElementById("checkpoint-select");
      select.innerHTML = "";

      data.checkpoints.forEach(cp => {
        const opt = document.createElement("option");
        opt.value = cp;
        opt.innerText = cp;
        if (cp === data.default_checkpoint) opt.selected = true;
        select.appendChild(opt);
      });

      state.selectedModel = select.value;
      document.getElementById("model-display").innerText = select.value || "No model found";
    } catch (err) {
      console.error("Failed to load models:", err);
    }
  }

  async function loadSystemStatus() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      document.getElementById("reel-counter").innerText = `${data.novel_images_count} frames in ./novel_images`;
      document.getElementById("threads-select").value = data.threads;
    } catch (err) {
      console.error("Failed to load status:", err);
    }
  }

  async function loadNovelImagesReel() {
    try {
      const res = await fetch("/api/novel_images");
      const data = await res.json();
      const strip = document.getElementById("reel-strip");
      strip.innerHTML = "";

      data.images.forEach(img => {
        const item = document.createElement("div");
        item.className = "reel-item";
        item.title = `Click to load ${img.name} into Layer 1\nPrompt: ${img.metadata?.layer1_prompt || 'N/A'}`;
        item.innerHTML = `
          <img src="${img.url}" alt="${img.name}">
          <span class="reel-label">${img.name}</span>
        `;
        item.addEventListener("click", () => {
          const loadImg = new Image();
          loadImg.onload = () => setLayerImage(1, loadImg);
          loadImg.src = img.url;

          if (img.metadata) {
            if (img.metadata.layer1_prompt) document.getElementById("prompt-l1").value = img.metadata.layer1_prompt;
            if (img.metadata.layer2_prompt) document.getElementById("prompt-l2").value = img.metadata.layer2_prompt;
            if (img.metadata.harmonize_prompt) document.getElementById("prompt-harm").value = img.metadata.harmonize_prompt;
          }
        });
        strip.appendChild(item);
      });
    } catch (err) {
      console.error("Failed to load reel:", err);
    }
  }

  async function runTxt2Img(targetLayerId) {
    const isL1 = targetLayerId === 1;
    const promptInput = isL1 ? document.getElementById("prompt-l1") : document.getElementById("prompt-l2");
    const negPromptInput = isL1 ? document.getElementById("neg-prompt-l1") : document.getElementById("neg-prompt-l2");
    const seedInput = isL1 ? document.getElementById("seed-l1") : document.getElementById("seed-l2");

    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert(`Please enter a prompt for Layer ${targetLayerId}.`);
      return;
    }

    const model = document.getElementById("checkpoint-select").value;
    const negPrompt = negPromptInput.value.trim();
    const resVal = document.getElementById("txt-resolution").value.split("x");
    const width = parseInt(resVal[0]);
    const height = parseInt(resVal[1]);
    const steps = parseInt(document.getElementById("txt-steps").value);
    const cfg = parseFloat(document.getElementById("txt-cfg").value);
    const seed = seedInput.value;

    setGeneratingState(true);
    fetchLogs();

    try {
      const res = await fetch("/api/generate_txt2img", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          negative_prompt: negPrompt,
          layer_target: targetLayerId,
          width,
          height,
          steps,
          cfg,
          seed: seed ? parseInt(seed) : null
        })
      });

      const data = await res.json();
      if (data.success) {
        const generatedImg = new Image();
        generatedImg.onload = () => {
          setLayerImage(targetLayerId, generatedImg);
        };
        generatedImg.src = data.image;
      } else if (data.cancelled) {
        console.log("Generation cancelled.");
      } else {
        alert(`Generation failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Generation error: ${err.message}`);
    } finally {
      setGeneratingState(false);
      fetchLogs();
      saveProjectStateDebounced();
    }
  }

  async function runHarmonize() {
    const model = document.getElementById("checkpoint-select").value;
    const prompt = document.getElementById("prompt-harm").value.trim();
    const denoise = parseFloat(document.getElementById("harm-denoise").value);
    const steps = parseInt(document.getElementById("txt-steps").value);
    const cfg = parseFloat(document.getElementById("txt-cfg").value);
    const compositeData = getFlattenedImageData();

    setGeneratingState(true);
    fetchLogs();

    try {
      const res = await fetch("/api/harmonize_img2img", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          denoising: denoise,
          steps,
          cfg,
          image: compositeData
        })
      });

      const data = await res.json();
      if (data.success) {
        const harmonizedImg = new Image();
        harmonizedImg.onload = () => {
          setLayerImage(1, harmonizedImg);
        };
        harmonizedImg.src = data.image;
      } else if (data.cancelled) {
        console.log("Harmonization was cancelled.");
      } else {
        alert(`Harmonization failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Harmonization error: ${err.message}`);
    } finally {
      setGeneratingState(false);
      fetchLogs();
      saveProjectStateDebounced();
    }
  }

  async function runInpaint() {
    const model = document.getElementById("checkpoint-select").value;
    const prompt = document.getElementById("prompt-harm").value.trim();
    const steps = parseInt(document.getElementById("txt-steps").value);
    const cfg = parseFloat(document.getElementById("txt-cfg").value);
    const compositeData = getFlattenedImageData();
    const maskData = getInpaintMaskData();

    if (!maskData) {
      alert("No feathered mask found to inpaint. Erase part of the top image first!");
      return;
    }

    setGeneratingState(true);
    fetchLogs();

    try {
      const res = await fetch("/api/inpaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          steps,
          cfg,
          image: compositeData,
          mask: maskData
        })
      });

      const data = await res.json();
      if (data.success) {
        const inpaintedImg = new Image();
        inpaintedImg.onload = () => {
          setLayerImage(1, inpaintedImg);
        };
        inpaintedImg.src = data.image;
      } else if (data.cancelled) {
        console.log("Inpaint cancelled.");
      } else {
        alert(`Inpainting failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Inpainting error: ${err.message}`);
    } finally {
      setGeneratingState(false);
      fetchLogs();
      saveProjectStateDebounced();
    }
  }

  async function handleFileUpload(file, targetLayerId) {
    const formData = new FormData();
    formData.append("file", file);

    terminalLog.innerHTML += `<div class="terminal-line info">[Upload] Sending ${file.name} to server for RGBA conversion...</div>`;
    terminalLog.scrollTop = terminalLog.scrollHeight;

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const uploadedImg = new Image();
        uploadedImg.onload = () => {
          setLayerImage(targetLayerId, uploadedImg);
        };
        uploadedImg.src = data.image;
        terminalLog.innerHTML += `<div class="terminal-line success">[Upload Complete] Layer ${targetLayerId} loaded as RGBA (${data.width}x${data.height})</div>`;
        terminalLog.scrollTop = terminalLog.scrollHeight;
      } else {
        alert(`Upload error: ${data.error}`);
      }
    } catch (err) {
      alert(`Upload failed: ${err.message}`);
    }
  }

  async function runLayerImg2Img(targetLayerId) {
    const layer = state.layers[targetLayerId];
    if (!layer.img) {
      alert(`Layer ${targetLayerId} has no image yet! Please upload an image or generate one with Txt2Img first.`);
      return;
    }

    const isL1 = targetLayerId === 1;
    const promptInput = isL1 ? document.getElementById("prompt-l1") : document.getElementById("prompt-l2");
    const negPromptInput = isL1 ? document.getElementById("neg-prompt-l1") : document.getElementById("neg-prompt-l2");
    const seedInput = isL1 ? document.getElementById("seed-l1") : document.getElementById("seed-l2");
    const denoiseInput = isL1 ? document.getElementById("denoise-l1") : document.getElementById("denoise-l2");

    const prompt = promptInput.value.trim();
    if (!prompt) {
      alert(`Please enter a prompt for Layer ${targetLayerId} Img2Img.`);
      return;
    }

    let layerDataUrl = layer.img.src;
    if (!layerDataUrl.startsWith("data:image")) {
      const scratch = document.createElement("canvas");
      scratch.width = layer.img.width;
      scratch.height = layer.img.height;
      const sCtx = scratch.getContext("2d");
      sCtx.drawImage(layer.img, 0, 0);
      layerDataUrl = scratch.toDataURL("image/png");
    }

    const model = document.getElementById("checkpoint-select").value;
    const negPrompt = negPromptInput.value.trim();
    const steps = parseInt(document.getElementById("txt-steps").value);
    const cfg = parseFloat(document.getElementById("txt-cfg").value);
    const denoise = parseFloat(denoiseInput.value);
    const seed = seedInput.value;

    setGeneratingState(true);
    fetchLogs();

    try {
      const res = await fetch("/api/layer_img2img", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          negative_prompt: negPrompt,
          layer_target: targetLayerId,
          denoising: denoise,
          steps,
          cfg,
          seed: seed ? parseInt(seed) : null,
          image: layerDataUrl
        })
      });

      const data = await res.json();
      if (data.success) {
        const transformedImg = new Image();
        transformedImg.onload = () => {
          setLayerImage(targetLayerId, transformedImg);
        };
        transformedImg.src = data.image;
      } else if (data.cancelled) {
        console.log("Img2Img cancelled.");
      } else {
        alert(`Img2Img failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Img2Img error: ${err.message}`);
    } finally {
      setGeneratingState(false);
      fetchLogs();
      saveProjectStateDebounced();
    }
  }

  // ==========================================
  // EVENT LISTENERS & WIRING
  // ==========================================
  const toolEraseBtn = document.getElementById("tool-erase");
  const toolRestoreBtn = document.getElementById("tool-restore");
  const toolMoveBtn = document.getElementById("tool-move");

  function setTool(toolName) {
    state.currentTool = toolName;
    [toolEraseBtn, toolRestoreBtn, toolMoveBtn].forEach(b => b.classList.remove("active"));
    if (toolName === "erase") toolEraseBtn.classList.add("active");
    if (toolName === "restore") toolRestoreBtn.classList.add("active");
    if (toolName === "move") toolMoveBtn.classList.add("active");
  }

  toolEraseBtn.addEventListener("click", () => setTool("erase"));
  toolRestoreBtn.addEventListener("click", () => setTool("restore"));
  toolMoveBtn.addEventListener("click", () => setTool("move"));

  document.getElementById("slider-brush-size").addEventListener("input", (e) => {
    state.brushSize = parseInt(e.target.value);
    document.getElementById("val-brush-size").innerText = `${state.brushSize}px`;
  });

  document.getElementById("slider-brush-feather").addEventListener("input", (e) => {
    state.brushFeather = parseInt(e.target.value);
    document.getElementById("val-brush-feather").innerText = `${state.brushFeather}%`;
  });

  document.getElementById("slider-brush-opacity").addEventListener("input", (e) => {
    state.brushOpacity = parseInt(e.target.value) / 100;
    document.getElementById("val-brush-opacity").innerText = `${e.target.value}%`;
  });

  document.getElementById("btn-undo").addEventListener("click", () => undoMask(getTopLayer()));
  document.getElementById("btn-redo").addEventListener("click", () => redoMask(getTopLayer()));
  document.getElementById("btn-clear-mask").addEventListener("click", () => resetMask(getTopLayer()));

  document.getElementById("btn-hud-swap").addEventListener("click", swapLayers);
  document.getElementById("btn-swap-layers").addEventListener("click", swapLayers);

  document.getElementById("btn-save-novel").addEventListener("click", saveToNovelImages);
  document.getElementById("btn-flatten-to-l1").addEventListener("click", () => flattenToLayer(1));
  document.getElementById("btn-flatten-to-l2").addEventListener("click", () => flattenToLayer(2));

  document.getElementById("btn-copy-l1-to-l2").addEventListener("click", () => {
    document.getElementById("prompt-l2").value = document.getElementById("prompt-l1").value;
    saveProjectStateDebounced();
  });

  document.getElementById("btn-copy-l2-to-l1").addEventListener("click", () => {
    document.getElementById("prompt-l1").value = document.getElementById("prompt-l2").value;
    saveProjectStateDebounced();
  });

  document.getElementById("btn-gen-l1").addEventListener("click", () => runTxt2Img(1));
  document.getElementById("btn-gen-l2").addEventListener("click", () => runTxt2Img(2));
  document.getElementById("btn-img2img-l1").addEventListener("click", () => runLayerImg2Img(1));
  document.getElementById("btn-img2img-l2").addEventListener("click", () => runLayerImg2Img(2));
  document.getElementById("btn-run-harmonize").addEventListener("click", runHarmonize);
  document.getElementById("btn-run-inpaint").addEventListener("click", runInpaint);

  document.getElementById("denoise-l1").addEventListener("input", (e) => {
    document.getElementById("val-denoise-l1").innerText = parseFloat(e.target.value).toFixed(2);
    saveProjectStateDebounced();
  });
  document.getElementById("denoise-l2").addEventListener("input", (e) => {
    document.getElementById("val-denoise-l2").innerText = parseFloat(e.target.value).toFixed(2);
    saveProjectStateDebounced();
  });

  // Direct upload triggers for Layer 1 & Layer 2
  const hubFileL1 = document.getElementById("hub-file-l1");
  const hubFileL2 = document.getElementById("hub-file-l2");

  if (hubFileL1) {
    hubFileL1.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0], 1);
    });
  }
  if (hubFileL2) {
    hubFileL2.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0], 2);
    });
  }

  // Header upload pills
  const headerUploadL1 = document.getElementById("btn-header-upload-l1");
  const headerUploadL2 = document.getElementById("btn-header-upload-l2");
  if (headerUploadL1 && hubFileL1) headerUploadL1.addEventListener("click", () => hubFileL1.click());
  if (headerUploadL2 && hubFileL2) headerUploadL2.addEventListener("click", () => hubFileL2.click());

  // Hub upload buttons
  const hubUploadL1 = document.getElementById("btn-hub-upload-l1");
  const hubUploadL2 = document.getElementById("btn-hub-upload-l2");
  if (hubUploadL1 && hubFileL1) hubUploadL1.addEventListener("click", () => hubFileL1.click());
  if (hubUploadL2 && hubFileL2) hubUploadL2.addEventListener("click", () => hubFileL2.click());

  // Card upload buttons
  const cardUploadL1 = document.getElementById("btn-card-upload-l1");
  const cardUploadL2 = document.getElementById("btn-card-upload-l2");
  if (cardUploadL1 && hubFileL1) cardUploadL1.addEventListener("click", () => hubFileL1.click());
  if (cardUploadL2 && hubFileL2) cardUploadL2.addEventListener("click", () => hubFileL2.click());

  ["prompt-l1", "neg-prompt-l1", "seed-l1", "prompt-l2", "neg-prompt-l2", "seed-l2", "prompt-harm"].forEach(id => {
    document.getElementById(id).addEventListener("input", saveProjectStateDebounced);
  });

  const scaleL2 = document.getElementById("scale-l2");
  scaleL2.addEventListener("input", (e) => {
    const top = getTopLayer();
    top.scale = parseInt(e.target.value) / 100;
    document.getElementById("val-scale-l2").innerText = `${e.target.value}%`;
    render();
    saveProjectStateDebounced();
  });

  const opacityL2 = document.getElementById("opacity-l2");
  opacityL2.addEventListener("input", (e) => {
    const top = getTopLayer();
    top.opacity = parseInt(e.target.value) / 100;
    document.getElementById("val-opacity-l2").innerText = `${e.target.value}%`;
    render();
    saveProjectStateDebounced();
  });

  document.getElementById("btn-fit-canvas-l2").addEventListener("click", () => {
    const top = getTopLayer();
    if (top.img) {
      top.scale = Math.min(mainCanvas.width / top.img.width, mainCanvas.height / top.img.height);
      top.x = (mainCanvas.width - top.img.width * top.scale) / 2;
      top.y = (mainCanvas.height - top.img.height * top.scale) / 2;
      scaleL2.value = Math.round(top.scale * 100);
      document.getElementById("val-scale-l2").innerText = `${scaleL2.value}%`;
      render();
      saveProjectStateDebounced();
    }
  });

  document.getElementById("vis-l1").addEventListener("click", (e) => {
    state.layers[1].visible = !state.layers[1].visible;
    e.target.innerText = state.layers[1].visible ? "👁️" : "🚫";
    render();
  });

  document.getElementById("vis-l2").addEventListener("click", (e) => {
    state.layers[2].visible = !state.layers[2].visible;
    e.target.innerText = state.layers[2].visible ? "👁️" : "🚫";
    render();
  });

  document.getElementById("upload-l1").addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0], 1);
  });

  document.getElementById("upload-l2").addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleFileUpload(e.target.files[0], 2);
  });

  // Layer 1 & Layer 2 Horizontal Flip Buttons
  const btnFlipL1 = document.getElementById("btn-flip-l1");
  if (btnFlipL1) btnFlipL1.addEventListener("click", () => flipLayerHorizontal(1));

  const btnFlipPromptL1 = document.getElementById("btn-flip-prompt-l1");
  if (btnFlipPromptL1) btnFlipPromptL1.addEventListener("click", () => flipLayerHorizontal(1));

  const btnFlipL2 = document.getElementById("btn-flip-l2");
  if (btnFlipL2) btnFlipL2.addEventListener("click", () => flipLayerHorizontal(2));

  const btnFlipCardL2 = document.getElementById("btn-flip-card-l2");
  if (btnFlipCardL2) btnFlipCardL2.addEventListener("click", () => flipLayerHorizontal(2));

  const btnFlipPromptL2 = document.getElementById("btn-flip-prompt-l2");
  if (btnFlipPromptL2) btnFlipPromptL2.addEventListener("click", () => flipLayerHorizontal(2));

  // New Canvas / Clear Project buttons
  const btnHeaderNewCanvas = document.getElementById("btn-header-new-canvas");
  if (btnHeaderNewCanvas) btnHeaderNewCanvas.addEventListener("click", () => clearCanvasAndNewProject());

  const btnNewCanvasHud = document.getElementById("btn-new-canvas");
  if (btnNewCanvasHud) btnNewCanvasHud.addEventListener("click", () => clearCanvasAndNewProject());

  const btnNewCanvasBottom = document.getElementById("btn-new-canvas-bottom");
  if (btnNewCanvasBottom) btnNewCanvasBottom.addEventListener("click", () => clearCanvasAndNewProject());

  // Individual Layer Clear buttons
  const btnClearL1 = document.getElementById("btn-clear-layer-1");
  if (btnClearL1) btnClearL1.addEventListener("click", () => clearLayerImage(1));

  const btnClearL2 = document.getElementById("btn-clear-layer-2");
  if (btnClearL2) btnClearL2.addEventListener("click", () => clearLayerImage(2));

  viewport.addEventListener("dragover", (e) => e.preventDefault());
  viewport.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0], state.topLayerId);
    }
  });

  document.getElementById("txt-steps").addEventListener("input", e => {
    document.getElementById("txt-steps-val").innerText = e.target.value;
    saveProjectStateDebounced();
  });
  document.getElementById("txt-cfg").addEventListener("input", e => {
    document.getElementById("txt-cfg-val").innerText = e.target.value;
    saveProjectStateDebounced();
  });
  document.getElementById("harm-denoise").addEventListener("input", e => {
    document.getElementById("harm-denoise-val").innerText = e.target.value;
    saveProjectStateDebounced();
  });

  document.querySelectorAll(".quick-presets .btn-micro").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.denoise;
      document.getElementById("harm-denoise").value = val;
      document.getElementById("harm-denoise-val").innerText = val;
      saveProjectStateDebounced();
    });
  });

  document.getElementById("threads-select").addEventListener("change", async (e) => {
    const val = parseInt(e.target.value);
    await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threads: val })
    });
  });

  document.getElementById("btn-refresh-reel").addEventListener("click", loadNovelImagesReel);

  // =========================================================================
  // CAPTION & TRANSPARENT TEXT OVERLAY STUDIO (v7)
  // =========================================================================
  const captionStudioToggle = document.getElementById("caption-studio-toggle");
  const captionStudioBody = document.getElementById("caption-studio-body");
  const btnToggleCaption = document.getElementById("btn-toggle-caption-studio");
  
  if (captionStudioToggle && captionStudioBody) {
    captionStudioToggle.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      captionStudioBody.classList.toggle("collapsed");
      btnToggleCaption.innerText = captionStudioBody.classList.contains("collapsed") ? "Expand ▾" : "Collapse ▴";
    });
  }

  const captionFontSizeInput = document.getElementById("caption-font-size");
  if (captionFontSizeInput) {
    captionFontSizeInput.addEventListener("input", (e) => {
      document.getElementById("val-caption-font-size").innerText = e.target.value;
    });
  }

  const captionStrokeWidthInput = document.getElementById("caption-stroke-width");
  if (captionStrokeWidthInput) {
    captionStrokeWidthInput.addEventListener("input", (e) => {
      document.getElementById("val-caption-stroke-width").innerText = e.target.value;
    });
  }

  const captionFillColorInput = document.getElementById("caption-fill-color");
  if (captionFillColorInput) {
    captionFillColorInput.addEventListener("input", (e) => {
      document.getElementById("lbl-fill-color").innerText = e.target.value.toUpperCase();
    });
  }

  const captionStrokeColorInput = document.getElementById("caption-stroke-color");
  if (captionStrokeColorInput) {
    captionStrokeColorInput.addEventListener("input", (e) => {
      document.getElementById("lbl-stroke-color").innerText = e.target.value.toUpperCase();
    });
  }

  const btnClearCaption = document.getElementById("btn-clear-caption");
  if (btnClearCaption) {
    btnClearCaption.addEventListener("click", () => {
      document.getElementById("caption-text-main").value = "";
      document.getElementById("caption-text-top").value = "";
    });
  }

  function generateCaptionOverlayCanvas() {
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.width = state.width || 512;
    overlayCanvas.height = state.height || 768;
    const ctx = overlayCanvas.getContext("2d");

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const textMain = (document.getElementById("caption-text-main")?.value || "").trim();
    const textTop = (document.getElementById("caption-text-top")?.value || "").trim();
    const preset = document.getElementById("caption-preset")?.value || "lower_third";
    const fontFamily = document.getElementById("caption-font-family")?.value || "Impact, sans-serif";
    const fontSize = parseInt(document.getElementById("caption-font-size")?.value || "36", 10);
    const fillColor = document.getElementById("caption-fill-color")?.value || "#ffe600";
    const strokeColor = document.getElementById("caption-stroke-color")?.value || "#000000";
    const strokeWidth = parseInt(document.getElementById("caption-stroke-width")?.value || "4", 10);
    const drawFrame = document.getElementById("caption-draw-frame")?.checked || false;

    if (drawFrame) {
      ctx.save();
      ctx.strokeStyle = fillColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(8, 8, overlayCanvas.width - 16, overlayCanvas.height - 16);
      ctx.lineWidth = 1;
      ctx.strokeRect(14, 14, overlayCanvas.width - 28, overlayCanvas.height - 28);
      ctx.restore();
    }

    function drawMultiline(textString, startY, customFontSize = fontSize) {
      if (!textString) return;
      ctx.save();
      ctx.font = `bold ${customFontSize}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lines = textString.split("\n");
      const lineHeight = customFontSize * 1.28;

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const currentY = startY + (index * lineHeight);
        const currentX = overlayCanvas.width / 2;

        if (strokeWidth > 0) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = strokeWidth * 2;
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;
          ctx.strokeText(trimmed, currentX, currentY);
        }

        ctx.fillStyle = fillColor;
        ctx.fillText(trimmed, currentX, currentY);
      });
      ctx.restore();
    }

    if (textTop) {
      const topFontSize = Math.round(fontSize * 0.85);
      drawMultiline(textTop, 45, topFontSize);
    }

    if (textMain) {
      const lines = textMain.split("\n");
      const totalBlockHeight = lines.length * (fontSize * 1.28);

      let startY;
      switch (preset) {
        case "top":
          startY = 50;
          break;
        case "center":
          startY = (overlayCanvas.height / 2) - (totalBlockHeight / 2) + (fontSize * 0.6);
          break;
        case "top_and_bottom":
        case "lower_third":
        default:
          startY = overlayCanvas.height - totalBlockHeight - 35;
          break;
      }
      drawMultiline(textMain, startY, fontSize);
    }

    return overlayCanvas;
  }

  const btnApplyCaptionL2 = document.getElementById("btn-apply-caption-l2");
  if (btnApplyCaptionL2) {
    btnApplyCaptionL2.addEventListener("click", () => {
      const canvas = generateCaptionOverlayCanvas();
      const dataUrl = canvas.toDataURL("image/png");

      const img = new Image();
      img.onload = () => {
        state.layers.layer2.image = img;
        state.layers.layer2.visible = true;
        state.layers.layer2.x = 0;
        state.layers.layer2.y = 0;
        state.layers.layer2.scale = 1.0;
        state.layers.layer2.opacity = 1.0;

        const sliderX = document.getElementById("slider-pos-x");
        const sliderY = document.getElementById("slider-pos-y");
        const sliderScale = document.getElementById("scale-l2");
        const sliderOpacity = document.getElementById("opacity-l2");
        if (sliderX) { sliderX.value = 0; document.getElementById("val-pos-x").innerText = "0px"; }
        if (sliderY) { sliderY.value = 0; document.getElementById("val-pos-y").innerText = "0px"; }
        if (sliderScale) { sliderScale.value = 100; document.getElementById("val-scale-l2").innerText = "100%"; }
        if (sliderOpacity) { sliderOpacity.value = 100; document.getElementById("val-opacity-l2").innerText = "100%"; }

        updateLayerPreview(2);
        renderCanvas();
        saveProjectStateDebounced();

        const toast = document.createElement("div");
        toast.className = "hud-canvas-badge";
        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.right = "20px";
        toast.style.zIndex = "9999";
        toast.style.background = "rgba(0, 229, 255, 0.2)";
        toast.style.border = "1px solid #00e5ff";
        toast.style.color = "#00e5ff";
        toast.innerText = "✓ Caption Overlay Applied to Layer 2";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
      };
      img.src = dataUrl;
    });
  }

  const btnDownloadCaptionPng = document.getElementById("btn-download-caption-png");
  if (btnDownloadCaptionPng) {
    btnDownloadCaptionPng.addEventListener("click", () => {
      const canvas = generateCaptionOverlayCanvas();
      const a = document.createElement("a");
      a.download = `caption_overlay_${Date.now()}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    });
  }

  // Initial load
  loadModels();
  loadSystemStatus();
  loadNovelImagesReel();
  loadProjectState();
  updateLayerUI();
  fetchLogs();
});
