package com.Regalia;

/*
 * Regalia - WebView Client
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

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.lang.ref.WeakReference;

/**
 * ChessWebViewClient - WebViewClient for the Regalia application.
 *
 * Handles page load events to trigger engine initialization.
 * Only allows navigation to local asset files for security.
 *
 * v18.6.0: Changed Activity reference to WeakReference to prevent memory leaks.
 * v1.0.4 Round-5 Rev27: shouldOverrideUrlLoading now OPENS external http(s)
 * URLs in the system default browser (defense-in-depth alongside the JS-side
 * openUrlInBrowser bridge). Previously, external links were silently blocked.
 *
 * Version: v1.2.3 (round-10: shouldOverrideUrlLoading now uses case-insensitive
 *   Uri.parse + equalsIgnoreCase for http(s) scheme check per RFC 3986 §3.1)
 */
public class ChessWebViewClient extends WebViewClient {
    private static final String TAG = "Regalia";
    private final WeakReference<MainActivity> activityRef;
    // v1.1.1 Phase 60 (audit P1-4.4): Render-process crash counter + last-crash
    //   timestamp for backoff. Static so the counter survives Activity recreate.
    private static int _renderCrashCount = 0;
    private static long _lastRenderCrashTime = 0L;

    public ChessWebViewClient(MainActivity activity) {
        this.activityRef = new WeakReference<>(activity);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        if (url == null) return true;
        // Allow local asset files to load normally
        if (url.startsWith("file:///android_asset/")) {
            return false;
        }
        // v1.0.4 Rev27: For http(s) URLs, open them in the system default browser
        // instead of silently blocking. This is defense-in-depth: the JS layer
        // already calls AndroidBridge.openUrlInBrowser() on link clicks, but if
        // a link is triggered by other means (e.g. meta refresh, JS window.open),
        // this WebViewClient layer catches it.
        // v1.2.1 round-10 (review-E P2): case-insensitive scheme check.
        //   RFC 3986 §3.1: scheme is case-insensitive — accept "HTTP://...", etc.
        Uri parsed = Uri.parse(url);
        String scheme = parsed.getScheme();
        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            try {
                Intent intent = new Intent(Intent.ACTION_VIEW, parsed);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                Activity activity = activityRef.get();
                if (activity != null) {
                    activity.startActivity(intent);
                } else {
                    // v1.2.3 round-13 (P2): Activity was destroyed — fall back
                    //   to the Application context. FLAG_ACTIVITY_NEW_TASK (set
                    //   above) is required for non-Activity contexts. Using
                    //   view.getContext() directly would return the dead Activity
                    //   (MainActivity passes `this` to the WebView constructor),
                    //   which could throw IllegalStateException on a destroyed
                    //   Activity. The outer catch (Throwable) masks it, but the
                    //   URL open would silently fail.
                    Context appCtx = view.getContext() != null
                            ? view.getContext().getApplicationContext() : null;
                    if (appCtx != null) {
                        appCtx.startActivity(intent);
                    }
                }
                Log.i(TAG, "Opened external URL via WebViewClient: " + url);
            } catch (Exception e) {
                // v1.2.3 (S1181): catch Exception, not Throwable — startActivity
                //   throws ActivityNotFoundException/SecurityException/IllegalStateException
                //   (all Exception subtypes). Errors (OOM etc.) must not be swallowed.
                Log.w(TAG, "Failed to open external URL: " + url, e);
            }
            return true; // Always return true so the WebView itself doesn't try to load it
        }
        // Block all other schemes (file:, content:, javascript:, intent:, etc.)
        Log.w(TAG, "Blocked non-asset, non-http(s) URL: " + url);
        return true;
    }

    // v1.0.4 Rev30 ROBUSTNESS: Override the newer WebResourceRequest-based overload
    // (added in API 24). The deprecated String-based overload above is still called
    // on API 23 (minSdk), but on API 24+ only THIS overload is invoked. Without this
    // override, http(s) links clicked on API 24+ devices would NOT be redirected
    // to the system browser (the deprecated overload wouldn't fire). Delegating to
    // the String overload keeps both paths consistent.
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        if (request == null) return true;
        Uri uri = request.getUrl();
        if (uri == null) return true;
        return shouldOverrideUrlLoading(view, uri.toString());
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        Log.i(TAG, "Page loaded: " + url);
        // v18.6.0: Use WeakReference to avoid leaking the Activity
        MainActivity activity = activityRef.get();
        if (activity != null) {
            activity.initEngineAfterPermissions();
        }
    }

    // v1.0.8 PHASE 29 (PDF best practice): Handle WebView render-process crashes
    //   per "WebView 性能与健壮性优化指南" §健壮性保障 §2.崩溃预防与处理.
    //   On API 26+ (Oreo), the WebView renderer runs in a separate process.
    //   If it crashes (OOM, GPU fault, native crash in the renderer), this
    //   callback fires. Without handling, the WebView is left in a broken
    //   state — black screen, no input — and the user must force-kill the app.
    //   With handling, we cleanly destroy the dead WebView and let the
    //   Activity recreate itself (or show an error). Returning true tells
    //   the framework we've handled it (don't kill the app process).
    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        // v1.0.8 PHASE 30: simplified log (removed invented "policy" label)
        Log.e(TAG, "WebView render process gone: crashed=" + detail.didCrash());
        // v1.1.1 Phase 60 (audit P1-4.4): Crash-count backoff to prevent infinite
        //   recreate() loop. If the GPU driver is buggy and the renderer keeps
        //   crashing, unconditional recreate() forms a crash-restart-crash loop
        //   that drains battery and makes the app unusable. We allow up to 3
        //   recreate attempts within a 60-second window; beyond that, we just
        //   destroy the WebView and let the user manually restart the app.
        //   The counter resets after 60 seconds of stability.
        long now = System.currentTimeMillis();
        if (now - _lastRenderCrashTime > 60000) {
            // Window expired — reset counter
            _renderCrashCount = 0;
        }
        _renderCrashCount++;
        _lastRenderCrashTime = now;
        if (_renderCrashCount > 3) {
            Log.e(TAG, "Render process crashed " + _renderCrashCount + " times within 60s — "
                    + "stopping recreate loop to prevent battery drain. User must restart app manually.");
            destroyWebViewSafely(view, "backoff path");
            // v1.2.3 round-13 (P1): show the user a recovery message instead
            //   of leaving them with a frozen screen. The Activity's WebView
            //   reference is now stale, so we hand off to showFallbackUI which
            //   builds a native recovery overlay.
            final MainActivity activity = activityRef.get();
            if (activity != null) {
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            activity.showFallbackUI(
                                "渲染进程多次崩溃，请手动重启应用 / Renderer crashed repeatedly, please restart the app manually.");
                        } catch (Exception e2) {
                            // v1.2.3 (S1181): showFallbackUI throws RuntimeException
                            //   subtypes at most — catching Throwable would also mask
                            //   OOM/StackOverflow, which must propagate.
                            Log.w(TAG, "Failed to show fallback UI after render-crash backoff", e2);
                        }
                    }
                });
            }
            return true; // We handled it — don't kill the app process
        }
        Log.w(TAG, "Render process crash count within 60s: " + _renderCrashCount + "/3");
        // Remove the dead WebView from its parent to avoid
        // WindowLeaked exceptions during Activity teardown.
        destroyWebViewSafely(view, "render-crash");
        // Notify the Activity so it can recreate the WebView (e.g., by
        // calling recreate() or showing a "Renderer crashed, tap to reload"
        // overlay). We use a WeakReference so we don't leak the Activity.
        MainActivity activity = activityRef.get();
        if (activity != null) {
            try {
                // Use recreate() to fully rebuild the Activity + WebView.
                // This is the simplest and most robust recovery — any
                // in-memory JS state is lost, but the engine subprocess
                // persists (it's a separate process), and persistent state
                // (SharedPreferences, PGN cache) survives.
                activity.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            activity.recreate();
                        } catch (Exception e) {
                            Log.w(TAG, "Activity.recreate() failed after renderer crash", e);
                        }
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "Failed to notify Activity of renderer crash", e);
            }
        }
        return true; // We handled it — don't kill the app process
    }

    /**
     * v1.2.3 (DRY + S1181): Best-effort WebView teardown shared by both
     *   render-crash paths (backoff and normal). Detaches the view from its
     *   parent (prevents WindowLeaked during Activity teardown) then destroys
     *   it. WebView.destroy() on an already-crashed renderer throws
     *   RuntimeException subtypes on some OEM ROMs — caught and logged.
     *   Errors (OOM etc.) are intentionally NOT caught (S1181).
     */
    private static void destroyWebViewSafely(WebView view, String pathTag) {
        try {
            if (view != null) {
                if (view.getParent() instanceof android.view.ViewGroup) {
                    ((android.view.ViewGroup) view.getParent()).removeView(view);
                }
                view.destroy();
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to destroy crashed WebView (" + pathTag + ")", e);
        }
    }
}
