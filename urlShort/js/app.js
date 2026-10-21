/**
 * Link Shortener (URL Short) - Application Logic
 * OpenAPI URL Shortening, Copy Clipboard, Real-time Validation & Mouse Tracking
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Elements ---
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  
  // URL Input Form
  const shortenForm = document.getElementById("shortenForm");
  const urlInput = document.getElementById("urlInput");
  const shortenBtn = document.getElementById("shortenBtn");
  const clearInputBtn = document.getElementById("clearInputBtn");
  const pasteInputBtn = document.getElementById("pasteInputBtn");
  const quickChips = document.querySelectorAll(".quick-chip");

  // Output Box Area (요구사항 3-1: 읽기 전용 출력 상자)
  const resultSection = document.getElementById("resultSection");
  const shortenedResultInput = document.getElementById("shortenedResultInput");
  const copyBtn = document.getElementById("copyBtn");
  const originalLink = document.getElementById("originalLink");
  const reductionBadge = document.getElementById("reductionBadge");
  const openLinkBtn = document.getElementById("openLinkBtn");
  const qrLinkBtn = document.getElementById("qrLinkBtn");

  // History & Notifications
  const historySection = document.getElementById("historySection");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const toastContainer = document.getElementById("toastContainer");

  // Alert Modal (요구사항 3-4: '복사하였습니다' 알림창)
  const alertModal = document.getElementById("alertModal");
  const modalCopiedUrl = document.getElementById("modalCopiedUrl");
  const modalCloseBtn = document.getElementById("modalCloseBtn");

  // State
  let currentShortenedUrl = "";
  let isShortening = false;

  // ==========================================================================
  // 1. Theme Toggle System
  // ==========================================================================
  const savedTheme = localStorage.getItem("qr_theme_v2") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("qr_theme_v2", nextTheme);
    showToast(nextTheme === "dark" ? "다크 모드로 전환되었습니다" : "라이트 모드로 전환되었습니다");
  });

  // ==========================================================================
  // 2. Interactive Mouse Cursor Tracking (Fluid Lerp 60fps)
  // ==========================================================================
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight * 0.4;
  let targetX = mouseX;
  let targetY = mouseY;

  function renderCursorGradient() {
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

    const hue1 = (30 + ratioX * 24).toFixed(1);
    const hue2 = (16 + ratioY * 20).toFixed(1);
    const hue3 = (42 + (ratioX - ratioY + 1) * 11).toFixed(1);

    root.style.setProperty("--cursor-hue-1", `${hue1}deg`);
    root.style.setProperty("--cursor-hue-2", `${hue2}deg`);
    root.style.setProperty("--cursor-hue-3", `${hue3}deg`);

    const orbX1 = ((ratioX - 0.5) * 45).toFixed(1);
    const orbY1 = ((ratioY - 0.5) * 45).toFixed(1);
    const orbX2 = ((0.5 - ratioX) * 55).toFixed(1);
    const orbY2 = ((0.5 - ratioY) * 55).toFixed(1);

    root.style.setProperty("--orb-x1", `${orbX1}px`);
    root.style.setProperty("--orb-y1", `${orbY1}px`);
    root.style.setProperty("--orb-x2", `${orbX2}px`);
    root.style.setProperty("--orb-y2", `${orbY2}px`);

    requestAnimationFrame(renderCursorGradient);
  }

  window.addEventListener("pointermove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  });

  requestAnimationFrame(renderCursorGradient);

  // ==========================================================================
  // 3. 요구사항 3-2: 입력 필드가 비어있으면 '단축하기' 버튼 비활성화
  // ==========================================================================
  function checkInputValidity() {
    const rawVal = urlInput.value.trim();
    if (rawVal.length === 0) {
      shortenBtn.disabled = true;
      shortenBtn.title = "단축할 URL 주소를 입력해주세요";
      clearInputBtn.classList.remove("visible");
    } else {
      shortenBtn.disabled = false;
      shortenBtn.title = "URL 단축하기";
      clearInputBtn.classList.add("visible");
    }
  }

  // 실시간 입력 감지 이벤트 (input, change, keyup, paste)
  urlInput.addEventListener("input", checkInputValidity);
  urlInput.addEventListener("keyup", checkInputValidity);
  urlInput.addEventListener("change", checkInputValidity);

  // 초기 로드 시 버튼 상태 검사
  checkInputValidity();

  // 지우기 버튼
  clearInputBtn.addEventListener("click", () => {
    urlInput.value = "";
    checkInputValidity();
    urlInput.focus();
  });

  // 붙여넣기 버튼
  pasteInputBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        urlInput.value = text.trim();
        checkInputValidity();
        showToast("클립보드 내용을 붙여넣었습니다");
        urlInput.focus();
      } else {
        showToast("클립보드가 비어있습니다", "error");
      }
    } catch (err) {
      showToast("클립보드 접근 권한이 필요합니다", "error");
    }
  });

  // 빠른 테스트 칩
  quickChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const sampleUrl = chip.getAttribute("data-url");
      if (sampleUrl) {
        urlInput.value = sampleUrl;
        checkInputValidity();
        requestShorten(sampleUrl);
      }
    });
  });

  // ==========================================================================
  // 4. URL 정규화 헬퍼 (http:// 자동 보정 등)
  // ==========================================================================
  function normalizeUrl(input) {
    let url = input.trim();
    if (!url) return "";

    // http 또는 https 프로토콜이 누락된 경우 기본 https:// 부여
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    try {
      // URL 문법 검증 + ASCII 퍼센트 인코딩 정규화
      // (한글 등 비ASCII 문자가 경로에 있으면 da.gd 등 일부 API가 거부하므로
      //  new URL().href로 표준 인코딩된 형태를 사용)
      return new URL(url).href;
    } catch (e) {
      return null;
    }
  }

  // ==========================================================================
  // 5. 요구사항 3-3: '단축하기' 클릭 시 OpenAPI로 URL 단축 요청 및 출력 상자 표시
  // ==========================================================================
  async function callShortenOpenApi(targetUrl) {
    // 다중 Fallback 체인으로 OpenAPI 요청
    // CORS 실측 검증 결과(2026-10) 기준 우선순위:
    //  - da.gd   : 항상 Access-Control-Allow-Origin: * (null origin 포함) → 1순위
    //  - spoo.me : ACAO: * 제공, 단 분당 5회 요청 제한 → 2순위
    //  - is.gd/v.gd : 성공 응답에만 ACAO 헤더가 실리고 에러 시 누락되는 불안정함 → 후순위
    //  - TinyURL 직접 호출 : ACAO가 tinyurl.com 고정이라 브라우저에서 항상 차단 → 제거됨

    // 1차: da.gd OpenAPI (GET, 순수 텍스트 응답)
    try {
      const daGdEndpoint = `https://da.gd/shorten?url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(daGdEndpoint, { method: "GET" });
      if (res.ok) {
        const shortUrl = (await res.text()).trim();
        if (shortUrl.startsWith("http")) {
          return { success: true, shortUrl: shortUrl, service: "da.gd" };
        }
      }
    } catch (e) {
      console.warn("da.gd OpenAPI fetch failed, trying spoo.me fallback...", e);
    }

    // 2차: spoo.me OpenAPI (POST, JSON 응답, 분당 5회 제한)
    try {
      const res = await fetch("https://spoo.me/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: `url=${encodeURIComponent(targetUrl)}`
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.short_url) {
          return { success: true, shortUrl: data.short_url, service: "spoo.me" };
        }
      }
    } catch (e) {
      console.warn("spoo.me OpenAPI fetch failed, trying is.gd fallback...", e);
    }

    // 3차: is.gd OpenAPI (성공 시에만 CORS 헤더 제공)
    try {
      const isGdEndpoint = `https://is.gd/create.php?format=json&url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(isGdEndpoint, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.shorturl) {
          return { success: true, shortUrl: data.shorturl, service: "is.gd" };
        }
        if (data && data.errorcode) {
          console.warn("is.gd returned error:", data.errormessage);
        }
      }
    } catch (e) {
      console.warn("is.gd OpenAPI fetch failed, trying v.gd fallback...", e);
    }

    // 4차: v.gd OpenAPI
    try {
      const vGdEndpoint = `https://v.gd/create.php?format=json&url=${encodeURIComponent(targetUrl)}`;
      const res = await fetch(vGdEndpoint, { method: "GET" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.shorturl) {
          return { success: true, shortUrl: data.shorturl, service: "v.gd" };
        }
      }
    } catch (e) {
      console.warn("v.gd OpenAPI fetch failed, trying server proxy...", e);
    }

    // 5차: 로컬 서버 프록시 (/api/shorten)
    // http/https로 서비스될 때만 시도 (localhost 개발 환경 전용 — GitHub Pages에서는 항상 실패하므로 마지막 보조 수단)
    if (/^https?:$/.test(window.location.protocol)) {
      try {
        const proxyEndpoint = `/api/shorten?url=${encodeURIComponent(targetUrl)}`;
        const res = await fetch(proxyEndpoint, { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data && data.shortUrl) {
            return { success: true, shortUrl: data.shortUrl, service: data.service || "로컬 프록시" };
          }
        }
      } catch (e) {
        console.warn("Local server proxy failed:", e);
      }
    }

    // 모든 외부 API 연결이 불가한 경우 (오프라인 등)
    throw new Error("모든 OpenAPI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
  }

  async function requestShorten(rawUrl) {
    if (isShortening) return;

    const validatedUrl = normalizeUrl(rawUrl);
    if (!validatedUrl) {
      showToast("올바른 웹사이트 URL 주소를 입력해주세요 (예: https://naver.com)", "error");
      urlInput.focus();
      return;
    }

    // 로딩 상태 시작
    isShortening = true;
    shortenBtn.disabled = true;
    shortenBtn.classList.add("loading");

    try {
      const result = await callShortenOpenApi(validatedUrl);
      if (result && result.shortUrl) {
        currentShortenedUrl = result.shortUrl;
        
        // 3-1: 읽기 전용 출력 상자에 단축 결과 보여주기
        shortenedResultInput.value = result.shortUrl;
        originalLink.href = validatedUrl;
        originalLink.textContent = validatedUrl;
        openLinkBtn.href = result.shortUrl;

        // QR 연계 링크 설정
        qrLinkBtn.href = `../url2qr/index.html?url=${encodeURIComponent(result.shortUrl)}`;

        // 단축율 계산 (원본 글자수 vs 단축 글자수)
        const origLen = validatedUrl.length;
        const shortLen = result.shortUrl.length;
        const reductionPct = Math.max(0, Math.round(((origLen - shortLen) / origLen) * 100));
        reductionBadge.textContent = reductionPct > 0 
          ? `길이 ${origLen}자 → ${shortLen}자 (${reductionPct}% 축소)` 
          : `단축 완료 (${result.service})`;

        // 결과 섹션 노출
        resultSection.classList.remove("hidden");
        resultSection.scrollIntoView({ behavior: "smooth", block: "nearest" });

        // 히스토리 추가
        addToHistory(validatedUrl, result.shortUrl);
        showToast(`URL이 성공적으로 단축되었습니다! (${result.service})`);
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || "URL 단축 중 오류가 발생했습니다", "error");
    } finally {
      isShortening = false;
      shortenBtn.classList.remove("loading");
      checkInputValidity();
    }
  }

  // 폼 제출 핸들러
  shortenForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!shortenBtn.disabled) {
      requestShorten(urlInput.value);
    }
  });

  shortenBtn.addEventListener("click", (e) => {
    e.preventDefault();
    if (!shortenBtn.disabled) {
      requestShorten(urlInput.value);
    }
  });

  // ==========================================================================
  // 6. 요구사항 3-4: '복사' 버튼 클릭 시 자동 복사 및 '복사하였습니다' 알림창
  // ==========================================================================
  async function copyShortenedUrl() {
    const textToCopy = shortenedResultInput.value.trim();
    if (!textToCopy) {
      showToast("복사할 단축 URL이 없습니다", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      
      // 복사 버튼 시각적 피드백
      copyBtn.classList.add("copied");
      const btnText = copyBtn.querySelector(".btn-text-copy");
      if (btnText) btnText.textContent = "복사됨!";
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        if (btnText) btnText.textContent = "복사";
      }, 2000);

      // 토스트 알림창 표시
      showToast("단축 URL이 클립보드에 복사되었습니다!");

      // 요구사항 3-4: '복사하였습니다' 알림창 모달 노출
      openAlertModal(textToCopy);

    } catch (err) {
      // 대체 복사 방법 (select & execCommand)
      shortenedResultInput.select();
      document.execCommand("copy");
      openAlertModal(textToCopy);
    }
  }

  copyBtn.addEventListener("click", copyShortenedUrl);

  // 알림창 열기
  function openAlertModal(copiedText) {
    modalCopiedUrl.textContent = copiedText;
    alertModal.classList.add("active");
    modalCloseBtn.focus();
  }

  // 알림창 닫기
  function closeAlertModal() {
    alertModal.classList.remove("active");
  }

  modalCloseBtn.addEventListener("click", closeAlertModal);
  alertModal.addEventListener("click", (e) => {
    if (e.target === alertModal) {
      closeAlertModal();
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && alertModal.classList.contains("active")) {
      closeAlertModal();
    }
  });

  // ==========================================================================
  // 7. 최근 단축 히스토리 관리 (LocalStorage)
  // ==========================================================================
  const HISTORY_KEY = "url_shortener_history_v1";

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 5)));
  }

  function addToHistory(original, short) {
    let list = getHistory();
    // 중복 제거
    list = list.filter(item => item.short !== short);
    list.unshift({
      original,
      short,
      date: new Date().toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    });
    saveHistory(list);
    renderHistory();
  }

  function renderHistory() {
    const list = getHistory();
    if (!list || list.length === 0) {
      historySection.style.display = "none";
      return;
    }

    historySection.style.display = "block";
    historyList.innerHTML = "";

    list.forEach(item => {
      const el = document.createElement("div");
      el.className = "history-item";
      el.innerHTML = `
        <div class="history-item-left">
          <a href="${item.short}" target="_blank" rel="noopener noreferrer" class="history-short-link">${item.short}</a>
          <span class="history-orig-link" title="${item.original}">${item.original}</span>
        </div>
        <div class="history-item-actions">
          <button type="button" class="mini-action-btn copy-history-btn" title="링크 복사" data-copy="${item.short}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>
          </button>
          <a href="../url2qr/index.html?url=${encodeURIComponent(item.short)}" class="mini-action-btn" title="QR 코드 생성">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"></rect><rect width="5" height="5" x="16" y="3" rx="1"></rect><rect width="5" height="5" x="3" y="16" rx="1"></rect><path d="M21 16h-3a2 2 0 0 0-2 2v3"></path><path d="M21 21v.01"></path><path d="M12 7v3a2 2 0 0 1-2 2H7"></path><path d="M3 12h.01"></path><path d="M12 3h.01"></path><path d="M12 16v.01"></path><path d="M16 12h1"></path><path d="M21 12v.01"></path><path d="M12 21v-1"></path></svg>
          </a>
        </div>
      `;

      el.querySelector(".copy-history-btn").addEventListener("click", async (e) => {
        const text = e.currentTarget.getAttribute("data-copy");
        await navigator.clipboard.writeText(text);
        openAlertModal(text);
      });

      historyList.appendChild(el);
    });
  }

  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderHistory();
    showToast("최근 단축 기록이 초기화되었습니다");
  });

  // 초기 히스토리 렌더링
  renderHistory();

  // ==========================================================================
  // 8. 플로팅 토스트 알림 헬퍼
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

  // Focus on URL Input
  urlInput.focus();
});
