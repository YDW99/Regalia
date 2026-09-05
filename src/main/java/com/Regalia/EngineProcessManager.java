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

import android.os.Build;
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
 * The {@link ChmodProvider} callback supplies the JNI bridge from
 * StockfishNative, keeping this class free of any Activity or Context
 * reference.
 *
 * v1.2.1 round-9: Slimmed the ChmodProvider interface to the single method
 *   that makeExecutable actually calls (nativeChmod). The previous interface
 *   also declared isEnglishMode() and postProgress(int, String) — leftovers
 *   from the round-4 cleanup that removed extractEngineFromApk() and its
 *   progress-reporting call sites. The anonymous implementation in
 *   StockfishNative still provides all 3 methods, but 2 of them were never
 *   invoked after the round-4 slim. Removing them eliminates dead interface
 *   surface and simplifies future implementations.
 */
public class EngineProcessManager {
    private static final String TAG = "EngineProcessManager";

    /** chmod provider — implemented by StockfishNative. */
    public interface ChmodProvider {
        boolean nativeChmod(String path);
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
                // v1.2.3 round-44 (C2): the Process reference is hoisted to the
                //   outer scope on both paths. On InterruptedException we
                //   destroyForcibly() the child (API 26+; destroy() below that,
                //   minSdk 23) so an interrupted waitFor cannot leak an orphan
                //   chmod process, and a finally block closes all three process
                //   streams — Process streams hold real fds that waitFor() does
                //   NOT release, so skipping the close leaks fds per attempt.
                Process p = null;
                try {
                    p = Runtime.getRuntime().exec(
                            new String[]{"/system/bin/chmod", "700", file.getAbsolutePath()});
                    if (!p.waitFor(2, TimeUnit.SECONDS)) {
                        p.destroy();
                    }
                } catch (InterruptedException e) {
                    killProcess(p);
                    Thread.currentThread().interrupt();
                } catch (Exception e2) {
                    // v1.2.3 round-44 (C3, evaluated — fallback KEPT): the array
                    //   form above is already a shell-free invocation, and this
                    //   sh -c fallback has no injection surface (the path comes
                    //   from getAbsolutePath() of an engine file inside the
                    //   app-private directory). It DOES have genuine rescue
                    //   value: on ROMs where /system/bin/chmod is not symlinked
                    //   (toybox applet only reachable via the shell's PATH or
                    //   builtin), the absolute-path exec throws while the
                    //   shell-resolved `chmod` still succeeds.
                    Process p2 = null;
                    try {
                        p2 = Runtime.getRuntime().exec(
                                new String[]{"/system/bin/sh", "-c",
                                        "chmod 700 " + file.getAbsolutePath()});
                        if (!p2.waitFor(2, TimeUnit.SECONDS)) {
                            p2.destroy();
                        }
                    } catch (InterruptedException e3) {
                        killProcess(p2);
                        Thread.currentThread().interrupt();
                    } catch (Exception ignored) {
                        // Last-resort fallback failed — non-fatal.
                    } finally {
                        closeProcessStreams(p2);
                    }
                } finally {
                    closeProcessStreams(p);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to make executable: " + file.getAbsolutePath(), e);
        }
    }

    /**
     * v1.2.3 round-44 (C2): forcibly kill a spawned process after an interrupt.
     * destroyForcibly() requires API 26 (minSdk is 23); below that, destroy()
     * is the strongest available signal.
     */
    private static void killProcess(Process p) {
        if (p == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                p.destroyForcibly();
            } else {
                p.destroy();
            }
        } catch (Exception ignored) {}
    }

    /**
     * v1.2.3 round-44 (C2): close a Process's stdin/stdout/stderr streams
     * (best-effort). Each stream holds a real fd; waitFor() does not close
     * them, so without this every attempt leaks three fds until GC finalizes.
     */
    private static void closeProcessStreams(Process p) {
        if (p == null) return;
        try { p.getOutputStream().close(); } catch (Exception ignored) {}
        try { p.getInputStream().close(); } catch (Exception ignored) {}
        try { p.getErrorStream().close(); } catch (Exception ignored) {}
    }
}
