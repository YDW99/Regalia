// StatsActivity.java — Fullscreen WebView activity for the 📊统计 stats page.
// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for GPL v3 compliance.

//
// Copyright (C) 2026 Regalia
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// The stats.html asset contains PGN parsing logic derived from DroidFish
// (GameTree/PgnToken/PgnScanner, Copyright (C) Peter Österlund, GPL v3).
// v1.0.8 PHASE 37/49: Although this Java file is original Regalia code, it is
//   classified as GPL v3 (not AGPL v3) to match the license of the stats.html
//   asset it exclusively hosts — the two form a single inseparable unit
//   (StatsActivity loads stats.html and the two communicate via
//   @JavascriptInterface). Keeping them under the same license avoids
//   dual-license confusion for redistributors. The GPL v3 boilerplate above
//   is therefore authoritative; earlier comments mentioning "AGPL v3" were
//   stale and have been removed.

package com.Regalia;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;

/**
 * v1.0.2 NEW FEATURE: Fullscreen WebView activity that displays the 📊统计
 * (statistics) page. The page is loaded from assets/stats.html and receives
 * the game PGN + eval data via an Intent extra.
 *
 * The activity handles:
 *   - Android back button: finish() (return to main game)
 *   - 💾HTML export: SAF picker → write HTML to user-chosen file
 *   - 🗃️导入 (Paste PGN / Select PGN file): handled entirely inside stats.html
 *       and StatsActivity — the SAF picker opens directly from this activity
 *       and the file content is passed back via onStatsPGNFileRead(content).
 *       No round-trip through MainActivity.
 *   - 🗂️复盘: finish() and notify main WebView to enter review mode
 *   - 返回对局: finish()
 *
 * License: GPL v3 (classified to match the stats.html asset it hosts, which
 * contains DroidFish-derived PGN parsing logic).
 */
public class StatsActivity extends Activity {

    private static final String TAG = "Regalia/StatsActivity";
    private static final int REQUEST_CODE_EXPORT_HTML = 2001;
    private static final int REQUEST_CODE_IMPORT_PGN = 2002;
    private WebView webView;
    private String statsPayload;
    // v1.0.8 PHASE 49: volatile — written by the WebView's JS thread (via
    //   @JavascriptInterface) inside evaluate() and cleared inside
    //   exportStats(), and read on the main thread (exportStats via
    //   runOnUiThread). Without volatile the main thread could see a stale
    //   null and skip the export, or see a stale non-null and export twice.
    private volatile String pendingExportHTML;
    // v1.0.4 Rev28: The PGN text imported on the stats page (via 🗃️ Paste PGN or
    // 📂 Select PGN File). When the user returns to the main activity, if this is
    // non-null, MainActivity prompts "🗃️ Import PGN to game?" Yes/No/Cancel.
    // Cleared to null when MainActivity reads it (one-shot consumption).
    // Static so MainActivity can access it without holding a StatsActivity ref.
    public static volatile String importedPGNOnStats = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // v1.0.5 Rev55: Fullscreen immersive mode — match MainActivity's
        // Android-15-aware approach. Previously used deprecated FLAG_FULLSCREEN
        // which conflicts with Edge-to-Edge enforcement on API 35+ (causes
        // black screen / offset viewport on HyperOS 3).
        try {
            requestWindowFeature(Window.FEATURE_NO_TITLE);
        } catch (Throwable e) {
            Log.w(TAG, "requestWindowFeature failed", e);
        }
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.R) {
            // FLAG_FULLSCREEN is valid on API 21-29 only; on API 30+ it
            // conflicts with Edge-to-Edge.
            getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                    WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }

        // Get the stats payload from the Intent
        statsPayload = getIntent().getStringExtra("statsPayload");
        if (statsPayload == null || statsPayload.isEmpty()) {
            Log.e(TAG, "No stats payload in Intent");
            finish();
            return;
        }

        // Create WebView
        webView = new WebView(this);
        // v1.0.5 Rev55: Match MainActivity's background color to avoid white flash.
        webView.setBackgroundColor(android.graphics.Color.parseColor("#1a0a0a"));
        // v1.0.5 Rev55: tapjacking defense (match MainActivity).
        webView.setFilterTouchesWhenObscured(true);
        setContentView(webView);

        // v1.0.5 Rev55: WebView security configuration — defense-in-depth parity
        // with MainActivity. The stats page also loads only local asset content,
        // but the security defaults should be identical to prevent a weaker
        // attack surface on the stats activity. Without these flags, a
        // compromised WebView (or a future code change that loads remote content)
        // could access file:// or content:// URIs.
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        // SECURITY: Disable all file/content access (same as MainActivity).
        // The stats page loads only from file:///android_asset/stats.html and
        // never needs file:// or content:// access — all PGN file I/O goes
        // through the JS bridge via SAF (Storage Access Framework).
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        // SECURITY: Block mixed content (no http subresource loads over https).
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);

        // Register a minimal JS bridge for the stats page
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String getStatsPayload() {
                return statsPayload;
            }

            // v1.0.8 PHASE 22 (bug fix): Expose system dark-mode state to stats.html.
            // Same implementation as StockfishNative.isSystemDarkMode() — reads
            // UiModeManager to reliably detect system dark/light mode on all
            // devices including Xiaomi HyperOS 3 where prefers-color-scheme is
            // unreliable. stats.html init() calls this to set data-theme attribute.
            @JavascriptInterface
            public boolean isSystemDarkMode() {
                try {
                    android.app.UiModeManager umm = (android.app.UiModeManager) getSystemService(UI_MODE_SERVICE);
                    if (umm == null) return true;
                    int mode = umm.getNightMode();
                    if (mode == android.app.UiModeManager.MODE_NIGHT_NO) return false;
                    if (mode == android.app.UiModeManager.MODE_NIGHT_YES) return true;
                    int curMode = getResources().getConfiguration().uiMode
                            & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
                    return curMode == android.content.res.Configuration.UI_MODE_NIGHT_YES;
                } catch (Throwable e) {
                    return true;
                }
            }

            @JavascriptInterface
            public void closeStatsPage() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        finish();
                    }
                });
            }

            // v1.0.2: Haptic feedback for stats page buttons.
            // v1.0.2 FIX: Respect the user's haptic preference (read from the
            // same "RegaliaEngine" prefs that StockfishNative.saveLangPref and
            // the haptic toggle use). Previously this always vibrated, ignoring
            // both the in-app haptic setting and the system haptic setting —
            // users who disabled haptic in main app settings still felt
            // vibration from stats page buttons. Also upgraded to VibrationEffect
            // on API 26+ to match StockfishNative's pattern (deprecated
            // vibrate(long) on newer APIs).
            @JavascriptInterface
            public void performHaptic(String type) {
                try {
                    // Check user preference (same prefs file as StockfishNative)
                    android.content.SharedPreferences prefs =
                            getSharedPreferences("RegaliaEngine", MODE_PRIVATE);
                    boolean appEnabled = prefs.getBoolean("hapticFeedbackEnabled", true);
                    boolean systemEnabled = android.provider.Settings.System.getInt(
                            getContentResolver(),
                            android.provider.Settings.System.HAPTIC_FEEDBACK_ENABLED, 1) != 0;
                    if (!appEnabled || !systemEnabled) return;

                    android.os.Vibrator v = (android.os.Vibrator) getSystemService(VIBRATOR_SERVICE);
                    if (v == null || !v.hasVibrator()) return;

                    // Use VibrationEffect on API 26+ for consistency with StockfishNative.
                    // Stats page only uses BUTTON_PRESS-style feedback, so a single
                    // short pulse is sufficient — we don't need the rich per-type
                    // patterns that the main app uses.
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                        try {
                            v.vibrate(android.os.VibrationEffect.createOneShot(
                                    20, android.os.VibrationEffect.DEFAULT_AMPLITUDE));
                        } catch (Throwable e) {
                            // Fallback: deprecated vibrate(long)
                            v.vibrate(20);
                        }
                    } else {
                        v.vibrate(20);
                    }
                } catch (Throwable e) {
                    Log.w(TAG, "performHaptic failed", e);
                }
            }

            @JavascriptInterface
            public void exportStatsHTML(String html) {
                pendingExportHTML = html;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                            intent.addCategory(Intent.CATEGORY_OPENABLE);
                            intent.setType("text/html");
                            intent.putExtra(Intent.EXTRA_TITLE, "Regalia_stats.html");
                            startActivityForResult(intent, REQUEST_CODE_EXPORT_HTML);
                        } catch (Throwable e) {
                            Log.e(TAG, "exportStatsHTML picker failed", e);
                            pendingExportHTML = null;
                        }
                    }
                });
            }

            // v1.0.2 FIX: Direct SAF file picker for PGN import from stats page.
            // Previously, the stats import dialog's "Select PGN File" button called
            // statsRequestImport() which finished the stats activity and bounced the
            // user back to the main activity before opening the picker — jarring UX.
            // Now we open ACTION_OPEN_DOCUMENT directly from StatsActivity, read the
            // file in onActivityResult, and pass the content back to stats.html via
            // the onStatsPGNFileRead(content) JS callback so the stats page can
            // re-render with the imported PGN without leaving the stats view.
            //
            // v1.0.2 CLEANUP: The old statsRequestImport() bridge method, the
            // MainActivity.pendingStatsImportRequest flag, and the main-WebView
            // onStatsRequestImport() handler have all been removed — the entire
            // import flow now stays inside StatsActivity, eliminating the round-trip.
            @JavascriptInterface
            public void statsSelectPGNFile() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                            intent.addCategory(Intent.CATEGORY_OPENABLE);
                            intent.setType("*/*");
                            intent.putExtra(Intent.EXTRA_MIME_TYPES,
                                    new String[]{"application/x-chess-pgn", "text/plain", "application/octet-stream"});
                            startActivityForResult(intent, REQUEST_CODE_IMPORT_PGN);
                        } catch (Throwable e) {
                            Log.e(TAG, "statsSelectPGNFile picker failed", e);
                            evalJs("if(typeof onStatsPGNFileRead==='function')onStatsPGNFileRead('')");
                        }
                    }
                });
            }

            @JavascriptInterface
            public void statsRequestReview() {
                // Close stats page and notify main WebView to enter review mode
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        MainActivity.pendingStatsReviewRequest = true;
                        finish();
                    }
                });
            }

            // v1.0.3: Load an asset file as base64 — used for GPL v3 logo in export dialog
            @JavascriptInterface
            public String loadAssetAsBase64(String assetPath) {
                // v1.0.5 Rev61: try-with-resources guarantees InputStream is closed
                // even if baos.write throws (e.g. OOM on a huge asset).
                try (java.io.InputStream is = getAssets().open(assetPath)) {
                    java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    int len;
                    while ((len = is.read(buffer)) != -1) {
                        baos.write(buffer, 0, len);
                    }
                    return android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
                } catch (Throwable e) {
                    Log.w(TAG, "loadAssetAsBase64 failed: " + assetPath, e);
                    return null;
                }
            }

            // v1.0.4 Rev28: Record the PGN text imported on the stats page (via
            // 🗃️ Paste PGN or 📂 Select PGN File). Called from stats.html's
            // _statsPastePGN() and onStatsPGNFileRead() handlers. The imported
            // PGN is stashed in the static importedPGNOnStats field; when the
            // user returns to MainActivity, MainActivity.onResume() checks this
            // field and prompts "🗃️ Import PGN to game?" if non-null.
            // One-shot: MainActivity clears the field after reading it.
            @JavascriptInterface
            public void setImportedPGN(String pgnText) {
                importedPGNOnStats = pgnText;
                Log.i(TAG, "Recorded imported PGN on stats page (" +
                        (pgnText != null ? pgnText.length() : 0) + " chars)");
            }

            // v1.0.4 Round-5 Rev27: Open an external http(s) URL in the system default
            // browser. Called from JS when the user taps any hyperlink in stats.html
            // (e.g. license links). Same security model as StockfishNative.openUrlInBrowser:
            // only http(s) URLs are allowed; all other schemes are silently rejected.
            @JavascriptInterface
            public void openUrlInBrowser(String url) {
                if (url == null) return;
                String trimmed = url.trim();
                if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
                    Log.w(TAG, "openUrlInBrowser rejected non-http(s) URL: " + trimmed);
                    return;
                }
                try {
                    Uri uri = Uri.parse(trimmed);
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    Log.i(TAG, "Opened external URL in browser: " + trimmed);
                } catch (Throwable e) {
                    Log.e(TAG, "openUrlInBrowser failed for: " + trimmed, e);
                }
            }
        }, "AndroidBridge");

        // Set WebViewClient to load stats.html from assets.
        // v1.0.4 Rev27: External http(s) URLs are now opened in the system browser
        // (defense-in-depth alongside the JS-side openUrlInBrowser bridge).
        // v1.1.2 PHASE 71 (robustness): Add the deprecated shouldOverrideUrlLoading
        //   overload (WebView, String) so that on API 21-23 (minSdk=21) external
        //   http(s) URLs are also redirected to the system browser. On those API
        //   levels, only the deprecated overload fires; the new
        //   WebResourceRequest-based overload is API 24+ only. Without this, a
        //   stats-page navigation to an external URL would load INTO the WebView
        //   (bypassing the system browser) on older devices. Also added
        //   onRenderProcessGone so that a render-process crash on the stats page
        //   finishes the activity instead of leaving a blank, unresponsive WebView
        //   (mirrors ChessWebViewClient's handling for the main chess board).
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = (request != null && request.getUrl() != null) ? request.getUrl().toString() : "";
                return _handleUrlOverride(url);
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return _handleUrlOverride(url != null ? url : "");
            }

            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                Log.e(TAG, "Stats WebView render process gone: crashed=" +
                        (detail != null && detail.didCrash()));
                try {
                    if (view != null) {
                        view.destroy();
                    }
                } catch (Throwable ignored) {}
                finish();
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Load the stats.html asset
        webView.loadUrl("file:///android_asset/stats.html");

        // v1.0.5 Rev55: Apply immersive mode (hide system bars) — match MainActivity.
        // The user expects the stats page to be fully immersive too.
        _applyImmersiveMode();

        Log.i(TAG, "StatsActivity created, loading stats.html");
    }

    /**
     * v1.1.2 PHASE 71: Shared URL-override logic for both the API 24+
     * {@link WebViewClient#shouldOverrideUrlLoading(WebView, WebResourceRequest)}
     * and the deprecated {@link WebViewClient#shouldOverrideUrlLoading(WebView, String)}
     * (which is the only one that fires on API 21-23). Returns {@code true} to
     * block the WebView from loading the URL ourselves; {@code false} to let
     * the WebView proceed (only for our own asset:// URLs).
     */
    private boolean _handleUrlOverride(String url) {
        if (url == null || url.isEmpty()) {
            return true; // Block empty URLs
        }
        if (url.startsWith("file:///android_asset/")) {
            return false; // Allow loading our own bundled assets
        }
        if (url.startsWith("http://") || url.startsWith("https://")) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Throwable e) {
                Log.w(TAG, "Failed to open external URL from stats WebView: " + url, e);
            }
            return true;
        }
        return true; // Block all other URL navigation (data:, javascript:, intent:, etc.)
    }

    /**
     * v1.0.5 Rev55: Apply immersive mode to hide system bars.
     * Mirrors MainActivity.enableImmersiveMode() — uses platform
     * WindowInsetsController on API 30+, legacy flags on API 21-29.
     */
    @android.annotation.SuppressLint("NewApi")
    private void _applyImmersiveMode() {
        try {
            if (android.os.Build.VERSION.SDK_INT >= 35) {
                // Android 15+: Edge-to-Edge enforced, just hide system bars.
                try {
                    getWindow().getInsetsController().hide(android.view.WindowInsets.Type.systemBars());
                    getWindow().getInsetsController().setSystemBarsBehavior(
                            android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                } catch (Throwable e) {
                    Log.w(TAG, "Android 15+ immersive mode failed", e);
                    _applyLegacyImmersive();
                }
                return;
            }
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                try {
                    getWindow().setDecorFitsSystemWindows(false);
                    getWindow().getInsetsController().hide(android.view.WindowInsets.Type.systemBars());
                    getWindow().getInsetsController().setSystemBarsBehavior(
                            android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                } catch (Throwable e) {
                    Log.w(TAG, "API 30-34 immersive mode failed", e);
                    _applyLegacyImmersive();
                }
                return;
            }
            _applyLegacyImmersive();
        } catch (Throwable e) {
            Log.w(TAG, "_applyImmersiveMode failed", e);
        }
    }

    private void _applyLegacyImmersive() {
        try {
            View decorView = getWindow().getDecorView();
            if (decorView != null) {
                decorView.setSystemUiVisibility(
                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_FULLSCREEN
                );
            }
        } catch (Throwable e) {
            Log.w(TAG, "_applyLegacyImmersive failed", e);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) _applyImmersiveMode();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_CODE_EXPORT_HTML) {
            String html = pendingExportHTML;
            pendingExportHTML = null;
            if (resultCode != RESULT_OK || data == null || data.getData() == null || html == null) {
                evalJs("if(typeof onStatsHTMLExported==='function')onStatsHTMLExported(false,'')");
                return;
            }
            try {
                Uri uri = data.getData();
                try (OutputStream os = getContentResolver().openOutputStream(uri);
                     OutputStreamWriter writer = new OutputStreamWriter(os, "UTF-8")) {
                    writer.write(html);
                    writer.flush();
                }
                String displayName = "Regalia_stats.html";
                try {
                    android.database.Cursor cursor = getContentResolver().query(uri, null, null, null, null);
                    if (cursor != null) {
                        try {
                            int nameIdx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                            if (nameIdx >= 0 && cursor.moveToFirst()) {
                                displayName = cursor.getString(nameIdx);
                            }
                        } finally { cursor.close(); }
                    }
                } catch (Throwable ignored) {}
                // v1.0.2 FIX: JSON-encode displayName for safe JS string passing.
                // Previously used displayName.replace("'", "\\'") which is
                // insufficient — a filename containing a backslash followed by
                // a quote, or a literal newline, would break the JS string
                // literal. JSON encoding handles all special characters safely.
                String jsonName;
                try {
                    jsonName = new org.json.JSONObject().put("name", displayName).toString();
                } catch (Throwable je) {
                    jsonName = "{\"name\":\"Regalia_stats.html\"}";
                }
                evalJs("if(typeof onStatsHTMLExported==='function'){try{var _d=" + jsonName + ";onStatsHTMLExported(true,_d.name);}catch(e){console.error('stats HTML export callback error:',e);}}");
            } catch (Throwable e) {
                Log.e(TAG, "Stats HTML export failed", e);
                evalJs("if(typeof onStatsHTMLExported==='function')onStatsHTMLExported(false,'')");
            }
        } else if (requestCode == REQUEST_CODE_IMPORT_PGN) {
            // v1.0.2 FIX: Read PGN file content and pass back to stats.html
            if (resultCode != RESULT_OK || data == null || data.getData() == null) {
                evalJs("if(typeof onStatsPGNFileRead==='function')onStatsPGNFileRead('')");
                return;
            }
            try {
                Uri uri = data.getData();
                // Take persistable permission so the URI remains usable if needed
                try {
                    getContentResolver().takePersistableUriPermission(
                            uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Throwable ignored) {}
                StringBuilder sb = new StringBuilder();
                try (InputStream is = getContentResolver().openInputStream(uri);
                     BufferedReader reader = new BufferedReader(new InputStreamReader(is, "UTF-8"))) {
                    String line;
                    int lineCount = 0;
                    final int MAX_LINES = 5000; // Match StockfishNative's limit
                    // v1.0.8 PHASE 32 ROBUSTNESS: track truncation and append a
                    //   warning comment (matching StockfishNative's behavior).
                    boolean truncated = false;
                    while ((line = reader.readLine()) != null) {
                        if (lineCount >= MAX_LINES) { truncated = true; break; }
                        sb.append(line).append("\n");
                        lineCount++;
                    }
                    if (truncated) {
                        sb.append("\n{ Warning: file truncated at ").append(MAX_LINES)
                          .append(" lines by Regalia import guard }\n");
                    }
                }
                String content = sb.toString();
                // Sanitize control characters (keep \n, \t, \r)
                content = content.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", "");
                // JSON-encode for safe JS string passing
                String jsonContent;
                try {
                    jsonContent = new org.json.JSONObject().put("content", content).toString();
                } catch (Throwable je) {
                    Log.e(TAG, "JSON encoding failed for stats PGN content", je);
                    jsonContent = "{\"content\":\"\"}";
                }
                evalJs("if(typeof onStatsPGNFileRead==='function'){try{var _d=" + jsonContent + ";onStatsPGNFileRead(_d.content);}catch(e){console.error('stats PGN read callback error:',e);}}");
            } catch (Throwable e) {
                Log.e(TAG, "Stats PGN file read failed", e);
                evalJs("if(typeof onStatsPGNFileRead==='function')onStatsPGNFileRead('')");
            }
        }
    }

    private void evalJs(final String js) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (webView != null) webView.evaluateJavascript(js, null);
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        // Handle Android back button.
        // v1.0.4 Rev28: Delegate to the JS-side returnToGame() so the
        // "🗃️ Import PGN to game?" interceptor can fire when a PGN was
        // imported on the stats page. returnToGame() either closes the
        // activity (no import) or shows the Yes/No/Cancel dialog (Cancel =
        // stay on stats page). If the import-back dialog is already visible,
        // back button = Cancel (dismiss dialog, stay on stats page).
        // v1.0.7 UI: Route through the unified handleStatsBackPress() which
        // also closes export/import dialogs created via DOM appendChild
        // (previously these were orphaned by the back button — only the
        // import-back Yes/No/Cancel was handled).
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (webView != null) {
                webView.evaluateJavascript(
                    "if(typeof handleStatsBackPress==='function'){handleStatsBackPress();}" +
                    "else if(typeof _statsImportBackDialogVisible!=='undefined'&&_statsImportBackDialogVisible){" +
                    "  _statsImportBackDismiss();" +
                    "} else if(typeof returnToGame==='function'){" +
                    "  returnToGame();" +
                    "}",
                    null);
                return true;
            }
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        // v1.0.8 PHASE 30: Full 6-step WebView teardown (matching MainActivity).
        //   Previously only webView.destroy() was called, which could leak JS
        //   callbacks, cause WindowLeaked exceptions, and leave a stale
        //   AndroidBridge interface pointing to the destroyed StatsActivity.
        if (webView != null) {
            try {
                if (webView.getParent() instanceof android.view.ViewGroup) {
                    ((android.view.ViewGroup) webView.getParent()).removeView(webView);
                }
            } catch (Throwable ignored) {}
            try { webView.clearHistory(); } catch (Throwable ignored) {}
            try { webView.loadUrl("about:blank"); } catch (Throwable ignored) {}
            try { webView.removeJavascriptInterface("AndroidBridge"); } catch (Throwable ignored) {}
            try { webView.onPause(); } catch (Throwable ignored) {}
            try { webView.destroy(); } catch (Throwable ignored) {}
            webView = null;
        }
        super.onDestroy();
    }
}
