package com.Regalia;

/*
 * Regalia - Main Activity
 * Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted
 * This code was AI-assisted and has been reviewed for AGPL v3 compliance.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * Regalia MainActivity - WebView-based chess game with Stockfish engine.
 *
 * Compatibility: Supports Android 5.0 (API 21) through Android 15 (API 35).
 * Android 15+ (API 35) Edge-to-Edge enforcement is handled via enableImmersiveMode().
 *
 * v18.4.1 CRITICAL FIX: Added robust crash protection:
 * - Wrapped entire onCreate in try-catch to prevent hard crash (闪退)
 * - AndroidX immersive mode uses reflection fallback if classes are missing
 * - All exception handlers log to logcat for debugging
 *
 * Version: v18.4.5
 */
public class MainActivity extends Activity {

    private static final String TAG = "Regalia";
    private static final String VERSION = "v1.0.0";

    private WebView webView;
    private StockfishNative stockfishEngine;
    private volatile boolean engineInitialized = false;
    private Handler initRetryHandler;
    private static final int INIT_RETRY_DELAY_MS = 5000; // 5 seconds
    private static final int INIT_MAX_RETRIES = 3;
    private int initRetryCount = 0;
    // OPT: P0 - Track if Activity is destroyed to prevent post-delayed callbacks from executing
    private volatile boolean isDestroyed = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // v18.4.1 CRITICAL FIX: Wrap ENTIRE onCreate in try-catch to prevent hard crash.
        // Previously, any uncaught exception here would crash the app immediately (闪退).
        // Now, we catch everything and show a fallback UI with the error message.
        try {
            onCreateInternal(savedInstanceState);
        } catch (Throwable e) {
            Log.e(TAG, "=== FATAL: onCreate crashed ===", e);
            try {
                showFallbackUI("\u5e94\u7528\u521d\u59cb\u5316\u5931\u8d25: " + e.getMessage());
            } catch (Throwable e2) {
                Log.e(TAG, "Even fallback UI failed", e2);
            }
        }
    }

    private void onCreateInternal(Bundle savedInstanceState) {
        // v18.4.6 CRITICAL FIX: Removed FLAG_FULLSCREEN — it is DEPRECATED since API 30
        // and CONFLICTS with Android 15+ Edge-to-Edge enforcement (targetSdk=35).
        // On Xiaomi HyperOS 3, FLAG_FULLSCREEN + setDecorFitsSystemWindows(false) causes
        // the WebView viewport to be pushed off-screen, resulting in COMPLETE BLACK SCREEN.
        // Instead, we rely on immersive mode (enableImmersiveMode) which is the correct
        // approach for hiding system bars on Android 11+.
        try {
            requestWindowFeature(Window.FEATURE_NO_TITLE);
        } catch (Throwable e) {
            Log.w(TAG, "requestWindowFeature failed", e);
        }

        // v18.4.6: Do NOT set FLAG_FULLSCREEN on API 30+ — it conflicts with Edge-to-Edge.
        // On API 21-29, FLAG_FULLSCREEN is still valid and needed for true fullscreen.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            try {
                getWindow().setFlags(
                        WindowManager.LayoutParams.FLAG_FULLSCREEN,
                        WindowManager.LayoutParams.FLAG_FULLSCREEN
                );
            } catch (Throwable e) {
                Log.w(TAG, "setFlags failed", e);
            }
        }

        // Try to create WebView - most likely point of failure
        try {
            webView = new WebView(this);
            // v18.4.6: Set WebView background to match CSS --bg (#1a0a0a) immediately,
            // so the user never sees a white flash or blank screen while chess.html loads.
            // This is critical for perceived startup speed on slow devices.
            webView.setBackgroundColor(Color.parseColor("#1a0a0a"));
        } catch (Throwable e) {
            Log.e(TAG, "WebView creation failed", e);
            showFallbackUI("WebView\u4e0d\u53ef\u7528: " + e.getMessage());
            return;
        }

        try {
            setContentView(webView);
        } catch (Throwable e) {
            Log.e(TAG, "setContentView failed", e);
            showFallbackUI("\u754c\u9762\u521b\u5efa\u5931\u8d25: " + e.getMessage());
            return;
        }

        // Enable immersive mode
        enableImmersiveMode();

        // Keep screen on during gameplay
        try {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } catch (Throwable e) {
            Log.w(TAG, "FLAG_KEEP_SCREEN_ON failed", e);
        }

        // Configure WebView settings
        try {
            WebSettings webSettings = webView.getSettings();
            webSettings.setJavaScriptEnabled(true);
            webSettings.setDomStorageEnabled(true);
            webSettings.setAllowFileAccess(true);
            webSettings.setAllowContentAccess(true);
            webSettings.setMediaPlaybackRequiresUserGesture(false);
            webSettings.setBuiltInZoomControls(false);
            webSettings.setDisplayZoomControls(false);
            webSettings.setUseWideViewPort(true);
            webSettings.setLoadWithOverviewMode(true);
            webSettings.setSupportZoom(false);
            webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
            webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            webSettings.setTextZoom(100);
            webSettings.setAllowFileAccessFromFileURLs(true);
            webSettings.setAllowUniversalAccessFromFileURLs(true);
            // Disable WebView force-dark (Android 10+) to prevent OEM dark mode
            // from inverting our dark theme colors (causes black-on-black text)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    webSettings.setForceDark(WebSettings.FORCE_DARK_OFF);
                } catch (Throwable e) {
                    // v18.4.6: setForceDark is deprecated in API 33+ but still functional.
                    // On some OEM WebViews it may throw — catch silently.
                    Log.w(TAG, "setForceDark failed (may be deprecated)", e);
                }
                // v18.4.6 FIX: Try BOTH setForceDarkBehavior AND setForceDarkStrategy.
                // The API name changed between Android 13 betas and release.
                // Some OEM ROMs (Xiaomi HyperOS) use the beta name, others use release name.
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    boolean strategySet = false;
                    // Try release API name first: setForceDarkStrategy
                    try {
                        java.lang.reflect.Method method = WebSettings.class.getMethod("setForceDarkStrategy", int.class);
                        method.invoke(webSettings, 0); // FORCE_DARK_ONLY_ON_WEB_THEME_SUPPORT = 0
                        strategySet = true;
                        Log.d(TAG, "setForceDarkStrategy(0) applied");
                    } catch (NoSuchMethodException e) {
                        Log.d(TAG, "setForceDarkStrategy not found, trying setForceDarkBehavior");
                    } catch (Throwable e) {
                        Log.w(TAG, "setForceDarkStrategy failed", e);
                    }
                    // Fallback: try beta API name: setForceDarkBehavior
                    if (!strategySet) {
                        try {
                            java.lang.reflect.Method method = WebSettings.class.getMethod("setForceDarkBehavior", int.class);
                            method.invoke(webSettings, 0);
                            strategySet = true;
                            Log.d(TAG, "setForceDarkBehavior(0) applied");
                        } catch (NoSuchMethodException e) {
                            Log.d(TAG, "Neither setForceDarkStrategy nor setForceDarkBehavior found — device may not support it");
                        } catch (Throwable e) {
                            Log.w(TAG, "setForceDarkBehavior failed", e);
                        }
                    }
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "WebSettings configuration error", e);
        }

        // Set WebViewClient - init engine directly when page loads
        webView.setWebViewClient(new ChessWebViewClient(this));

        // Set WebChromeClient
        webView.setWebChromeClient(new WebChromeClient());

        // Initialize Stockfish engine
        try {
            stockfishEngine = new StockfishNative(this);
            webView.addJavascriptInterface(stockfishEngine, "AndroidBridge");
        } catch (Throwable e) {
            Log.e(TAG, "StockfishNative initialization failed", e);
            stockfishEngine = null;
        }

        // Load the chess HTML
        try {
            webView.loadUrl("file:///android_asset/chess.html");
        } catch (Throwable e) {
            Log.e(TAG, "Failed to load chess.html", e);
            showFallbackUI("\u52a0\u8f7d\u68cb\u76d8\u9875\u9762\u5931\u8d25: " + e.getMessage());
        }

        // Setup delayed init retry as safety net — if onPageFinished fails to trigger
        // or engine init hangs, this will retry initialization
        initRetryHandler = new Handler(Looper.getMainLooper());
        scheduleInitRetry();
    }

    /**
     * Schedule a delayed retry of engine initialization.
     * This acts as a safety net in case onPageFinished doesn't fire
     * or the engine init thread hangs.
     */
    private void scheduleInitRetry() {
        initRetryHandler.removeCallbacksAndMessages(null);
        // v18.3.0: Lambda eliminated for HyperOS 3 ART compatibility (invokedynamic issue)
        initRetryHandler.postDelayed(new Runnable() {
            public void run() {
                // OPT: P0 - Guard against callback executing after Activity is finishing or destroyed.
                // This prevents crashes when the user exits the app before the delayed callback fires.
                if (isFinishing() || isDestroyed) {
                    Log.d(TAG, "Init retry skipped - activity is finishing or destroyed");
                    return;
                }
                if (stockfishEngine == null) {
                    Log.w(TAG, "Retry " + (initRetryCount + 1) + ": stockfishEngine is null, attempting re-creation");
                    try {
                        stockfishEngine = new StockfishNative(MainActivity.this);
                        webView.addJavascriptInterface(stockfishEngine, "AndroidBridge");
                    } catch (Throwable e) {
                        Log.e(TAG, "Engine re-creation failed", e);
                    }
                }
                if (stockfishEngine != null && !stockfishEngine.isEngineReady() && initRetryCount < INIT_MAX_RETRIES) {
                    initRetryCount++;
                    Log.i(TAG, "Delayed engine init retry " + initRetryCount + "/" + INIT_MAX_RETRIES);
                    initStockfishEngine();
                    // Also trigger JS-side init via evaluateJavascript as backup
                    try {
                        webView.evaluateJavascript(
                            "try{if(typeof AndroidBridge!=='undefined'&&AndroidBridge.initEngine){AndroidBridge.initEngine();}}catch(e){console.error('Delayed init error:',e);}",
                            null
                        );
                    } catch (Throwable e) {
                        Log.w(TAG, "JS delayed init call failed", e);
                    }
                    scheduleInitRetry();
                }
            }
        }, INIT_RETRY_DELAY_MS);
    }

    void initEngineAfterPermissions() {
        // FIX: null-safe check — if engineInitialized is true but stockfishEngine is null
        // (constructor failed), we must NOT throw NPE and should allow re-init attempts
        if (engineInitialized) {
            if (stockfishEngine != null && stockfishEngine.isEngineReady()) {
                Log.i(TAG, "Engine already ready, skipping init");
                return;
            }
            // Engine was marked initialized but not ready — reset flag to allow retry
            Log.w(TAG, "Engine init flag set but engine not ready, allowing retry");
            engineInitialized = false;
        }
        if (stockfishEngine == null) {
            Log.e(TAG, "Cannot init engine — stockfishEngine is null");
            return;
        }
        engineInitialized = true;
        initRetryCount = 0; // Reset retry count on successful init attempt
        Log.i(TAG, "Initializing engine");
        initStockfishEngine();
    }

    void initStockfishEngine() {
        if (stockfishEngine != null && !stockfishEngine.isEngineReady()) {
            try {
                stockfishEngine.initEngine();
            } catch (Throwable e) {
                Log.e(TAG, "Engine init failed", e);
            }
        }
    }

    private void showFallbackUI(String message) {
        try {
            LinearLayout layout = new LinearLayout(this);
            layout.setOrientation(LinearLayout.VERTICAL);
            layout.setGravity(Gravity.CENTER);
            layout.setBackgroundColor(Color.parseColor("#1a0a0a"));
            layout.setPadding(32, 32, 32, 32);

            TextView titleView = new TextView(this);
            titleView.setText("Regalia " + VERSION);
            titleView.setTextColor(Color.parseColor("#ffd700"));
            titleView.setTextSize(24);
            titleView.setGravity(Gravity.CENTER);
            titleView.setPadding(0, 0, 0, 24);

            TextView msgView = new TextView(this);
            msgView.setText(message);
            msgView.setTextColor(Color.parseColor("#f5e6c8"));
            msgView.setTextSize(16);
            msgView.setGravity(Gravity.CENTER);

            layout.addView(titleView);
            layout.addView(msgView);
            setContentView(layout);
        } catch (Throwable e) {
            Log.e(TAG, "Fallback UI failed", e);
        }
    }

    /**
     * v18.4.6 CRITICAL FIX: Completely rewrote enableImmersiveMode().
     *
     * ROOT CAUSE of black screen: The previous implementation used AndroidX reflection
     * (WindowCompat.setDecorFitsSystemWindows) to set decorFitsSystemWindows=false.
     * On Android 15+ (targetSdk=35), Edge-to-Edge is MANDATORY — the system already
     * sets decorFitsSystemWindows=false automatically. Our explicit call was CONFLICTING
     * with the system's Edge-to-Edge enforcement, causing the WebView's viewport to
     * be offset incorrectly (content pushed behind the status bar or off-screen entirely).
     *
     * FIX: On Android 15+ (API 35), do NOT call setDecorFitsSystemWindows at all —
     * let the system handle Edge-to-Edge natively. On Android 11-14 (API 30-34),
     * use the platform WindowInsetsController API directly (no AndroidX reflection).
     * On Android 5-10, use legacy system UI visibility flags.
     *
     * This eliminates the AndroidX reflection chain that was causing ClassNotFoundException
     * and VerifyError on some devices, and removes the conflicting setDecorFitsSystemWindows
     * call that was causing black screens on Xiaomi HyperOS 3.
     */
    @SuppressLint("NewApi")
    private void enableImmersiveMode() {
        try {
            // On Android 15+ (API 35+), Edge-to-Edge is enforced by the system.
            // Do NOT call setDecorFitsSystemWindows — it conflicts with the system setting.
            // Only hide the system bars using the platform API.
            if (Build.VERSION.SDK_INT >= 35) {
                // Android 15+: Use platform WindowInsetsController to hide system bars
                try {
                    getWindow().getInsetsController().hide(android.view.WindowInsets.Type.systemBars());
                    getWindow().getInsetsController().setSystemBarsBehavior(
                            android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    Log.d(TAG, "Android 15+ immersive mode: system bars hidden via platform API");
                } catch (Throwable e) {
                    Log.w(TAG, "Android 15+ insetsController failed, using legacy fallback", e);
                    applyLegacyImmersiveMode(getWindow().getDecorView());
                }
                return;
            }

            // Android 11-14 (API 30-34): Use platform WindowInsetsController
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    getWindow().setDecorFitsSystemWindows(false);
                    getWindow().getInsetsController().hide(android.view.WindowInsets.Type.systemBars());
                    getWindow().getInsetsController().setSystemBarsBehavior(
                            android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    Log.d(TAG, "Android 11-14 immersive mode applied via platform API");
                } catch (Throwable e) {
                    Log.w(TAG, "Platform insetsController failed, trying legacy", e);
                    try {
                        // Fallback: setDecorFitsSystemWindows + legacy flags
                        getWindow().setDecorFitsSystemWindows(false);
                    } catch (Throwable e2) {
                        Log.w(TAG, "setDecorFitsSystemWindows also failed", e2);
                    }
                    applyLegacyImmersiveMode(getWindow().getDecorView());
                }
                return;
            }

            // Android 5-10 (API 21-29): Legacy system ui visibility flags
            View decorView = getWindow().getDecorView();
            if (decorView != null) {
                applyLegacyImmersiveMode(decorView);
            }
        } catch (Throwable e) {
            Log.w(TAG, "enableImmersiveMode failed", e);
        }
    }

    /**
     * OPT: P0/P4 - Extracted legacy immersive mode logic for reuse and clarity.
     * Used on Android 5.x through Android 10 (API 21-29).
     */
    private void applyLegacyImmersiveMode(View decorView) {
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            enableImmersiveMode();
        }
    }

    /**
     * v18.5.0 FIX: Handle configuration changes (screen rotation) without Activity recreation.
     * Previously, android:screenOrientation="portrait" prevented rotation entirely.
     * Now with "unspecified", the Activity can rotate, and since configChanges includes
     * orientation|screenSize, the system calls this method instead of recreating the Activity.
     * We trigger a JS render() to update the CSS landscape/portrait layout.
     */
    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        int orientation = newConfig.orientation;
        Log.i(TAG, "Configuration changed: orientation=" +
                (orientation == Configuration.ORIENTATION_LANDSCAPE ? "landscape" :
                 orientation == Configuration.ORIENTATION_PORTRAIT ? "portrait" : "undefined"));
        // Re-apply immersive mode after rotation
        enableImmersiveMode();
        // Trigger JS-side re-render to apply landscape/portrait CSS rules
        if (webView != null) {
            try {
                webView.evaluateJavascript(
                    "try{if(typeof render==='function')render();}catch(e){console.error('render on config change failed:',e);}",
                    null
                );
            } catch (Throwable e) {
                Log.w(TAG, "Failed to trigger render on config change", e);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (webView != null) {
            try {
                webView.onResume();
            } catch (Throwable e) {
                Log.w(TAG, "webView.onResume failed", e);
            }
        }
        enableImmersiveMode();

        // Retry engine init if not ready (handles case where init failed previously)
        if (stockfishEngine != null && !stockfishEngine.isEngineReady() && !engineInitialized) {
            Log.i(TAG, "onResume: engine not initialized, retrying");
            initEngineAfterPermissions();
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        if (webView != null) {
            try {
                webView.onPause();
            } catch (Throwable e) {
                Log.w(TAG, "webView.onPause failed", e);
            }
        }
    }

    @Override
    public void onDestroy() {
        // OPT: P0 - Set destroyed flag first so delayed callbacks check it before executing.
        isDestroyed = true;

        // OPT: P0 - Cancel any pending init retry callbacks and release Handler reference
        // to prevent memory leaks and late callback execution.
        if (initRetryHandler != null) {
            initRetryHandler.removeCallbacksAndMessages(null);
            initRetryHandler = null;
        }
        // Notify JS to clean up event listeners and timers before destroying WebView
        if (webView != null) {
            try {
                webView.evaluateJavascript("try{if(typeof _cleanupEventListeners==='function')_cleanupEventListeners();}catch(e){}", null);
            } catch (Throwable ignored) {}
        }
        if (stockfishEngine != null) {
            try {
                stockfishEngine.shutdown();
            } catch (Throwable e) {
                Log.w(TAG, "Engine shutdown failed", e);
            }
        }
        if (webView != null) {
            try {
                webView.destroy();
            } catch (Throwable e) {
                Log.w(TAG, "WebView destroy failed", e);
            }
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView != null) {
                try {
                    webView.evaluateJavascript("if(typeof handleBackPress==='function'){handleBackPress();}", null);
                } catch (Throwable e) {
                    Log.w(TAG, "evaluateJavascript for back key failed", e);
                }
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /**
     * FIX: Handle SAF file picker results for settings import and export.
     * - REQUEST_CODE_IMPORT_SETTINGS: Reads the selected file via ContentResolver and imports settings.
     * - REQUEST_CODE_EXPORT_SETTINGS: Writes pending export content to the user-chosen location.
     */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK) return;
        if (stockfishEngine == null) return;
        try {
            if (requestCode == StockfishNative.REQUEST_CODE_IMPORT_SETTINGS) {
                stockfishEngine.handleFilePickerResult(data);
            } else if (requestCode == StockfishNative.REQUEST_CODE_EXPORT_SETTINGS) {
                stockfishEngine.handleExportFilePickerResult(data);
            } else if (requestCode == StockfishNative.REQUEST_CODE_IMPORT_PGN) {
                stockfishEngine.handlePGNFilePickerResult(data);
            }
        } catch (Throwable e) {
            Log.e(TAG, "onActivityResult failed for request " + requestCode, e);
        }
    }

    public WebView getWebView() {
        return webView;
    }
}
