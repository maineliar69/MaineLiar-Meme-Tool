const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const fileInput = document.getElementById("fileInput");
const zoomInput = document.getElementById("zoom");
const fitBtn = document.getElementById("fitBtn");
const fillBtn = document.getElementById("fillBtn");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");
const dropHint = document.getElementById("dropHint");

const overlay = new Image();
overlay.src = "assets/overlay.png";

let background = null;
let scale = 1;
let x = 0;
let y = 0;

let dragging = false;
let dragStartX = 0;
let dragStartY = 0;
let imageStartX = 0;
let imageStartY = 0;

let lastPinchDistance = null;
let lastPinchCenter = null;

overlay.onload = () => {
  canvas.width = overlay.naturalWidth;
  canvas.height = overlay.naturalHeight;
  render();
};

function render() {
  if (!canvas.width || !canvas.height) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (background) {
    const w = background.naturalWidth * scale;
    const h = background.naturalHeight * scale;
    ctx.drawImage(background, x, y, w, h);
  }

  ctx.drawImage(overlay, 0, 0, canvas.width, canvas.height);
}

function loadFile(file) {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      background = img;
      fillImage();
      dropHint.classList.add("hidden");
      downloadBtn.disabled = false;
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function setScaleAroundPoint(newScale, pointX, pointY) {
  if (!background) return;

  newScale = Math.max(0.1, Math.min(5, newScale));

  const imagePointX = (pointX - x) / scale;
  const imagePointY = (pointY - y) / scale;

  scale = newScale;
  x = pointX - imagePointX * scale;
  y = pointY - imagePointY * scale;

  zoomInput.value = scale;
  render();
}

function fitImage() {
  if (!background) return;

  scale = Math.min(
    canvas.width / background.naturalWidth,
    canvas.height / background.naturalHeight
  );

  centerImage();
}

function fillImage() {
  if (!background) return;

  scale = Math.max(
    canvas.width / background.naturalWidth,
    canvas.height / background.naturalHeight
  );

  centerImage();
}

function centerImage() {
  const w = background.naturalWidth * scale;
  const h = background.naturalHeight * scale;

  x = (canvas.width - w) / 2;
  y = (canvas.height - h) / 2;

  zoomInput.value = Math.min(5, Math.max(0.1, scale));
  render();
}

function resetImage() {
  fillImage();
}

function canvasPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

fileInput.addEventListener("change", () => {
  loadFile(fileInput.files[0]);
});

["dragenter", "dragover"].forEach((eventName) => {
  canvas.parentElement.addEventListener(eventName, (event) => {
    event.preventDefault();
  });
});

canvas.parentElement.addEventListener("drop", (event) => {
  event.preventDefault();
  loadFile(event.dataTransfer.files[0]);
});

canvas.addEventListener("pointerdown", (event) => {
  if (!background || event.pointerType === "touch") return;

  dragging = true;
  canvas.classList.add("dragging");
  canvas.setPointerCapture(event.pointerId);

  const p = canvasPoint(event.clientX, event.clientY);
  dragStartX = p.x;
  dragStartY = p.y;
  imageStartX = x;
  imageStartY = y;
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging || event.pointerType === "touch") return;

  const p = canvasPoint(event.clientX, event.clientY);
  x = imageStartX + (p.x - dragStartX);
  y = imageStartY + (p.y - dragStartY);
  render();
});

function endDrag() {
  dragging = false;
  canvas.classList.remove("dragging");
}

canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

canvas.addEventListener(
  "wheel",
  (event) => {
    if (!background) return;
    event.preventDefault();

    const p = canvasPoint(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    setScaleAroundPoint(scale * factor, p.x, p.y);
  },
  { passive: false }
);

// Touch drag + pinch zoom.
const touches = new Map();

canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch" || !background) return;
  canvas.setPointerCapture(event.pointerId);
  touches.set(event.pointerId, canvasPoint(event.clientX, event.clientY));

  if (touches.size === 1) {
    const p = [...touches.values()][0];
    dragStartX = p.x;
    dragStartY = p.y;
    imageStartX = x;
    imageStartY = y;
  }

  if (touches.size === 2) {
    const pts = [...touches.values()];
    lastPinchDistance = Math.hypot(
      pts[1].x - pts[0].x,
      pts[1].y - pts[0].y
    );
    lastPinchCenter = {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2
    };
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "touch" || !touches.has(event.pointerId)) return;

  touches.set(event.pointerId, canvasPoint(event.clientX, event.clientY));

  if (touches.size === 1) {
    const p = [...touches.values()][0];
    x = imageStartX + (p.x - dragStartX);
    y = imageStartY + (p.y - dragStartY);
    render();
  } else if (touches.size === 2) {
    const pts = [...touches.values()];
    const distance = Math.hypot(
      pts[1].x - pts[0].x,
      pts[1].y - pts[0].y
    );
    const center = {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2
    };

    if (lastPinchDistance) {
      const ratio = distance / lastPinchDistance;
      setScaleAroundPoint(scale * ratio, center.x, center.y);
    }

    lastPinchDistance = distance;
    lastPinchCenter = center;
  }
});

function removeTouch(event) {
  touches.delete(event.pointerId);

  if (touches.size < 2) {
    lastPinchDistance = null;
    lastPinchCenter = null;
  }

  if (touches.size === 1) {
    const p = [...touches.values()][0];
    dragStartX = p.x;
    dragStartY = p.y;
    imageStartX = x;
    imageStartY = y;
  }
}

canvas.addEventListener("pointerup", removeTouch);
canvas.addEventListener("pointercancel", removeTouch);

zoomInput.addEventListener("input", () => {
  if (!background) return;

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  setScaleAroundPoint(Number(zoomInput.value), centerX, centerY);
});

fitBtn.addEventListener("click", fitImage);
fillBtn.addEventListener("click", fillImage);
resetBtn.addEventListener("click", resetImage);

downloadBtn.addEventListener("click", () => {
  if (!background) return;

  render();

  const link = document.createElement("a");
  link.download = "finished-image.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});
