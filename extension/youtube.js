console.log("Vemo 익스텐션 작동 중...");

// 1. 상태 관리
let isOverlayActive = false;
let memoButton = null;
let overlay = null;

// 2. 썸네일 관련 함수들
const thumbnailHandlers = {
  addOverlayToThumbnail(thumbnail) {
    if (!isOverlayActive) return;

    thumbnail.style.visibility = "visible";
    thumbnail.style.position = "relative";
    thumbnail.style.transition = "transform 0.3s ease, filter 0.3s ease";

    const overlayDiv = this.createOverlayDiv();
    const playButton = this.createPlayButton();
    const triangleImg = this.createTriangleIcon();

    this.attachEventHandlers(thumbnail, overlayDiv, playButton, triangleImg);
  },

  createOverlayDiv() {
    const overlayDiv = document.createElement("div");
    overlayDiv.className = "thumbnail-overlay";
    overlayDiv.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10;
            pointer-events: none;
            background-color: rgba(255, 255, 255, 0.4);
            transition: background-color 0.3s ease;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(10px);
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
    return overlayDiv;
  },

  createPlayButton() {
    const playButton = document.createElement("div");
    playButton.style.cssText = `
            width: 70px;
            height: 70px;
            background: rgba(255, 255, 255, 0.7);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
            cursor: pointer;
            transition: transform 0.2s ease;
            position: relative;
        `;
    return playButton;
  },

  createTriangleIcon() {
    const triangleImg = document.createElement("div");
    triangleImg.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg"
                width="50" height="50" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#64B5F6" />
                        <stop offset="100%" stop-color="#2196F3" />
                    </linearGradient>
                </defs>
                <g transform="translate(50, 330) scale(0.8, -0.8)">
                    <path d="M44 295 c-15 -24 -14 -28 56 -150 66 -115 74 -125 100 -125 31 0 50 23 50 60 0 34 -119 220 -147 231 -35 13 -41 12 -59 -16z" fill="url(#gradient)"/>
                    <path d="M252 304 c-44 -30 -19 -114 34 -114 29 0 60 25 74 61 13 29 12 33 -9 50 -28 23 -69 24 -99 3z" fill="url(#gradient)"/>
                </g>
            </svg>
        `;
    return triangleImg;
  },

  attachEventHandlers(thumbnail, overlayDiv, playButton, triangleImg) {
    const handlers = {
      mouseenter: () => {
        if (!isOverlayActive) return;
        if (!overlayDiv.contains(playButton)) {
          playButton.appendChild(triangleImg);
          overlayDiv.appendChild(playButton);
          thumbnail.parentElement.appendChild(overlayDiv);
        }
        thumbnail.style.transform = "scale(1.3)";
        overlayDiv.style.backgroundColor = "rgba(33, 148, 243, 0.2)";
      },
      mouseleave: () => {
        if (!isOverlayActive) return;
        if (overlayDiv.contains(playButton)) playButton.remove();
        if (thumbnail.parentElement.contains(overlayDiv)) overlayDiv.remove();
        thumbnail.style.transform = "scale(1)";
        overlayDiv.style.backgroundColor = "transparent";
      },
      click: (e) => {
        if (!isOverlayActive) return;
        e.preventDefault();
        e.stopPropagation();
        this.handleThumbnailClick(e);
      },
    };

    thumbnail.addEventListener("mouseenter", handlers.mouseenter);
    thumbnail.addEventListener("mouseleave", handlers.mouseleave);
    thumbnail.addEventListener("click", handlers.click);

    thumbnail._vemoHandlers = handlers;
  },

  handleThumbnailClick(e) {
    const target = e.target;
    if (
      target.tagName === "IMG" &&
      target.classList.contains("yt-core-image")
    ) {
      const src = target.getAttribute("src");
      const match = src.match(/\/vi\/([^\/]+)\//);
      if (match && match[1]) {
        console.log("📌Video ID:", match[1]);
        window.location.href = `http://localhost:5050/vemo/${match[1]}`;
      }
    }
  },
};

// 3. 메모 버튼 관련 함수들
const memoButtonHandlers = {
  create() {
    if (memoButton) return;

    memoButton = document.createElement("button");
    memoButton.textContent = "📃영상 메모 바로가기";
    this.setMemoButtonStyle();
    this.attachMemoButtonEvents();
    document.body.appendChild(memoButton);
  },

  setMemoButtonStyle() {
    memoButton.style.cssText = `
            font-size: 15px;
            font-weight: bold;
            position: fixed;
            right: 20px;
            bottom: 54px;
            z-index: 9999;
            padding: 10px 20px;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        `;
  },

  attachMemoButtonEvents() {
    memoButton.addEventListener(
      "mouseenter",
      () => (memoButton.style.backgroundColor = "#1976D2")
    );
    memoButton.addEventListener(
      "mouseleave",
      () => (memoButton.style.backgroundColor = "#2196F3")
    );
    memoButton.addEventListener("click", this.handleMemoButtonClick);
  },

  handleMemoButtonClick() {
    isOverlayActive = !isOverlayActive;
    console.log("isOverlayActive:", isOverlayActive);

    if (isOverlayActive) {
      overlayHandlers.observe();
      overlayHandlers.create();
    } else {
      overlayHandlers.remove();
    }

    memoButton.textContent = isOverlayActive
      ? " 닫기 ❌"
      : "📃영상 메모 바로가기";
  },

  remove() {
    if (memoButton) memoButton.remove();
    memoButton = null;
    overlayHandlers.remove();
  },
};

// 4. 오버레이 관련 함수들
const overlayHandlers = {
  observe() {
    if (!isOverlayActive) return;
    console.log("observeThumbnails 실행 중");

    const observer = new MutationObserver(() => {
      document
        .querySelectorAll(
          "a#thumbnail img.yt-core-image.yt-core-image--fill-parent-height"
        )
        .forEach((thumbnail) => {
          if (!thumbnail.classList.contains("vemo-processed")) {
            thumbnail.classList.add("vemo-processed");
            thumbnailHandlers.addOverlayToThumbnail(thumbnail);
          }
        });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },

  create() {
    if (!isOverlayActive) return;
    if (overlay) return;
    this.remove();

    overlay = document.createElement("div");
    overlay.className = "vemo-overlay";

    document
      .querySelectorAll(
        "a#thumbnail img.yt-core-image.yt-core-image--fill-parent-height"
      )
      .forEach((thumbnail) => {
        if (!thumbnail.classList.contains("vemo-processed")) {
          thumbnail.classList.add("vemo-processed");
          thumbnailHandlers.addOverlayToThumbnail(thumbnail);
        }
      });

    document.body.appendChild(overlay);
  },

  remove() {
    if (overlay) overlay.remove();
    overlay = null;

    document.querySelectorAll(".vemo-processed").forEach((thumbnail) => {
      if (thumbnail._vemoHandlers) {
        thumbnail.removeEventListener(
          "mouseenter",
          thumbnail._vemoHandlers.mouseenter
        );
        thumbnail.removeEventListener(
          "mouseleave",
          thumbnail._vemoHandlers.mouseleave
        );
        thumbnail.removeEventListener("click", thumbnail._vemoHandlers.click);
        delete thumbnail._vemoHandlers;
      }

      thumbnail.classList.remove("vemo-processed");
      thumbnail.style.transform = "";
      thumbnail.style.visibility = "";
      thumbnail.style.position = "";
      thumbnail.style.transition = "";
    });

    document
      .querySelectorAll(".thumbnail-overlay")
      .forEach((el) => el.remove());
  },
};

// 5. 메시지 리스너 및 초기화
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "toggleButton") {
    isOverlayActive = request.isEnabled;
    overlayHandlers.remove();

    if (isOverlayActive) {
      memoButtonHandlers.create();
      isOverlayActive = false;
      overlayHandlers.create();
    } else {
      memoButtonHandlers.remove();
    }
  }
});

// 6. 초기 상태 설정
chrome.storage.sync.get(["isEnabled"], (result) => {
  if (result.isEnabled) {
    memoButtonHandlers.create();
  }
});
