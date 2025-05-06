# PrivacyGuard Chrome Extension

PrivacyGuard is a browser extension for Google Chrome designed to enhance user privacy by providing basic ad blocking and attempting to mitigate browser fingerprinting techniques.

## Features

* **Ad Blocking:**
    * **Network-Level Blocking:** Blocks network requests to known tracker and ad domains using Chrome's Declarative Net Request API. Rules are defined in `dnr_rules.json`.
    * **Cosmetic Filtering:** Hides ad elements (banners, containers, etc.) on web pages by injecting CSS rules. Selectors are loaded from `rules.json` and applied via a content script (`css-blocking.js`).
* **Fingerprint Spoofing:**
    * Attempts to modify Canvas and WebGL fingerprinting vectors to reduce uniqueness.
    * Injects noise into Canvas `toDataURL` and `getImageData` outputs.
    * Randomizes font width metrics returned by `measureText`.
    * Spoofs WebGL vendor/renderer strings returned by `getParameter`.
    * Adds noise to WebGL `readPixels` output and `getShaderPrecisionFormat` results.
* **Activity Counters (Popup Feature):**
    * Displays the number of trackers blocked (via DNR) in the extension popup.
    * Displays the number of fingerprinting attempts detected/intercepted on the current active page in the popup.

## Implementation Details

* **Manifest V3:** Built using the Manifest V3 extension platform.
* **Background Script (`background.js`):** Manages extension state, handles settings storage (`chrome.storage.local`), coordinates communication between scripts, manages DNR ruleset enabling/disabling, and aggregates counts for the popup.
* **Content Scripts:**
    * `css-blocking.js`: Runs at `document_start`, fetches CSS selectors from `rules.json` (via `web_accessible_resources`), and injects CSS into the page head to hide elements.
    * `content.js`: Runs at `document_start` primarily to inject `injected_script.js` into the page's main world. Also handles communication setup with the background script.
* **Main-World Injection (`injected_script.js`):** To overcome content script isolation and race conditions with early-running page scripts, this script is injected via `<script src="...">` (using `web_accessible_resources` and `chrome.runtime.getURL`). It runs in the page's main JavaScript context and overrides `document.createElement`.
* **Fingerprinting Patches:** The injected script patches canvas/WebGL methods (`getContext`, `toDataURL`, `getParameter`, etc.) directly on the element/context *instance* when it's created or accessed, aiming to modify the fingerprint before the page script can use it. Includes `toString()` spoofing to make patches appear native.
* **Declarative Net Request (`dnr_rules.json`):** Defines network blocking rules processed efficiently by the browser engine.
* **Popup (`popup.html`, `popup.js`, `popup.css`):** Provides a user interface for enabling/disabling features and viewing the activity counters. Fetches data from the background script upon opening.

## Development Challenges

* **Manifest Configuration:** Encountered errors due to incorrectly referencing the same rules file for both DNR (expecting an Array) and CSS blocking (expecting an Object). Resolved by using separate `dnr_rules.json` and `rules.json` files.
* **Race Conditions:** The primary challenge was reliably patching browser APIs (Canvas, WebGL) before scripts loaded synchronously in the page's `<head>` could access the original, unpatched functions. Standard `document_start` content script patching proved insufficient due to timing and isolated worlds.
* **Content Security Policy (CSP):** An initial attempt at main-world injection using inline scripts (`script.textContent`) was blocked by website CSPs. The solution required switching to injecting an external script file (`injected_script.js`) via `script.src`, permitted by declaring it in `web_accessible_resources`.
* **Debugging:** Diagnosing the subtle timing issues and confirming whether overrides were being invoked required careful use of console logging, the "Preserve log" DevTools feature, and creating minimal test cases.

## Testing & Evaluation

* **Test Environment:** Functionality was tested using a custom Flask-based web application (`wpltracker.py` - see below) designed to simulate tracking and fingerprinting, as well as public test sites like Cover Your Tracks (EFF).
* **Ad Blocking:** The DNR and CSS blocking rules successfully block and hide *some* ads and tracker requests based on the defined rules. However, the current rule lists are minimal and do not provide comprehensive coverage compared to established ad blockers.
* **Fingerprint Spoofing:** The Canvas and WebGL spoofing techniques successfully modify the underlying data (verified on simple test pages). However, sophisticated test sites like Cover Your Tracks **can still detect that the fingerprinting metrics are being spoofed**, indicating the methods introduce detectable inconsistencies.
* **Activity Counters:** The popup correctly displays the count of blocked trackers (debug only) and fingerprinting attempts detected on the active page, providing user feedback.

## Test Website (`wpltracker.py`)

A simple Flask application (`wpltracker.py`) was used during development to simulate basic tracking and fingerprinting scenarios. It includes routes to serve tracker scripts (like `trackerbf.js` which performs canvas fingerprinting) and log received data, allowing for controlled testing of the extension's blocking and spoofing capabilities.

*(You would typically include the `wpltracker.py` code or link to it here if sharing the repository)*

## Installation (Unpacked Extension)

1.  Download or clone this repository.
2.  Open Google Chrome and navigate to `chrome://extensions/`.
3.  Enable "Developer mode" using the toggle switch in the top-right corner.
4.  Click the "Load unpacked" button.
5.  Select the directory containing the extension's files (including `manifest.json`).
6.  The PrivacyGuard extension should now be installed and active.

## Future Improvements

* Expand `dnr_rules.json` and `rules.json` significantly by incorporating rules from standard blocklists (e.g., EasyList, EasyPrivacy) for more effective ad/tracker blocking. This would require implementing a parser and update mechanism.
* Refine fingerprinting spoofing techniques to be less detectable by specialized test sites.
* Implement protection against other fingerprinting vectors (e.g., AudioContext, Fonts, Navigator properties).
* Develop a more sophisticated UI for managing custom rules or viewing detailed blocking information.
* Implement a reliable production method for counting blocked trackers (as `onRuleMatchedDebug` is development-only).
