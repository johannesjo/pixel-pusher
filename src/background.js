"use strict";
// Background script to relay messages between DevTools and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateOverlayFromPanel') {
        // Forward message to all tabs
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (tab.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'updateOverlay',
                        state: message.state
                    }).catch(() => {
                        // Ignore errors for tabs where content script isn't injected
                    });
                }
            });
        });
    }
});
