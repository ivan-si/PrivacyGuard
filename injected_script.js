(function () {
    // Re-define helpers or make them self-contained within this injected scope
    const INJ_DEBUG_LOGGING = false;
    const INJ_NOISE_LEVEL = 2;
    const INJ_NOISE_FREQUENCY = 0.03;
    const INJ_FONT_WIDTH_NOISE = 0.08;

    function inj_logDebug(...args) { if (INJ_DEBUG_LOGGING) console.debug('[FP Protect INJECTED - Debug]', ...args); }
    function inj_logInfo(...args) { if (INJ_DEBUG_LOGGING) console.log('[FP Protect INJECTED - Info]', ...args); }
    function inj_logError(...args) { if (INJ_DEBUG_LOGGING) console.error('[FP Protect INJECTED - Error]', ...args); }
    function inj_logWarn(...args) { if (INJ_DEBUG_LOGGING) console.warn('[FP Protect INJECTED - Warn]', ...args); }

    // --- INJECTED: notifyFingerprintingDetected ---
    // Note: Cannot call chrome.runtime.sendMessage from main world.
    // We can only log or potentially communicate via window.postMessage if needed.
    const inj_notifiedApis = new Set();
    function inj_notifyFingerprintingDetected(api) {
        if (!inj_notifiedApis.has(api)) {
            inj_notifiedApis.add(api);
            inj_logInfo('Fingerprinting attempt detected via: ' + api);
            // Cannot send chrome.runtime message here.
        }
    }

    // --- INJECTED: spoofFunctionSignature ---
    function inj_spoofFunctionSignature(newFunc, originalFunc) {
        // ... (Copy the implementation of spoofFunctionSignature here) ...
        if (typeof originalFunc !== 'function') { return newFunc; }
        try {
            const originalToStringResult = originalFunc.toString();
            Object.defineProperty(newFunc, 'toString', { value: () => originalToStringResult, enumerable: false, writable: false, configurable: true });
            Object.defineProperty(newFunc, 'length', { value: originalFunc.length, enumerable: false, writable: false, configurable: true });
            Object.defineProperty(newFunc, 'name', { value: originalFunc.name, enumerable: false, writable: false, configurable: true });
        } catch (e) { inj_logWarn('[FP Protect INJ] Could not fully spoof signature for ' + (originalFunc.name || 'func') + ':', e); }
        return newFunc;
    }

    // --- INJECTED: addCanvasNoise ---
    function inj_addCanvasNoise(imageData) {
        // ... (Copy the implementation of addCanvasNoise here, using INJ_ constants) ...
        if (!imageData || !imageData.data) return imageData;
        const pixels = imageData.data; const len = pixels.length; let noisyPixelCount = 0;
        for (let i = 0; i < len; i += 4) {
            if (Math.random() < INJ_NOISE_FREQUENCY) {
                noisyPixelCount++;
                const noiseR = Math.floor(Math.random() * (2 * INJ_NOISE_LEVEL + 1)) - INJ_NOISE_LEVEL;
                const noiseG = Math.floor(Math.random() * (2 * INJ_NOISE_LEVEL + 1)) - INJ_NOISE_LEVEL;
                const noiseB = Math.floor(Math.random() * (2 * INJ_NOISE_LEVEL + 1)) - INJ_NOISE_LEVEL;
                pixels[i] = Math.max(0, Math.min(255, pixels[i] + noiseR));
                pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noiseG));
                pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noiseB));
            }
        }
        if (noisyPixelCount > 0) { inj_logDebug('INJ Added Canvas noise to ' + noisyPixelCount + ' pixels.'); }
        return imageData;
    }

    // --- INJECTED: WebGL Noise/Helpers (Simplified for brevity) ---
    // You would need to copy addWebGLReadPixelsNoise and related logic here too if keeping WebGL
    function inj_addWebGLReadPixelsNoise(buffer, width, height, format, type, gl) {
        inj_logDebug("INJ WebGL noise (simplified placeholder)"); // Placeholder
        return buffer;
    }

    // --- INJECTED: Instance Patching Logic ---
    // This logic needs access to originals retrieved *within this scope*

    function inj_patchCanvas2DInstance(context) {
        if (!context || context._injInstancePatched) return;
        inj_logDebug('INJ Applying Canvas 2D instance patches:', context);
        const instanceOriginalGetImageData = context.getImageData;
        const instanceOriginalMeasureText = context.measureText;

        if (typeof instanceOriginalGetImageData === 'function') {
            const prot = CanvasRenderingContext2D.prototype; // Get prototype for internal calls
            const instanceProtectedGetImageData = function (...imgArgs) {
                inj_notifyFingerprintingDetected('Canvas getImageData'); inj_logDebug('INJ getImageData called');
                try {
                    const originalImageData = instanceOriginalGetImageData.call(this, ...imgArgs);
                    const noisyImageData = inj_addCanvasNoise(originalImageData); return noisyImageData;
                } catch (e) { inj_logError("INJ Error getImageData:", e); return instanceOriginalGetImageData.call(this, ...imgArgs); }
            };
            context.getImageData = inj_spoofFunctionSignature(instanceProtectedGetImageData, instanceOriginalGetImageData);
        }

        if (typeof instanceOriginalMeasureText === 'function') {
            const instanceProtectedMeasureText = function (text) {
                inj_notifyFingerprintingDetected('Font measureText'); inj_logDebug('INJ measureText called');
                try {
                    const metrics = instanceOriginalMeasureText.call(this, text); const noise = Math.random() * (2 * INJ_FONT_WIDTH_NOISE) - INJ_FONT_WIDTH_NOISE;
                    const noisyWidth = Math.max(0, metrics.width + noise); const noisyMetrics = {};
                    for (const key in metrics) { if (Object.prototype.hasOwnProperty.call(metrics, key)) noisyMetrics[key] = metrics[key]; }
                    noisyMetrics.width = noisyWidth; return Object.freeze(noisyMetrics);
                } catch (e) { inj_logError("INJ Error measureText:", e); return instanceOriginalMeasureText.call(this, text); }
            };
            context.measureText = inj_spoofFunctionSignature(instanceProtectedMeasureText, instanceOriginalMeasureText);
        }

        Object.defineProperty(context, '_injInstancePatched', { value: true, writable: false });
        inj_logDebug('INJ Canvas 2D instance patches applied.');
    }

    function inj_patchWebGLInstance(context) {
        if (!context || context._injInstancePatched) return;
        inj_logInfo('INJ Applying WebGL instance patches:', context);
        // ... Simplified: copy necessary WebGL patching logic here ...
        // Example for getParameter
        const gl = context;
        const originalGetParameter = gl.getParameter;
        if (typeof originalGetParameter === 'function') {
            const protectedGetParameter = function (pname) {
                // Simplified spoofing logic - copy full logic if needed
                if (pname === 37445 || pname === 37446) { // VENDOR or RENDERER (using debug consts)
                    inj_logDebug('INJ Spoofing WebGL VENDOR/RENDERER');
                    inj_notifyFingerprintingDetected('WebGL getParameter(Vendor/Renderer)');
                    return "Spoofed by Injection";
                }
                return originalGetParameter.call(this, pname);
            };
            gl.getParameter = inj_spoofFunctionSignature(protectedGetParameter, originalGetParameter);
        }
        // ... Add patches for getShaderPrecisionFormat, readPixels using inj_ helpers ...

        Object.defineProperty(context, '_injInstancePatched', { value: true, writable: false });
        inj_logInfo('INJ WebGL instance patches applied.');
    }


    // --- INJECTED: createElement Override ---
    inj_logInfo('Executing injected script to override createElement...');
    const inj_originalCreateElement = document.createElement;

    if (typeof inj_originalCreateElement !== 'function') {
        inj_logError("INJECTED script could not find original document.createElement!");
        return; // Stop injection if fundamental API is missing
    }

    const inj_protectedCreateElement = function (tagName, ...args) {
        const lowerTagName = typeof tagName === 'string' ? tagName.toLowerCase() : tagName;
        inj_logDebug('INJECTED createElement called! tagName:', lowerTagName);

        let element;
        try {
            element = inj_originalCreateElement.call(document, tagName, ...args);
        } catch (e) {
            inj_logError("INJECTED error calling original createElement:", e);
            throw e;
        }

        if (lowerTagName === 'canvas' && element instanceof HTMLCanvasElement) {
            inj_logInfo('INJECTED Canvas element created, applying instance patches...');
            try {
                const originalInstanceGetContext = element.getContext; // Get originals *from this instance*
                const originalInstanceToDataURL = element.toDataURL;

                // --- Patch getContext on instance ---
                if (typeof originalInstanceGetContext === 'function') {
                    const protectedInstanceGetContext = function (contextType, ...ctxArgs) {
                        inj_logDebug('INJ Instance getContext called, type:', contextType);
                        let context;
                        try { context = originalInstanceGetContext.call(element, contextType, ...ctxArgs); }
                        catch (e) { inj_logError("INJ Error original getContext:", e); throw e; }
                        // Trigger specific patching based on type
                        if (context) {
                            if (contextType === '2d' || context instanceof CanvasRenderingContext2D) {
                                inj_patchCanvas2DInstance(context);
                            } else if (contextType === 'webgl' || contextType === 'experimental-webgl' || context instanceof WebGLRenderingContext) {
                                inj_patchWebGLInstance(context);
                            } else if (contextType === 'webgl2' || context instanceof WebGL2RenderingContext) {
                                inj_patchWebGLInstance(context); // Basic patch for now
                                inj_logWarn("INJ WebGL2 detected, may be incomplete.");
                            }
                        }
                        return context;
                    };
                    element.getContext = inj_spoofFunctionSignature(protectedInstanceGetContext, originalInstanceGetContext);
                    inj_logDebug("INJ Instance getContext patched.");
                } else { inj_logWarn("INJ Instance getContext not found/function."); }

                // --- Patch toDataURL on instance ---
                if (typeof originalInstanceToDataURL === 'function') {
                    const protectedInstanceToDataURL = function (...urlArgs) {
                        inj_notifyFingerprintingDetected('Canvas toDataURL'); inj_logDebug('INJ Instance toDataURL called');
                        try {
                            const width = element.width; const height = element.height;
                            if (width === 0 || height === 0) return originalInstanceToDataURL.call(element, ...urlArgs);
                            // Use ORIGINAL prototype methods internally for drawing/getting data
                            const protoGetContext = HTMLCanvasElement.prototype.getContext;
                            const protoGetImageData = CanvasRenderingContext2D.prototype.getImageData;
                            const protoToDataURL = HTMLCanvasElement.prototype.toDataURL;
                            let ctx; try { ctx = protoGetContext.call(element, '2d'); } catch (e) { inj_logWarn("INJ internal getContext failed", e); return originalInstanceToDataURL.call(element, ...urlArgs); }
                            if (!ctx) return originalInstanceToDataURL.call(element, ...urlArgs);
                            const imgData = protoGetImageData.call(ctx, 0, 0, width, height);
                            const noisyImgData = inj_addCanvasNoise(imgData);
                            // Temp canvas - use ORIGINAL createElement/getContext for safety
                            const tempCanvas = inj_originalCreateElement.call(document, 'canvas'); tempCanvas.width = width; tempCanvas.height = height;
                            const tempCtx = protoGetContext.call(tempCanvas, '2d');
                            if (!tempCtx) return originalInstanceToDataURL.call(element, ...urlArgs);
                            tempCtx.putImageData(noisyImgData, 0, 0);
                            // Use ORIGINAL prototype toDataURL on temp canvas
                            return protoToDataURL.call(tempCanvas, ...urlArgs);
                        } catch (e) { inj_logError("INJ Error toDataURL:", e); return originalInstanceToDataURL.call(element, ...urlArgs); }
                    };
                    element.toDataURL = inj_spoofFunctionSignature(protectedInstanceToDataURL, originalInstanceToDataURL);
                    inj_logDebug("INJ Instance toDataURL patched.");
                } else { inj_logWarn("INJ Instance toDataURL not found/function."); }

            } catch (patchError) {
                inj_logError("INJECTED error applying instance patches:", patchError);
            }
        }
        return element;
    };

    // Apply the override and spoof signature
    try {
        document.createElement = inj_spoofFunctionSignature(inj_protectedCreateElement, inj_originalCreateElement);
        inj_logInfo('INJECTED document.createElement override successful.');
    } catch (e) {
        inj_logError('INJECTED CRITICAL error assigning createElement override:', e);
        // Attempt to revert if override fails? Difficult in injected script.
    }

})(); // End injected IIFE