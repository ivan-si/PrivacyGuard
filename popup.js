// popup.js (Revised and Feature Added)

document.addEventListener('DOMContentLoaded', () => {
  // Get references to all UI elements
  const trackerBlockingToggle = document.getElementById('trackerBlockingToggle');
  const blockCountSpan = document.getElementById('blockCount'); // For tracker count
  const fingerprintProtectionToggle = document.getElementById('fingerprintProtectionToggle');
  const fpCountSpan = document.getElementById('fpCount'); // Get the NEW element for FP count

  console.log("Popup script loaded."); // Basic check

  // --- Load Initial State from Storage & Fetch Fresh Counts ---

  // 1. Load initial toggle states from storage
  chrome.storage.local.get(
      ['trackerBlockingEnabled', 'fingerprintProtectionEnabled'],
      (result) => {
          if (chrome.runtime.lastError) {
              console.error("Popup: Error loading toggle states:", chrome.runtime.lastError);
              // Set visual defaults on error
              trackerBlockingToggle.checked = true;
              fingerprintProtectionToggle.checked = true;
          } else {
              console.log("Popup: Initial toggle state loaded:", result);
              // Set toggles (default to true if undefined, consistent with background init)
              trackerBlockingToggle.checked = (typeof result.trackerBlockingEnabled === 'undefined') ? true : !!result.trackerBlockingEnabled;
              fingerprintProtectionToggle.checked = (typeof result.fingerprintProtectionEnabled === 'undefined') ? true : !!result.fingerprintProtectionEnabled;
          }
      }
  );

  // 2. Fetch UP-TO-DATE counts from background script when popup opens
  // Fetch Global Tracker Count
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
      if (chrome.runtime.lastError) {
          console.error("Popup: Error getting stats (tracker count):", chrome.runtime.lastError.message);
          blockCountSpan.textContent = 'N/A';
      } else if (response) {
           console.log("Popup: Received stats:", response);
           // Use response.blockedTrackers, handle if it's missing or zero
           blockCountSpan.textContent = response.blockedTrackers || 0;
      } else {
          blockCountSpan.textContent = '0'; // Default to 0 if no response
          console.warn("Popup: No response received for GET_STATS.");
      }
  });

  // Fetch Fingerprint Count for the current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
          console.error("Popup: Error querying active tab:", chrome.runtime.lastError);
          if(fpCountSpan) fpCountSpan.textContent = 'N/A';
          return;
      }
      if (tabs && tabs.length > 0 && tabs[0].id && fpCountSpan) {
          const currentTabId = tabs[0].id;
          chrome.runtime.sendMessage(
              { type: 'GET_FP_COUNT_FOR_TAB', tabId: currentTabId },
              (response) => {
                  if (chrome.runtime.lastError) {
                      console.error("Popup: Error getting FP count:", chrome.runtime.lastError.message);
                      fpCountSpan.textContent = 'N/A';
                  } else if (response) {
                      console.log("Popup: Received FP count:", response.count);
                      fpCountSpan.textContent = response.count || 0;
                  } else {
                      fpCountSpan.textContent = 'N/A'; // No response
                  }
              }
          );
      } else if (fpCountSpan) {
          fpCountSpan.textContent = 'N/A'; // Cannot get tab ID
          console.warn("Popup: Could not get active tab ID for FP count.");
      }
  });


  // --- Add Event Listeners for Toggles ---

  // Tracker Blocking Toggle
  trackerBlockingToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      console.log(`Popup: Tracker blocking toggled to ${isEnabled}`);
      // Update storage (optional here, background also does it, but good for immediate UI feel)
      chrome.storage.local.set({ trackerBlockingEnabled: isEnabled });
      // Send message to background to update setting and DNR rules
      chrome.runtime.sendMessage({ type: 'TOGGLE_TRACKER_BLOCKING', enabled: isEnabled });
  });

  // Fingerprint Protection Toggle
  fingerprintProtectionToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      console.log(`Popup: Fingerprint protection toggled to ${isEnabled}`);
      // Update storage (optional here)
      chrome.storage.local.set({ fingerprintProtectionEnabled: isEnabled });
      // Send message to background to update setting AND notify content script
      chrome.runtime.sendMessage(
          { type: 'TOGGLE_FINGERPRINT_PROTECTION', enabled: isEnabled },
          (response) => { // Optional: Log background response
              if (chrome.runtime.lastError) {
                   console.warn("Popup: Error receiving response from background FP toggle:", chrome.runtime.lastError.message);
              } else if (response) {
                   console.log("Popup: Background response to FP toggle:", response);
              }
          }
       );
  });
}); // End DOMContentLoaded