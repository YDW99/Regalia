// StatsActivity.java — Fullscreen WebView activity for the 📊统计 stats page.
// AI-GEN: AI assisted
// This code was AI-assisted and has been reviewed for AGPL v3 compliance.

//
// Copyright (C) 2026 Regalia
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
//
// The stats.html asset contains PGN parsing logic derived from DroidFish
// (GameTree/PgnToken/PgnScanner, Copyright (C) Peter Österlund, GPL v3).
// This Java file is original Regalia code (AGPL v3) — it only hosts the
// WebView and delegates all PGN parsing to the JavaScript in stats.html.

package com.Regalia;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
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
 * License: AGPL v3 (original Regalia code). The stats.html asset contains
 * DroidFish-derived PGN parsing logic under GPL v3.
 */
public class StatsActivity extends Activity {

    private static final String TAG = "Regalia/StatsActivity";
    private static final int REQUEST_CODE_EXPORT_HTML = 2001;
    private static final int REQUEST_CODE_IMPORT_PGN = 2002;
    private WebView webView;
    private String statsPayload;
    private String pendingExportHTML;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fullscreen immersive mode
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                WindowManager.LayoutParams.FLAG_FULLSCREEN);

        // Get the stats payload from the Intent
        statsPayload = getIntent().getStringExtra("statsPayload");
        if (statsPayload == null || statsPayload.isEmpty()) {
            Log.e(TAG, "No stats payload in Intent");
            finish();
            return;
        }

        // Create WebView
        webView = new WebView(this);
        setContentView(webView);

        // Configure WebView
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Register a minimal JS bridge for the stats page
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String getStatsPayload() {
                return statsPayload;
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
                try {
                    java.io.InputStream is = getAssets().open(assetPath);
                    java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                    byte[] buffer = new byte[4096];
                    int len;
                    while ((len = is.read(buffer)) != -1) {
                        baos.write(buffer, 0, len);
                    }
                    is.close();
                    return android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
                } catch (Throwable e) {
                    Log.w(TAG, "loadAssetAsBase64 failed: " + assetPath, e);
                    return null;
                }
            }
        }, "AndroidBridge");

        // Set WebViewClient to load stats.html from assets
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true; // Block all URL navigation
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        // Load the stats.html asset
        webView.loadUrl("file:///android_asset/stats.html");

        Log.i(TAG, "StatsActivity created, loading stats.html");
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
                    while ((line = reader.readLine()) != null && lineCount < MAX_LINES) {
                        sb.append(line).append("\n");
                        lineCount++;
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
        // Handle Android back button — return to main game
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            finish();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
