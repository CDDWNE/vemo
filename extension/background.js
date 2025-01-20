chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureTab') {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, dataUrl => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ dataUrl: dataUrl });
            }
        });
        return true; // 비동기 응답을 위해 true 반환
    }

    if (request.action === 'startSelection') {
        sendResponse({ started: true });
        return true;
    }
});
