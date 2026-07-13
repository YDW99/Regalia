package com.Regalia;

/*
 * Regalia - Engine Process Manager
 * Copyright (C) 2026 Regalia
 *
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Österlund (original DroidFish logic:
 *   ExternalEngine.java, InternalStockFish.java, EngineUtil.java patterns)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0: Extracted from StockfishNative.java (Phase 73 God Module split).
 * v1.2.1 (round-4 cleanup): Slimmed to the single method that StockfishNative
 *         actually delegates to (makeExecutable). All other helpers
 *         (resolveEngineBinary / extractEngineFromApk / extractEngineFromAssets /
 *         startProcess / initStreams / cleanupResources / isElfFile / process
 *         getters/setters) were dead code — StockfishNative keeps its own
 *         inline copies of these for direct field access. Keeping them here
 *         created two sources of truth and risked divergence.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import android.util.Log;

import java.io.File;
import java.util.concurrent.TimeUnit;

/**
 * EngineProcessManager — file-permission helper (v1.2.1 slimmed).
 *
 * The only method exposed is {@link #makeExecutable(File)}, which tries four
 * strategies in order:
 *   1. nativeChmod(path) — JNI call into the engine_jni helper.
 *   2. File.setExecutable(true, false) — standard Java API.
 *   3. /system/bin/chmod 700 — direct system call.
 *   4. /system/bin/sh -c "chmod 700 ..." — last-resort shell fallback.
 *
 * The {@link ChmodProvider} callback supplies the JNI bridge and the
 * user-facing progress / language helpers from StockfishNative, keeping this
 * class free of any Activity or Context reference.
 */
public class EngineProcessManager {
    private static final String TAG = "EngineProcessManager";

    /** chmod provider — implemented by StockfishNative. */
    public interface ChmodProvider {
        boolean nativeChmod(String path);
        boolean isEnglishMode();
        void postProgress(int pct, String message);
    }

    private final ChmodProvider chmodProvider;

    public EngineProcessManager(ChmodProvider chmodProvider) {
        this.chmodProvider = chmodProvider;
    }

    /**
     * Make a file executable using multiple strategies for maximum compatibility.
     * Each InterruptedException re-asserts the interrupt flag (SonarCloud B13/B14).
     */
    public void makeExecutable(File file) {
        try {
            boolean nativeOk = chmodProvider.nativeChmod(file.getAbsolutePath());
            if (nativeOk && file.canExecute()) {
                return;
            }
            if (!file.setExecutable(true, false)) {
                try {
                    Process p = Runtime.getRuntime().exec(
                            new String[]{"/system/bin/chmod", "700", file.getAbsolutePath()});
                    if (!p.waitFor(2, TimeUnit.SECONDS)) {
                        p.destroy();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } catch (Throwable e2) {
                    try {
                        Process p = Runtime.getRuntime().exec(
                                new String[]{"/system/bin/sh", "-c",
                                        "chmod 700 " + file.getAbsolutePath()});
                        if (!p.waitFor(2, TimeUnit.SECONDS)) {
                            p.destroy();
                        }
                    } catch (InterruptedException e3) {
                        Thread.currentThread().interrupt();
                    } catch (Throwable ignored) {
                        // Last-resort fallback failed — non-fatal.
                    }
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "Failed to make executable: " + file.getAbsolutePath(), e);
        }
    }
}
