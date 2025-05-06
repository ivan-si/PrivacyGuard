// background.js - CORRECTED Example

// --- Initialization ---
chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Background] Extension installed or updated:", details.reason);

  // Set default values on first install or if missing
  chrome.storage.local.get([
      'fingerprintProtectionEnabled',
      'trackerBlockingEnabled' // Assuming you still have tracker blocking
    ], (result) => {
      let defaultsToSet = {};
      if (typeof result.fingerprintProtectionEnabled === 'undefined') {
          console.log("[Background] Initializing fingerprintProtectionEnabled to true.");
          defaultsToSet.fingerprintProtectionEnabled = true;
      }
      if (typeof result.trackerBlockingEnabled === 'undefined') {
          console.log("[Background] Initializing trackerBlockingEnabled to true.");
          defaultsToSet.trackerBlockingEnabled = true;
          // Also initialize related things if tracker blocking is new
          defaultsToSet.blockedTrackers = 0;
      }
       if (Object.keys(defaultsToSet).length > 0) {
            defaultsToSet.fpDetectionCounts = {}; // Always initialize/reset this? Or check too?
            chrome.storage.local.set(defaultsToSet)
                .then(() => {
                    console.log("[Background] Default settings saved.");
                    // Update DNR rules if tracker setting was initialized
                    if (defaultsToSet.trackerBlockingEnabled) {
                        updateRulesets();
                    }
                })
                .catch(error => {
                    console.error("[Background] Error saving default settings:", error);
                });
       } else {
            console.log("[Background] Existing settings found.");
            // Still might want to update rulesets on update?
            updateRulesets();
       }
   });
});


// --- Declarative Net Request Rule Management (Example) ---
async function updateRulesets() {
  try {
    const settings = await chrome.storage.local.get(['trackerBlockingEnabled']);
    const enableRulesetIds = settings.trackerBlockingEnabled ? ["ruleset_1"] : [];
    const disableRulesetIds = settings.trackerBlockingEnabled ? [] : ["ruleset_1"];

    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enableRulesetIds,
      disableRulesetIds: disableRulesetIds
    });
    console.log(`[Background] Rulesets updated. Enabled: ${enableRulesetIds.join(', ') || 'None'}.`);
  } catch (error) {
      console.error("[Background] Error updating DNR rulesets:", error);
  }
}


// --- Combined Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[Background] Received message:", message);
  let isResponseAsync = false;

  // --- Stats Request (Example) ---
  if (message.type === 'GET_STATS') {
    isResponseAsync = true;
    chrome.storage.local.get(['blockedTrackers'], (data) => {
      sendResponse({
        blockedTrackers: data.blockedTrackers || 0
      });
    });
  }

  // --- Toggle Tracker Blocking (Example) ---
  else if (message.type === 'TOGGLE_TRACKER_BLOCKING') {
    if (typeof message.enabled !== 'undefined') {
        chrome.storage.local.set({ trackerBlockingEnabled: message.enabled })
        .then(() => {
            console.log(`[Background] Tracker blocking ${message.enabled ? 'enabled' : 'disabled'}.`);
            updateRulesets(); // Update rules after setting changes
            // sendResponse({ status: "Tracker blocking setting updated" }); // Optional response
        }).catch(error => {
            console.error("[Background] Error setting tracker blocking:", error);
            // sendResponse({ status: "Error updating setting" }); // Optional error response
        });
        // isResponseAsync = true; // Set to true if using .then() with sendResponse
    }
  }

  // --- Toggle Fingerprint Protection ---
  // Handles toggle message FROM popup/options
  else if (message.type === 'TOGGLE_FINGERPRINT_PROTECTION') {
     if (typeof message.enabled !== 'undefined') {
        isResponseAsync = true; // Because we query tabs and send message async
        chrome.storage.local.set({ fingerprintProtectionEnabled: message.enabled })
        .then(() => {
            console.log(`[Background] Fingerprint protection ${message.enabled ? 'enabled' : 'disabled'}.`);
            // Inform active content script about the change so it can react immediately
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].id) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        type: 'FINGERPRINT_PROTECTION_CHANGED', // Message type content script listens for
                        enabled: message.enabled
                    }, response => {
                         if (chrome.runtime.lastError) {
                            console.warn("[Background] Error sending FP change to active tab:", chrome.runtime.lastError.message);
                            sendResponse({ status: "FP setting updated, but couldn't notify active tab." });
                         } else {
                            console.log("[Background] FP change message sent to active tab.");
                            sendResponse({ status: "FP setting updated and active tab notified." });
                         }
                    });
                } else {
                     console.warn("[Background] Could not find active tab to notify for FP change.");
                     sendResponse({ status: "FP setting updated, but no active tab found." });
                }
            }); // End chrome.tabs.query
        }).catch(error => {
            console.error("[Background] Error setting fingerprint protection:", error);
            sendResponse({ status: "Error updating FP setting" });
        });
     } else {
         console.warn("[Background] TOGGLE_FINGERPRINT_PROTECTION message missing 'enabled' property.");
         // sendResponse({ status: "Error: Malformed message"}); // Optional
     }
  }

  // --- Fingerprinting Detected ---
  // Handles notification message FROM content script
  else if (message.type === 'FINGERPRINTING_DETECTED') {
    // Background simply logs this or updates counts/badges
    console.log(`[Background] Fingerprinting detected msg from ${sender.tab ? sender.tab.url : 'unknown tab'} via ${message.api}`);
    if (sender.tab && sender.tab.id) {
      isResponseAsync = true; // Because storage operations are async
      const tabId = sender.tab.id;
      const tabIdStr = tabId.toString();
      chrome.storage.local.get(['fpDetectionCounts'], (result) => {
        const counts = result.fpDetectionCounts || {};
        counts[tabIdStr] = (counts[tabIdStr] || 0) + 1;
        chrome.storage.local.set({ fpDetectionCounts: counts })
        .then(() => {
            // Update badge (ensure "action" permission is set in manifest)
            chrome.action.setBadgeText({ text: counts[tabIdStr].toString(), tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#FF0000', tabId: tabId }); // Red color
            sendResponse({ status: "Detection logged by background", count: counts[tabIdStr] }); // Optional response
        }).catch(error => {
             console.error("[Background] Error updating FP detection count:", error);
             sendResponse({ status: "Detection log error"}); // Optional error response
        });
      });
    } else {
        // Cannot update badge without tab ID
        // sendResponse({ status: "Detection logged, but no tab context." }); // Optional response
    }
  }

  // +++ NEW: Handle request for FP count from popup +++
  else if (message.type === 'GET_FP_COUNT_FOR_TAB') {
    const tabIdStr = message.tabId ? message.tabId.toString() : null;
    if (tabIdStr) {
         isResponseAsync = true; // Response is async due to storage.get
         // Get count from local storage (as used in FINGERPRINTING_DETECTED handler)
         chrome.storage.local.get(['fpDetectionCounts'], (result) => {
             if (chrome.runtime.lastError) {
                 console.error("[Background] Error getting fpDetectionCounts:", chrome.runtime.lastError.message);
                 sendResponse({ count: 0 }); // Send 0 on error
             } else {
                 const counts = result.fpDetectionCounts || {};
                 const count = counts[tabIdStr] || 0;
                 console.log(`[Background] Sending FP count ${count} for tab ${tabIdStr}`);
                 sendResponse({ count: count });
             }
         });
    } else {
         console.warn("[Background] GET_FP_COUNT_FOR_TAB missing tabId.");
         sendResponse({ count: 0 }); // No tab ID provided
    }
  }

  // Return true if we have planned to send a response asynchronously
  // ONLY return true if sendResponse might be called later in an async callback.
  // If all sendResponse calls happen synchronously or not at all for a message type, return false or nothing.
  return isResponseAsync;
});


// --- Optional Tab Cleanup Listener (Example) ---
chrome.tabs.onRemoved.addListener((tabId) => {
    chrome.storage.local.get(['fpDetectionCounts'], (result) => {
        const counts = result.fpDetectionCounts || {};
        if (counts[tabId.toString()]) {
            console.log(`[Background] Tab ${tabId} closed, removing fingerprint count.`);
            delete counts[tabId.toString()];
            chrome.storage.local.set({ fpDetectionCounts: counts });
        }
    });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Clear badge when a tab starts loading a new page or finishes
    if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
        chrome.action.setBadgeText({ text: '', tabId: tabId });
    }
});


// --- Optional Storage Change Listener (Example for DNR) ---
// Useful if settings could change via sync or other means
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.trackerBlockingEnabled) {
    console.log("[Background] trackerBlockingEnabled setting changed via storage, updating rulesets.");
    updateRulesets();
  }
});

console.log("[Background] Service worker started and listeners attached.");

// --- NO Fingerprinting Protection Code (initializeProtection, etc.) should be here ---
// --- NO HTMLCanvasElement, document, window manipulation code should be here ---