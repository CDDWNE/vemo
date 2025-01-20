let isLoggedIn = true;

// DOM 요소 선택
const loginBtn = document.getElementById("login-btn");
const beforeLogin = document.getElementById("before-login");
const afterLogin = document.getElementById("after-login");

async function checkLocalHostToken() {
  try {
    // 현재 활성화된 탭 가져오기
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (
      !activeTab ||
      !activeTab.url ||
      !activeTab.url.includes("http://localhost:5050/")
    ) {
      const tabs = await chrome.tabs.query({
        url: "http://localhost:5050/*",
      });

      if (tabs.length === 0) {
        return null;
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const token = sessionStorage.getItem("token");
          return token;
        },
      });

      return result[0]?.result || null;
    }

    const result = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        const token = sessionStorage.getItem("token");
        return token;
      },
    });

    return result[0]?.result || null;
  } catch (error) {
    console.error("Token check failed:", error);
    return null;
  }
}

// 로그인 버튼 클릭 핸들러
loginBtn.addEventListener("click", async () => {
  const token = await checkLocalHostToken();

  if (token) {
    beforeLogin.classList.add("hidden");
    afterLogin.classList.remove("hidden");
  } else {
    chrome.tabs.create({ url: "http://localhost:5050/login" });
    window.close();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  beforeLogin.classList.add("hidden");
  afterLogin.classList.remove("hidden");
});

// 토글 버튼 이벤트 리스너
document.addEventListener("DOMContentLoaded", function () {
  // 초기 상태는 무조건 로그인 UI 표시
  beforeLogin.classList.add("hidden");
  afterLogin.classList.remove("hidden");

  const toggleButton = document.getElementById("toggleButton");

  chrome.storage.sync.get(["isEnabled"], function (result) {
    toggleButton.checked = result.isEnabled || false;
  });

  toggleButton.addEventListener("change", function () {
    const isEnabled = toggleButton.checked;
    chrome.storage.sync.set({ isEnabled: isEnabled });
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleButton",
          isEnabled: isEnabled,
        });
      }
    });
  });
});
