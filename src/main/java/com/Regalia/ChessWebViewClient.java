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

import android.util.Log;
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
 *
 * Version: v18.6.0
 */
public class ChessWebViewClient extends WebViewClient {
    private static final String TAG = "Regalia";
    private final WeakReference<MainActivity> activityRef;

    public ChessWebViewClient(MainActivity activity) {
        this.activityRef = new WeakReference<>(activity);
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, String url) {
        // Only allow loading local asset files; block external navigation
        if (url != null && url.startsWith("file:///android_asset/")) {
            return false;
        }
        return true;
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
}
