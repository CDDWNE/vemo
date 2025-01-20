// content.js

// -----------------------------------------------------------
// 메시지 수신: 웹 페이지(React) → content script
// -----------------------------------------------------------
window.addEventListener("message", (event) => {
  if (event.source !== window) return; // 보안상 체크

  const { type } = event.data;

  if (type === "CAPTURE_TAB") {
    captureYouTubePlayer();
  } else if (type === "CAPTURE_AREA") {
    // "영역 선택" 버튼
    try {
      chrome.runtime.sendMessage(
        { action: "startSelection" },
        function (response) {
          if (chrome.runtime.lastError) {
            console.error(
              "[Vemo Extension] Chrome runtime error:",
              chrome.runtime.lastError
            );
            return;
          }
          if (response && response.started) {
            activateSelectionOverlay();
          }
        }
      );
    } catch (error) {
      console.error("[Vemo Extension] Error sending message:", error);
    }
  }
});

// -----------------------------------------------------------
// 1) 전체 캡처 대신 "YouTube 플레이어만 크롭" 예시
// -----------------------------------------------------------
function captureYouTubePlayer() {
  const iframe = document.getElementById("youtube-player");
  if (!iframe) {
    postMessageToPage("CAPTURE_TAB_RESPONSE", null);
    return;
  }

  // 정확한 위치와 크기 계산
  const rect = iframe.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;

  const absoluteRect = {
    left: Math.round(rect.left * scale),
    top: Math.round(rect.top * scale),
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale),
  };

  // 스크롤 위치는 scale과 별개로 처리
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  // 최종 캡처 위치 계산
  absoluteRect.left += Math.round(scrollLeft * scale);
  absoluteRect.top += Math.round(scrollTop * scale);

  // 캡처 전에 스크롤 위치 저장
  const originalScroll = {
    x: window.scrollX,
    y: window.scrollY,
  };

  // 캡처할 요소가 뷰포트 내에 완전히 보이도록 스크롤
  iframe.scrollIntoView({
    behavior: "instant",
    block: "center",
  });

  // 요소가 뷰포트에 자리잡을 때까지 잠시 대기
  setTimeout(() => {
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      if (!response || !response.dataUrl) {
        console.error("[Vemo Extension] 캡처 실패");
        postMessageToPage("CAPTURE_TAB_RESPONSE", null);
        return;
      }

      cropImage(
        response.dataUrl,
        absoluteRect.left,
        absoluteRect.top,
        absoluteRect.width,
        absoluteRect.height,
        (croppedUrl) => {
          if (!croppedUrl) {
            console.error("[Vemo Extension] 크롭 실패");
            postMessageToPage("CAPTURE_TAB_RESPONSE", null);
            return;
          }

          // 성공적으로 처리된 경우
          postMessageToPage("CAPTURE_TAB_RESPONSE", croppedUrl);

          // 시각적 피드백은 캡처 완료 후에 표시
          const overlay = document.createElement("div");
          overlay.style.cssText = `
                      position: fixed;
                      border: 2px solid #000000;
                      background: rgba(0, 0, 0, 0.2);
                      pointer-events: none;
                      z-index: 999999;
                      left: ${rect.left}px;
                      top: ${rect.top}px;
                      width: ${rect.width}px;
                      height: ${rect.height}px;
                      transition: opacity 0.3s ease;
                  `;
          document.body.appendChild(overlay);

          setTimeout(() => {
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 300);
          }, 300);
        }
      );
    });
  }, 100);
}

// -----------------------------------------------------------
// 2) 선택 영역 캡처 (드래그 오버레이)
// -----------------------------------------------------------
let overlayElement = null;
let selectionBox = null;
let isSelecting = false;
let isDragging = false;
let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;

function addSelectionStyles() {
  const style = document.createElement("style");
  style.textContent = `
      #vemo-selection-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.2);
          cursor: crosshair;
          z-index: 999999;
      }

      #vemo-selection-box {
          position: fixed;
          border: 2px solid #1a73e8;
          background: rgba(26, 115, 232, 0.1);
          pointer-events: none;
          z-index: 999999;
          display: none;
      }
  `;
  document.head.appendChild(style);
}

function activateSelectionOverlay() {
  addSelectionStyles();
  removeSelectionOverlay();

  overlayElement = document.createElement("div");
  overlayElement.id = "vemo-selection-overlay";
  document.body.appendChild(overlayElement);

  selectionBox = document.createElement("div");
  selectionBox.id = "vemo-selection-box";
  document.body.appendChild(selectionBox);

  overlayElement.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  isSelecting = true;
}

function removeSelectionOverlay() {
  if (overlayElement) {
    overlayElement.removeEventListener("mousedown", onMouseDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    overlayElement.remove();
    overlayElement = null;
  }
  if (selectionBox) {
    selectionBox.remove();
    selectionBox = null;
  }
  isSelecting = false;
  isDragging = false;
  document.body.style.cursor = "default";
}

function onMouseDown(e) {
  if (!isSelecting) return;

  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  endX = startX;
  endY = startY;

  selectionBox.style.display = "block";
  updateSelectionBox();

  e.preventDefault();
}

function onMouseMove(e) {
  if (!isSelecting || !isDragging) return;

  endX = e.clientX;
  endY = e.clientY;
  updateSelectionBox();

  e.preventDefault();
}

function onMouseUp(e) {
  if (!isSelecting || !isDragging) return;

  isDragging = false;
  endX = e.clientX;
  endY = e.clientY;

  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  if (width > 5 && height > 5) {
    const scale = window.devicePixelRatio || 1;
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    const captureArea = {
      x: Math.round((left + scrollLeft) * scale),
      y: Math.round((top + scrollTop) * scale),
      width: Math.round(width * scale),
      height: Math.round(height * scale),
    };

    // 캡처 전에 선택 요소들 숨김
    overlayElement.style.display = "none";
    selectionBox.style.display = "none";

    setTimeout(() => {
      chrome.runtime.sendMessage({ action: "captureTab" }, (resp) => {
        if (resp && resp.dataUrl) {
          cropImage(
            resp.dataUrl,
            captureArea.x,
            captureArea.y,
            captureArea.width,
            captureArea.height,
            (croppedUrl) => {
              postMessageToPage("CAPTURE_TAB_RESPONSE", croppedUrl);
              removeSelectionOverlay();
            }
          );
        }
      });
    }, 50);
  } else {
    removeSelectionOverlay();
  }

  e.preventDefault();
}

function updateSelectionBox() {
  if (!selectionBox || !isDragging) return;

  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  selectionBox.style.left = `${left}px`;
  selectionBox.style.top = `${top}px`;
  selectionBox.style.width = `${width}px`;
  selectionBox.style.height = `${height}px`;
}

// -----------------------------------------------------------
// 3) 공통: 이미지 크롭 함수 (Canvas 사용)
// -----------------------------------------------------------
async function compressImage(base64String) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // 최대 크기 제한 (예: 1024px)
      const MAX_SIZE = 1024;
      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // 압축된 이미지 생성 (품질 0.7 = 70%)
      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
      resolve(compressedBase64);
    };
    img.onerror = reject;
    img.src = base64String;
  });
}

// 이미지 데이터 정제 함수 추가
function sanitizeImageData(base64String) {
  // base64 문자열에서 데이터 URI 스키마 제거
  const base64Data = base64String.replace(
    /^data:image\/(png|jpeg|jpg);base64,/,
    ""
  );
  return base64Data;
}

// cropImage 함수 수정
function cropImage(dataUrl, cropX, cropY, cropW, cropH, callback) {
  if (!dataUrl) {
    callback(null);
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onerror = (error) => {
    callback(null);
  };

  img.onload = async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = cropW;
      canvas.height = cropH;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        console.error("[Vemo Extension] Failed to get canvas context");
        callback(null);
        return;
      }

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      // 품롭된 이미지를 압축
      const croppedUrl = canvas.toDataURL("image/jpeg", 0.8);
      try {
        const compressedUrl = await compressImage(croppedUrl);
        // 이미지 데이터 정제
        const sanitizedData = sanitizeImageData(compressedUrl);
        callback(sanitizedData); // 정제된 데이터 전달
      } catch (error) {
        callback(null);
      }
    } catch (error) {
      callback(null);
    }
  };

  img.src = dataUrl;
}

// postMessageToPage 함수 수정
function postMessageToPage(type, dataUrl) {
  let processedData = dataUrl;
  if (dataUrl && dataUrl.startsWith("data:image/")) {
    processedData = sanitizeImageData(dataUrl);
  }

  const response = {
    type,
    ok: processedData !== null,
    dataUrl: processedData,
    format: "jpeg", // 이미지 형식 명시
    timestamp: new Date().getTime(),
  };

  window.postMessage(response, "*");
}

// 캡처 완료 후 하이라이트 표시 함수
function showCaptureHighlight() {
  // 하이라이트 표시 제거
  return;
}
