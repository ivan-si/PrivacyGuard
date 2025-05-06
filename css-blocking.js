// css-blocking.js - Loads rules from rules.json (Corrected Version)

(async function() { // Wrap in async IIFE to use await
  'use strict';

  // --- Configuration ---
  // Rules are loaded from rules.json

  const HIDING_STYLE_PROPERTIES = `
      display: none !important;
      visibility: hidden !important;
      width: 0 !important;
      height: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
      position: absolute !important;
      top: -9999px !important;
      left: -9999px !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      overflow: hidden !important;
  `;

  // --- Functions ---

  /**
   * Loads rules from the rules.json file.
   * @returns {Promise<object|null>} A promise resolving with {target_domains, css_selectors} or null.
   */
  async function loadRules() {
      const rulesUrl = chrome.runtime.getURL('rules.json');
      console.log("[CSS Blocker] Attempting to load rules from:", rulesUrl);
      try {
          const response = await fetch(rulesUrl);
          if (!response.ok) {
              // Log detailed error for fetch failure
              console.error(`[CSS Blocker] Failed to fetch rules.json. Status: ${response.status} ${response.statusText}. URL: ${rulesUrl}`);
              throw new Error(`HTTP error ${response.status}`);
          }
          const rules = await response.json();
          if (typeof rules !== 'object' || rules === null) {
              throw new Error("rules.json content is not a valid JSON object.");
          }
          console.log("[CSS Blocker] Successfully loaded and parsed rules.json");
          // Provide default empty arrays if keys are missing/invalid
          return {
              target_domains: Array.isArray(rules.target_domains) ? rules.target_domains : [],
              css_selectors: Array.isArray(rules.css_selectors) ? rules.css_selectors : []
          };
      } catch (error) {
          console.error("[CSS Blocker] Error loading or parsing rules.json:", error);
          return null; // Indicate error
      }
  }

  /**
   * Generates the CSS rule string from a list of selectors.
   * @param {string[]} selectors - Array of CSS selectors.
   * @returns {string} The CSS rule string.
   */
  function generateCssRule(selectors) {
      if (!Array.isArray(selectors) || selectors.length === 0) {
          return '';
      }
      const validSelectors = selectors.filter(s => typeof s === 'string' && s.trim() !== '');
      if (validSelectors.length === 0) {
          return '';
      }
      const selectorString = validSelectors.join(',\n');
      const css = `
/* Injected by PrivacyGuard Extension */
${selectorString} {
  ${HIDING_STYLE_PROPERTIES}
}
      `;
      // console.log("[CSS Blocker] Generated CSS:", css); // Optional: Log generated CSS for debugging
      return css;
  }

  /**
   * Injects the CSS string into the document head.
   * @param {string} cssString - The CSS rules to inject.
   * @param {number} selectorCount - Number of selectors included for logging.
   */
  function injectCss(cssString, selectorCount) {
      if (!cssString) {
          console.log("[CSS Blocker] No valid CSS rules generated to inject.");
          return;
      }
      // Avoid duplicate injection in the same frame if script runs multiple times
      if (document.head.querySelector('style[data-injector="PrivacyGuard-CSS"]')) {
           console.log("[CSS Blocker] CSS already injected in this frame.");
           return;
      }

      try {
          const style = document.createElement('style');
          style.setAttribute('type', 'text/css');
          style.setAttribute('data-injector', 'PrivacyGuard-CSS'); // Use specific ID
          style.textContent = cssString;
          (document.head || document.documentElement).appendChild(style);
          console.log(`[CSS Blocker] Injected ${selectorCount} CSS hiding rules successfully.`);
      } catch (e) {
          console.error("[CSS Blocker] Failed to inject CSS:", e);
      }
  }

  /**
   * Main async function to load rules and apply blocking.
   */
  async function applyCssBlocking() {
      console.log("[CSS Blocker] applyCssBlocking started.");
      const rules = await loadRules();

      if (!rules) {
          console.warn("[CSS Blocker] Could not load rules. CSS blocking will be inactive.");
          return;
      }

      const targetDomains = rules.target_domains;
      const cssSelectors = rules.css_selectors;

      // Check if hostname matches (only if target_domains array is not empty)
      if (targetDomains.length > 0 && !targetDomains.includes(window.location.hostname)) {
           console.log(`[CSS Blocker] Domain ${window.location.hostname} not targeted by rules.json. Skipping CSS injection.`);
           return;
      }

      if (!Array.isArray(cssSelectors) || cssSelectors.length === 0) {
           console.log("[CSS Blocker] No CSS selectors found in rules.json.");
           return;
      }

      console.log(`[CSS Blocker] Applying ${cssSelectors.length} selectors for domain ${window.location.hostname}.`);
      const cssRulesString = generateCssRule(cssSelectors);
      injectCss(cssRulesString, cssSelectors.length);

      // MutationObserver previously removed - relying on CSS.
      // console.log("[CSS Blocker] CSS rules application process finished.");
  }

  // --- Execution ---
  console.log("[CSS Blocker] Script executing...");
  // Call the main async function.
  applyCssBlocking();

})(); // End async IIFE