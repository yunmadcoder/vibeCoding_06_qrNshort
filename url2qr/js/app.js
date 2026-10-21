/**
 * QR Studio - Application Logic
 * QR Code Generation, Morphing Layout & JPG Download
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const mainStage = document.getElementById("mainStage");
  const logoLink = document.getElementById("logoLink");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  
  // URL Input Form
  const urlForm = document.getElementById("urlForm");
  const urlInput = document.getElementById("urlInput");
  const confirmBtn = document.getElementById("confirmBtn");
  const clearInputBtn = document.getElementById("clearInputBtn");
  const pasteInputBtn = document.getElementById("pasteInputBtn");
  const quickChips = document.querySelectorAll(".quick-chip");

  // QR Code Area
  const qrInteractiveFrame = document.getElementById("qrInteractiveFrame");
  const qrcodeBox = document.getElementById("qrcodeBox");
  const targetUrlText = document.getElementById("targetUrlText");
  const copyUrlBtn = document.getElementById("copyUrlBtn");
  const urlPreviewWrap = document.getElementById("urlPreviewWrap");
  
  // Action Buttons
  const downloadJpgBtn = document.getElementById("downloadJpgBtn");
  const copyImageBtn = document.getElementById("copyImageBtn");
  const resetBtn = document.getElementById("resetBtn");
  const exportCanvas = document.getElementById("exportCanvas");
  const toastContainer = document.getElementById("toastContainer");

  // State Variables
  let currentValidUrl = "";
  let qrCodeInstance = null;

  // ==========================================================================
  // 1. Theme Toggle System (Default: Bright Light Mode matching logo)
  // ==========================================================================
  const savedTheme = localStorage.getItem("qr_theme_v2") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("qr_theme_v2", nextTheme);
    showToast(nextTheme === "dark" ? "다크 모드로 전환되었습니다" : "밝은 라이트 모드로 전환되었습니다");
  });

  // ==========================================================================
  // 1-1. Interactive Mouse Cursor Gradient Tracking
  // - 마우스 커서 위치에 따라 그라데이션 색상(Hue)과 반경이 부드럽게 변화
  // - Lerp 감속 보간을 적용하여 부드러운 60fps 인터랙션 제공
  // ==========================================================================
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight * 0.4;
  let targetX = mouseX;
  let targetY = mouseY;
  let isPointerActive = false;
  let mouseRafId = null;

  function renderCursorGradient() {
    // 0.08 interpolation for smooth fluid damping
    mouseX += (targetX - mouseX) * 0.08;
    mouseY += (targetY - mouseY) * 0.08;

    const winW = window.innerWidth || 1;
    const winH = window.innerHeight || 1;
    const ratioX = Math.min(Math.max(mouseX / winW, 0), 1);
    const ratioY = Math.min(Math.max(mouseY / winH, 0), 1);

    const root = document.documentElement;
    root.style.setProperty("--cursor-x", `${(ratioX * 100).toFixed(1)}%`);
    root.style.setProperty("--cursor-y", `${(ratioY * 100).toFixed(1)}%`);
    root.style.setProperty("--cursor-ratio-x", ratioX.toFixed(3));
    root.style.setProperty("--cursor-ratio-y", ratioY.toFixed(3));

    // Dynamic Hues harmonized with logo (Amber Yellow & Sunset Orange):
    // Warm golden amber (30° ~ 54°)
    const hue1 = (30 + ratioX * 24).toFixed(1);
    // Warm sunset tangerine/coral (16° ~ 36°)
    const hue2 = (16 + ratioY * 20).toFixed(1);
    // Bright sunlit honey gold (42° ~ 64°)
    const hue3 = (42 + (ratioX - ratioY + 1) * 11).toFixed(1);

    root.style.setProperty("--cursor-hue-1", `${hue1}deg`);
    root.style.setProperty("--cursor-hue-2", `${hue2}deg`);
    root.style.setProperty("--cursor-hue-3", `${hue3}deg`);

    // Parallax shift for ambient background orbs
    const orbX1 = ((ratioX - 0.5) * 45).toFixed(1);
    const orbY1 = ((ratioY - 0.5) * 45).toFixed(1);
    const orbX2 = ((0.5 - ratioX) * 55).toFixed(1);
    const orbY2 = ((0.5 - ratioY) * 55).toFixed(1);

    root.style.setProperty("--orb-x1", `${orbX1}px`);
    root.style.setProperty("--orb-y1", `${orbY1}px`);
    root.style.setProperty("--orb-x2", `${orbX2}px`);
    root.style.setProperty("--orb-y2", `${orbY2}px`);

    const distance = Math.abs(targetX - mouseX) + Math.abs(targetY - mouseY);
    if (distance > 0.1 || isPointerActive) {
      mouseRafId = requestAnimationFrame(renderCursorGradient);
    } else {
      mouseRafId = null;
    }
  }

  function onPointerMove(e) {
    targetX = e.clientX;
    targetY = e.clientY;
    isPointerActive = true;
    if (!mouseRafId) {
      mouseRafId = requestAnimationFrame(renderCursorGradient);
    }
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerMove, { passive: true });

  // Initial draw at center
  renderCursorGradient();

  // ==========================================================================
  // 2. URL Format Normalization & Validation
  // ==========================================================================
  function normalizeUrl(input) {
    let trimmed = input.trim();
    if (!trimmed) return "";

    // Protocol check: http, https, mailto, tel, etc.
    const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
    if (!hasProtocol) {
      trimmed = "https://" + trimmed;
    }
    return trimmed;
  }

  function getCleanFileName(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/[^a-zA-Z0-9]/g, "_");
      const timeStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      return `qrcode_${host || "link"}_${timeStr}.jpg`;
    } catch {
      return `qrcode_${Date.now()}.jpg`;
    }
  }

  // ==========================================================================
  // 3. QR Code Generation & Layout State Switch
  // ==========================================================================
  function generateQRCode(rawInput) {
    const validUrl = normalizeUrl(rawInput);

    if (!validUrl) {
      showToast("URL 주소를 입력해 주세요.", "error");
      urlInput.focus();
      return;
    }

    currentValidUrl = validUrl;

    // Reset Box
    qrcodeBox.innerHTML = "";

    try {
      // Create QRCode using QRCodeJS library
      qrCodeInstance = new QRCode(qrcodeBox, {
        text: validUrl,
        width: 256,
        height: 256,
        colorDark: "#1c1917",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H // High Error Correction
      });

      // Update URL Preview
      targetUrlText.textContent = validUrl;
      targetUrlText.title = validUrl;

      // Morph Layout: URL Bar moves to bottom dock, QR Code appears in center
      if (!mainStage.classList.contains("has-qr")) {
        mainStage.classList.add("has-qr");
        const confirmBtnText = confirmBtn.querySelector(".btn-text");
        if (confirmBtnText) confirmBtnText.textContent = "변경";
      }

      showToast("QR 코드가 성공적으로 생성되었습니다!");

    } catch (err) {
      console.error("QR Code Generation Error:", err);
      showToast("QR 코드 생성 중 오류가 발생했습니다.", "error");
    }
  }

  // ==========================================================================
  // 4. High-Quality JPG Download (data URL + temporary anchor)
  //    - 클릭 시점에 JPEG data URL을 생성해 즉시 다운로드하므로
  //      파일명과 .jpg 확장자가 항상 보장됩니다.
  // ==========================================================================
  function downloadJPG() {
    const srcCanvas = qrcodeBox.querySelector("canvas");
    const srcImg = qrcodeBox.querySelector("img");

    if (!srcCanvas && !srcImg) {
      showToast("다운로드할 QR 코드가 없습니다.", "error");
      return;
    }

    const exportSize = 1000;
    const quietZone = 120; // safe white border for scanning
    const qrSize = exportSize - (quietZone * 2);

    exportCanvas.width = exportSize;
    exportCanvas.height = exportSize;
    const ctx = exportCanvas.getContext("2d");

    // Pure white background (mandatory for JPEG)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportSize, exportSize);
    ctx.imageSmoothingEnabled = false;

    const triggerDownload = (drawable) => {
      ctx.drawImage(drawable, quietZone, quietZone, qrSize, qrSize);

      const fileName = getCleanFileName(currentValidUrl);
      const dataUrl = exportCanvas.toDataURL("image/jpeg", 0.95);

      const tempLink = document.createElement("a");
      tempLink.href = dataUrl;
      tempLink.download = fileName;
      document.body.appendChild(tempLink);
      tempLink.click();
      setTimeout(() => {
        if (tempLink.parentNode) {
          tempLink.parentNode.removeChild(tempLink);
        }
      }, 300);

      showToast(`JPG 파일로 다운로드되었습니다! (${fileName})`, "success");
    };

    if (srcCanvas) {
      triggerDownload(srcCanvas);
    } else if (srcImg && srcImg.src) {
      const tempImg = new Image();
      tempImg.crossOrigin = "anonymous";
      tempImg.onload = () => triggerDownload(tempImg);
      tempImg.src = srcImg.src;
    }
  }

  // ==========================================================================
  // 5. Copy QR Image to Clipboard (Bonus Feature)
  // ==========================================================================
  async function copyQRImageToClipboard() {
    const srcCanvas = qrcodeBox.querySelector("canvas");
    if (!srcCanvas) {
      showToast("복사할 QR 코드가 없습니다.", "error");
      return;
    }

    // Prepare white-background canvas for clipboard
    const clipCanvas = document.createElement("canvas");
    clipCanvas.width = 512;
    clipCanvas.height = 512;
    const ctx = clipCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 512);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(srcCanvas, 40, 40, 432, 432);

    try {
      clipCanvas.toBlob(async (blob) => {
        if (!blob) {
          showToast("이미지 변환 실패", "error");
          return;
        }
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob })
        ]);
        showToast("QR 이미지가 클립보드에 복사되었습니다!");
      }, "image/png");
    } catch (err) {
      console.warn("Clipboard write failed:", err);
      showToast("클립보드 복사를 지원하지 않는 브라우저입니다.", "error");
    }
  }

  // ==========================================================================
  // 6. Reset to Initial View (새로 만들기 / 로고 클릭)
  // ==========================================================================
  function resetToInitial() {
    mainStage.classList.remove("has-qr");
    urlInput.value = "";
    urlInput.focus();
    updateInputState();

    const confirmBtnText = confirmBtn.querySelector(".btn-text");
    if (confirmBtnText) confirmBtnText.textContent = "확인";
    
    showToast("초기 화면으로 이동했습니다.");
  }

  // ==========================================================================
  // 7. Input Helpers (Clear, Paste, Chips)
  // ==========================================================================
  function updateInputState() {
    if (urlInput.value.trim().length > 0) {
      clearInputBtn.classList.add("visible");
    } else {
      clearInputBtn.classList.remove("visible");
    }
  }

  urlInput.addEventListener("input", updateInputState);

  clearInputBtn.addEventListener("click", () => {
    urlInput.value = "";
    updateInputState();
    urlInput.focus();
  });

  pasteInputBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        urlInput.value = text.trim();
        updateInputState();
        showToast("클립보드 내용이 입력되었습니다.");
        urlInput.focus();
      } else {
        showToast("클립보드가 비어있습니다.", "error");
      }
    } catch {
      showToast("클립보드 접근 권한이 필요합니다.", "error");
    }
  });

  quickChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const url = chip.getAttribute("data-url");
      if (url) {
        urlInput.value = url;
        updateInputState();
        generateQRCode(url);
      }
    });
  });

  // Copy URL Text to Clipboard
  function copyUrlToClipboard() {
    if (!currentValidUrl) return;
    navigator.clipboard.writeText(currentValidUrl).then(() => {
      copyUrlBtn.classList.add("copied");
      showToast("URL 주소가 복사되었습니다!");
      setTimeout(() => {
        copyUrlBtn.classList.remove("copied");
      }, 2000);
    }).catch(() => {
      showToast("URL 복사에 실패했습니다.", "error");
    });
  }

  copyUrlBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    copyUrlToClipboard();
  });

  urlPreviewWrap.addEventListener("click", copyUrlToClipboard);

  // ==========================================================================
  // 8. Event Listeners for QR & Submission
  // ==========================================================================
  // Submit Form
  urlForm.addEventListener("submit", (e) => {
    e.preventDefault();
    generateQRCode(urlInput.value);
  });

  // QR Code Box Click -> JPG Download
  qrInteractiveFrame.addEventListener("click", (e) => {
    e.preventDefault();

    // Visual feedback
    qrInteractiveFrame.style.transform = "scale(0.95)";
    setTimeout(() => {
      qrInteractiveFrame.style.transform = "";
    }, 180);

    downloadJPG();
  });

  // Action Buttons
  downloadJpgBtn.addEventListener("click", (e) => {
    e.preventDefault();
    downloadJPG();
  });
  copyImageBtn.addEventListener("click", copyQRImageToClipboard);
  resetBtn.addEventListener("click", resetToInitial);
  logoLink.addEventListener("click", (e) => {
    e.preventDefault();
    resetToInitial();
  });

  // ==========================================================================
  // 9. Toast Notification Helper
  // ==========================================================================
  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    const iconSvg = type === "success" 
      ? `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
      : `<svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("hiding");
      setTimeout(() => {
        if (toastContainer.contains(toast)) {
          toastContainer.removeChild(toast);
        }
      }, 300);
    }, 2800);
  }

  // Initial URL Parameter Handling (e.g. from urlShort service: ?url=...)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const initialUrl = urlParams.get("url");
    if (initialUrl && initialUrl.trim()) {
      urlInput.value = initialUrl.trim();
      setTimeout(() => {
        generateQRCode(initialUrl.trim());
      }, 100);
    } else {
      urlInput.focus();
    }
  } catch (err) {
    urlInput.focus();
  }
});
