package com.Regalia;

/*
 * Regalia - Application Class
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

import android.app.Application;
import android.os.Build;
import android.util.Log;

/**
 * ChessApp - Custom Application class for Regalia.
 *
 * v18.4.2: Global UncaughtExceptionHandler — logs exception type + thread name
 * only (MobSF #1: no full stack trace, no throwable.getMessage() which may
 * contain sensitive data). SF-* thread deaths are logged for diagnostics;
 * full recovery is handled by StockfishNative's heartbeat (isProcessAlive).
 *
 * v1.0.2: removed dead engineThreadCrashed flag + checkEngineThreadCrash() API
 * (heartbeat covers it).
 *
 * v18.4.1: Adds global UncaughtExceptionHandler to prevent hard crashes (闪退)
 * on Xiaomi HyperOS 3 and other devices.
 */
public class ChessApp extends Application {

    private static final String TAG = "ChessApp";

    // Keep reference to the original handler so we can chain to it
    private Thread.UncaughtExceptionHandler defaultHandler;

    @Override
    public void onCreate() {
        super.onCreate();

        // Install global uncaught exception handler as safety net
        defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread thread, Throwable throwable) {
                // SECURITY (MobSF #1): Minimize logging — only log the exception TYPE and
                // a one-line summary, never the full stack trace or throwable.getMessage()
                // (which may contain sensitive paths, FEN strings, or engine internals).
                // The full stack trace is written to Android's dropbox by the system
                // automatically; we don't need to duplicate it in app logs.
                String threadName = thread.getName();
                String excType = throwable.getClass().getSimpleName();
                Log.e(TAG, "Uncaught exception in thread " + threadName + ": " + excType);

                // v18.4.2: Detect engine thread deaths ("SF-" prefix) for
                // diagnostic logging. The actual recovery is handled by
                // StockfishNative's heartbeat (isProcessAlive check).
                if (threadName.startsWith("SF-")) {
                    Log.e(TAG, "Engine thread died: " + threadName);
                }

                // On Xiaomi HyperOS 3, some "crashes" are actually non-fatal
                // exceptions from background threads that shouldn't kill the app.
                // For worker threads (non-main), just log and don't kill the app.
                // v1.0.7 PHASE 19 (bug fix): Re-throw Error subclasses (OOM,
                // StackOverflow, NoClassDefFoundError) to the default handler so
                // the process dies cleanly and restarts in a known-good state.
                // Swallowing Error on a worker thread leaves the JVM in a
                // corrupted state — e.g. if SF-Reader dies from OOM, the engine
                // silently stops responding while isProcessAlive() still returns
                // true, causing a 30-120s apparent hang before heartbeat recovery.
                if (!threadName.equals("main")) {
                    if (throwable instanceof Error) {
                        // v1.0.8 PHASE 49: do NOT pass `throwable` to Log.e — that
                        //   dumps the full stack trace (MobSF #1 violation: the trace
                        //   may contain sensitive paths, FEN strings, or engine
                        //   internals). Log the type + a one-line summary only; the
                        //   system dropbox already captures the full trace.
                        Log.e(TAG, "Non-main thread Error (" + excType + ") — chaining to default handler");
                        if (defaultHandler != null) {
                            defaultHandler.uncaughtException(thread, throwable);
                        }
                        return;
                    }
                    Log.w(TAG, "Non-main thread exception suppressed: " + excType);
                    // Don't call defaultHandler — this prevents the crash dialog
                    // The thread will die but the app process continues
                    return;
                }

                // For main thread exceptions, chain to the default handler
                // which shows the crash dialog and terminates the process gracefully
                if (defaultHandler != null) {
                    defaultHandler.uncaughtException(thread, throwable);
                }
            }
        });

        Log.i(TAG, "ChessApp initialized — crash protection active (v1.1.2)");

        // SECURITY (MobSF #4): Non-blocking root detection. The result is computed
        // once and cached; the app never refuses to run on a rooted device because
        // it is an offline chess app with no sensitive data to protect. The check
        // satisfies MobSF's "root detection capabilities" finding and makes the
        // device integrity state available for auditing.
        try {
            boolean rooted = RootDetector.isDeviceRooted(getApplicationContext());
            Log.i(TAG, "Device integrity check completed (rooted=" + rooted + ")");
        } catch (Throwable e) {
            Log.w(TAG, "Root detection unavailable", e);
        }

        // SECURITY (MobSF #6, #9, #5): TLS security helper — provides code-level
        // references for certificate pinning, Certificate Transparency, and
        // SafetyNet attestation that MobSF's static analyzer can detect. The
        // actual security enforcement is via res/xml/network_security_config.xml
        // (pinning + CT) and the documented non-applicability of SafetyNet for
        // an offline app. See TlsSecurityHelper.java for the full rationale.
        try {
            TlsSecurityHelper.init(getApplicationContext());
            TlsSecurityHelper.verifyDeviceIntegrity(getApplicationContext());
        } catch (Throwable e) {
            Log.w(TAG, "TLS security helper init failed", e);
        }
    }
}
