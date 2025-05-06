// content.js - Revised to inject via script src

(function () {
    'use strict';

    // --- Configuration ---
    const DEBUG_LOGGING = false;

    // --- Utility Functions (Content Script Scope) ---
    function logDebug(...args) { if (DEBUG_LOGGING) console.debug('[FP Protect CS - Debug]', ...args); }
    function logInfo(...args) { if (DEBUG_LOGGING) console.log('[FP Protect CS - Info]', ...args); }
    function logError(...args) { if (DEBUG_LOGGING) console.error('[FP Protect CS - Error]', ...args); }
    function logWarn(...args) { if (DEBUG_LOGGING) console.warn('[FP Protect CS - Warn]', ...args); }

    let injectionAttempted = false; // Prevent multiple injections per frame

    // --- Function to Inject Script via SRC ---
    function injectScriptFile() {
        if (injectionAttempted) {
            logDebug("Injection already attempted in this frame.");
            return;
        }
        injectionAttempted = true; // Mark as attempted

        try {
            const script = document.createElement('script');
            const scriptUrl = chrome.runtime.getURL('injected_script.js');
            logInfo(`Injecting script via src: ${scriptUrl}`);
            script.src = scriptUrl;

            // Important: Append to head to execute as early as possible
            (document.head || document.documentElement).appendChild(script);

            // Clean up the script tag after it has likely loaded/executed
            // Using setTimeout to allow the browser time to fetch and run it.
            // This isn't foolproof but better than leaving it.
            setTimeout(() => {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                    logDebug("Injection script tag removed from DOM (post-timeout).");
                }
            }, 100); // Adjust timeout if needed, but keep it short

        } catch (e) {
            logError('Script injection failed:', e);
            injectionAttempted = false; // Reset flag if injection itself failed
        }
    }

    // --- Initialization and Control Logic ---
    logDebug("Content script executing (SRC Injection strategy)...");

    try {
        logDebug("Checking initial storage setting 'fingerprintProtectionEnabled'...");
        chrome.storage.local.get(['fingerprintProtectionEnabled'], (result) => {
            if (chrome.runtime.lastError) { logError("CS Error getting initial setting:", chrome.runtime.lastError); return; }
            logDebug("CS Storage result:", result);
            if (result.fingerprintProtectionEnabled) {
                logInfo("CS Fingerprint protection enabled, attempting to inject script file...");
                injectScriptFile(); // Call the function to inject the file
            } else {
                logInfo('CS Fingerprint protection is disabled in storage.');
            }
        });
    } catch (e) { logError("CS Error accessing storage during initialization:", e); }

    try {
        logDebug("CS Adding message listener for 'FINGERPRINT_PROTECTION_CHANGED'...");
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            logDebug("CS Received message:", message);
            if (message.type === 'FINGERPRINT_PROTECTION_CHANGED') {
                logInfo(`CS Received FINGERPRINT_PROTECTION_CHANGED message: enabled=${message.enabled}`);
                if (typeof message.enabled !== 'undefined') {
                    if (message.enabled) {
                        logInfo("CS Enabling via message: Injecting script file (if not already done)...");
                        injectScriptFile(); // Attempt injection again (harmless if already attempted)
                        if (sendResponse) sendResponse({ status: "Injection initiated." });
                    } else {
                        logInfo('CS Setting disabled via message. Reload page required to remove applied modifications.');
                        if (sendResponse) sendResponse({ status: "Protection disabled, reload required." });
                    }
                } else { logWarn('CS Malformed message.'); if (sendResponse) sendResponse({ status: "Error: Malformed message." }); }
                return true;
            }
        });
        logDebug("CS Message listener added.");
    } catch (e) { logError("CS Error adding message listener:", e); }

    logDebug("Content script finished initial execution (SRC Injection strategy).");

})(); // End IIFE