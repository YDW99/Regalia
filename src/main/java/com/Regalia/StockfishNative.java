package com.Regalia;

/*
 * Regalia - Stockfish Engine Native Interface
 * Copyright (C) 2026 Regalia
 * 
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Österlund (original DroidFish logic:
 *   ExternalEngine.java, InternalStockFish.java, UCIEngineBase.java,
 *   EngineUtil.java, DroidComputerPlayer.java patterns)
 * Modifications Copyright (C) 2026 Regalia
 * 
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
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
 *
 * v18.5.0: Refactored to remove JNI bridge / engine import code.
 * Only built-in engine (nativeLibraryDir) is supported.
 * Context changed to Application context to prevent Activity memory leaks.
 * Duplicate recovery code extracted into cleanupEngineResources()/recoverEngine().
 * UCI option support check now cached in a Set for O(1) lookup.
 */

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.lang.ref.WeakReference;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * StockfishNative - Manages the Stockfish UCI chess engine process.
 * Single persistent read thread + state machine (NONE/GO/HINT/EVAL/PONDER).
 * synchronized(stateLock) protects all state transitions.
 *
 * Engine binary is delivered as lib/arm64-v8a/libstockfish.so in the APK.
 * With extractNativeLibs="true", Android extracts it to nativeLibraryDir
 * where SELinux policy guarantees executability.
 *
 * v18.5.0: Only the built-in engine in nativeLibraryDir is supported.
 * JNI bridge and engine import functionality have been removed.
 *
 * Engine Configuration Management:
 * - SharedPreferences persistence for all UCI options
 * - Auto/manual hardware configuration (with big.LITTLE awareness)
 * - Settings export/import in TXT format
 *
 * Version: v1.0.8
 */
public class StockfishNative {

    private static final String TAG = "StockfishNative";

    // v18.5.0: Load native JNI library for chmod/renice operations
    static {
        try {
            System.loadLibrary("engine_bridge");
            // SECURITY (MobSF #3): Minimal logging — no library path or exception detail
            Log.i("StockfishNative", "JNI ready");
        } catch (UnsatisfiedLinkError e) {
            // SECURITY (MobSF #3): Do NOT log the exception message — it may contain
            // internal library paths. Log only a generic, non-sensitive notice.
            Log.w("StockfishNative", "JNI optional module not loaded (non-critical)");
        }
    }

    private static final int STATE_NONE   = 0;
    private static final int STATE_GO     = 1;
    private static final int STATE_HINT   = 2;
    private static final int STATE_EVAL   = 3;
    private static final int STATE_PONDER = 4;

    private static final String ENGINE_LIB_NAME = "libstockfish.so";
    private static final String PREFS_NAME = "RegaliaEngine";

    // v18.4.0: ELO_MAP synced with JS ELO_MATCH for consistent level display
    private static final int[] ELO_MAP = {0, 800, 1350, 1700, 2000, 2200, 2350, 2800};
    // v1.0.5: Synced with the application version (was stale at v1.0.2).
    private static final String ENGINE_VERSION = "v1.0.8";
    // Movetime mapping: index 0 unused, 1-7 = game levels
    private static final int[] MOVETIME_MAP = {0, 500, 800, 1000, 1500, 2000, 3000, 5000};

    // v18.4.10: Native chmod and renice — derived from DroidFish EngineUtil.java (nativeutil.cpp).
    // Copyright (C) Peter Österlund (original DroidFish logic).
    // Modified by Regalia on 2026-06-12.
    // Native chmod is more reliable than Runtime.exec("chmod ...") for setting
    // engine binary permissions, following DroidFish's proven approach.
    private static native boolean nativeChmod(String path);
    private static native void nativeRenice(int pid, int prio);

    // B8 FIX: Use Application context to prevent Activity memory leak.
    // The context field holds getApplicationContext(), which is safe for
    // SharedPreferences, AssetManager, and system services.
    // For Activity-specific operations (WebView access, finish()), use activityRef.
    private final Context context;
    // WeakReference to the Activity — used for obtaining the WebView and for exitApp().
    // Stored separately from context to avoid leaking the Activity.
    private volatile WeakReference<Activity> activityRef = new WeakReference<>(null);
    private final Handler mainHandler;
    private final Object stateLock = new Object();
    private final SharedPreferences prefs;

    // OPT: P2 - Cache WebView reference via WeakReference to avoid repeated lookups
    // in postJsCallback. The reference is updated whenever the WebView becomes available.
    private volatile WeakReference<WebView> cachedWebViewRef = new WeakReference<>(null);

    // v1.0.7 PHASE 19 (thread safety): All four engine resource fields are now
    // volatile. They are written from multiple threads (_engineExecutor worker,
    // heartbeat thread, JS binder thread via shutdown/recoverEngine). Without
    // volatile, a read on one thread may never observe a null write from another
    // thread, producing NPEs or writes to a destroyed process's stream.
    private volatile Process engineProcess;
    private volatile BufferedReader engineReader;
    private volatile OutputStreamWriter engineWriter;
    private volatile Thread readerThread;

    private volatile int currentState = STATE_NONE;
    private volatile boolean engineReady = false;
    private volatile boolean shutdownRequested = false;
    // Latch used to wait for stale bestmove after sending "stop".
    private volatile CountDownLatch _stopLatch = null;
    private final Object _stopLatchLock = new Object();

    // Stored eval result during STATE_EVAL
    private volatile Integer _storedEvalCp = null;
    private volatile Integer _storedEvalMate = null;
    private volatile int _lastEvalDepth = 0;
    // v1.0.4 Rev33: seldepth (selective search depth / tactical depth) for eval display.
    private volatile int _lastEvalSeldepth = 0;

    // Stored WDL (Win/Draw/Loss) data during STATE_EVAL
    private volatile int _storedWdlW = -1;
    private volatile int _storedWdlD = -1;
    private volatile int _storedWdlL = -1;

    // Maximum reasonable search depth
    private static final int MAX_REASONABLE_DEPTH = 60;
    // Expected depth limit for eval searches (go depth N)
    private volatile int _evalDepthLimit = 15;

    private volatile boolean _heartbeatRunning = false;
    // v1.0.8 PHASE 49: volatile — written inside synchronized startHeartbeat(),
    //   read+joined in unsynchronized shutdown(). Without volatile the shutdown
    //   thread could see a stale null and skip the interrupt/join, leaking the
    //   thread. _heartbeatRunning above is already volatile; the Thread handle
    //   must be too for the same cross-thread visibility reason.
    private volatile Thread _heartbeatThread = null;
    private static final int HEARTBEAT_INTERVAL_MS = 5000; // 5 seconds (fast detection for aggressive OEM process killers)
    // v1.0.8 PHASE 33: ZOMBIE_TIMEOUT_MS is currently unused — the Phase 30 fix
    //   gates the zombie check on isSearching, so only ZOMBIE_SEARCH_TIMEOUT_MS
    //   applies. Kept for documentation of the original design intent (a future
    //   idle-timeout could re-enable it).
    private static final long ZOMBIE_TIMEOUT_MS = 30000; // reserved: 30s idle timeout (currently unused)
    private static final long ZOMBIE_SEARCH_TIMEOUT_MS = 120000; // 2 minutes for active searches
    private volatile long _lastResponseTime = System.currentTimeMillis();
    private volatile int _autoRecoveryCount = 0;
    private static final int MAX_AUTO_RECOVERY = 3; // Conservative: prevent restart loops on HyperOS 3
    private static final int RECOVERY_COUNT_RESET_INTERVAL_MS = 120000; // 2 min — reset counter after stable operation
    private volatile long _lastRecoveryTimestamp = 0;
    // Restart lock: prevents concurrent restartEngine/recoverEngine calls
    private final Object _restartLock = new Object();
    private volatile boolean _restartInProgress = false;
    /** Request code for SAF file picker (import settings) */
    static final int REQUEST_CODE_IMPORT_SETTINGS = 1001;
    static final int REQUEST_CODE_IMPORT_PGN = 1003;
    private final Object _startEngineLock = new Object();

    // v18.6.0: Single-thread executor for serialized UCI command execution
    // Replaces new Thread().start() calls to prevent engine hangs from concurrent UCI commands
    // Not final — must be recreated after shutdown() for restartEngine() to work.
    // v1.0.7 PHASE 19 (thread safety): _engineExecutor is reassigned in
    // initEngine/recoverEngine/restartEngine from multiple threads. Without
    // volatile, one thread's reassignment may not be visible to another thread
    // that then calls .execute() on the old (already-shutdown) executor.
    private volatile ExecutorService _engineExecutor = _createEngineExecutor();

    private static ExecutorService _createEngineExecutor() {
        return Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "SF-Exec");
            t.setPriority(Thread.NORM_PRIORITY);
            return t;
        });
    }

    /**
     * v1.0.2 FIX (audit): Wrap _engineExecutor.execute() to catch RejectedExecutionException.
     * If the executor is shutdown (during restartEngine/shutdown), the rejection would
     * otherwise propagate to the WebView JS thread and leave JS-side loading flags stuck
     * (e.g. _evalLoading=true forever). On rejection, fire onEngineError so JS resets.
     */
    private void _safeExecute(Runnable r, String tag) {
        try {
            _engineExecutor.execute(r);
        } catch (java.util.concurrent.RejectedExecutionException e) {
            Log.w(TAG, tag + ": executor rejected (shutdown in progress?)", e);
            try {
                postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine busy, please retry" : "\u5f15\u64ce\u5fd9\uff0c\u8bf7\u91cd\u8bd5") + ")");
            } catch (Throwable ignored) {}
        }
    }

    // v18.4.1: Extended bestmove pattern to capture optional ponder move
    private static final Pattern BESTMOVE_PATTERN = Pattern.compile("^bestmove\\s+(\\S+)(?:\\s+ponder\\s+(\\S+))?");
    private static final Pattern INFO_DEPTH_PATTERN = Pattern.compile("^info\\s+depth\\s+(\\d+)");
    // v1.0.4 Rev33: seldepth (selective search depth) — tactical depth, usually >= depth.
    // Per SF18 eval best-practices doc: depth is the main iteration depth, seldepth reflects
    // the actual max depth reached in tactical variations. Display as "SD" after "D".
    private static final Pattern SELDEPTH_PATTERN = Pattern.compile("seldepth\\s+(\\d+)");
    private static final Pattern NODES_PATTERN = Pattern.compile("nodes\\s+(\\d+)");
    private static final Pattern NPS_PATTERN = Pattern.compile("nps\\s+(\\d+)");
    private static final Pattern SCORE_CP_PATTERN = Pattern.compile("score\\s+cp\\s+(-?\\d+)");
    private static final Pattern SCORE_MATE_PATTERN = Pattern.compile("score\\s+mate\\s+(-?\\d+)");
    private static final Pattern WDL_PATTERN = Pattern.compile("wdl\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)");
    private static final Pattern MULTIPV_PATTERN = Pattern.compile("multipv\\s+(\\d+)");
    private static final Pattern PV_PATTERN = Pattern.compile(
            "\\bpv\\s+([a-h][1-8][a-h][1-8][qrbn]?\\s*)+",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern UCIOK_PATTERN = Pattern.compile("^uciok");
    private static final Pattern READYOK_PATTERN = Pattern.compile("^readyok");

    // ===================== ENGINE CONFIGURATION FIELDS =====================

    // Engine info collected during UCI handshake
    private String engineName = "Stockfish";
    private String engineAuthor = "Unknown";
    private String engineOptionsJson = "{}";

    // P1 FIX: Cached set of UCI option names — populated after UCI handshake.
    // Provides O(1) lookup for engineSupportsOption() instead of re-parsing JSON every call.
    private final Set<String> supportedOptionNames = Collections.synchronizedSet(new HashSet<String>());

    // Current engine binary path
    private String currentEnginePath = null;

    // Auto config: when enabled, detectHardwareAndConfigure() is called automatically
    private volatile boolean autoConfigEnabled = true;

    // Current UCI option values (loaded from prefs or defaults)
    private volatile int engineThreads = 2;
    private volatile int engineHash = 64;
    private volatile int engineMoveOverhead = 30;
    private volatile int engineMultiPV = 1;
    private volatile boolean enginePonder = false;
    private volatile boolean engineShowWDL = true;
    private volatile int engineSkillLevel = 20;
    private volatile boolean engineLimitElo = false;
    private volatile int engineElo = 2800;

    // UCI option regex patterns for parsing engine capabilities
    private static final Pattern ID_NAME_PATTERN = Pattern.compile("^id\\s+name\\s+(.+)");
    private static final Pattern ID_AUTHOR_PATTERN = Pattern.compile("^id\\s+author\\s+(.+)");
    private static final Pattern OPTION_PATTERN = Pattern.compile(
            "^option\\s+name\\s+(.+?)\\s+type\\s+(\\w+)(?:\\s+default\\s+(.+?))?(?:\\s+min\\s+(\\d+))?(?:\\s+max\\s+(\\d+))?"
    );

    // v18.4.1: MultiPV analysis results
    private volatile String _lastMultiPVJson = "[]";
    private volatile String _lastPonderMove = null;
    private volatile boolean _isPondering = false;
    // FIX: Flag to indicate that a ponder stop is in progress and the resulting
    // bestmove should be discarded. Without this, when stopAndWaitForBestmove()
    // sets _isPondering=false and sends "stop", the ponder search's bestmove
    // arrives and gets processed as a normal bestmove (since _isPondering is now
    // false), causing wrong state routing — e.g., entering review mode gets
    // a stale bestmove that corrupts the engine state machine.
    private volatile boolean _discardingPonderBestmove = false;
    // v18.4.1: Accumulated MultiPV data during current search
    private final java.util.concurrent.ConcurrentHashMap<Integer, JSONObject> _multiPVData =
            new java.util.concurrent.ConcurrentHashMap<>();

    // ===================== UCI HANDSHAKE TRACKING =====================

    private volatile boolean isUciHandshakeActive = false;

    // B8 FIX: Constructor uses context.getApplicationContext() to prevent leaking
    // the Activity. The Activity is stored separately via a WeakReference for
    // WebView access and exitApp() only.
    public StockfishNative(Context context) {
        this.context = context.getApplicationContext();
        // If the caller is an Activity, store a weak reference for WebView/exitApp access
        if (context instanceof Activity) {
            this.activityRef = new WeakReference<>((Activity) context);
        }
        this.mainHandler = new Handler(Looper.getMainLooper());
        this.prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        loadSettingsFromPrefs();
        // OPT: P2 - Initialize cached WebView reference early
        updateCachedWebView();
    }

    /**
     * v18.7.0: Check if the app is in English mode for bilingual messages.
     * Reads from SharedPreferences (written by JS on language toggle).
     */
    private boolean isEnglishMode() {
        try {
            String lang = prefs.getString("lang", "");
            if (lang != null && !lang.isEmpty()) return "en".equals(lang);
            return !java.util.Locale.getDefault().getLanguage().startsWith("zh");
        } catch (Throwable e) {
            return false;
        }
    }

    private volatile boolean initStarted = false;

    /**
     * Load all engine settings from SharedPreferences.
     * Called once in constructor.
     */
    private void loadSettingsFromPrefs() {
        autoConfigEnabled = prefs.getBoolean("autoConfig", true);
        engineThreads = prefs.getInt("engineThreads", 2);
        engineHash = prefs.getInt("engineHash", 64);
        engineMoveOverhead = prefs.getInt("engineMoveOverhead", 30);
        engineMultiPV = prefs.getInt("engineMultiPV", 1);
        enginePonder = prefs.getBoolean("enginePonder", false);
        engineShowWDL = prefs.getBoolean("engineShowWDL", true);
        engineSkillLevel = prefs.getInt("engineSkillLevel", 20);
        engineLimitElo = prefs.getBoolean("engineLimitElo", false);
        engineElo = prefs.getInt("engineElo", 2800);
        Log.i(TAG, "Settings loaded from prefs: threads=" + engineThreads
                + " hash=" + engineHash + " autoConfig=" + autoConfigEnabled);
    }

    private void saveBoolSetting(String key, boolean value) {
        prefs.edit().putBoolean(key, value).apply();
    }

    private void saveIntSetting(String key, int value) {
        prefs.edit().putInt(key, value).apply();
    }

    private void saveStringSetting(String key, String value) {
        prefs.edit().putString(key, value).apply();
    }

    // ===================== JS CALLBACK HELPERS =====================
    // (v1.0.2: removed dead postJsCallbackJson() — all callers use postJsCallback directly.)

    @JavascriptInterface
    public void initEngine() {
        if (initStarted && engineReady && isProcessAlive()) {
            Log.i(TAG, "initEngine: engine already running and ready, skipping");
            return;
        }
        if (initStarted && !engineReady) {
            Log.w(TAG, "initEngine: initStarted=true but engine not ready — allowing retry");
            initStarted = false;
        }
        // FIX: After shutdown(), _engineExecutor is terminated. Recreate it before use.
        try {
            if (_engineExecutor.isShutdown()) {
                _engineExecutor = _createEngineExecutor();
            }
        } catch (Throwable e) {
            _engineExecutor = _createEngineExecutor();
        }
        initStarted = true;
        _restartInProgress = false; // Reset lock for fresh init
        try {
            _engineExecutor.execute(new Runnable() {
                public void run() {
                    try {
                        startEngine();
                    } catch (Throwable e) {
                        Log.e(TAG, "Failed to initialize engine", e);
                        initStarted = false;
                        engineReady = false;
                        _restartInProgress = false;
                        postJsCallback("onEngineError(" + escapeJsString(e.getMessage() != null ? e.getMessage() : "Unknown error") + ")");
                    }
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException e) {
            Log.w(TAG, "initEngine: executor rejected, recreating");
            _engineExecutor = _createEngineExecutor();
            _engineExecutor.execute(new Runnable() {
                public void run() {
                    try {
                        startEngine();
                    } catch (Throwable t) {
                        Log.e(TAG, "initEngine retry failed", t);
                        initStarted = false;
                        engineReady = false;
                        _restartInProgress = false;
                        postJsCallback("onEngineError(" + escapeJsString(t.getMessage() != null ? t.getMessage() : "Unknown error") + ")");
                    }
                }
            });
        }
    }

    private boolean isProcessAlive() {
        try {
            if (engineProcess == null) return false;
            return engineProcess.isAlive();
        } catch (NoSuchMethodError e) {
            try {
                engineProcess.exitValue();
                return false;
            } catch (IllegalThreadStateException ex) {
                return true;
            }
        } catch (Throwable e) {
            return false;
        }
    }

    // v1.0.2 FIX: Safe wrapper for Process.destroyForcibly() — that method is
    // API 26+ only, but our minSdk is 21. On API 21-25, fall back to a second
    // destroy() call (the OS will eventually reap the process). Also uses
    // isProcessAlive() instead of engineProcess.isAlive() for the same reason.
    private void destroyForciblySafe() {
        if (engineProcess == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                engineProcess.destroyForcibly();
            } else {
                // API 21-25: destroyForcibly() not available; second destroy()
                // call is a no-op if the process is already dead, but kicks
                // the OS to reap it if the first destroy() was graceful.
                engineProcess.destroy();
            }
        } catch (Throwable ignored) {}
    }

    @JavascriptInterface
    public void engineGo(final String fen, final int level) {
        engineGoInternal(fen, level, false);
    }

    @JavascriptInterface
    public void engineGoNewGame(final String fen, final int level) {
        engineGoInternal(fen, level, true);
    }

    /**
     * v18.5.0: Go with a specific depth instead of movetime.
     *
     * v1.0.5 Rev55 FIX: This method is used by the JS layer for "deep eval"
     * (requestEngineEvalDeep / analyze-all). It enters STATE_EVAL — the same
     * state as engineEval — but was MISSING the applyEvalModeOptions() call
     * that engineEval has. Without it, a deep eval search ran with the
     * gameplay Contempt (default 24, biases scores by avoiding draws) and
     * the user's MultiPV setting (which may be >1, reducing depth). The
     * analysis was therefore BIASED and SHALLOWER than intended.
     *
     * Fix: call applyEvalModeOptions() before position+go (sets Contempt=0,
     * MultiPV=1, UCI_ShowWDL=true), matching engineEval. The bestmove
     * handler's STATE_EVAL branch already calls restoreGameplayOptions()
     * which restores the user's settings for the next gameplay search.
     */
    @JavascriptInterface
    public void engineGoDepth(final String fen, final int depth) {
        // v1.0.2 FIX (audit): use _safeExecute to catch RejectedExecutionException
        _safeExecute(new Runnable() { // tag: engineGoDepth
            public void run() {
                if (!engineReady) {
                    postJsCallback("onEngineError(" + escapeJsString("Engine not ready") + ")");
                    return;
                }
                stopAndWaitForBestmove("engineGoDepth");

                synchronized (stateLock) {
                    currentState = STATE_EVAL;
                }
                _storedEvalCp = null;
                _storedEvalMate = null;
                _lastEvalDepth = 0; _lastEvalSeldepth = 0; // v1.0.4 Rev33: reset seldepth too
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
                _evalDepthLimit = depth;
                forceFullStrength();
                // v1.0.5 Rev55: Apply eval-mode options for objective analysis.
                // Without this, deep eval used gameplay Contempt=24 (biased)
                // and the user's MultiPV (possibly >1, reducing depth).
                applyEvalModeOptions();
                sendUciCommand("position fen " + fen);
                sendUciCommand("go depth " + depth);
            }
        }, "engineGoDepth");
    }

    private void stopAndWaitForBestmove(String callerTag) {
        // v18.6.0: Skip stop/wait entirely when engine is idle — avoids unnecessary
        // latch allocation and 1-second timeout when no search is running.
        if (currentState == STATE_NONE && !_isPondering) {
            return;
        }

        if (_isPondering) {
            _isPondering = false;
            _discardingPonderBestmove = true; // FIX: Discard the ponder's bestmove when it arrives
            synchronized (stateLock) {
                currentState = STATE_NONE;
            }
            sendUciCommand("stop");
            try { Thread.sleep(100); } catch (InterruptedException ignored) {}
            // FIX: After stopping ponder, the engine is now idle (bestmove was discarded).
            // Previously, the code fell through to create a new latch and send "stop" again,
            // but the engine already sent its bestmove (which was discarded). The new latch
            // never gets counted down, causing a 1-second timeout stall on every transition
            // out of ponder (entering review, starting eval, etc.). Now we return early.
            return;
        }

        final CountDownLatch stopLatch = new CountDownLatch(1);
        synchronized (_stopLatchLock) {
            _stopLatch = stopLatch;
            sendUciCommand("stop");
        }
        try {
            if (!stopLatch.await(1, TimeUnit.SECONDS)) {
                // v1.0.7 PHASE 19 (bug fix): Engine didn't respond to "stop" within
                // 1 second — likely a frozen/zombie engine. Set the discard flag so
                // the eventual late bestmove is NOT routed to handleBestMove as a
                // real move. Without this, a late bestmove from the stopped search
                // could corrupt the next position's game state (the bestmove is for
                // the OLD position, not the new one the user is now on).
                _discardingPonderBestmove = true;
                Log.w(TAG, callerTag + ": stopAndWaitForBestmove timed out — discarding late bestmove");
            }
        } catch (InterruptedException e) {
            Log.w(TAG, callerTag + ": interrupted waiting for stop bestmove");
        } finally {
            synchronized (_stopLatchLock) {
                if (_stopLatch == stopLatch) {
                    _stopLatch = null;
                }
            }
        }
        // v1.0.8 PHASE 49: removed the dead `_timedOut` local boolean (was
        //   assigned true on timeout but never read — the _discardingPonderBestmove
        //   flag is the real signal consumers check).
    }

    private void engineGoInternal(final String fen, final int level, final boolean needNewGame) {
        // v1.0.2 FIX (audit): use _safeExecute to catch RejectedExecutionException
        _safeExecute(new Runnable() { // tag: engineGoInternal
            public void run() {
                if (!engineReady) {
                    postJsCallback("onEngineError(" + escapeJsString("Engine not ready") + ")");
                    return;
                }
                stopAndWaitForBestmove("engineGoInternal");

                synchronized (stateLock) {
                    currentState = STATE_GO;
                }
                if (needNewGame) {
                    sendUciCommand("ucinewgame");
                    final CountDownLatch newGameLatch = new CountDownLatch(1);
                    readyOkLatchHolder = newGameLatch;
                    sendUciCommand("isready");
                    try {
                        newGameLatch.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Log.w(TAG, "engineGoNewGame: interrupted waiting for readyok");
                    } finally {
                        readyOkLatchHolder = null;
                    }
                }
                sendUciCommand("position fen " + fen);
                setGameDifficulty(level);
                int movetime = (level >= 1 && level < MOVETIME_MAP.length) ? MOVETIME_MAP[level] : 5000;
                sendUciCommand("go movetime " + movetime);
            }
        }, "engineGoInternal");
    }

    /**
     * v1.0.4 LATEST: Timed-game engine go — sends "go" with wtime/btime/winc/binc
     * so Stockfish 18 manages its own time allocation per the time control.
     *
     * Per UCI protocol, the engine uses these parameters to decide how long to
     * search. For Fischer increment, winc/binc > 0. For sudden death, winc/binc=0.
     * For Bronstein/US delay, the delay is NOT passed to the engine (the engine
     * doesn't know about delays; the app handles delay deduction separately).
     *
     * The difficulty level still controls UCI_LimitStrength / Skill Level via
     * setGameDifficulty(), so timed games remain playable at all levels.
     *
     * @param fen current position FEN
     * @param level difficulty level (1-8)
     * @param needNewGame whether to send ucinewgame first
     * @param wtimeMs White's remaining clock time in milliseconds
     * @param btimeMs Black's remaining clock time in milliseconds
     * @param wincMs White's increment per move in milliseconds (Fischer only)
     * @param bincMs Black's increment per move in milliseconds (Fischer only)
     */
    @JavascriptInterface
    public void engineGoTimed(final String fen, final int level, final boolean needNewGame,
                               final long wtimeMs, final long btimeMs,
                               final long wincMs, final long bincMs) {
        _safeExecute(new Runnable() { // tag: engineGoTimed
            public void run() {
                if (!engineReady) {
                    postJsCallback("onEngineError(" + escapeJsString("Engine not ready") + ")");
                    return;
                }
                // v1.0.4 Rev35 TIMED-GAME FIX: Record the JS-side clock snapshot
                // timestamp so we can deduct the elapsed setup time (stopAndWait +
                // ucinewgame + readyok wait) from the wtime/btime we finally send
                // to the engine. Previously, the engine received the STALE clock
                // value from when JS called engineGoTimed() — but by the time
                // "go" is actually sent, the real clock has decreased (by up to
                // 1s for stopAndWait, up to 5s for ucinewgame+readyok). The engine
                // then over-allocates search time, searching past the GUI's 0-mark.
                final long _callTimeMs = System.currentTimeMillis();

                stopAndWaitForBestmove("engineGoTimed");

                synchronized (stateLock) {
                    currentState = STATE_GO;
                }
                if (needNewGame) {
                    sendUciCommand("ucinewgame");
                    final CountDownLatch newGameLatch = new CountDownLatch(1);
                    readyOkLatchHolder = newGameLatch;
                    sendUciCommand("isready");
                    try {
                        newGameLatch.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException e) {
                        Log.w(TAG, "engineGoTimed: interrupted waiting for readyok");
                    } finally {
                        readyOkLatchHolder = null;
                    }
                }
                sendUciCommand("position fen " + fen);
                setGameDifficulty(level);

                // v1.0.4 Rev35: Re-compute the clock values to send, deducting
                // the setup overhead (time elapsed since JS called us). This
                // ensures the engine gets the ACTUAL remaining time, not the
                // stale snapshot. We also add a safety margin (engineMoveOverhead,
                // default 30ms but user-configurable up to 10s) to avoid the
                // engine's bestmove arriving AFTER the GUI clock hits 0.
                long setupElapsedMs = System.currentTimeMillis() - _callTimeMs;
                // Clamp setup elapsed to a reasonable bound (cap at 6s — if it
                // took longer, the engine state is suspect anyway)
                if (setupElapsedMs > 6000) setupElapsedMs = 6000;
                long safetyMarginMs = Math.max(50, engineMoveOverhead); // at least 50ms
                long _wtime = Math.max(0, wtimeMs - setupElapsedMs - safetyMarginMs);
                long _btime = Math.max(0, btimeMs - setupElapsedMs - safetyMarginMs);
                long _winc = Math.max(0, wincMs);
                long _binc = Math.max(0, bincMs);
                // UCI go command with time management. Stockfish 18 will allocate
                // search time intelligently based on remaining clock + increment.
                sendUciCommand("go wtime " + _wtime + " btime " + _btime +
                               " winc " + _winc + " binc " + _binc);
                if (setupElapsedMs > 100) {
                    Log.i(TAG, "engineGoTimed: setup took " + setupElapsedMs + "ms, deducted from clock; wtime=" + _wtime + " btime=" + _btime + " margin=" + safetyMarginMs);
                }
            }
        }, "engineGoTimed");
    }

    @JavascriptInterface
    public void engineHint(final String fen) {
        // v1.0.2 FIX (audit): use _safeExecute to catch RejectedExecutionException
        _safeExecute(new Runnable() { // tag: engineHint
            public void run() {
                if (!engineReady) {
                    postJsCallback("onEngineError(" + escapeJsString("Engine not ready") + ")");
                    return;
                }
                stopAndWaitForBestmove("engineHint");

                synchronized (stateLock) {
                    currentState = STATE_HINT;
                }
                forceFullStrength();
                sendUciCommand("position fen " + fen);
                sendUciCommand("go movetime 5000");
            }
        }, "engineHint");
    }

    @JavascriptInterface
    public void engineEval(final String fen) {
        // v1.0.2 FIX (audit): use _safeExecute to catch RejectedExecutionException
        _safeExecute(new Runnable() { // tag: engineEval
            public void run() {
                if (!engineReady) {
                    postJsCallback("onEngineError(" + escapeJsString("Engine not ready") + ")");
                    return;
                }
                stopAndWaitForBestmove("engineEval");

                synchronized (stateLock) {
                    currentState = STATE_EVAL;
                }
                _storedEvalCp = null;
                _storedEvalMate = null;
                _lastEvalDepth = 0; _lastEvalSeldepth = 0; // v1.0.4 Rev33: reset seldepth too
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
                _evalDepthLimit = 15;
                forceFullStrength();
                // v1.0.4 Rev32 UCI EVAL OPTIMIZATION (per SF18 eval best-practices):
                //   1. Set Contempt=0 for objective evaluation (default 24 biases scores
                //      by avoiding draws — distorts analysis. See SF18 docs §4, §11).
                //   2. Set MultiPV=1 for max search depth (MultiPV>1 reduces depth).
                //   3. Ensure UCI_ShowWDL=true for Win/Draw/Loss probability output.
                // These are set BEFORE `position`+`go` so they apply to this search.
                // After the eval, the next gameplay search will re-set MultiPV/Contempt
                // via setGameDifficulty() / applySettings() as needed.
                applyEvalModeOptions();
                sendUciCommand("position fen " + fen);
                sendUciCommand("go depth 15");
            }
        }, "engineEval");
    }

    @JavascriptInterface
    public void engineEvalDeep(final String fen) {
        // v1.0.2 FIX (audit): use _safeExecute to catch RejectedExecutionException
        _safeExecute(new Runnable() { // tag: engineEvalDeep
            public void run() {
                if (!engineReady) {
                    postJsCallback("onEngineError(" + escapeJsString("Engine not ready") + ")");
                    return;
                }
                stopAndWaitForBestmove("engineEvalDeep");

                synchronized (stateLock) {
                    currentState = STATE_EVAL;
                }
                _storedEvalCp = null;
                _storedEvalMate = null;
                _lastEvalDepth = 0; _lastEvalSeldepth = 0; // v1.0.4 Rev33: reset seldepth too
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
                _evalDepthLimit = 22;
                forceFullStrength();
                // v1.0.4 Rev32 UCI EVAL OPTIMIZATION: same as engineEval —
                // Contempt=0, MultiPV=1, UCI_ShowWDL=true for objective deep eval.
                applyEvalModeOptions();
                sendUciCommand("position fen " + fen);
                sendUciCommand("go depth 22");
            }
        }, "engineEvalDeep");
    }

    /**
     * v1.0.4 Rev32: Apply engine options for objective position evaluation.
     * Per SF18 best-practices documentation:
     *   - Contempt=0: default Contempt=24 biases scores by avoiding draws,
     *     distorting analysis. Set to 0 for objective eval.
     *   - MultiPV=1: ensures maximum search depth (MultiPV>1 splits search
     *     effort across N lines, reducing depth).
     *   - UCI_ShowWDL=true: enables Win/Draw/Loss probability output in info
     *     lines, so the eval display can show accurate WDL percentages.
     *
     * These options are set BEFORE the `position`+`go` commands so they apply
     * to the upcoming eval search. After the eval, the next gameplay search
     * re-applies gameplay-appropriate settings via setGameDifficulty() /
     * applySettings().
     *
     * Note: We use sendSetOptionAndWait (synchronous, waits for readyok) for
     * Contempt and MultiPV since changing them may trigger internal engine
     * state changes. UCI_ShowWDL is a lightweight flag that doesn't need wait.
     */
    private void applyEvalModeOptions() {
        try {
            if (engineSupportsOption("Contempt")) {
                sendSetOptionAndWait("Contempt", "0");
            }
            if (engineMultiPV != 1 && engineSupportsOption("MultiPV")) {
                sendSetOptionAndWait("MultiPV", "1");
            }
            if (engineSupportsOption("UCI_ShowWDL")) {
                sendUciCommand("setoption name UCI_ShowWDL value true");
            }
        } catch (Throwable e) {
            Log.w(TAG, "applyEvalModeOptions failed", e);
        }
    }

    /**
     * v1.0.4 Rev32: Restore gameplay-appropriate engine options after an eval
     * search. Counterpart to applyEvalModeOptions().
     *   - Contempt=24 (SF18 default): makes the engine play more aggressively
     *     during actual games (avoids easy draws).
     *   - MultiPV=user setting: restore the user's MultiPV preference for
     *     gameplay analysis display.
     * Uses ASYNC setoption (no isready wait) — the next search's
     * stopAndWaitForBestmove + isready handshake ensures options are applied
     * before the new search starts, so we don't need to block here.
     */
    private void restoreGameplayOptions() {
        try {
            if (engineSupportsOption("Contempt")) {
                sendUciCommand("setoption name Contempt value 24");
            }
            if (engineMultiPV != 1 && engineSupportsOption("MultiPV")) {
                sendUciCommand("setoption name MultiPV value " + engineMultiPV);
            }
        } catch (Throwable e) {
            Log.w(TAG, "restoreGameplayOptions failed", e);
        }
    }

    /**
     * v18.5.0: Alias for engineEval — matches the JS API contract.
     */
    @JavascriptInterface
    public void requestEngineEval(final String fen) {
        engineEval(fen);
    }

    /**
     * v18.5.0: Alias for getMultiPVResult — matches the JS API contract.
     */
    @JavascriptInterface
    public String requestMultiPV() {
        return getMultiPVResult();
    }

    /**
     * v1.0.1: Get the Android system language for i18n auto-detection.
     * Returns the ISO 639-1 language code (e.g., "zh", "en", "ja").
     */
    @JavascriptInterface
    public String getSystemLanguage() {
        return java.util.Locale.getDefault().getLanguage();
    }

    /**
     * Set game difficulty level (1-7). Controls UCI_LimitStrength + UCI_Elo only.
     */
    private void setGameDifficulty(int level) {
        if (level >= 1 && level <= 6) {
            int elo = (level >= 1 && level < ELO_MAP.length) ? ELO_MAP[level] : 1500;
            engineLimitElo = true;
            engineElo = elo;
            if (engineSupportsOption("UCI_LimitStrength"))
                sendUciCommand("setoption name UCI_LimitStrength value true");
            if (engineSupportsOption("UCI_Elo"))
                sendUciCommand("setoption name UCI_Elo value " + elo);
        } else {
            engineLimitElo = false;
            if (engineSupportsOption("UCI_LimitStrength"))
                sendUciCommand("setoption name UCI_LimitStrength value false");
            if (engineSupportsOption("Skill Level"))
                sendUciCommand("setoption name Skill Level value " + engineSkillLevel);
        }
        saveBoolSetting("engineLimitElo", engineLimitElo);
        if (level >= 1 && level <= 6) {
            saveIntSetting("engineElo", engineElo);
        }
        postJsCallback("onGameDifficultyChanged(" + engineLimitElo + "," + engineElo + ")");
    }

    /**
     * Force full-strength engine play for evaluation and hint searches.
     */
    private void forceFullStrength() {
        if (engineSupportsOption("Skill Level"))
            sendUciCommand("setoption name Skill Level value 20");
        if (engineSupportsOption("UCI_LimitStrength"))
            sendUciCommand("setoption name UCI_LimitStrength value false");
    }

    @JavascriptInterface
    public void syncGameDifficulty(int level) {
        Log.i(TAG, "syncGameDifficulty: level=" + level);
        setGameDifficulty(level);
    }

    /**
     * v1.0.4 NEW: Enable/disable Stockfish's UCI_Chess960 option for Fischer
     * Random Chess (Chess960) games. When Chess960 is enabled, the engine
     * accepts Shredder-FEN castling rights (HAah format) and correctly handles
     * 960-style castling moves where king/rook end up on non-traditional squares.
     *
     * This MUST be called whenever the user starts a Chess960 game or switches
     * back to standard chess. The setting persists for the lifetime of the
     * engine process (until restart).
     *
     * Per UCI protocol: setoption is only allowed when the engine is idle
     * (not searching). We rely on the caller (JS side) to invoke this before
     * engineGo/engineGoNewGame, which themselves call stopAndWaitForBestmove().
     */
    @JavascriptInterface
    public void setChess960Mode(boolean enabled) {
        Log.i(TAG, "setChess960Mode: " + enabled);
        if (!engineReady) {
            Log.w(TAG, "setChess960Mode: engine not ready, will be applied at next startEngine");
            _pendingChess960 = enabled;
            return;
        }
        _pendingChess960 = enabled;
        if (engineSupportsOption("UCI_Chess960")) {
            _safeExecute(new Runnable() { // tag: setChess960Mode
                public void run() {
                    stopAndWaitForBestmove("setChess960Mode");
                    sendSetOptionAndWait("UCI_Chess960", enabled ? "true" : "false");
                }
            }, "setChess960Mode");
        } else {
            Log.w(TAG, "Engine does not support UCI_Chess960 option — Chess960 moves will still work via standard FEN");
        }
    }
    private volatile boolean _pendingChess960 = false;

    /**
     * v1.0.4 NEW: Returns the current Chess960 mode flag (last value passed to
     * setChess960Mode). Exposed to JS so the UI can verify engine state matches
     * the game variant.
     */
    @JavascriptInterface
    public boolean isChess960Mode() {
        return _pendingChess960;
    }

    @JavascriptInterface
    public boolean isEngineReady() {
        return engineReady;
    }

    // v1.0.8 PHASE 22 (bug fix): Expose system dark-mode state to JS.
    // WebView's prefers-color-scheme传递依赖 APP 主题的 isLightTheme 属性。
    // 由于 APP 使用 Theme.NoTitleBar（非 DayNight），isLightTheme 不随系统切换，
    // 导致 prefers-color-scheme 始终为固定值（在某些 OEM ROM 如小米澎湃 OS 3 上
    // 可能始终为 dark）。此方法通过 UiModeManager 直接检测系统夜间模式，
    // 让 JS 在 CSS 媒体查询之外额外检查，确保浅/深色模式正确切换。
    // 兼容 Android 5.0 (API 21) 及以上，包括小米澎湃 OS 3。
    @JavascriptInterface
    public boolean isSystemDarkMode() {
        try {
            android.content.Context ctx = context;
            if (ctx == null) return true; // 默认深色（与原设计一致）
            android.app.UiModeManager umm = (android.app.UiModeManager) ctx.getSystemService(android.content.Context.UI_MODE_SERVICE);
            if (umm == null) return true;
            int mode = umm.getNightMode();
            // MODE_NIGHT_NO → 浅色; MODE_NIGHT_YES → 深色; MODE_NIGHT_AUTO / MODE_NIGHT_CUSTOM → 跟随系统
            if (mode == android.app.UiModeManager.MODE_NIGHT_NO) return false;
            if (mode == android.app.UiModeManager.MODE_NIGHT_YES) return true;
            // MODE_NIGHT_AUTO_TIME or MODE_NIGHT_CUSTOM: check current UI mode
            int curMode = ctx.getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
            return curMode == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        } catch (Throwable e) {
            return true; // 出错时默认深色（安全回退）
        }
    }

    // ===================== ENGINE BINARY RESOLUTION =====================

    /**
     * Find the Stockfish binary. Resolution order:
     * 1. nativeLibraryDir (SELinux-trusted, guaranteed executable)
     * 2. app lib subdirectory (alternative extraction path)
     * 3. Search parent directories for stockfish-named files
     * 4. Extract directly from APK zip (fallback)
     * 5. Extract from assets (universal APK compatibility)
     */
    private File resolveEngineBinary() {
        // Priority 1: nativeLibraryDir (SELinux-trusted, guaranteed executable)
        try {
            ApplicationInfo appInfo = context.getApplicationInfo();
            String nativeLibDir = appInfo.nativeLibraryDir;
            Log.i(TAG, "nativeLibraryDir: " + nativeLibDir);

            if (nativeLibDir != null && !nativeLibDir.isEmpty()) {
                File libFile = new File(nativeLibDir, ENGINE_LIB_NAME);
                Log.i(TAG, "Looking for engine at: " + libFile.getAbsolutePath()
                        + " exists=" + libFile.exists()
                        + " canRead=" + libFile.canRead()
                        + " canExecute=" + libFile.canExecute()
                        + " length=" + libFile.length());

                if (libFile.exists() && libFile.canRead()) {
                    if (isElfFile(libFile)) {
                        Log.i(TAG, "Engine binary found in nativeLibraryDir (SELinux-trusted)");
                        currentEnginePath = libFile.getAbsolutePath();
                        return libFile;
                    } else {
                        Log.w(TAG, "Engine in nativeLibraryDir failed ELF verification: " + libFile.getAbsolutePath());
                    }
                }

                // List directory contents for diagnostics
                File libDir = new File(nativeLibDir);
                if (libDir.exists() && libDir.isDirectory()) {
                    String[] files = libDir.list();
                    Log.w(TAG, "nativeLibraryDir contents: " + (files != null ? Arrays.toString(files) : "null"));
                }
            }
        } catch (Throwable e) {
            Log.e(TAG, "Error accessing nativeLibraryDir", e);
        }

        // Priority 2: app's lib subdirectory
        try {
            File appLibDir = new File(context.getApplicationInfo().dataDir, "lib");
            File appLibFile = new File(appLibDir, ENGINE_LIB_NAME);
            if (appLibFile.exists() && appLibFile.canRead()) {
                if (isElfFile(appLibFile)) {
                    Log.i(TAG, "Engine binary found in app lib dir: " + appLibFile.getAbsolutePath());
                    currentEnginePath = appLibFile.getAbsolutePath();
                    return appLibFile;
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "Error checking app lib dir", e);
        }

        // Priority 3: look for any file containing "stockfish" in nativeLibraryDir parent
        try {
            ApplicationInfo appInfo = context.getApplicationInfo();
            String nativeLibDir = appInfo.nativeLibraryDir;
            if (nativeLibDir != null) {
                File parentDir = new File(nativeLibDir).getParentFile();
                if (parentDir != null && parentDir.isDirectory()) {
                    File[] candidates = parentDir.listFiles(new java.io.FilenameFilter() {
                        public boolean accept(File dir, String name) {
                            return name.toLowerCase().contains("stockfish") || name.equals(ENGINE_LIB_NAME);
                        }
                    });
                    if (candidates != null) {
                        for (File candidate : candidates) {
                            if (candidate.exists() && candidate.canRead() && candidate.isFile()) {
                                if (isElfFile(candidate)) {
                                    Log.i(TAG, "Engine binary found by search: " + candidate.getAbsolutePath());
                                    currentEnginePath = candidate.getAbsolutePath();
                                    return candidate;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "Error searching for engine", e);
        }

        // Priority 4: extract engine directly from APK
        File extracted = extractEngineFromApk();
        if (extracted != null) {
            return extracted;
        }

        // v1.0.8 PHASE 30: Do NOT postJsCallback here — caller (startEngineInternal) handles the error.
        // Previously both this method AND the caller fired onEngineError, causing double error toasts.
        String msg = isEnglishMode() ? "Stockfish engine binary not found, please reinstall" : "\u672a\u627e\u5230Stockfish\u5f15\u64ce\u4e8c\u8fdb\u5236\u6587\u4ef6\uff0c\u8bf7\u91cd\u65b0\u5b89\u88c5\u5e94\u7528";
        Log.e(TAG, msg);
        return null;
    }

    // ===================== ENGINE PROCESS MANAGEMENT =====================

    private void startEngine() throws IOException {
        // v18.4.7: Synchronize to prevent concurrent startEngine() calls
        synchronized (_startEngineLock) {
            startEngineInternal();
        }
    }

    private void startEngineInternal() throws IOException {
        postJsCallback("onInitProgress(5, " + escapeJsString(isEnglishMode() ? "Starting engine initialization..." : "\u5f00\u59cb\u521d\u59cb\u5316\u5f15\u64ce...") + ")");

        if (engineProcess != null && isProcessAlive()) {
            Log.w(TAG, "Engine already running");
            postJsCallback("onInitProgress(100, " + escapeJsString(isEnglishMode() ? "Engine already running" : "\u5f15\u64ce\u5df2\u8fd0\u884c") + ")");
            postJsCallback("onEngineReady()");
            engineReady = true;
            return;
        }

        try {
        // Step 1: Locate engine binary (10% -> 25%)
        postJsCallback("onInitProgress(10, " + escapeJsString(isEnglishMode() ? "Locating engine file..." : "\u6b63\u5728\u5b9a\u4f4d\u5f15\u64ce\u6587\u4ef6...") + ")");
        File stockfishBin = resolveEngineBinary();
        if (stockfishBin == null) {
            Log.e(TAG, "Engine binary resolution failed — resetting initStarted for retry");
            initStarted = false;
            _restartInProgress = false; // v1.0.8 PHASE 30: clear restart lock so future recoverEngine() calls can proceed
            postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine file not found, will use offline mode" : "\u5f15\u64ce\u6587\u4ef6\u672a\u627e\u5230\uff0c\u5c06\u4f7f\u7528\u79bb\u7ebf\u6a21\u5f0f") + ")");
            return;
        }

        Log.i(TAG, "Starting Stockfish: " + stockfishBin.getAbsolutePath()
                + " size=" + stockfishBin.length()
                + " canExecute=" + stockfishBin.canExecute());

        // Step 2: Start engine process (25% -> 50%)
        postJsCallback("onInitProgress(25, " + escapeJsString(isEnglishMode() ? "Starting engine process..." : "\u6b63\u5728\u542f\u52a8\u5f15\u64ce\u8fdb\u7a0b...") + ")");
        boolean started = startEngineViaProcessBuilder(stockfishBin);

        if (!started) {
            Log.e(TAG, "Engine process start failed");
            initStarted = false;
            _restartInProgress = false; // v1.0.8 PHASE 30: clear restart lock so future recoverEngine() calls can proceed
            postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine start failed - please reinstall" : "\u5f15\u64ce\u542f\u52a8\u5931\u8d25 - \u8bf7\u91cd\u65b0\u5b89\u88c5\u5e94\u7528") + ")");
            return;
        }

        // Step 3: Initialize I/O streams (50% -> 60%)
        postJsCallback("onInitProgress(50, " + escapeJsString(isEnglishMode() ? "Establishing engine communication..." : "\u6b63\u5728\u5efa\u7acb\u5f15\u64ce\u901a\u4fe1...") + ")");
        engineReader = new BufferedReader(new java.io.InputStreamReader(engineProcess.getInputStream()));
        engineWriter = new OutputStreamWriter(engineProcess.getOutputStream());

        shutdownRequested = false;
        readerThread = new Thread(new Runnable() {
            public void run() {
                readEngineOutput();
            }
        }, "SF-Reader");
        readerThread.setDaemon(true);
        readerThread.start();

        // Step 4: UCI handshake (60% -> 75%)
        postJsCallback("onInitProgress(60, " + escapeJsString(isEnglishMode() ? "Performing UCI handshake..." : "\u6b63\u5728\u6267\u884cUCI\u63e1\u624b...") + ")");
        final CountDownLatch uciOkLatch = new CountDownLatch(1);
        uciOkLatchHolder = uciOkLatch;

        // Reset engine info before handshake
        engineName = "Stockfish";
        engineAuthor = "Unknown";
        engineOptionsJson = "{}";
        supportedOptionNames.clear();

        isUciHandshakeActive = true;

        sendUciCommand("uci");

        try {
            boolean gotUciOk = uciOkLatch.await(10, TimeUnit.SECONDS);
            if (!gotUciOk) {
                Log.e(TAG, "Timed out waiting for uciok");
                cleanupFailedEngine();
                initStarted = false;
                postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine initialization timeout" : "\u5f15\u64ce\u521d\u59cb\u5316\u8d85\u65f6") + ")");
                return;
            }
        } catch (InterruptedException e) {
            Log.e(TAG, "Interrupted waiting for uciok");
            cleanupFailedEngine();
            initStarted = false;
            postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine initialization interrupted" : "\u5f15\u64ce\u521d\u59cb\u5316\u88ab\u4e2d\u65ad") + ")");
            return;
        } finally {
            uciOkLatchHolder = null;
            isUciHandshakeActive = false;
        }

        // Step 5: Wait for engine ready (75% -> 90%)
        postJsCallback("onInitProgress(75, " + escapeJsString(isEnglishMode() ? "Waiting for engine ready..." : "\u6b63\u5728\u7b49\u5f85\u5f15\u64ce\u5c31\u7eea...") + ")");
        final CountDownLatch readyOkLatch = new CountDownLatch(1);
        readyOkLatchHolder = readyOkLatch;

        sendUciCommand("isready");

        try {
            boolean gotReadyOk = readyOkLatch.await(10, TimeUnit.SECONDS);
            if (!gotReadyOk) {
                Log.e(TAG, "Timed out waiting for readyok");
                cleanupFailedEngine();
                initStarted = false;
                postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine initialization timeout" : "\u5f15\u64ce\u521d\u59cb\u5316\u8d85\u65f6") + ")");
                return;
            }
        } catch (InterruptedException e) {
            Log.e(TAG, "Interrupted waiting for readyok");
            cleanupFailedEngine();
            initStarted = false;
            postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine initialization interrupted" : "\u5f15\u64ce\u521d\u59cb\u5316\u88ab\u4e2d\u65ad") + ")");
            return;
        } finally {
            readyOkLatchHolder = null;
        }

        // Step 6: Apply settings with correct ordering
        engineReady = true;
        postJsCallback("onInitProgress(80, " + escapeJsString(isEnglishMode() ? "Applying engine configuration..." : "\u6b63\u5728\u5e94\u7528\u5f15\u64ce\u914d\u7f6e...") + ")");
        applySettings();

        // v1.0.4 NEW: Re-apply the Chess960 mode flag if it was set before the
        // (re)start. Without this, an engine auto-recovery after a crash would
        // silently drop UCI_Chess960=true and the user's Chess960 game would
        // be analyzed as standard chess (wrong castling handling).
        if (_pendingChess960 && engineSupportsOption("UCI_Chess960")) {
            try {
                sendSetOptionAndWait("UCI_Chess960", "true");
            } catch (Exception e) {
                Log.w(TAG, "Failed to re-apply UCI_Chess960 after engine start: " + e.getMessage());
            }
        }

        // Step 7: Engine ready (90% -> 100%)
        postJsCallback("onInitProgress(90, " + escapeJsString(isEnglishMode() ? "Engine ready!" : "\u5f15\u64ce\u5c31\u7eea\uff01") + ")");
        Log.i(TAG, "Stockfish engine ready: " + engineName);
        _autoRecoveryCount = 0;
        _restartInProgress = false; // Clear restart lock on successful start
        postJsCallback("onEngineReady()");

        // Start the foreground service to keep the engine process alive
        EngineService.start(context);

        // Notify JS with engine info
        notifyEngineInfo();

        startHeartbeat();

        } catch (Throwable t) {
            Log.e(TAG, "Unexpected error in startEngine — resetting initStarted", t);
            initStarted = false;
            engineReady = false;
            if (t instanceof IOException) throw (IOException) t;
            if (t instanceof RuntimeException) throw (RuntimeException) t;
            throw new RuntimeException(t);
        }
    }

    /**
     * Start an engine via ProcessBuilder.
     * Tries direct ProcessBuilder first, then /system/bin/sh -c as fallback.
     */
    private boolean startEngineViaProcessBuilder(File engineBin) {
        String binPath = engineBin.getAbsolutePath();
        File workDir = engineBin.getParentFile();

        // Ensure the file is executable
        makeExecutable(engineBin);

        // Attempt 1: Direct ProcessBuilder
        try {
            ProcessBuilder pb = new ProcessBuilder(binPath);
            pb.redirectErrorStream(true);
            if (workDir != null) pb.directory(workDir);
            engineProcess = pb.start();
            Log.i(TAG, "Started via direct ProcessBuilder");
        } catch (IOException e1) {
            Log.w(TAG, "Direct ProcessBuilder failed: " + e1.getMessage());

            // Attempt 2: /system/bin/sh -c with quoted path
            try {
                String quotedPath = "exec '" + binPath.replace("'", "'\\''") + "'";
                ProcessBuilder pb = new ProcessBuilder("/system/bin/sh", "-c", quotedPath);
                pb.redirectErrorStream(true);
                if (workDir != null) pb.directory(workDir);
                engineProcess = pb.start();
                Log.i(TAG, "Started via /system/bin/sh -c");
            } catch (IOException e2) {
                Log.w(TAG, "sh -c fallback also failed: " + e2.getMessage());
                // v1.0.8 PHASE 30: use e2 (the fallback failure), not e1 (the original failure)
                postJsCallback("onEngineError(" + escapeJsString(
                        "\u65e0\u6cd5\u542f\u52a8\u5f15\u64ce\u8fdb\u7a0b: " + e2.getMessage()) + ")");
                return false;
            }
        }

        // Wait for the engine process to initialize
        try {
            Thread.sleep(800);
        } catch (InterruptedException ignored) {}

        if (!isProcessAlive()) {
            Log.w(TAG, "Engine process not alive after 800ms, retrying check (1000ms)...");
            try {
                Thread.sleep(1000);
            } catch (InterruptedException ignored) {}

            if (!isProcessAlive()) {
                Log.e(TAG, "Engine process died immediately after starting from: " + binPath);
                try {
                    int exitCode = engineProcess.exitValue();
                    Log.e(TAG, "Engine exit code: " + exitCode);
                    if (exitCode == 127) {
                        Log.e(TAG, "Exit 127 = command not found or SELinux blocked execution");
                    } else if (exitCode == 126) {
                        Log.e(TAG, "Exit 126 = permission denied (not executable or SELinux W^X)");
                    } else if (exitCode == 139) {
                        Log.e(TAG, "Exit 139 = SIGSEGV (wrong ABI or corrupted binary)");
                    }
                } catch (Throwable ignored) {}
                try { engineProcess.getInputStream().close(); } catch (Throwable ignored) {}
                try { engineProcess.getOutputStream().close(); } catch (Throwable ignored) {}
                try { engineProcess.getErrorStream().close(); } catch (Throwable ignored) {}
                engineProcess = null;
                return false;
            }
        }

        Log.i(TAG, "Engine process started successfully");
        return true;
    }

    // Latch holders for init sequence
    private volatile CountDownLatch uciOkLatchHolder = null;
    private volatile CountDownLatch readyOkLatchHolder = null;

    // ===================== R1/R2 FIX: Extracted recovery helpers =====================

    /**
     * Clean up engine process resources (streams, process, reader thread).
     * Used by both readEngineOutput() EOF/IOException paths and heartbeat
     * zombie recovery to avoid duplicate code.
     */
    private void cleanupEngineResources() {
        // Close process streams
        if (engineProcess != null) {
            try { engineProcess.getInputStream().close(); } catch (Throwable ignored) {}
            try { engineProcess.getOutputStream().close(); } catch (Throwable ignored) {}
            try { engineProcess.getErrorStream().close(); } catch (Throwable ignored) {}
            try {
                engineProcess.destroy();
                try { Thread.sleep(100); } catch (InterruptedException ignored) {}
                // v1.0.2 FIX: use isProcessAlive() + destroyForciblySafe() —
                // direct engineProcess.isAlive() / destroyForcibly() throw
                // NoSuchMethodError on API 21-25 (minSdk).
                if (isProcessAlive()) destroyForciblySafe();
            } catch (Throwable ignored) {}
            engineProcess = null;
        }
        // Close writer
        synchronized (this) {
            if (engineWriter != null) {
                try { engineWriter.close(); } catch (IOException ignored) {}
                engineWriter = null;
            }
        }
        // Interrupt reader thread
        if (readerThread != null) {
            readerThread.interrupt();
            try { readerThread.join(1000); } catch (Throwable ignored) {}
            readerThread = null;
        }
        engineReader = null;
        engineReady = false;
        initStarted = false;
        // v1.0.2 FIX (audit): Reset ponder/discarded-bestmove flags so a crashed
        // engine doesn't leave _discardingPonderBestmove=true, which would cause
        // the FIRST bestmove from the recovered engine to be silently dropped
        // (manifesting as "AI never moves" after recovery). Also clear latch
        // holders so a stale latch from the dead engine doesn't block the new
        // engine's isready handshake.
        _isPondering = false;
        _discardingPonderBestmove = false;
        _lastPonderMove = null;
        _stopLatch = null;
        readyOkLatchHolder = null;
        uciOkLatchHolder = null;
    }

    /**
     * Attempt engine recovery after a failure (EOF, IOException, zombie detection).
     * Uses cleanupEngineResources() to tear down the old process, then restarts
     * with auto-recovery counting to prevent infinite loops.
     *
     * @param reason Human-readable reason for the recovery (for logging)
     * @param userMessage Chinese-language message to show the user via onEngineError
     */
    private void recoverEngine(final String reason, final String userMessage) {
        // Prevent concurrent restart — if another restart is already in progress, skip
        synchronized (_restartLock) {
            if (_restartInProgress) {
                Log.w(TAG, "Recovery skipped — restart already in progress (" + reason + ")");
                return;
            }
            _restartInProgress = true;
        }

        // Reset recovery count if engine has been stable for a while
        long timeSinceLastRecovery = System.currentTimeMillis() - _lastRecoveryTimestamp;
        if (timeSinceLastRecovery > RECOVERY_COUNT_RESET_INTERVAL_MS && _autoRecoveryCount > 0) {
            Log.i(TAG, "Resetting auto-recovery count (" + _autoRecoveryCount + ") after " + (timeSinceLastRecovery/1000) + "s of stable operation");
            _autoRecoveryCount = 0;
        }

        if (_autoRecoveryCount >= MAX_AUTO_RECOVERY) {
            Log.e(TAG, "Auto-recovery limit reached (" + MAX_AUTO_RECOVERY + "), giving up. Reason: " + reason);
            _restartInProgress = false;
            postJsCallback("onEngineError(" + escapeJsString(userMessage) + ")");
            return;
        }
        _autoRecoveryCount++;
        _lastRecoveryTimestamp = System.currentTimeMillis();
        final int attemptNum = _autoRecoveryCount;

        // CRITICAL FIX: Notify JS that engine is restarting so it can reset stale state.
        // Without this, JS state (isAIThinking, _evalLoading, etc.) remains stale from
        // before the crash, causing doAIMove() to early-return when onEngineReady() fires.
        postJsCallback("onEngineRestarting()");

        // Ensure executor is available — recreate if shutdown
        try {
            if (_engineExecutor.isShutdown()) {
                _engineExecutor = _createEngineExecutor();
            }
        } catch (Throwable e) {
            _engineExecutor = _createEngineExecutor();
        }

        final int delay = Math.min(1000 + (attemptNum - 1) * 500, 5000); // Cap at 5s
        try {
            _engineExecutor.execute(new Runnable() {
                public void run() {
                    try {
                        Thread.sleep(delay);
                        if (shutdownRequested) { _restartInProgress = false; return; }
                        Log.i(TAG, "Auto-recovery attempt " + attemptNum + "/" + MAX_AUTO_RECOVERY + " (" + reason + ")");
                        cleanupEngineResources();
                        // v1.0.8 PHASE 24 (bug fix): shut down the current executor
                        //   before creating a fresh one. Previously each recovery
                        //   cycle leaked an ExecutorService (and its non-daemon
                        //   thread) because the old executor was never shut down.
                        try { _engineExecutor.shutdown(); } catch (Throwable tsh) {}
                        _engineExecutor = _createEngineExecutor(); // Fresh executor after cleanup
                        _engineExecutor.execute(new Runnable() {
                            public void run() {
                                try {
                                    startEngine();
                                } catch (Throwable t2) {
                                    Log.e(TAG, "Auto-recovery startEngine failed (" + reason + ")", t2);
                                    if (attemptNum >= MAX_AUTO_RECOVERY) {
                                        postJsCallback("onEngineError(" + escapeJsString(userMessage) + ")");
                                    }
                                } finally {
                                    _restartInProgress = false;
                                }
                            }
                        });
                    } catch (Throwable t) {
                        Log.e(TAG, "Auto-recovery attempt " + attemptNum + " failed (" + reason + ")", t);
                        _restartInProgress = false;
                        if (attemptNum >= MAX_AUTO_RECOVERY) {
                            postJsCallback("onEngineError(" + escapeJsString(userMessage) + ")");
                        }
                    }
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException e) {
            // Executor was shutdown — recreate and retry
            Log.w(TAG, "Recovery executor rejected, recreating (" + reason + ")");
            _engineExecutor = _createEngineExecutor();
            try {
                _engineExecutor.execute(new Runnable() {
                    public void run() {
                        try {
                            cleanupEngineResources();
                            startEngine();
                        } catch (Throwable t) {
                            Log.e(TAG, "Recovery retry failed (" + reason + ")", t);
                            if (attemptNum >= MAX_AUTO_RECOVERY) {
                                postJsCallback("onEngineError(" + escapeJsString(userMessage) + ")");
                            }
                        } finally {
                            _restartInProgress = false;
                        }
                    }
                });
            } catch (Throwable t2) {
                _restartInProgress = false;
                Log.e(TAG, "Recovery retry also failed (" + reason + ")", t2);
            }
        }
    }

    /**
     * Read engine output in a blocking loop.
     * Uses simple blocking readLine() for reliable UCI response processing.
     */
    private void readEngineOutput() {
        try {
            String line;
            while (!shutdownRequested && engineReader != null) {
                try {
                    line = engineReader.readLine();
                } catch (java.net.SocketException e) {
                    if (!shutdownRequested) {
                        Log.w(TAG, "Socket exception while reading engine output (process likely killed)");
                    }
                    break;
                }

                if (line == null) {
                    // End of stream — engine process has terminated
                    if (!shutdownRequested) {
                        Log.e(TAG, "Engine output stream ended unexpectedly — attempting auto-recovery");
                        // R1/R2 FIX: Use recoverEngine() instead of inline duplicate code
                        recoverEngine("EOF", "\u5f15\u64ce\u591a\u6b21\u610f\u5916\u7ec8\u6b62\uff0c\u8bf7\u624b\u52a8\u91cd\u542f");
                    }
                    break;
                }
                if (shutdownRequested) break;
                _lastResponseTime = System.currentTimeMillis();
                processEngineLine(line.trim());
            }
        } catch (IOException e) {
            if (!shutdownRequested) {
                Log.e(TAG, "Error reading engine output", e);
                // R1/R2 FIX: Use recoverEngine() instead of inline duplicate code
                recoverEngine("IOException", "\u5f15\u64ce\u901a\u4fe1\u53cd\u590d\u5931\u8d25\uff0c\u8bf7\u5c1d\u8bd5\u624b\u52a8\u91cd\u542f");
            }
        } finally {
            Log.i(TAG, "Engine reader thread exiting");
        }
    }

    private void processEngineLine(String line) {
        _lastResponseTime = System.currentTimeMillis();

        if (line.isEmpty()) return;

        if (!line.startsWith("info")) {
            Log.d(TAG, "Engine output: " + line);
        }

        try {
            if (isUciHandshakeActive) {
                parseUciInfo(line);
            }

            if (UCIOK_PATTERN.matcher(line).find()) {
                if (optionsBuilder != null) {
                    engineOptionsJson = optionsBuilder.toString();
                    optionsBuilder = null;
                }
                CountDownLatch latch = uciOkLatchHolder;
                if (latch != null) {
                    latch.countDown();
                }
                return;
            }

            if (READYOK_PATTERN.matcher(line).find()) {
                CountDownLatch latch = readyOkLatchHolder;
                if (latch != null) {
                    latch.countDown();
                } else {
                    Log.d(TAG, "readyok received but no latch waiting");
                }
                return;
            }

            Matcher bestMoveMatcher = BESTMOVE_PATTERN.matcher(line);
            if (bestMoveMatcher.find()) {
                CountDownLatch stopLatch = _stopLatch;
                if (stopLatch != null) {
                    stopLatch.countDown();
                    return;
                }
                // v1.0.8 PHASE 33: FIX: Discard bestmove from a stopped ponder.
                //   _isPondering is already false by the time the bestmove arrives
                //   (stopPonder/stopAndWaitForBestmove set it before sending "stop"),
                //   so without this discard flag the stale bestmove would route to
                //   handleBestMove() with STATE_NONE and corrupt the state machine.
                if (_discardingPonderBestmove) {
                    _discardingPonderBestmove = false;
                    synchronized (stateLock) {
                        currentState = STATE_NONE;
                    }
                    Log.d(TAG, "Discarding stale bestmove from stopped ponder (stopAndWaitForBestmove)");
                    return;
                }
                String bestMove = bestMoveMatcher.group(1);
                String ponderMove = bestMoveMatcher.group(2);
                if (ponderMove != null && !ponderMove.isEmpty()) {
                    _lastPonderMove = ponderMove;
                    Log.i(TAG, "Ponder move received: " + ponderMove);
                } else {
                    _lastPonderMove = null;
                }
                handleBestMove(bestMove);
                synchronized (stateLock) {
                    currentState = STATE_NONE;
                }
                return;
            }

            if (line.startsWith("info")) {
                synchronized (stateLock) {
                    if (currentState == STATE_NONE) return;
                }
                processInfoLine(line);
            }
        } catch (Throwable e) {
            Log.e(TAG, "Error processing engine line: " + line, e);
        }
    }

    // v18.4.0: Accumulator for UCI options during handshake
    private JSONArray optionsBuilder = null;

    /**
     * Parse id name, id author, and option lines during UCI handshake.
     * P1 FIX: Also populates supportedOptionNames Set for O(1) lookup.
     */
    private void parseUciInfo(String line) {
        Matcher nameMatcher = ID_NAME_PATTERN.matcher(line);
        if (nameMatcher.find()) {
            engineName = nameMatcher.group(1).trim();
            Log.i(TAG, "Engine name: " + engineName);
            return;
        }

        Matcher authorMatcher = ID_AUTHOR_PATTERN.matcher(line);
        if (authorMatcher.find()) {
            engineAuthor = authorMatcher.group(1).trim();
            Log.i(TAG, "Engine author: " + engineAuthor);
            return;
        }

        Matcher optionMatcher = OPTION_PATTERN.matcher(line);
        if (optionMatcher.find()) {
            try {
                String optionName = optionMatcher.group(1).trim();
                JSONObject opt = new JSONObject();
                opt.put("name", optionName);
                opt.put("type", optionMatcher.group(2));
                if (optionMatcher.group(3) != null) {
                    opt.put("default", optionMatcher.group(3));
                }
                if (optionMatcher.group(4) != null) {
                    opt.put("min", Integer.parseInt(optionMatcher.group(4)));
                }
                if (optionMatcher.group(5) != null) {
                    opt.put("max", Integer.parseInt(optionMatcher.group(5)));
                }
                if (optionsBuilder == null) {
                    optionsBuilder = new JSONArray();
                }
                optionsBuilder.put(opt);
                // P1 FIX: Cache option name for O(1) lookup in engineSupportsOption()
                supportedOptionNames.add(optionName);
            } catch (Throwable e) {
                Log.w(TAG, "Error parsing option line: " + line, e);
            }
        }
    }

    /**
     * Notify JS with current engine info via onEngineInfo callback.
     */
    private void notifyEngineInfo() {
        try {
            JSONObject info = new JSONObject();
            info.put("name", engineName);
            info.put("author", engineAuthor);
            info.put("path", currentEnginePath != null ? currentEnginePath : "");
            info.put("threads", engineThreads);
            info.put("hash", engineHash);
            info.put("autoConfig", autoConfigEnabled);
            postJsCallback("onEngineInfo(" + info.toString() + ")");
        } catch (Throwable e) {
            Log.w(TAG, "Error notifying engine info", e);
        }
    }

    private void processInfoLine(String line) {
        try {
            Matcher depthMatcher = INFO_DEPTH_PATTERN.matcher(line);
            if (!depthMatcher.find()) return;

            int depth = Integer.parseInt(depthMatcher.group(1));

            if (depth > MAX_REASONABLE_DEPTH) {
                Log.w(TAG, "Skipping unrealistic depth " + depth + " (likely stale info line)");
                return;
            }

            // v1.0.4 Rev33: parse seldepth (selective search depth / tactical depth).
            // Seldepth is usually >= depth (reflects actual max depth in tactical
            // variations). Display as "SD" after "D" in the eval/AI bars.
            int seldepth = 0;
            Matcher seldepthMatcher = SELDEPTH_PATTERN.matcher(line);
            if (seldepthMatcher.find()) {
                try {
                    seldepth = Integer.parseInt(seldepthMatcher.group(1));
                    if (seldepth > MAX_REASONABLE_DEPTH * 2) seldepth = 0; // sanity cap
                } catch (Throwable ignored) { seldepth = 0; }
            }

            Long nodes = null;
            Long nps = null;
            Matcher nodesMatcher = NODES_PATTERN.matcher(line);
            if (nodesMatcher.find()) {
                nodes = Long.parseLong(nodesMatcher.group(1));
            }
            Matcher npsMatcher = NPS_PATTERN.matcher(line);
            if (npsMatcher.find()) {
                nps = Long.parseLong(npsMatcher.group(1));
            }

            int scoreCp = 0;
            int scoreMate = 0;
            boolean hasMate = false;
            boolean hasCp = false;

            Matcher mateMatcher = SCORE_MATE_PATTERN.matcher(line);
            if (mateMatcher.find()) {
                scoreMate = Integer.parseInt(mateMatcher.group(1));
                hasMate = true;
            }

            Matcher cpMatcher = SCORE_CP_PATTERN.matcher(line);
            if (cpMatcher.find()) {
                scoreCp = Integer.parseInt(cpMatcher.group(1));
                hasCp = true;
            }

            int wdlW = -1, wdlD = -1, wdlL = -1;
            Matcher wdlMatcher = WDL_PATTERN.matcher(line);
            if (wdlMatcher.find()) {
                wdlW = Integer.parseInt(wdlMatcher.group(1));
                wdlD = Integer.parseInt(wdlMatcher.group(2));
                wdlL = Integer.parseInt(wdlMatcher.group(3));
            }

            int multiPVIndex = 1;
            Matcher multiPVMatcher = MULTIPV_PATTERN.matcher(line);
            if (multiPVMatcher.find()) {
                multiPVIndex = Integer.parseInt(multiPVMatcher.group(1));
            }

            String pvMoves = "";
            Matcher pvMatcher = PV_PATTERN.matcher(line);
            if (pvMatcher.find()) {
                String pvSection = pvMatcher.group(0).trim();
                pvMoves = pvSection.substring(3).trim();
            }

            boolean isUpperBound = line.contains("upperbound");
            boolean isLowerBound = line.contains("lowerbound");

            if (multiPVIndex >= 1 && !isUpperBound && !isLowerBound && !pvMoves.isEmpty()) {
                try {
                    JSONObject pvData = new JSONObject();
                    pvData.put("index", multiPVIndex);
                    pvData.put("depth", depth);
                    if (seldepth > 0) pvData.put("seldepth", seldepth); // v1.0.4 Rev33
                    if (hasCp) pvData.put("scoreCp", scoreCp);
                    if (hasMate) pvData.put("scoreMate", scoreMate);
                    pvData.put("wdlW", wdlW);
                    pvData.put("wdlD", wdlD);
                    pvData.put("wdlL", wdlL);
                    pvData.put("pv", pvMoves);
                    _multiPVData.put(multiPVIndex, pvData);
                } catch (Throwable e) {
                    Log.w(TAG, "Error storing MultiPV data", e);
                }
            }

            int state;
            synchronized (stateLock) {
                state = currentState;
            }

            switch (state) {
                case STATE_GO:
                case STATE_HINT:
                    if (engineMultiPV > 1 && multiPVIndex > 1) {
                        // v1.0.2 PERF (audit): build JSON via StringBuilder instead of
                        // JSONObject allocation (saves ~8 JSONObject.put calls + a
                        // HashMap allocation per info line — significant at 10-50
                        // info lines/sec during MultiPV search).
                        try {
                            StringBuilder sb = new StringBuilder(128);
                            sb.append("{\"index\":").append(multiPVIndex);
                            sb.append(",\"depth\":").append(depth);
                            if (seldepth > 0) sb.append(",\"seldepth\":").append(seldepth); // v1.0.4 Rev33
                            if (hasCp) sb.append(",\"scoreCp\":").append(scoreCp);
                            else sb.append(",\"scoreCp\":null");
                            if (hasMate) sb.append(",\"scoreMate\":").append(scoreMate);
                            else sb.append(",\"scoreMate\":null");
                            sb.append(",\"wdlW\":").append(wdlW);
                            sb.append(",\"wdlD\":").append(wdlD);
                            sb.append(",\"wdlL\":").append(wdlL);
                            sb.append(",\"pv\":").append(JSONObject.quote(pvMoves));
                            sb.append("}");
                            postJsCallback("onMultiPVProgress(" + sb.toString() + ")");
                        } catch (Throwable e) {
                            Log.w(TAG, "Error sending MultiPV progress", e);
                        }
                    } else {
                        // v1.0.4 Rev33: added seldepth as 9th param to onEngineProgress.
                        postJsCallback("onEngineProgress(" + depth + ", "
                                + (nodes != null ? nodes : "null") + ", "
                                + (nps != null ? nps : "null") + ", "
                                + (hasCp ? scoreCp : "null") + ", "
                                + (hasMate ? scoreMate : "null") + ", "
                                + wdlW + ", " + wdlD + ", " + wdlL + ", "
                                + seldepth + ")");
                    }
                    break;

                case STATE_EVAL:
                    if (depth <= _evalDepthLimit) {
                        _lastEvalDepth = depth;
                        if (seldepth > 0) _lastEvalSeldepth = seldepth; // v1.0.4 Rev33
                    } else {
                        Log.w(TAG, "Skipping eval depth " + depth + " > limit " + _evalDepthLimit);
                    }
                    // FIX: Do not update eval state from upperbound/lowerbound info lines.
                    // These are intermediate bounds from aspiration window misses, not final
                    // scores. Storing them would corrupt the eval display — e.g., an
                    // upperbound of 0 cp could overwrite a valid +2.5 evaluation.
                    if (!isUpperBound && !isLowerBound) {
                        _storedWdlW = wdlW;
                        _storedWdlD = wdlD;
                        _storedWdlL = wdlL;
                        if (hasMate) {
                            _storedEvalCp = null;
                            _storedEvalMate = scoreMate;
                        } else if (hasCp) {
                            _storedEvalCp = scoreCp;
                            _storedEvalMate = null;
                        }
                    }
                    if (engineMultiPV > 1 && multiPVIndex > 1) {
                        // v1.0.2 PERF (audit): StringBuilder instead of JSONObject
                        try {
                            StringBuilder sb = new StringBuilder(128);
                            sb.append("{\"index\":").append(multiPVIndex);
                            sb.append(",\"depth\":").append(depth);
                            if (seldepth > 0) sb.append(",\"seldepth\":").append(seldepth); // v1.0.4 Rev33
                            if (hasCp) sb.append(",\"scoreCp\":").append(scoreCp);
                            else sb.append(",\"scoreCp\":null");
                            if (hasMate) sb.append(",\"scoreMate\":").append(scoreMate);
                            else sb.append(",\"scoreMate\":null");
                            sb.append(",\"wdlW\":").append(wdlW);
                            sb.append(",\"wdlD\":").append(wdlD);
                            sb.append(",\"wdlL\":").append(wdlL);
                            sb.append(",\"pv\":").append(JSONObject.quote(pvMoves));
                            sb.append("}");
                            postJsCallback("onMultiPVProgress(" + sb.toString() + ")");
                        } catch (Throwable e) {
                            Log.w(TAG, "Error sending MultiPV progress", e);
                        }
                    } else {
                        // v1.0.4 Rev33: added seldepth as 9th param to onEngineProgress.
                        postJsCallback("onEngineProgress(" + depth + ", "
                                + (nodes != null ? nodes : "null") + ", "
                                + (nps != null ? nps : "null") + ", "
                                + (hasCp ? scoreCp : "null") + ", "
                                + (hasMate ? scoreMate : "null") + ", "
                                + wdlW + ", " + wdlD + ", " + wdlL + ", "
                                + seldepth + ")");
                    }
                    break;

                case STATE_PONDER:
                    // v1.0.4 Rev33: added seldepth (6th param) and nodes/nps to
                    // onPonderProgress so the review eval bar can show real-time
                    // depth/SD/nodes/nps during ponder too. Previous signature was
                    // (depth, nodes, nps, scoreCp, scoreMate); new signature is
                    // (depth, nodes, nps, scoreCp, scoreMate, seldepth).
                    postJsCallback("onPonderProgress(" + depth + ", "
                            + (nodes != null ? nodes : "null") + ", "
                            + (nps != null ? nps : "null") + ", "
                            + (hasCp ? scoreCp : "null") + ", "
                            + (hasMate ? scoreMate : "null") + ", "
                            + seldepth + ")");
                    break;
            }
        } catch (Throwable e) {
            Log.w(TAG, "Error parsing info line", e);
        }
    }

    private void handleBestMove(String uciMove) {
        int state;
        synchronized (stateLock) {
            state = currentState;
        }

        String multiPVJson = buildMultiPVJson(uciMove);
        _lastMultiPVJson = multiPVJson;

        _isPondering = false;

        switch (state) {
            case STATE_GO:
                postJsCallback("onBestMove(" + escapeJsString(uciMove) + ")");
                postJsCallback("onMultiPVResult(" + multiPVJson + ")");
                break;
            case STATE_HINT:
                postJsCallback("onHintMove(" + escapeJsString(uciMove) + ")");
                postJsCallback("onMultiPVResult(" + multiPVJson + ")");
                break;
            case STATE_EVAL:
                // v1.0.4 Rev33: added _lastEvalSeldepth as 7th param to onEngineEval
                // so the eval bar can display "D15 SD22" (depth + tactical depth).
                if (_storedEvalMate != null) {
                    postJsCallback("onEngineEval(" + _storedEvalCp + ", " + _storedEvalMate + ", " + _lastEvalDepth + ", " + _storedWdlW + ", " + _storedWdlD + ", " + _storedWdlL + ", " + _lastEvalSeldepth + ")");
                } else if (_storedEvalCp != null) {
                    postJsCallback("onEngineEval(" + _storedEvalCp + ", null, " + _lastEvalDepth + ", " + _storedWdlW + ", " + _storedWdlD + ", " + _storedWdlL + ", " + _lastEvalSeldepth + ")");
                } else {
                    postJsCallback("onEngineEval(0, null, " + _lastEvalDepth + ", " + _storedWdlW + ", " + _storedWdlD + ", " + _storedWdlL + ", " + _lastEvalSeldepth + ")");
                }
                postJsCallback("onMultiPVResult(" + multiPVJson + ")");
                _storedEvalCp = null;
                _storedEvalMate = null;
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
                // v1.0.4 Rev32: Restore default Contempt=24 + user MultiPV after eval.
                // applyEvalModeOptions() set Contempt=0 and MultiPV=1 for objective
                // eval; restore gameplay-appropriate values so the next gameplay
                // search isn't distorted. Use async setoption (no wait) — the next
                // search's stopAndWaitForBestmove + isready handshake ensures the
                // options are applied before the new search starts.
                restoreGameplayOptions();
                break;
        }

        _multiPVData.clear();
    }

    /**
     * Build MultiPV JSON array from accumulated data.
     */
    private String buildMultiPVJson(String bestMove) {
        try {
            JSONArray arr = new JSONArray();
            JSONObject pv1 = new JSONObject();
            pv1.put("index", 1);
            pv1.put("move", bestMove);
            JSONObject stored1 = _multiPVData.get(1);
            if (stored1 != null) {
                pv1.put("depth", stored1.optInt("depth", 0));
                if (stored1.has("scoreCp")) pv1.put("scoreCp", stored1.getInt("scoreCp"));
                if (stored1.has("scoreMate")) pv1.put("scoreMate", stored1.getInt("scoreMate"));
                pv1.put("wdlW", stored1.optInt("wdlW", -1));
                pv1.put("wdlD", stored1.optInt("wdlD", -1));
                pv1.put("wdlL", stored1.optInt("wdlL", -1));
                pv1.put("pv", stored1.optString("pv", ""));
            }
            arr.put(pv1);

            java.util.ArrayList<Integer> keys = new java.util.ArrayList<>(_multiPVData.keySet());
            java.util.Collections.sort(keys);
            for (int idx : keys) {
                if (idx == 1) continue;
                JSONObject stored = _multiPVData.get(idx);
                if (stored != null) {
                    arr.put(stored);
                }
            }
            return arr.toString();
        } catch (Throwable e) {
            Log.w(TAG, "Error building MultiPV JSON", e);
            return "[]";
        }
    }

    /**
     * Send a UCI command to the engine process.
     * Synchronized to prevent command interleaving from concurrent threads.
     */
    private synchronized void sendUciCommand(String command) {
        if (engineWriter == null) {
            Log.e(TAG, "Cannot send command - engine writer is null");
            return;
        }
        if (engineProcess == null || !isProcessAlive()) {
            Log.e(TAG, "Cannot send command - engine process is not alive");
            engineReady = false;
            return;
        }
        try {
            Log.d(TAG, "Sending UCI: " + command);
            engineWriter.write(command + "\n");
            engineWriter.flush();
        } catch (IOException e) {
            Log.e(TAG, "Error sending command: " + command, e);
            engineReady = false;
        }
    }

    /**
     * Send a setoption command and wait for readyok confirmation.
     */
    private boolean sendSetOptionAndWait(String name, String value) {
        if (!engineReady || engineWriter == null) {
            Log.w(TAG, "Cannot set option " + name + " - engine not ready");
            return false;
        }
        final CountDownLatch latch = new CountDownLatch(1);
        readyOkLatchHolder = latch;
        sendUciCommand("setoption name " + name + " value " + value);
        sendUciCommand("isready");
        try {
            long deadline = System.currentTimeMillis() + 3000;
            while (System.currentTimeMillis() < deadline) {
                if (latch.await(100, TimeUnit.MILLISECONDS)) {
                    return true;
                }
                if (engineProcess != null && !isProcessAlive()) {
                    Log.e(TAG, "Engine process died while setting " + name);
                    engineReady = false;
                    readyOkLatchHolder = null;
                    return false;
                }
            }
            Log.w(TAG, "Timeout waiting for readyok after setting " + name);
            readyOkLatchHolder = null;
            return false;
        } catch (InterruptedException e) {
            Log.w(TAG, "Interrupted waiting for readyok after setting " + name);
            readyOkLatchHolder = null;
            return false;
        }
    }

    /**
     * Update the cached WebView reference using the Activity weak reference.
     */
    private void updateCachedWebView() {
        Activity activity = activityRef.get();
        if (activity instanceof MainActivity) {
            WebView wv = ((MainActivity) activity).getWebView();
            if (wv != null) {
                cachedWebViewRef = new WeakReference<>(wv);
            }
        }
    }

    /**
     * Deliver a JS callback to the WebView via evaluateJavascript.
     */
    private void postJsCallback(final String jsExpression) {
        final String cleanJs = jsExpression;
        try {
            mainHandler.post(new Runnable() {
                public void run() {
                    try {
                        WebView webView = cachedWebViewRef.get();
                        if (webView == null) {
                            // Try to get WebView from Activity reference
                            Activity activity = activityRef.get();
                            if (activity instanceof MainActivity) {
                                webView = ((MainActivity) activity).getWebView();
                                if (webView != null) {
                                    cachedWebViewRef = new WeakReference<>(webView);
                                }
                            }
                        }
                        if (webView == null) {
                            Log.w(TAG, "postJsCallback: webView is null, skipping: " + cleanJs);
                            return;
                        }
                        String safeJs = "try{" + cleanJs + "}catch(e){console.error('BridgeCB error:',e.message);}";
                        webView.evaluateJavascript(safeJs, null);
                    } catch (Throwable e) {
                        Log.e(TAG, "Error posting JS callback: " + cleanJs, e);
                    }
                }
            });
        } catch (Throwable e) {
            Log.e(TAG, "Error queuing JS callback", e);
        }
    }

    @JavascriptInterface
    public void shutdown() {
        // v1.0.8 PHASE 33: NOT synchronized on `this` (unlike startHeartbeat).
        //   There is a benign race: shutdown() could run between startHeartbeat's
        //   check-and-set and thread.start(). In that case the new heartbeat
        //   thread sees _heartbeatRunning=false and exits immediately — no leak,
        //   no double heartbeat. _heartbeatRunning is volatile so visibility is
        //   fine. Synchronizing shutdown() would risk deadlock if the heartbeat
        //   thread holds the lock during recoverEngine().
        _heartbeatRunning = false;
        if (_heartbeatThread != null) {
            _heartbeatThread.interrupt();
            try { _heartbeatThread.join(1000); } catch (Throwable ignored) {}
            _heartbeatThread = null;
        }

        shutdownRequested = true;
        synchronized (stateLock) {
            currentState = STATE_NONE;
        }
        engineReady = false;

        CountDownLatch uciLatch = uciOkLatchHolder;
        if (uciLatch != null) uciLatch.countDown();
        CountDownLatch readyLatch = readyOkLatchHolder;
        if (readyLatch != null) readyLatch.countDown();

        synchronized (this) {
            try {
                if (engineWriter != null) {
                    try {
                        engineWriter.write("quit\n");
                        engineWriter.flush();
                    } catch (IOException ignored) {}
                    try {
                        engineWriter.close();
                    } catch (IOException ignored) {}
                    engineWriter = null;
                }
            } catch (Throwable e) {
                Log.w(TAG, "Error during shutdown", e);
            }
        }

        if (engineProcess != null) {
            try {
                engineProcess.destroy();
                try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                // v1.0.2 FIX: use isProcessAlive() + destroyForciblySafe() —
                // direct engineProcess.isAlive() / destroyForcibly() throw
                // NoSuchMethodError on API 21-25 (minSdk).
                if (isProcessAlive()) {
                    destroyForciblySafe();
                    Log.w(TAG, "Engine process did not exit gracefully, force-killed");
                }
            } catch (Throwable e) {
                Log.w(TAG, "Error destroying process", e);
            }
            engineProcess = null;
        }

        if (readerThread != null) {
            try {
                readerThread.interrupt();
                readerThread.join(1000);
            } catch (Throwable ignored) {}
            readerThread = null;
        }

        CountDownLatch stopLatch = _stopLatch;
        if (stopLatch != null) stopLatch.countDown();

        engineReader = null;
        initStarted = false;
        cachedWebViewRef.clear();

        EngineService.stop(context);

        // v18.6.0: Shut down the single-thread executor for UCI commands
        _engineExecutor.shutdownNow();

        Log.i(TAG, "Stockfish engine shut down");
    }

    /**
     * Clean up partially-initialized engine after UCI handshake timeout.
     */
    private void cleanupFailedEngine() {
        shutdownRequested = true;
        engineReady = false;

        CountDownLatch uciLatch = uciOkLatchHolder;
        if (uciLatch != null) uciLatch.countDown();
        CountDownLatch readyLatch = readyOkLatchHolder;
        if (readyLatch != null) readyLatch.countDown();
        CountDownLatch stopLatch = _stopLatch;
        if (stopLatch != null) stopLatch.countDown();

        synchronized (this) {
            if (engineWriter != null) {
                try { engineWriter.close(); } catch (IOException ignored) {}
                engineWriter = null;
            }
        }

        if (engineProcess != null) {
            try {
                engineProcess.destroy();
                try { Thread.sleep(100); } catch (InterruptedException ignored) {}
                // v1.0.2 FIX: use isProcessAlive() + destroyForciblySafe() —
                // direct engineProcess.isAlive() / destroyForcibly() throw
                // NoSuchMethodError on API 21-25 (minSdk).
                if (isProcessAlive()) destroyForciblySafe();
            } catch (Throwable ignored) {}
            engineProcess = null;
        }

        if (readerThread != null) {
            readerThread.interrupt();
            try { readerThread.join(1000); } catch (Throwable ignored) {}
            readerThread = null;
        }

        engineReader = null;
        isUciHandshakeActive = false;
        Log.i(TAG, "Cleaned up failed engine process");
    }

    // v1.0.8 PHASE 30: synchronized to prevent two heartbeat threads on concurrent calls
    private synchronized void startHeartbeat() {
        if (_heartbeatRunning) return;
        _heartbeatRunning = true;
        _heartbeatThread = new Thread(new Runnable() {
            public void run() {
                while (_heartbeatRunning && !shutdownRequested) {
                    try {
                        Thread.sleep(HEARTBEAT_INTERVAL_MS);
                    } catch (InterruptedException e) {
                        break;
                    }
                    if (!_heartbeatRunning || shutdownRequested) break;

                    // Check 1: Process-level health
                    if (!isProcessAlive()) {
                        Log.e(TAG, "Heartbeat: engine process is dead, attempting restart");
                        // R1/R2 FIX: Use recoverEngine() instead of inline duplicate code
                        recoverEngine("heartbeat-dead-process",
                                "\u5f15\u64ce\u53cd\u590d\u5d29\u6e83\uff0c\u8bf7\u5c1d\u8bd5\u624b\u52a8\u91cd\u542f\u6216\u68c0\u67e5\u5f15\u64ce\u6587\u4ef6");
                        continue; // Skip zombie check this cycle
                    }

                    // Check 2: Responsiveness — zombie detection
                    // v1.0.8 PHASE 30: Only check zombie when actively searching. A healthy IDLE
                    //   engine emits nothing, so _lastResponseTime goes stale after 30s and would
                    //   falsely trigger a full recoverEngine() cycle (1-5s delay + process restart)
                    //   during quiet play. The process-alive check above already covers the
                    //   "engine process died" case for idle engines.
                    // v1.0.8 PHASE 33: removed dead `isSearching` local + ternary (the outer guard
                    //   already ensures currentState!=STATE_NONE, so the ternary always picked
                    //   ZOMBIE_SEARCH_TIMEOUT_MS; ZOMBIE_TIMEOUT_MS was unreachable). Use the
                    //   search timeout directly.
                    if (engineReady && (currentState != STATE_NONE)) {
                        long timeSinceLastResponse = System.currentTimeMillis() - _lastResponseTime;
                        if (timeSinceLastResponse > ZOMBIE_SEARCH_TIMEOUT_MS) {
                            Log.e(TAG, "Heartbeat: engine zombie detected (no response for " + timeSinceLastResponse + " ms), attempting recovery");
                            // R1/R2 FIX: Use cleanupEngineResources() + recoverEngine() instead of inline code
                            // First try graceful quit
                            synchronized (StockfishNative.this) {
                                try {
                                    if (engineWriter != null) {
                                        engineWriter.write("quit\n");
                                        engineWriter.flush();
                                    }
                                } catch (IOException ignored) {}
                            }
                            // Wait briefly for graceful exit
                            try { Thread.sleep(200); } catch (InterruptedException e) { break; }
                            // Clean up all resources
                            cleanupEngineResources();
                            // Wait before restarting
                            try { Thread.sleep(500); } catch (InterruptedException e) { break; }
                            // Attempt recovery (recoverEngine handles counter incrementing)
                            recoverEngine("heartbeat-zombie",
                                    "\u5f15\u64ce\u53cd\u590d\u65e0\u54cd\u5e94\uff0c\u8bf7\u5c1d\u8bd5\u624b\u52a8\u91cd\u542f");
                        }
                    }
                }
            }
        }, "SF-Heartbeat");
        _heartbeatThread.setDaemon(true);
        _heartbeatThread.start();
    }

    @JavascriptInterface
    public void restartEngine() {
        // Prevent concurrent restart — if another restart is already in progress, skip
        synchronized (_restartLock) {
            if (_restartInProgress) {
                Log.w(TAG, "restartEngine: skipping — restart already in progress");
                return;
            }
            _restartInProgress = true;
        }

        // Ensure executor is available — recreate if shutdown (common after recoverEngine)
        try {
            if (_engineExecutor.isShutdown()) {
                _engineExecutor = _createEngineExecutor();
            }
        } catch (Throwable e) {
            _engineExecutor = _createEngineExecutor();
        }

        final ExecutorService executor = _engineExecutor;
        try {
            executor.execute(new Runnable() {
                public void run() {
                    Log.i(TAG, "Restarting engine by JS request");
                    _autoRecoveryCount = 0;
                    shutdown();
                    try {
                        Thread.sleep(500);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    // Recreate the executor since shutdown() destroyed it
                    _engineExecutor = _createEngineExecutor();
                    initStarted = false;
                    _engineExecutor.execute(new Runnable() {
                        public void run() {
                            try {
                                startEngine();
                            } catch (Throwable e) {
                                Log.e(TAG, "Engine restart failed", e);
                                postJsCallback("onEngineError(" + escapeJsString((isEnglishMode() ? "Engine restart failed: " : "\u5f15\u64ce\u91cd\u542f\u5931\u8d25: ") + (e.getMessage() != null ? e.getMessage() : "Unknown")) + ")");
                            } finally {
                                _restartInProgress = false;
                            }
                        }
                    });
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException e) {
            // Executor was shutdown — recreate and retry directly
            Log.w(TAG, "restartEngine: executor rejected, recreating");
            _engineExecutor = _createEngineExecutor();
            _engineExecutor.execute(new Runnable() {
                public void run() {
                    try {
                        _autoRecoveryCount = 0;
                        cleanupEngineResources();
                        startEngine();
                    } catch (Throwable t) {
                        Log.e(TAG, "Engine restart retry failed", t);
                        postJsCallback("onEngineError(" + escapeJsString((isEnglishMode() ? "Engine restart failed: " : "\u5f15\u64ce\u91cd\u542f\u5931\u8d25: ") + (t.getMessage() != null ? t.getMessage() : "Unknown")) + ")");
                    } finally {
                        _restartInProgress = false;
                    }
                }
            });
        }
    }

    private static String escapeJsString(String s) {
        if (s == null) return "''";
        StringBuilder sb = new StringBuilder("'");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '\'': sb.append("\\'"); break;
                case '\"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                // v18.7.0 FIX: Escape Unicode line/paragraph separators — these are
                // invalid inside JavaScript string literals and can cause syntax errors
                // when PGN files contain them. Also escape NULL byte and other C0 controls.
                case '\u2028': sb.append("\\u2028"); break;
                case '\u2029': sb.append("\\u2029"); break;
                case '\u0000': sb.append("\\u0000"); break;
                default:
                    // Escape other C0 control characters (0x01-0x1F except \t\n\r already handled)
                    if (c < 0x20 && c != '\t' && c != '\n' && c != '\r') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                    break;
            }
        }
        sb.append("'");
        return sb.toString();
    }

    /**
     * B8 FIX: exitApp() now uses activityRef (WeakReference) instead of
     * casting context (which is now Application context and cannot be cast to Activity).
     */
    @JavascriptInterface
    public void exitApp() {
        mainHandler.post(new Runnable() {
            public void run() {
                try {
                    Activity activity = activityRef.get();
                    if (activity != null && !activity.isFinishing()) {
                        activity.finish();
                    } else {
                        Log.w(TAG, "exitApp: no valid Activity reference, cannot finish");
                    }
                } catch (Throwable e) {
                    Log.w(TAG, "exitApp failed", e);
                }
            }
        });
    }

    // ===================== ENGINE CONFIGURATION API =====================

    /**
     * Check if a file has a valid ELF header (starts with 0x7f ELF).
     */
    private boolean isElfFile(File file) {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] header = new byte[4];
            int read = fis.read(header);
            if (read >= 4) {
                return header[0] == (byte) 0x7f && header[1] == 'E' && header[2] == 'L' && header[3] == 'F';
            }
        } catch (IOException e) {
            Log.w(TAG, "Error checking ELF header for " + file.getName(), e);
        }
        return false;
    }

    /**
     * Get current engine information including name, author, path, and config.
     */
    @JavascriptInterface
    public String getEngineInfo() {
        try {
            JSONObject info = new JSONObject();
            info.put("name", engineName);
            info.put("author", engineAuthor);
            info.put("path", currentEnginePath != null ? currentEnginePath : "");
            info.put("threads", engineThreads);
            info.put("hash", engineHash);
            info.put("autoConfig", autoConfigEnabled);
            return info.toString();
        } catch (Throwable e) {
            Log.e(TAG, "Error building engine info", e);
            return "{}";
        }
    }

    // ===================== AUTO / MANUAL CONFIG =====================

    @JavascriptInterface
    public void setAutoConfig(boolean enabled) {
        autoConfigEnabled = enabled;
        saveBoolSetting("autoConfig", enabled);
        Log.i(TAG, "Auto config " + (enabled ? "enabled" : "disabled"));
        if (enabled && engineReady) {
            detectHardwareAndConfigure();
        }
    }

    @JavascriptInterface
    public boolean isAutoConfig() {
        return autoConfigEnabled;
    }

    /**
     * Detect hardware capabilities and configure engine accordingly.
     * Sets optimal Threads and Hash values based on CPU cores and available memory.
     */
    private void detectHardwareAndConfigure() {
        try {
            int availableProcessors = Runtime.getRuntime().availableProcessors();

            int bigCoreCount = detectBigCoreCount();
            int effectiveCores;
            if (bigCoreCount > 0) {
                effectiveCores = bigCoreCount;
                Log.i(TAG, "big.LITTLE detected: " + bigCoreCount + " big cores out of "
                        + availableProcessors + " total");
            } else {
                effectiveCores = availableProcessors / 2;
            }

            int optimalThreads = Math.max(1, effectiveCores);
            optimalThreads = Math.min(optimalThreads, 16);

            long maxMemory = Runtime.getRuntime().maxMemory();
            // Stockfish 18 best practice: keep hashfull < 30% for optimal strength.
            // On mobile, 64MB is the sweet spot; cap at 128MB to avoid OOM on low-RAM devices.
            long optimalHashMB = Math.max(16, maxMemory / (16 * 1024 * 1024));
            optimalHashMB = Math.min(optimalHashMB, 128);
            optimalHashMB = Math.max(16, (optimalHashMB / 16) * 16);

            Log.i(TAG, "Hardware detection: processors=" + availableProcessors
                    + " (bigCores=" + bigCoreCount + ")"
                    + " -> threads=" + optimalThreads
                    + ", maxMemory=" + (maxMemory / 1024 / 1024) + "MB"
                    + " -> hash=" + optimalHashMB + "MB");

            if (engineReady) {
                sendSetOptionAndWait("Threads", String.valueOf(optimalThreads));
                sendSetOptionAndWait("Hash", String.valueOf(optimalHashMB));
                engineThreads = optimalThreads;
                engineHash = (int) optimalHashMB;
                saveIntSetting("engineThreads", engineThreads);
                saveIntSetting("engineHash", engineHash);
                notifyEngineInfo();
            }
        } catch (Throwable e) {
            Log.e(TAG, "Hardware detection failed", e);
        }
    }

    /**
     * Detect the number of "big" cores on big.LITTLE ARM architectures.
     */
    // v1.0.2 PERF (audit): cache detectBigCoreCount() result — CPU topology
    // is fixed for the device's lifetime, no need to re-parse /proc/cpuinfo
    // every time detectHardwareAndConfigure() is called.
    private volatile int _cachedBigCoreCount = -1;

    private int detectBigCoreCount() {
        if (_cachedBigCoreCount >= 0) return _cachedBigCoreCount;
        int bigCores = 0;
        try {
            java.util.List<Long> frequencies = new java.util.ArrayList<>();

            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(new java.io.FileInputStream("/proc/cpuinfo")))) {
                String line;
                long currentFreq = 0;
                while ((line = reader.readLine()) != null) {
                    if (line.startsWith("processor")) {
                        if (currentFreq > 0) {
                            frequencies.add(currentFreq);
                        }
                        currentFreq = 0;
                    } else if (line.contains("CPU max MHz") || line.contains("BogoMIPS")) {
                        try {
                            String[] parts = line.split(":");
                            if (parts.length >= 2) {
                                double freq = Double.parseDouble(parts[1].trim());
                                currentFreq = (long) (freq * 1000);
                            }
                        } catch (NumberFormatException ignored) {}
                    } else if (line.contains("cpu MHz")) {
                        try {
                            String[] parts = line.split(":");
                            if (parts.length >= 2) {
                                double freq = Double.parseDouble(parts[1].trim());
                                if (currentFreq == 0) {
                                    currentFreq = (long) (freq * 1000);
                                }
                            }
                        } catch (NumberFormatException ignored) {}
                    }
                }
                if (currentFreq > 0) {
                    frequencies.add(currentFreq);
                }
            }

            if (frequencies.size() >= 2) {
                java.util.Collections.sort(frequencies);
                long medianFreq = frequencies.get(frequencies.size() / 2);
                long highestFreq = frequencies.get(frequencies.size() - 1);

                if (highestFreq > medianFreq * 1.2) {
                    for (long freq : frequencies) {
                        if (freq >= highestFreq * 0.9) {
                            bigCores++;
                        }
                    }
                }
            }
        } catch (Throwable e) {
            Log.d(TAG, "big.LITTLE detection failed (non-fatal): " + e.getMessage());
        }
        _cachedBigCoreCount = bigCores; // v1.0.2 PERF: cache result
        return bigCores;
    }

    // ===================== UCI OPTION SETTERS =====================

    /**
     * P1 FIX: Check if the current engine supports a given UCI option name.
     * Uses the cached supportedOptionNames Set for O(1) lookup instead of
     * re-parsing the engineOptionsJson string on every call.
     */
    // v1.0.8 PHASE 30: synchronize the combined check-then-contains to prevent a race where
    //   the UCI handshake thread clears supportedOptionNames between isEmpty() and contains().
    private boolean engineSupportsOption(String optionName) {
        synchronized (supportedOptionNames) {
            if (supportedOptionNames.isEmpty()) {
                // No option info available — assume supported (safe default for built-in Stockfish)
                return true;
            }
            if (!supportedOptionNames.contains(optionName)) {
                Log.i(TAG, "Engine does not support option: " + optionName + " (skipping)");
                return false;
            }
            return true;
        }
    }

    /**
     * Apply all current settings to the engine in the correct order.
     *
     * v1.0.2 SIMPLIFY (audit): consolidated the two near-identical branches
     * (autoConfig on/off) into one. The ONLY difference was how Threads/Hash
     * are determined: autoConfig calls detectHardwareAndConfigure() (which
     * sets Threads/Hash from device hardware); the else branch applies the
     * user-specified Threads/Hash directly. All other options (Move Overhead,
     * MultiPV, Ponder, UCI_ShowWDL, Skill Level, UCI_LimitStrength, UCI_Elo)
     * were applied identically in both branches — duplicated ~50 lines.
     */
    private void applySettings() {
        if (!engineReady) {
            Log.w(TAG, "Cannot apply settings - engine not ready");
            return;
        }

        Log.i(TAG, "Applying engine settings (autoConfig=" + autoConfigEnabled + ")");

        // Threads + Hash: source depends on autoConfig
        if (autoConfigEnabled) {
            detectHardwareAndConfigure();
            if (!engineReady) return;
        } else {
            if (engineSupportsOption("Threads")) {
                sendSetOptionAndWait("Threads", String.valueOf(engineThreads));
                if (!engineReady) return;
            }
            if (engineSupportsOption("Hash")) {
                sendSetOptionAndWait("Hash", String.valueOf(engineHash));
                if (!engineReady) return;
            }
        }

        // Common options (applied identically regardless of autoConfig)
        if (engineSupportsOption("Move Overhead")) {
            sendSetOptionAndWait("Move Overhead", String.valueOf(engineMoveOverhead));
            if (!engineReady) return;
        }
        if (engineSupportsOption("MultiPV")) {
            sendSetOptionAndWait("MultiPV", String.valueOf(engineMultiPV));
            if (!engineReady) return;
        }
        if (engineSupportsOption("Ponder")) {
            sendSetOptionAndWait("Ponder", String.valueOf(enginePonder));
            if (!engineReady) return;
        }
        if (engineSupportsOption("UCI_ShowWDL")) {
            sendSetOptionAndWait("UCI_ShowWDL", String.valueOf(engineShowWDL));
            if (!engineReady) return;
        }
        if (engineSupportsOption("Skill Level")) {
            sendSetOptionAndWait("Skill Level", String.valueOf(engineSkillLevel));
            if (!engineReady) return;
        }
        if (engineSupportsOption("UCI_LimitStrength")) {
            sendSetOptionAndWait("UCI_LimitStrength", String.valueOf(engineLimitElo));
            if (!engineReady) return;
            if (engineLimitElo && engineSupportsOption("UCI_Elo")) {
                sendSetOptionAndWait("UCI_Elo", String.valueOf(engineElo));
            }
        }

        Log.i(TAG, "Engine settings applied successfully");
    }

    @JavascriptInterface
    public void setEngineThreads(int threads) {
        if (threads < 1) threads = 1;
        if (threads > 512) threads = 512;
        engineThreads = threads;
        saveIntSetting("engineThreads", threads);
        if (autoConfigEnabled) {
            Log.w(TAG, "setEngineThreads ignored - autoConfig is enabled");
            return;
        }
        if (engineReady) {
            sendSetOptionAndWait("Threads", String.valueOf(threads));
        }
    }

    @JavascriptInterface
    public void setEngineHash(int hashMB) {
        if (hashMB < 1) hashMB = 1;
        if (hashMB > 33554432) hashMB = 33554432;
        engineHash = hashMB;
        saveIntSetting("engineHash", hashMB);
        if (autoConfigEnabled) {
            Log.w(TAG, "setEngineHash ignored - autoConfig is enabled");
            return;
        }
        if (engineReady) {
            sendSetOptionAndWait("Hash", String.valueOf(hashMB));
        }
    }

    @JavascriptInterface
    public void setEngineMoveOverhead(int ms) {
        if (ms < 0) ms = 0;
        if (ms > 5000) ms = 5000;
        engineMoveOverhead = ms;
        saveIntSetting("engineMoveOverhead", ms);
        if (engineReady) {
            sendSetOptionAndWait("Move Overhead", String.valueOf(ms));
        }
    }

    @JavascriptInterface
    public void setEngineMultiPV(int multiPV) {
        if (multiPV < 1) multiPV = 1;
        if (multiPV > 500) multiPV = 500;
        engineMultiPV = multiPV;
        saveIntSetting("engineMultiPV", multiPV);
        if (engineReady) {
            sendSetOptionAndWait("MultiPV", String.valueOf(multiPV));
        }
    }

    @JavascriptInterface
    public void setEnginePonder(boolean enabled) {
        enginePonder = enabled;
        saveBoolSetting("enginePonder", enabled);
        if (engineReady) {
            sendSetOptionAndWait("Ponder", String.valueOf(enabled));
        }
    }

    // ===================== PONDER MANAGEMENT =====================

    /**
     * Start pondering (thinking on opponent's time) on the given position.
     *
     * v1.0.4 Rev31 UCI COMPLIANCE FIX: Per UCI spec and Stockfish documentation,
     * `go ponder` MUST include time parameters (wtime/btime/winc/binc) so that
     * when the GUI later sends `ponderhit`, the engine can switch to normal
     * time management using those parameters. Without time params, the engine
     * doesn't know how much time it has after ponderhit, leading to either:
     *   - Engine searches way too long after ponderhit (no time pressure)
     *   - Engine returns bestmove almost instantly after ponderhit (panic mode)
     * Both are incorrect behavior for timed games.
     *
     * The previous implementation sent only "go ponder" with no time params,
     * which broke timed-game ponder. Now we accept optional time params from
     * the JS layer and include them in the go ponder command.
     *
     * For untimed games, the JS layer passes all zeros, which produces a plain
     * "go ponder" (engine ignores zero time params effectively, but we still
     * send them for consistency).
     *
     * @param fenWithPonderMove FEN of the position AFTER the predicted opponent move
     * @param wtimeMs White's remaining clock (ms), 0 if untimed
     * @param btimeMs Black's remaining clock (ms), 0 if untimed
     * @param wincMs White's increment per move (ms), 0 if none
     * @param bincMs Black's increment per move (ms), 0 if none
     */
    @JavascriptInterface
    public void startPonder(final String fenWithPonderMove,
                             final long wtimeMs, final long btimeMs,
                             final long wincMs, final long bincMs) {
        if (!engineReady || !enginePonder) return;
        // v1.0.2 FIX (audit): use _safeExecute to catch RejectedExecutionException
        _safeExecute(new Runnable() { // tag: startPonder
            public void run() {
                if (_isPondering) {
                    Log.w(TAG, "Already pondering, skipping startPonder");
                    return;
                }
                _isPondering = true;
                synchronized (stateLock) {
                    currentState = STATE_PONDER;
                }
                Log.i(TAG, "Starting ponder on position: " + fenWithPonderMove);
                sendUciCommand("position fen " + fenWithPonderMove);
                // v1.0.4 Rev31: include time params in go ponder so ponderhit
                // can correctly switch to timed search. Clamp to non-negative.
                long _wtime = Math.max(0, wtimeMs);
                long _btime = Math.max(0, btimeMs);
                long _winc = Math.max(0, wincMs);
                long _binc = Math.max(0, bincMs);
                // For untimed games (all zeros), send plain "go ponder" to avoid
                // any engine confusion about zero-time scenarios.
                if (_wtime == 0 && _btime == 0 && _winc == 0 && _binc == 0) {
                    sendUciCommand("go ponder");
                } else {
                    sendUciCommand("go ponder wtime " + _wtime + " btime " + _btime +
                                   " winc " + _winc + " binc " + _binc);
                }
            }
        }, "startPonder");
    }

    /**
     * Legacy single-arg startPonder — kept for backward compatibility with any
     * JS code that might still call it. Delegates to the timed version with
     * all-zero time params (untimed ponder).
     * @deprecated Use the 5-arg version with time params for timed games.
     */
    @JavascriptInterface
    public void startPonder(final String fenWithPonderMove) {
        startPonder(fenWithPonderMove, 0, 0, 0, 0);
    }

    @JavascriptInterface
    public void ponderHit() {
        if (!_isPondering) return;
        Log.i(TAG, "ponderhit — opponent played expected move");
        _isPondering = false;
        // FIX: Set state to STATE_GO so that the resulting bestmove is processed
        // correctly as the AI's move response, not dropped. Previously STATE_NONE
        // caused the bestmove handler to skip execution, missing the ponder result.
        synchronized (stateLock) {
            currentState = STATE_GO;
        }
        sendUciCommand("ponderhit");
    }

    @JavascriptInterface
    public void stopPonder() {
        if (!_isPondering) return;
        Log.i(TAG, "Stopping ponder — opponent played unexpected move");
        _isPondering = false;
        _discardingPonderBestmove = true; // Discard the ponder's bestmove when it arrives
        synchronized (stateLock) {
            currentState = STATE_NONE;
        }
        sendUciCommand("stop");
    }

    /**
     * v1.0.4 Rev35: Force-stop any in-flight engine search immediately.
     * Used by the JS layer when:
     *   - The game clock expires (timed-game flag-fall) — the engine must stop
     *     NOW, not when its internal wtime estimate says to. Without this, the
     *     engine continues searching after the clock hits 0, appearing
     *     "unresponsive" and wasting battery.
     *   - The user resigns / starts a new game / enters review mode mid-search.
     *
     * This is a "hard stop": sends "stop" and marks the bestmove as discarded
     * so it doesn't get processed as a real move. The engine's bestmove
     * response (when it arrives) is silently consumed and dropped.
     *
     * Unlike stopPonder() (which only handles ponder state), this method works
     * for ANY engine state (STATE_GO, STATE_HINT, STATE_EVAL, STATE_PONDER).
     */
    @JavascriptInterface
    public void engineStop() {
        Log.i(TAG, "engineStop — forcing engine to stop immediately");
        // v1.0.4 Rev36 FIX: Only set _discardingPonderBestmove when the engine
        // is actually in an active state (GO/HINT/EVAL/PONDER). If the engine
        // is idle (STATE_NONE), setting this flag would cause the NEXT game's
        // first bestmove to be silently discarded — manifesting as a 15s
        // safety-timer delay on the AI's first move of the new game.
        int stateBefore;
        synchronized (stateLock) {
            stateBefore = currentState;
            currentState = STATE_NONE;
        }
        _isPondering = false;
        if (stateBefore != STATE_NONE) {
            _discardingPonderBestmove = true;
            try {
                sendUciCommand("stop");
            } catch (Throwable e) {
                Log.w(TAG, "engineStop: sendUciCommand failed", e);
            }
        }
    }

    /**
     * v1.0.4 Rev35: Send a raw UCI command to the engine. Use sparingly —
     * prefer the typed methods (engineGo, engineEval, etc.) when available.
     * Currently used by the JS layer's resign/game-over path as a fallback
     * when engineStop() isn't sufficient.
     */
    @JavascriptInterface
    public void sendToEngine(final String command) {
        if (command == null || command.isEmpty()) return;
        _safeExecute(new Runnable() {
            public void run() {
                if (!engineReady) return;
                try {
                    sendUciCommand(command);
                } catch (Throwable e) {
                    Log.w(TAG, "sendToEngine failed: " + command, e);
                }
            }
        }, "sendToEngine");
    }

    @JavascriptInterface
    public String getLastPonderMove() {
        // One-shot read: clear after returning to prevent stale data from leaking
        // through on subsequent calls. The JS side should consume this value
        // immediately and store it in its own variable.
        String move = _lastPonderMove;
        _lastPonderMove = null;
        return move;
    }

    @JavascriptInterface
    public boolean isPondering() {
        return _isPondering;
    }

    // ===================== NOTIFICATION UPDATE =====================

    /**
     * Update the foreground service notification with engine status info.
     * v1.0.1: The notification now shows ONLY ready/analyzing/error states
     * (no depth/speed). Detailed depth/nps/score data is still shown in the
     * in-app eval bar; the notification is intentionally minimal to avoid
     * distracting the user. Keeping the notification actively updated (even
     * with a static "ready" string) still prevents the OS from killing the
     * service on aggressive memory managers like Xiaomi HyperOS 3.
     *
     * @param info Status string to display in the notification
     */
    @JavascriptInterface
    public void updateEngineNotification(String info) {
        if (info == null || info.isEmpty()) return;
        try {
            EngineService.updateNotification(context, info);
        } catch (Throwable e) {
            Log.w(TAG, "updateEngineNotification failed", e);
        }
    }

    /**
     * Save language preference to SharedPreferences so that the foreground
     * service notification can display text in the correct language.
     */
    @JavascriptInterface
    public void saveLangPref(String lang) {
        if (lang == null) return;
        try {
            // v1.0.2 FIX: Use the SAME SharedPreferences file as isEnglishMode() reads from.
            // Previously this used "Regalia_prefs" while isEnglishMode() reads from "RegaliaEngine"
            // (PREFS_NAME) — a mismatch that caused the language preference to be lost,
            // manifesting as "正在应用引擎配置..." appearing in Chinese even when the user
            // had previously switched to English mode.
            SharedPreferences.Editor editor = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
            editor.putString("lang", lang);
            editor.apply();
        } catch (Throwable e) {
            Log.w(TAG, "saveLangPref failed", e);
        }
    }

    // ===================== PERSISTENT CACHE (HyperOS 3 FIX) =====================
    // v1.0.4 Round-5 Rev16: WebView localStorage on Xiaomi HyperOS 3 is aggressively
    // cleared by the system memory manager / cache cleaner — sometimes within minutes
    // of the app going to background, sometimes on the next launch. This loses the
    // engine eval cache (Regalia_reviewEvalCache), the language preference
    // (Regalia_lang), and the recovery state (Regalia_recovery).
    //
    // Fix: provide a Java-side persistent key-value store backed by SharedPreferences
    // (MODE_PRIVATE). SharedPreferences files live in /data/data/com.Regalia/files/...
    // and are NEVER cleared by HyperOS cache management. The JS layer dual-writes to
    // both localStorage (fast in-memory reads) and these SharedPreferences-backed
    // methods (persistence). On cache miss in localStorage, the JS layer falls back
    // to persistentGet() and rehydrates localStorage.
    //
    // All values are stored as String. JSON encoding/decoding is the caller's
    // responsibility (JS side). The keys are prefixed with "kv_" in SharedPreferences
    // to avoid collision with engine settings keys ("lang", "engineThreads", etc.).
    private static final String KV_PREFIX = "kv_";

    @JavascriptInterface
    public String persistentGet(String key) {
        if (key == null) return null;
        try {
            // Return null if the key doesn't exist (SharedPreferences.getString returns
            // the default value, which we set to null). JS side treats null as "no
            // cached value" and falls back to computing the value fresh.
            return prefs.getString(KV_PREFIX + key, null);
        } catch (Throwable e) {
            Log.w(TAG, "persistentGet failed for key=" + key, e);
            return null;
        }
    }

    @JavascriptInterface
    public void persistentSet(String key, String value) {
        if (key == null) return;
        try {
            SharedPreferences.Editor editor = prefs.edit();
            if (value == null) {
                editor.remove(KV_PREFIX + key);
            } else {
                editor.putString(KV_PREFIX + key, value);
            }
            editor.apply();
        } catch (Throwable e) {
            Log.w(TAG, "persistentSet failed for key=" + key, e);
        }
    }

    @JavascriptInterface
    public void persistentRemove(String key) {
        if (key == null) return;
        try {
            prefs.edit().remove(KV_PREFIX + key).apply();
        } catch (Throwable e) {
            Log.w(TAG, "persistentRemove failed for key=" + key, e);
        }
    }

    // v1.0.4 Round-5 Rev20: Synchronous variants — use commit() instead of apply()
    // to guarantee the write hits disk before returning. This is CRITICAL for
    // HyperOS 3 compatibility: HyperOS 3 can SIGKILL the app within milliseconds
    // of it going to background, and apply()'s in-memory write queue is lost.
    // commit() blocks until fsync completes — slightly slower but durable.
    //
    // Use these for any data the user would notice losing (eval cache, current
    // PGN). Use the async persistentSet() for non-critical writes (e.g., UI
    // preferences that can be recomputed).
    @JavascriptInterface
    public void persistentSetSync(String key, String value) {
        if (key == null) return;
        try {
            SharedPreferences.Editor editor = prefs.edit();
            if (value == null) {
                editor.remove(KV_PREFIX + key);
            } else {
                editor.putString(KV_PREFIX + key, value);
            }
            // commit() returns boolean — true if written successfully. We discard
            // the result because the JS layer can't meaningfully react to a failed
            // disk write (the data is gone regardless).
            editor.commit();
        } catch (Throwable e) {
            Log.w(TAG, "persistentSetSync failed for key=" + key, e);
        }
    }

    /**
     * Flush any pending apply() writes to disk synchronously.
     * Call from onPause/onStop/onUserLeaveHint to ensure all queued writes
     * hit disk before the OS can kill the app.
     */
    @JavascriptInterface
    public void persistentFlush() {
        try {
            // An empty commit() forces SharedPreferences to flush its in-memory
            // write queue (any pending apply() calls) to disk before returning.
            prefs.edit().commit();
        } catch (Throwable e) {
            Log.w(TAG, "persistentFlush failed", e);
        }
    }

    // v1.0.4 Round-5 Rev20: Dedicated eval cache file storage.
    // SharedPreferences is optimized for small primitive values; storing a
    // 1-12 MB JSON blob in it slows down app startup (loads ALL keys into
    // memory at construction) and burns memory. We use a dedicated file
    // /data/data/com.Regalia/files/eval_cache.json instead, with atomic
    // write (tmp + rename) for crash safety.
    private static final String EVAL_CACHE_FILE = "eval_cache.json";

    /**
     * Synchronously read the eval cache file. Returns the raw JSON string,
     * or null if the file doesn't exist / can't be read.
     * Called at JS module construction — must be fast. Reads ~100KB-12MB.
     */
    @JavascriptInterface
    public String loadEvalCacheSync() {
        try {
            File file = new File(context.getFilesDir(), EVAL_CACHE_FILE);
            if (!file.exists() || !file.isFile()) return null;
            try (java.io.FileInputStream fis = new java.io.FileInputStream(file);
                 java.io.InputStreamReader reader = new java.io.InputStreamReader(fis, "UTF-8");
                 java.io.StringWriter sw = new java.io.StringWriter()) {
                char[] buf = new char[16384];
                int n;
                while ((n = reader.read(buf)) > 0) {
                    sw.write(buf, 0, n);
                }
                return sw.toString();
            }
        } catch (Throwable e) {
            Log.w(TAG, "loadEvalCacheSync failed", e);
            return null;
        }
    }

    /**
     * Synchronously write the eval cache file using atomic write (tmp + rename).
     * Guarantees durability: blocks until fsync + rename complete.
     * HyperOS 3 cannot kill the app fast enough to lose data — by the time
     * this returns, the file is on disk.
     */
    @JavascriptInterface
    public boolean saveEvalCacheSync(String json) {
        if (json == null) return false;
        try {
            File finalFile = new File(context.getFilesDir(), EVAL_CACHE_FILE);
            File tmpFile = new File(context.getFilesDir(), EVAL_CACHE_FILE + ".tmp");
            // Write to tmp file
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(tmpFile);
                 java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(fos, "UTF-8")) {
                writer.write(json);
                writer.flush();
                // v1.0.4 Round-5 Rev20: sync() for crash safety.
                // FileDescriptor.sync() is available since Java 1.0 / Android API 1.
                // If sync fails (rare), we still proceed — the rename is atomic.
                try { fos.getFD().sync(); } catch (Throwable ignored) {}
            }
            // v1.0.4 Rev23: Use Files.move with ATOMIC_MOVE + REPLACE_EXISTING
            // on API 26+ for true atomic rename. The old delete+rename sequence
            // had a brief window where neither the old nor the new file existed
            // (if the app crashed between delete and rename, the cache would be
            // lost). Files.move with ATOMIC_MOVE is POSIX-atomic.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    java.nio.file.Files.move(tmpFile.toPath(), finalFile.toPath(),
                            java.nio.file.StandardCopyOption.ATOMIC_MOVE,
                            java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    return true;
                } catch (java.nio.file.AtomicMoveNotSupportedException e) {
                    // Cross-device tmp/final — fall through to legacy path
                    Log.w(TAG, "saveEvalCacheSync: ATOMIC_MOVE not supported, falling back");
                }
            }
            // Legacy path (API 21-25 or cross-device fallback)
            if (finalFile.exists()) finalFile.delete();
            if (!tmpFile.renameTo(finalFile)) {
                // Fallback: copy tmp to final if rename fails (cross-device?)
                Log.w(TAG, "saveEvalCacheSync: rename failed, falling back to copy");
                java.nio.file.Files.copy(tmpFile.toPath(), finalFile.toPath(),
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "saveEvalCacheSync failed", e);
            return false;
        }
    }

    // ===================== PGN CACHE MANAGER (v1.0.4 Round-5 Rev18) =====================
    // The user can save the current PGN to a named cache entry and later re-import it
    // from the 📚 button in the review toolbar. Each entry is a separate file in
    // /data/data/com.Regalia/files/pgn_cache/<name>.pgn — the directory is app-private
    // and is NEVER cleared by HyperOS 3 cache management (same as SharedPreferences).
    //
    // The list returned by listPGNCaches() is a JSON array of {name, size, mtime} objects.
    // getPGNCache(name) returns the raw PGN text. deletePGNCache(name) removes one entry.
    // deletePGNCaches([names]) removes multiple entries atomically (best-effort).

    private static final String PGN_CACHE_DIR = "pgn_cache";

    private File _pgnCacheDir() {
        File dir = new File(context.getFilesDir(), PGN_CACHE_DIR);
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private String _sanitizeCacheName(String name) {
        // Strip path separators, control chars, and trim. Empty name → null.
        if (name == null) return null;
        String s = name.trim();
        // Remove any path-like characters (forbid directory traversal)
        s = s.replaceAll("[/\\\\:*?\"<>|]", "");
        // Remove control characters
        s = s.replaceAll("[\\x00-\\x1f\\x7f]", "");
        // Limit length to 100 chars to avoid filesystem issues
        if (s.length() > 100) s = s.substring(0, 100);
        return s.isEmpty() ? null : s;
    }

    @JavascriptInterface
    public String listPGNCaches() {
        try {
            File dir = _pgnCacheDir();
            File[] files = dir.listFiles();
            if (files == null) return "[]";
            // Sort: newest first (by mtime desc)
            java.util.Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            org.json.JSONArray arr = new org.json.JSONArray();
            // v1.0.4 Round-5 Rev20: Pre-load all tag files into a map for O(1) lookup
            // (avoids N file reads when listing N entries).
            java.util.Map<String, org.json.JSONArray> tagMap = new java.util.HashMap<>();
            for (File f : files) {
                String fn = f.getName();
                if (fn.endsWith(".tags.json")) {
                    String baseName = fn.substring(0, fn.length() - ".tags.json".length());
                    try {
                        String content = getPGNCacheTags(baseName);
                        tagMap.put(baseName, new org.json.JSONArray(content));
                    } catch (Throwable ignored) {}
                }
            }
            for (File f : files) {
                if (!f.isFile()) continue;
                String fn = f.getName();
                if (fn.endsWith(".tags.json")) continue; // Skip tag files in main list
                // Strip .pgn extension for display
                String displayName = fn.endsWith(".pgn") ? fn.substring(0, fn.length() - 4) : fn;
                try {
                    org.json.JSONObject obj = new org.json.JSONObject();
                    obj.put("name", displayName);
                    obj.put("size", f.length());
                    obj.put("mtime", f.lastModified());
                    // Include tags (empty array if none)
                    org.json.JSONArray tags = tagMap.get(displayName);
                    obj.put("tags", tags != null ? tags : new org.json.JSONArray());
                    arr.put(obj);
                } catch (Throwable ignored) {}
            }
            return arr.toString();
        } catch (Throwable e) {
            Log.w(TAG, "listPGNCaches failed", e);
            return "[]";
        }
    }

    @JavascriptInterface
    public boolean savePGNCache(String name, String pgn) {
        if (name == null || pgn == null) return false;
        String safe = _sanitizeCacheName(name);
        if (safe == null) return false;
        try {
            File file = new File(_pgnCacheDir(), safe + ".pgn");
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
                 java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(fos, "UTF-8")) {
                writer.write(pgn);
                writer.flush();
            }
            Log.i(TAG, "PGN cache saved: " + safe + " (" + pgn.length() + " chars)");
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "savePGNCache failed for name=" + safe, e);
            return false;
        }
    }

    @JavascriptInterface
    public String getPGNCache(String name) {
        if (name == null) return null;
        String safe = _sanitizeCacheName(name);
        if (safe == null) return null;
        try {
            File file = new File(_pgnCacheDir(), safe + ".pgn");
            if (!file.exists() || !file.isFile()) return null;
            try (java.io.FileInputStream fis = new java.io.FileInputStream(file);
                 java.io.InputStreamReader reader = new java.io.InputStreamReader(fis, "UTF-8");
                 java.io.StringWriter sw = new java.io.StringWriter()) {
                char[] buf = new char[8192];
                int n;
                while ((n = reader.read(buf)) > 0) {
                    sw.write(buf, 0, n);
                }
                return sw.toString();
            }
        } catch (Throwable e) {
            Log.w(TAG, "getPGNCache failed for name=" + safe, e);
            return null;
        }
    }

    @JavascriptInterface
    public boolean deletePGNCache(String name) {
        if (name == null) return false;
        String safe = _sanitizeCacheName(name);
        if (safe == null) return false;
        try {
            File file = new File(_pgnCacheDir(), safe + ".pgn");
            boolean pgnDeleted = file.exists() && file.delete();
            // v1.0.4 Round-5 Rev20: Also delete associated tags file
            File tagsFile = new File(_pgnCacheDir(), safe + ".tags.json");
            if (tagsFile.exists()) tagsFile.delete();
            return pgnDeleted;
        } catch (Throwable e) {
            Log.w(TAG, "deletePGNCache failed for name=" + safe, e);
            return false;
        }
    }

    /**
     * Delete multiple PGN cache entries. Names is a JSON array of strings.
     * Returns the number of entries successfully deleted.
     */
    @JavascriptInterface
    public int deletePGNCaches(String namesJson) {
        if (namesJson == null) return 0;
        int deleted = 0;
        try {
            org.json.JSONArray arr = new org.json.JSONArray(namesJson);
            for (int i = 0; i < arr.length(); i++) {
                String name = arr.optString(i, "");
                if (deletePGNCache(name)) deleted++;
            }
        } catch (Throwable e) {
            Log.w(TAG, "deletePGNCaches failed", e);
        }
        return deleted;
    }

    // v1.0.4 Round-5 Rev20: Rename and Tag features for PGN Cache Manager.
    // Tags are stored as a separate file: pgn_cache/<name>.tags.json (an array
    // of strings). This avoids modifying the PGN file itself and allows fast
    // tag queries without parsing PGN. Tag files are tiny (< 1KB each).

    /**
     * Atomically rename a PGN cache entry. Also renames the associated
     * tags file if it exists. Returns true on success.
     * If a cache with the new name already exists, returns false (does not overwrite).
     */
    @JavascriptInterface
    public boolean renamePGNCache(String oldName, String newName) {
        if (oldName == null || newName == null) return false;
        String oldSafe = _sanitizeCacheName(oldName);
        String newSafe = _sanitizeCacheName(newName);
        if (oldSafe == null || newSafe == null) return false;
        if (oldSafe.equals(newSafe)) return true; // No-op
        try {
            File oldFile = new File(_pgnCacheDir(), oldSafe + ".pgn");
            File newFile = new File(_pgnCacheDir(), newSafe + ".pgn");
            if (!oldFile.exists()) return false;
            if (newFile.exists()) return false; // Refuse to overwrite
            if (!oldFile.renameTo(newFile)) return false;
            // Also rename tags file if exists
            File oldTags = new File(_pgnCacheDir(), oldSafe + ".tags.json");
            if (oldTags.exists()) {
                File newTags = new File(_pgnCacheDir(), newSafe + ".tags.json");
                oldTags.renameTo(newTags); // best-effort
            }
            Log.i(TAG, "PGN cache renamed: " + oldSafe + " → " + newSafe);
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "renamePGNCache failed: " + oldSafe + " → " + newSafe, e);
            return false;
        }
    }

    /**
     * Set tags for a PGN cache entry. tagsJson is a JSON array of strings.
     * Pass null or empty array to clear tags.
     * Returns true on success.
     */
    @JavascriptInterface
    public boolean setPGNCacheTags(String name, String tagsJson) {
        if (name == null) return false;
        String safe = _sanitizeCacheName(name);
        if (safe == null) return false;
        try {
            File tagsFile = new File(_pgnCacheDir(), safe + ".tags.json");
            // Parse to validate JSON and normalize
            org.json.JSONArray arr;
            if (tagsJson == null || tagsJson.trim().isEmpty()) {
                arr = new org.json.JSONArray();
            } else {
                arr = new org.json.JSONArray(tagsJson);
            }
            if (arr.length() == 0) {
                // No tags — delete the file
                if (tagsFile.exists()) tagsFile.delete();
                return true;
            }
            // Write tags file
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(tagsFile);
                 java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(fos, "UTF-8")) {
                writer.write(arr.toString());
                writer.flush();
                try { fos.getFD().sync(); } catch (Throwable ignored) {}
            }
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "setPGNCacheTags failed for name=" + safe, e);
            return false;
        }
    }

    /**
     * Get tags for a PGN cache entry. Returns a JSON array of strings (e.g., [" classics "," tactics "]).
     * Returns "[]" if no tags file exists.
     */
    @JavascriptInterface
    public String getPGNCacheTags(String name) {
        if (name == null) return "[]";
        String safe = _sanitizeCacheName(name);
        if (safe == null) return "[]";
        try {
            File tagsFile = new File(_pgnCacheDir(), safe + ".tags.json");
            if (!tagsFile.exists() || !tagsFile.isFile()) return "[]";
            try (java.io.FileInputStream fis = new java.io.FileInputStream(tagsFile);
                 java.io.InputStreamReader reader = new java.io.InputStreamReader(fis, "UTF-8");
                 java.io.StringWriter sw = new java.io.StringWriter()) {
                char[] buf = new char[4096];
                int n;
                while ((n = reader.read(buf)) > 0) {
                    sw.write(buf, 0, n);
                }
                // Validate JSON
                String content = sw.toString();
                new org.json.JSONArray(content); // throws if invalid
                return content;
            }
        } catch (Throwable e) {
            Log.w(TAG, "getPGNCacheTags failed for name=" + safe, e);
            return "[]";
        }
    }

    // ===================== MULTIPV / WDL / SKILL =====================

    @JavascriptInterface
    public String getMultiPVResult() {
        return _lastMultiPVJson;
    }

    @JavascriptInterface
    public void setEngineShowWDL(boolean enabled) {
        engineShowWDL = enabled;
        saveBoolSetting("engineShowWDL", enabled);
        if (engineReady) {
            sendSetOptionAndWait("UCI_ShowWDL", String.valueOf(enabled));
        }
    }

    /**
     * v18.5.0: Alias for setEngineShowWDL — matches the JS API contract.
     */
    @JavascriptInterface
    public void setShowWDL(boolean enabled) {
        setEngineShowWDL(enabled);
    }

    @JavascriptInterface
    public void setEngineSkillLevel(int level) {
        if (level < 0) level = 0;
        if (level > 20) level = 20;
        engineSkillLevel = level;
        saveIntSetting("engineSkillLevel", level);
        if (engineReady) {
            sendSetOptionAndWait("Skill Level", String.valueOf(level));
        }
    }

    // v1.0.6 NEW: JS-side getter for the current Skill Level value.
    // Used by _aiOpponentNameWithLevel() to render "SL<N>" in the AI opponent
    // bar and in PGN [White]/[Black] tags when the AI is in SL mode.
    @JavascriptInterface
    public int getEngineSkillLevel() {
        return engineSkillLevel;
    }

    @JavascriptInterface
    public void setEngineLimitElo(boolean enabled, int elo) {
        if (elo < 500) elo = 500;
        if (elo > 3500) elo = 3500;
        engineLimitElo = enabled;
        engineElo = elo;
        saveBoolSetting("engineLimitElo", enabled);
        saveIntSetting("engineElo", elo);
        if (engineReady) {
            sendSetOptionAndWait("UCI_LimitStrength", String.valueOf(enabled));
            if (enabled) {
                sendSetOptionAndWait("UCI_Elo", String.valueOf(elo));
            }
        }
    }

    /**
     * v18.5.0: Convenience alias matching the JS API contract.
     */
    @JavascriptInterface
    public void setLimitStrength(boolean enabled, int elo) {
        setEngineLimitElo(enabled, elo);
    }

    /**
     * v18.5.0: Set the engine ELO independently (only effective when UCI_LimitStrength is true).
     */
    @JavascriptInterface
    public void setElo(int elo) {
        if (elo < 500) elo = 500;
        if (elo > 3500) elo = 3500;
        engineElo = elo;
        saveIntSetting("engineElo", elo);
        if (engineReady && engineLimitElo) {
            sendSetOptionAndWait("UCI_Elo", String.valueOf(elo));
        }
    }

    @JavascriptInterface
    public String getEngineSettings() {
        try {
            JSONObject settings = new JSONObject();
            settings.put("threads", engineThreads);
            settings.put("hash", engineHash);
            settings.put("moveOverhead", engineMoveOverhead);
            settings.put("multiPV", engineMultiPV);
            settings.put("ponder", enginePonder);
            settings.put("showWDL", engineShowWDL);
            settings.put("skillLevel", engineSkillLevel);
            settings.put("limitStrength", engineLimitElo);
            settings.put("elo", engineElo);
            settings.put("autoConfig", autoConfigEnabled);
            return settings.toString();
        } catch (Throwable e) {
            Log.e(TAG, "Error building engine settings JSON", e);
            return "{}";
        }
    }

    // ===================== SETTINGS EXPORT / IMPORT =====================

    @JavascriptInterface
    public String exportSettings() {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
            String timestamp = sdf.format(new Date());

            StringBuilder sb = new StringBuilder();
            sb.append("# Regalia Engine Configuration\n");
            sb.append("# Version: ").append(ENGINE_VERSION).append("\n");
            sb.append("# Export Time: ").append(timestamp).append("\n");
            sb.append("#\n");
            sb.append("engine.name=").append(engineName).append("\n");
            sb.append("engine.path=").append(currentEnginePath != null ? currentEnginePath : "").append("\n");
            sb.append("engine.threads=").append(engineThreads).append("\n");
            sb.append("engine.hash=").append(engineHash).append("\n");
            sb.append("engine.moveOverhead=").append(engineMoveOverhead).append("\n");
            sb.append("engine.multiPV=").append(engineMultiPV).append("\n");
            sb.append("engine.ponder=").append(enginePonder).append("\n");
            sb.append("engine.showWDL=").append(engineShowWDL).append("\n");
            sb.append("engine.skillLevel=").append(engineSkillLevel).append("\n");
            sb.append("engine.limitStrength=").append(engineLimitElo).append("\n");
            sb.append("engine.elo=").append(engineElo).append("\n");
            sb.append("engine.autoConfig=").append(autoConfigEnabled).append("\n");

            return sb.toString();
        } catch (Throwable e) {
            Log.e(TAG, "Error exporting settings", e);
            return "# Error exporting settings\n";
        }
    }

    /**
     * v18.5.0: Alias for exportSettings — matches the JS API contract.
     */
    @JavascriptInterface
    public String exportEngineSettings() {
        return exportSettings();
    }

    @JavascriptInterface
    public void importSettings(String txtContent) {
        // v1.0.2 FIX (audit): use _safeExecute to catch RejectedExecutionException
        _safeExecute(new Runnable() { // tag: importSettings
            public void run() {
                boolean success = false;
                String message = "";
                int appliedCount = 0;
                int skippedAutoConfigCount = 0;

                try {
                    if (txtContent == null || txtContent.trim().isEmpty()) {
                        throw new IllegalArgumentException("Empty settings content");
                    }

                    // v1.0.2 FIX: Track explicitly-imported keys so we can report
                    // which ones were silently overridden by autoConfig. Without
                    // this, a user importing "engine.threads=4" while autoConfig
                    // is on would see "Imported N settings successfully" but the
                    // threads value would be silently replaced by the detected
                    // hardware value — manifesting as "import reports success but
                    // has no effect".
                    java.util.Set<String> explicitlySet = new java.util.HashSet<>();

                    String[] lines = txtContent.split("\\r?\\n");
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;

                        int eqIndex = line.indexOf('=');
                        if (eqIndex <= 0 || eqIndex >= line.length() - 1) continue;

                        String key = line.substring(0, eqIndex).trim();
                        String value = line.substring(eqIndex + 1).trim();

                        try {
                            switch (key) {
                                case "engine.threads":
                                    engineThreads = Math.max(1, Math.min(1024, Integer.parseInt(value)));
                                    saveIntSetting("engineThreads", engineThreads);
                                    explicitlySet.add("engine.threads");
                                    appliedCount++;
                                    break;
                                case "engine.hash":
                                    engineHash = Math.max(1, Math.min(1048576, Integer.parseInt(value)));
                                    saveIntSetting("engineHash", engineHash);
                                    explicitlySet.add("engine.hash");
                                    appliedCount++;
                                    break;
                                case "engine.moveOverhead":
                                    engineMoveOverhead = Math.max(0, Math.min(10000, Integer.parseInt(value)));
                                    saveIntSetting("engineMoveOverhead", engineMoveOverhead);
                                    appliedCount++;
                                    break;
                                case "engine.multiPV":
                                    engineMultiPV = Math.max(1, Math.min(8, Integer.parseInt(value)));
                                    saveIntSetting("engineMultiPV", engineMultiPV);
                                    appliedCount++;
                                    break;
                                case "engine.ponder":
                                    enginePonder = Boolean.parseBoolean(value);
                                    saveBoolSetting("enginePonder", enginePonder);
                                    appliedCount++;
                                    break;
                                case "engine.showWDL":
                                    engineShowWDL = Boolean.parseBoolean(value);
                                    saveBoolSetting("engineShowWDL", engineShowWDL);
                                    appliedCount++;
                                    break;
                                case "engine.skillLevel":
                                    engineSkillLevel = Math.max(0, Math.min(20, Integer.parseInt(value)));
                                    saveIntSetting("engineSkillLevel", engineSkillLevel);
                                    appliedCount++;
                                    break;
                                case "engine.limitStrength":
                                    engineLimitElo = Boolean.parseBoolean(value);
                                    saveBoolSetting("engineLimitElo", engineLimitElo);
                                    appliedCount++;
                                    break;
                                case "engine.elo":
                                    engineElo = Math.max(1, Math.min(3200, Integer.parseInt(value)));
                                    saveIntSetting("engineElo", engineElo);
                                    appliedCount++;
                                    break;
                                case "engine.autoConfig":
                                    autoConfigEnabled = Boolean.parseBoolean(value);
                                    saveBoolSetting("autoConfig", autoConfigEnabled);
                                    appliedCount++;
                                    break;
                                default:
                                    break;
                            }
                        } catch (NumberFormatException e) {
                            Log.w(TAG, "Invalid value for " + key + ": " + value);
                        }
                    }

                    // v1.0.2 FIX: If autoConfig is enabled AND the user explicitly
                    // imported engine.threads/engine.hash, those explicit values
                    // would be silently overridden by detectHardwareAndConfigure()
                    // in applySettings(). Honor the user's explicit import by
                    // disabling autoConfig for this apply cycle only.
                    if (autoConfigEnabled) {
                        if (explicitlySet.contains("engine.threads") || explicitlySet.contains("engine.hash")) {
                            Log.i(TAG, "User explicitly imported threads/hash — disabling autoConfig for this apply cycle");
                            skippedAutoConfigCount = 1;
                            // Persist the change so the engine-config UI reflects it
                            autoConfigEnabled = false;
                            saveBoolSetting("autoConfig", false);
                        }
                    }

                    if (engineReady) {
                        // v1.0.2 CRITICAL FIX: Stop any in-flight search BEFORE applying
                        // settings. Otherwise sendSetOptionAndWait() times out waiting
                        // for readyok (engine only responds to isready when idle), and
                        // the settings silently fail to apply — manifesting as
                        // "import reports success but does not take effect".
                        try {
                            stopAndWaitForBestmove("importSettings");
                        } catch (Throwable t) {
                            Log.w(TAG, "stopAndWaitForBestmove during import failed", t);
                        }
                        applySettings();
                        notifyEngineInfo();
                    } else {
                        // v1.0.2 FIX: Engine not ready yet — settings are saved to
                        // prefs and will be applied automatically by startEngine()'s
                        // call to applySettings() once the engine finishes initializing.
                        Log.i(TAG, "Engine not ready — settings saved, will apply on next engineReady");
                    }

                    success = true;
                    message = "Imported " + appliedCount + " settings successfully";
                    if (skippedAutoConfigCount > 0) {
                        message += " (autoConfig disabled to honor explicit threads/hash)";
                    }
                    if (!engineReady) {
                        message += " (engine not ready — will apply on next start)";
                    }
                    Log.i(TAG, message);
                } catch (Throwable e) {
                    Log.e(TAG, "Error importing settings", e);
                    message = e.getMessage() != null ? e.getMessage() : "Import failed";
                }

                try {
                    JSONObject result = new JSONObject();
                    result.put("success", success);
                    result.put("message", message);
                    postJsCallback("onSettingsImported(" + result.toString() + ")");
                } catch (Throwable e) {
                    Log.w(TAG, "Error posting settings imported callback", e);
                }
            }
        }, "importSettings");
    }

    /**
     * v18.5.0: Alias for importSettings — matches the JS API contract.
     */
    @JavascriptInterface
    public void importEngineSettings(String txtContent) {
        importSettings(txtContent);
    }

    // ===================== HAPTIC FEEDBACK =====================

    @JavascriptInterface
    public int getApiLevel() {
        return Build.VERSION.SDK_INT;
    }

    @JavascriptInterface
    public boolean hasVibrator() {
        try {
            android.os.Vibrator vibrator = (android.os.Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            return vibrator != null && vibrator.hasVibrator();
        } catch (Throwable e) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean isHapticEnabled() {
        try {
            boolean systemEnabled = android.provider.Settings.System.getInt(
                context.getContentResolver(),
                android.provider.Settings.System.HAPTIC_FEEDBACK_ENABLED, 1
            ) != 0;
            boolean appEnabled = prefs.getBoolean("hapticFeedbackEnabled", true);
            // FIX: Both system AND app must be enabled. Previously used OR (||)
            // which meant disabling haptic in app settings had no effect.
            return systemEnabled && appEnabled;
        } catch (Throwable e) {
            return true;
        }
    }

    @JavascriptInterface
    public void performHaptic(String type) {
        try {
            android.os.Vibrator vibrator = (android.os.Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;

            if (!isHapticEnabled()) return;

            int apiLevel = Build.VERSION.SDK_INT;
            final android.os.Vibrator finalVibrator = vibrator;

            Runnable hapticRunnable = new Runnable() {
                public void run() {
                    try {
                        performHapticInternal(finalVibrator, type, apiLevel);
                    } catch (Throwable e) {
                        Log.w(TAG, "performHapticInternal failed: " + e.getMessage());
                    }
                }
            };

            mainHandler.post(hapticRunnable);
        } catch (Throwable e) {
            Log.w(TAG, "performHaptic failed: " + e.getMessage());
        }
    }

    private void performHapticInternal(android.os.Vibrator vibrator, String type, int apiLevel) {
        switch (type) {
                case "BUTTON_PRESS":
                    if (apiLevel >= 31) {
                        try {
                            android.os.VibrationEffect effect = android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_CLICK);
                            vibrator.vibrate(effect);
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 15);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 15);
                    }
                    break;

                case "PIECE_SELECT":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.3f, 0.0f}, new long[]{0, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 31) {
                        try {
                            android.os.VibrationEffect effect = android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_TICK);
                            vibrator.vibrate(effect);
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 10);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 10);
                    }
                    break;

                case "PIECE_MOVE":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.0f}, new long[]{0, 40, 25})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 31) {
                        try {
                            android.os.VibrationEffect effect = android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_HEAVY_CLICK);
                            vibrator.vibrate(effect);
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 25);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 25);
                    }
                    break;

                // v1.0.8 PHASE 26: piece-specific haptics for pawn (light quiver),
                //   queen (massive impact), king (heavy regal).
                // v1.0.8 PHASE 27: added knight (jump + crisp landing),
                //   bishop (smooth glide), rook (charge + impact) haptics so all
                //   six piece types have distinct, personality-matched feedback.
                case "PAWN_MOVE":
                    // Light quiver — three tiny ticks (the "瑟瑟发抖" shiver)
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.15f, 0.05f, 0.15f, 0.05f, 0.15f, 0.0f}, new long[]{0, 12, 8, 12, 8, 12, 8})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 12, 8, 12, 8, 12};
                            int[] amplitudes = {0, 60, 20, 60, 20, 60};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 20);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 20);
                    }
                    break;

                case "KNIGHT_MOVE":
                    // Agile jump + crisp landing — a gentle lift-off ramp, a brief
                    // mid-air gap, then a sharp crisp "ding" tick (the L-shape
                    // parabolic jump + crisp ding landing from the sound/animation).
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.35f, 0.1f, 0.7f, 0.0f}, new long[]{0, 30, 40, 25, 15})) {
                        // PWLE: ramp up (lift-off) → gap (mid-air) → sharp peak (landing ding)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 30, 40, 25};
                            int[] amplitudes = {0, 100, 30, 200};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 60);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 60);
                    }
                    break;

                case "BISHOP_MOVE":
                    // Sharp smooth glide — a single smooth swell (no hard peak);
                    // the bishop slides swiftly and cleanly along the diagonal.
                    // Matches the sawtooth-glide + filter-sweep sound (270ms).
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.4f, 0.45f, 0.2f, 0.0f}, new long[]{0, 40, 50, 40, 20})) {
                        // PWLE: smooth ramp up → smooth ramp down (bell-curve, no tick)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 40, 50, 40};
                            int[] amplitudes = {0, 120, 140, 60};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 70);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 70);
                    }
                    break;

                case "ROOK_MOVE":
                    // Fierce charge-dash-impact — a low charge rumble, a brief dash
                    // gap, then a heavy impact thud (matches the 3-stage rook sound
                    // and the light board shake on landing).
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.15f, 0.85f, 0.3f, 0.5f, 0.0f}, new long[]{0, 25, 35, 60, 25, 40, 20})) {
                        // PWLE: low charge → gap (dash whoosh) → heavy impact thud
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 25, 35, 60, 25, 40};
                            int[] amplitudes = {0, 150, 40, 255, 80, 150};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 120);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 120);
                    }
                    break;

                case "QUEEN_MOVE":
                    // Massive impact — the "铿锵有声、掷地有声" resounding slam
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.8f, 0.3f, 1.0f, 0.2f, 0.7f, 0.0f}, new long[]{0, 60, 40, 120, 50, 80, 40})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 60, 40, 120, 50, 80};
                            int[] amplitudes = {0, 200, 80, 255, 130, 180};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 300);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 300);
                    }
                    break;

                case "KING_MOVE":
                    // Heavy regal — four measured thuds (the "威严庄重" solemn steps)
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.2f, 0.6f, 0.2f, 0.6f, 0.2f, 0.6f, 0.0f}, new long[]{0, 50, 60, 50, 60, 50, 60, 50, 40})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 50, 60, 50, 60, 50, 60, 50};
                            int[] amplitudes = {0, 180, 60, 180, 60, 180, 60, 180};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 250);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 250);
                    }
                    break;

                case "PIECE_CAPTURE":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.2f, 0.6f, 0.0f}, new long[]{0, 30, 20, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 31) {
                        try {
                            vibrator.vibrate(android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_DOUBLE_CLICK));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 40);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 40);
                    }
                    break;

                case "SLIDER_DRAG":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.15f, 0.0f}, new long[]{0, 15, 10})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 8);
                    }
                    break;

                case "TAB_SWITCH":
                    if (apiLevel >= 31) {
                        try {
                            vibrator.vibrate(android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_CLICK));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 20);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 20);
                    }
                    break;

                case "TOGGLE_ON":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.2f, 0.5f, 0.0f}, new long[]{0, 30, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 30);
                    }
                    break;

                case "TOGGLE_OFF":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.2f, 0.0f}, new long[]{0, 30, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 20);
                    }
                    break;

                case "CHECK_ALERT":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.8f, 0.3f, 0.8f, 0.3f, 0.8f, 0.0f}, new long[]{0, 50, 30, 50, 30, 50, 30})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 50, 30, 50, 30, 50};
                            int[] amplitudes = {0, 255, 100, 255, 100, 255};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 200);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 200);
                    }
                    break;

                case "GAME_OVER":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.3f, 0.8f, 0.1f, 0.0f}, new long[]{0, 100, 50, 200, 80, 50})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 100, 50, 200, 80};
                            int[] amplitudes = {0, 200, 100, 255, 30};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 400);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 400);
                    }
                    break;

                // v1.0.8 PHASE 28: CASTLE and PROMOTION haptics (previously fell to
                //   the 15ms default — castling felt LESS tactile than a normal move,
                //   promotion had no celebratory feedback).
                // v1.0.8 PHASE 29: CASTLE redesigned to match the new rapid "snap +
                //   slam" sound (playCastleRookMove in ui.js). The old pattern
                //   (40-30-50ms, amplitudes 160/50/200) was too gentle and too slow
                //   for the new impactful sound. New pattern mirrors the two-stage
                //   audio design:
                //     Stage 1 (0-35ms): sharp intense snap — amplitude 255 (max),
                //                       matching the 110Hz thump + noise crack
                //     Stage 2 (45-105ms): heavy rumble slam — amplitude 220,
                //                         matching the sawtooth down-sweep + shimmer
                //   Total ~105ms (vs old 120ms) — tighter, more decisive.
                //   The "威严的迅猛" (majestic rapidity) feel: the king commands,
                //   the rook obeys instantly with a heavy thud.
                case "CASTLE":
                    // Two-stage snap + slam — synchronized with playCastleRookMove
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 1.0f, 0.3f, 0.85f, 0.0f}, new long[]{0, 35, 10, 60, 15})) {
                        // PWLE succeeded
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 35, 10, 60};
                            int[] amplitudes = {0, 255, 80, 220};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 105);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 105);
                    }
                    break;

                case "PROMOTION":
                    // Celebratory ascending triad — three rising pulses
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.3f, 0.15f, 0.5f, 0.2f, 0.8f, 0.0f}, new long[]{0, 30, 20, 30, 20, 50, 20})) {
                        // PWLE succeeded
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 30, 20, 30, 20, 50};
                            int[] amplitudes = {0, 80, 30, 140, 50, 220};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Throwable e) {
                            fallbackVibrate(vibrator, apiLevel, 100);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 100);
                    }
                    break;

                default:
                    fallbackVibrate(vibrator, apiLevel, 15);
                    break;
            }
    }

    @JavascriptInterface
    public void setHapticEnabled(boolean enabled) {
        saveBoolSetting("hapticFeedbackEnabled", enabled);
        Log.i(TAG, "Haptic feedback preference set to: " + enabled);
    }

    // v1.0.8 PHASE 28 (bug fix): tryPwleVibrate now returns boolean (true if
    //   PWLE succeeded, false if it fell back). The internal fallback was a
    //   single OneShot which lost the multi-stage pattern (e.g. queen's
    //   charge-impact became a single 390ms buzz). Now: if PWLE fails, return
    //   false so the case statement's API 26+ waveform branch can run (which
    //   has the correct multi-stage pattern). The old internal fallback is
    //   removed — no more silent single-buzz degradation.
    private boolean tryPwleVibrate(android.os.Vibrator vibrator, float[] amplitudes, long[] durations) {
        if (Build.VERSION.SDK_INT >= 35) {
            try {
                Class<?> builderClass = Class.forName("android.os.VibrationEffect$Composition");
                java.lang.reflect.Method startPwleMethod = builderClass.getMethod("startPwle");
                java.lang.reflect.Method addPwleRampMethod = builderClass.getMethod("addPwleRamp", long.class, float.class);
                java.lang.reflect.Method composeMethod = builderClass.getMethod("compose");

                Object composition = builderClass.getDeclaredConstructor().newInstance();
                startPwleMethod.invoke(composition);

                for (int i = 0; i < amplitudes.length; i++) {
                    addPwleRampMethod.invoke(composition, durations[i], amplitudes[i]);
                }

                Object effect = composeMethod.invoke(composition);
                vibrator.vibrate((android.os.VibrationEffect) effect);
                return true;
            } catch (Throwable e) {
                Log.d(TAG, "PWLE not available, falling back to waveform");
                return false;
            }
        }
        return false;
    }

    private void fallbackVibrate(android.os.Vibrator vibrator, int apiLevel, long durationMs) {
        try {
            if (apiLevel >= 26) {
                vibrator.vibrate(android.os.VibrationEffect.createOneShot(durationMs, 128));
            } else {
                vibrator.vibrate(durationMs);
            }
        } catch (Throwable e) {
            // Silent - vibrator unavailable
        }
    }

    // ===================== ASSET LOADING =====================

    @JavascriptInterface
    public String loadAssetAsBase64(String assetPath) {
        // FIX: Use try-with-resources to prevent InputStream leak on exception
        try (java.io.InputStream in = context.getAssets().open(assetPath)) {
            byte[] buffer = new byte[8192];
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            int len;
            while ((len = in.read(buffer)) > 0) {
                baos.write(buffer, 0, len);
            }
            return android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
        } catch (Throwable e) {
            Log.e(TAG, "Failed to load asset as base64: " + assetPath, e);
            return "";
        }
    }

    // ===================== EXTERNAL URL LAUNCHER =====================

    /**
     * v1.0.4 Round-5 Rev27: Open an external http(s) URL in the system default browser.
     *
     * Called from JavaScript when the user taps any hyperlink (About page GitHub
     * link, AGPL/GPL license links, etc.). The URL is strictly validated to be
     * http/https — any other scheme is silently rejected (defense against
     * intent-scheme injection attacks).
     *
     * The Intent is started with FLAG_ACTIVITY_NEW_TASK because the caller is
     * the Application context (StockfishNative holds the app context, not an
     * Activity context). Without this flag, startActivity() would throw
     * "Calling startActivity() from outside of an Activity context requires
     * the FLAG_ACTIVITY_NEW_TASK flag".
     *
     * @param url The http(s) URL to open.
     */
    @JavascriptInterface
    public void openUrlInBrowser(String url) {
        if (url == null) return;
        String trimmed = url.trim();
        // SECURITY: Only allow http(s) schemes. Reject file:, content:, javascript:, etc.
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            Log.w(TAG, "openUrlInBrowser rejected non-http(s) URL: " + trimmed);
            return;
        }
        try {
            Uri uri = Uri.parse(trimmed);
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            // Only allow browsers to handle this intent (no implicit app-component
            // hijacking). Note: chooser is intentionally NOT used — we want the
            // system default browser, and a chooser would add an extra tap.
            context.startActivity(intent);
            Log.i(TAG, "Opened external URL in browser: " + trimmed);
        } catch (Throwable e) {
            Log.e(TAG, "openUrlInBrowser failed for: " + trimmed, e);
        }
    }

    // ===================== ENGINE BINARY EXTRACTION HELPERS =====================

    /**
     * Extract engine binary from APK's lib/ directory to filesDir.
     * Fallback for OEM ROMs that skip extraction of large native libraries during install.
     */
    private File extractEngineFromApk() {
        File destFile = new File(context.getFilesDir(), ENGINE_LIB_NAME);

        // FIX: Also verify ELF header on cached file to prevent using corrupted extraction
        if (destFile.exists() && destFile.length() > 50000000 && isElfFile(destFile)) {
            Log.i(TAG, "Using previously extracted engine: " + destFile.getAbsolutePath()
                    + " size=" + destFile.length());
            makeExecutable(destFile);
            currentEnginePath = destFile.getAbsolutePath();
            return destFile;
        }

        // Try extracting from assets first (universal APK compatibility)
        File assetExtracted = extractEngineFromAssets();
        if (assetExtracted != null) {
            return assetExtracted;
        }

        try {
            ApplicationInfo appInfo = context.getApplicationInfo();
            String apkPath = appInfo.sourceDir;
            if (apkPath == null) {
                Log.w(TAG, "Cannot extract: sourceDir is null");
                return null;
            }

            postJsCallback("onInitProgress(12, " + escapeJsString(isEnglishMode() ? "Extracting engine from APK..." : "\u6b63\u5728\u4ece\u5b89\u88c5\u5305\u63d0\u53d6\u5f15\u64ce...") + ")");
            String[] apkEntryPaths = {
                "lib/arm64-v8a/" + ENGINE_LIB_NAME,
                "lib/armeabi-v7a/" + ENGINE_LIB_NAME,
                ENGINE_LIB_NAME
            };

            try (ZipFile zip = new ZipFile(apkPath)) {
                ZipEntry entry = null;
                for (String path : apkEntryPaths) {
                    entry = zip.getEntry(path);
                    if (entry != null) {
                        break;
                    }
                }
                if (entry == null) {
                    Log.w(TAG, "Engine entry not found in APK");
                    return null;
                }
                Log.i(TAG, "Extracting engine from APK: " + entry.getName());

                try (java.io.InputStream in = zip.getInputStream(entry);
                     java.io.FileOutputStream out = new java.io.FileOutputStream(destFile)) {
                    byte[] buffer = new byte[262144];
                    int len;
                    long total = 0;
                    long lastProgress = 0;
                    while ((len = in.read(buffer)) > 0) {
                        out.write(buffer, 0, len);
                        total += len;
                        if (total - lastProgress > 10485760) {
                            lastProgress = total;
                            int pct = 12 + (int) (total * 13 / entry.getSize());
                            postJsCallback("onInitProgress(" + pct + ", " + escapeJsString((isEnglishMode() ? "Extracting engine... " : "\u6b63\u5728\u63d0\u53d6\u5f15\u64ce... ") + (total / 1048576) + "MB/" + (entry.getSize() / 1048576) + "MB") + ")");
                        }
                    }
                    out.flush();
                    Log.i(TAG, "Extracted engine: " + total + " bytes");
                }
            }

            makeExecutable(destFile);

            if (destFile.exists() && destFile.canRead() && destFile.length() > 50000000) {
                if (isElfFile(destFile)) {
                    Log.i(TAG, "Engine extracted successfully, size=" + destFile.length());
                    currentEnginePath = destFile.getAbsolutePath();
                    return destFile;
                } else {
                    Log.e(TAG, "Extracted engine failed ELF header verification");
                    destFile.delete();
                }
            } else {
                Log.e(TAG, "Extracted engine file is invalid (size=" + (destFile.exists() ? destFile.length() : 0) + ")");
                destFile.delete();
            }
        } catch (Throwable e) {
            Log.e(TAG, "Failed to extract engine from APK", e);
        }
        return null;
    }

    /**
     * Extract engine binary from assets/engines/ directory.
     * Used when APK has no jniLibs (universal APK without ABI restriction).
     */
    private File extractEngineFromAssets() {
        File destFile = new File(context.getFilesDir(), ENGINE_LIB_NAME);

        // FIX: Also verify ELF header on cached file to prevent using corrupted extraction
        if (destFile.exists() && destFile.length() > 50000000 && isElfFile(destFile)) {
            Log.i(TAG, "Using previously asset-extracted engine: " + destFile.getAbsolutePath()
                    + " size=" + destFile.length());
            makeExecutable(destFile);
            currentEnginePath = destFile.getAbsolutePath();
            return destFile;
        }

        String assetPath = "engines/" + ENGINE_LIB_NAME;
        Log.i(TAG, "Attempting to extract engine from assets: " + assetPath);

        try (java.io.InputStream in = context.getAssets().open(assetPath);
             java.io.FileOutputStream out = new java.io.FileOutputStream(destFile)) {
            byte[] buffer = new byte[262144];
            int len;
            long total = 0;
            long lastProgress = 0;
            while ((len = in.read(buffer)) > 0) {
                out.write(buffer, 0, len);
                total += len;
                if (total - lastProgress > 10485760) {
                    lastProgress = total;
                    // v1.0.5 Round-6 Rev61 (2026.6.27): FIX integer-division truncation.
                    // Original `total / 114115752L * 13` evaluated left-to-right:
                    //   total / 114115752L  → 0 for any total < 114 MB (integer truncation)
                    //   0 * 13              → 0
                    // So progress stayed at 12% until extraction completed, then jumped
                    // to 25%. Reordered to `total * 13L / 114115752L` so the multiply
                    // happens first (no precision loss for total < 8.8 GB).
                    int pct = 12 + (int) (total * 13L / 114115752L);
                    postJsCallback("onInitProgress(" + pct + ", " + escapeJsString((isEnglishMode() ? "Extracting engine... " : "\u6b63\u5728\u63d0\u53d6\u5f15\u64ce... ") + (total / 1048576) + "MB") + ")");
                }
            }
            out.flush();
            Log.i(TAG, "Extracted engine from assets: " + total + " bytes");
        } catch (java.io.FileNotFoundException e) {
            Log.d(TAG, "Engine not found in assets (expected for jniLibs-based APK)");
            return null;
        } catch (Throwable e) {
            Log.w(TAG, "Failed to extract engine from assets", e);
            return null;
        }

        makeExecutable(destFile);

        if (destFile.exists() && destFile.canRead() && destFile.length() > 50000000) {
            if (isElfFile(destFile)) {
                Log.i(TAG, "Engine extracted from assets successfully, size=" + destFile.length());
                currentEnginePath = destFile.getAbsolutePath();
                return destFile;
            } else {
                Log.e(TAG, "Asset-extracted engine failed ELF verification — deleting");
                destFile.delete();
            }
        } else {
            Log.e(TAG, "Asset-extracted engine is invalid (size=" + (destFile.exists() ? destFile.length() : 0) + ")");
            destFile.delete();
        }
        return null;
    }

    /**
     * Make a file executable using multiple methods for maximum compatibility.
     */
    private void makeExecutable(File file) {
        try {
            boolean nativeOk = nativeChmod(file.getAbsolutePath());
            if (nativeOk && file.canExecute()) {
                return;
            }
            if (!file.setExecutable(true, false)) {
                // v1.0.8 PHASE 49: destroy() the chmod subprocess on timeout to
                //   avoid zombie processes on broken ROMs where chmod hangs.
                //   waitFor(2s) returns false on timeout but leaves the process
                //   running; an explicit destroy() reaps it.
                try {
                    Process p = Runtime.getRuntime().exec(
                            new String[]{"/system/bin/chmod", "744", file.getAbsolutePath()});
                    if (!p.waitFor(2, TimeUnit.SECONDS)) {
                        p.destroy();
                    }
                } catch (Throwable e2) {
                    try {
                        Process p = Runtime.getRuntime().exec(
                                new String[]{"/system/bin/sh", "-c",
                                        "chmod 744 " + file.getAbsolutePath()});
                        if (!p.waitFor(2, TimeUnit.SECONDS)) {
                            p.destroy();
                        }
                    } catch (Throwable ignored) {}
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "Failed to make executable: " + file.getAbsolutePath(), e);
        }
    }

    // (v18.5.0: copyFile() removed — dead code after engine-import removal; extract* uses inline streams.)

    // ===================== FILE I/O FOR SETTINGS EXPORT/IMPORT =====================

    /**
     * Check if the app has external storage permission.
     * On Android 10+: Scoped storage — app-specific directories don't need permission.
     * On Android 13+: SAF is the proper way to access files; no runtime permission needed.
     * MANAGE_EXTERNAL_STORAGE has been removed — SAF is used for all file I/O.
     */
    @JavascriptInterface
    public boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            // Android 13+: No runtime storage permission needed — SAF handles everything
            return true;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10-12: READ_EXTERNAL_STORAGE still works for File API access
            // FIX: Use checkSelfPermission() instead of checkCallingOrSelfPermission().
            // In @JavascriptInterface context, checkCallingOrSelfPermission() uses the
            // WebView's caller identity which may not match the app's own UID, causing
            // false negatives. checkSelfPermission() always checks the app's own permissions.
            return context.checkSelfPermission(
                android.Manifest.permission.READ_EXTERNAL_STORAGE
            ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        // Android 9 and below: check WRITE_EXTERNAL_STORAGE
        return context.checkSelfPermission(
            android.Manifest.permission.WRITE_EXTERNAL_STORAGE
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    /**
     * Request storage permission based on Android version.
     * - Android 9 and below: WRITE_EXTERNAL_STORAGE
     * - Android 10-12 (API 29-32): READ_EXTERNAL_STORAGE (still valid for File API)
     * - Android 13+ (API 33+): No runtime permission needed — SAF handles file access
     */
    @JavascriptInterface
    public void requestStoragePermission() {
        Activity activity = activityRef.get();
        if (activity == null) return;
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                // Android 9 and below: request WRITE_EXTERNAL_STORAGE
                activity.requestPermissions(
                    new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    1001
                );
            } else if (Build.VERSION.SDK_INT < 33) {
                // Android 10-12: request READ_EXTERNAL_STORAGE (still valid for File API)
                activity.requestPermissions(
                    new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE},
                    1001
                );
            }
            // Android 13+: No runtime permission to request — SAF handles file access
        } catch (Throwable e) {
            Log.w(TAG, "requestStoragePermission failed", e);
        }
    }

    // (MANAGE_EXTERNAL_STORAGE methods removed — SAF handles all public-dir I/O, no special permission needed, API 19+.)

    /** Request code for SAF file picker (export settings via ACTION_CREATE_DOCUMENT) */
    static final int REQUEST_CODE_EXPORT_SETTINGS = 1002;
    /** v1.0.2 FEATURE (audit): Request code for PGN export via ACTION_CREATE_DOCUMENT */
    static final int REQUEST_CODE_EXPORT_PGN = 1004;
    // (v1.0.2: REQUEST_CODE_EXPORT_STATS_HTML removed — stats HTML export lives in StatsActivity now.)
    // (v1.0.2: _pendingStatsPayload / _pendingStatsHTML removed — StatsActivity has its own bridge; these were memory leaks.)

    /** Pending export content — stored temporarily until SAF picker returns a URI */
    private volatile String _pendingExportContent = null;
    /** v1.0.2 FEATURE: pending export type — "settings" or "pgn" — so handleExportFilePickerResult
     *  fires the correct JS callback (onSettingsExported vs onPGNExported). */
    private volatile String _pendingExportType = "settings";

    /** v1.0.8 PHASE 24: Cancel a pending export (user dismissed the SAF picker).
     *  Clears the pending content and notifies JS so the "Exporting..." dialog
     *  is dismissed. Without this, cancelling the picker leaves the dialog hung. */
    public void cancelPendingExport() {
        _pendingExportContent = null;
        _pendingExportType = "settings";
        try {
            postJsCallback("if(typeof onExportCancelled==='function')onExportCancelled();");
        } catch (Throwable ignored) {}
    }

    /**
     * Open the system SAF file picker for exporting settings to a TXT file.
     * Uses ACTION_CREATE_DOCUMENT which creates a file in the user-chosen location
     * (typically Download directory). No special permissions needed — SAF handles it.
     * The actual write happens in handleExportFilePickerResult() after the user picks a location.
     */
    @JavascriptInterface
    public void openExportFilePicker(String content) {
        if (content == null || content.isEmpty()) {
            Log.w(TAG, "openExportFilePicker: empty content, skipping");
            return;
        }
        _pendingExportContent = content;
        _pendingExportType = "settings";
        try {
            Activity activity = activityRef.get();
            if (activity == null) {
                Log.w(TAG, "openExportFilePicker: no valid Activity reference");
                postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
                return;
            }
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);
            intent.setType("text/plain");
            intent.putExtra(android.content.Intent.EXTRA_TITLE, "Regalia_engine_settings.txt");
            activity.startActivityForResult(intent, REQUEST_CODE_EXPORT_SETTINGS);
            Log.i(TAG, "SAF export file picker opened");
        } catch (Throwable e) {
            Log.e(TAG, "openExportFilePicker failed", e);
            _pendingExportContent = null;
            _pendingExportType = "settings";
            postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /**
     * v1.0.2 FEATURE (audit): Open the system SAF file picker for exporting a PGN game.
     * Mirrors openExportFilePicker but uses .pgn extension and a separate request code
     * so handleExportFilePickerResult can fire onPGNExported() instead of onSettingsExported().
     */
    @JavascriptInterface
    public void openPGNExportFilePicker(String content) {
        if (content == null || content.isEmpty()) {
            Log.w(TAG, "openPGNExportFilePicker: empty content, skipping");
            return;
        }
        _pendingExportContent = content;
        _pendingExportType = "pgn";
        try {
            Activity activity = activityRef.get();
            if (activity == null) {
                Log.w(TAG, "openPGNExportFilePicker: no valid Activity reference");
                postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
                return;
            }
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);
            intent.setType("application/x-chess-pgn");
            intent.putExtra(android.content.Intent.EXTRA_TITLE, "Regalia_game.pgn");
            activity.startActivityForResult(intent, REQUEST_CODE_EXPORT_PGN);
            Log.i(TAG, "SAF PGN export file picker opened");
        } catch (Throwable e) {
            Log.e(TAG, "openPGNExportFilePicker failed", e);
            _pendingExportContent = null;
            _pendingExportType = "settings";
            postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /**
     * v1.0.2 NEW FEATURE: Open the stats page (📊统计) in a new fullscreen WebView activity.
     * The payload contains {pgn, evals, playerColor, lang} — StatsActivity reads it
     * via its OWN AndroidBridge.getStatsPayload() (registered on StatsActivity's
     * WebView, not this one). The payload is passed as an Intent extra.
     */
    @android.webkit.JavascriptInterface
    public void openStatsPage(String payload) {
        if (payload == null || payload.isEmpty()) {
            Log.w(TAG, "openStatsPage: empty payload, skipping");
            return;
        }
        try {
            Activity activity = activityRef.get();
            if (activity == null) {
                Log.w(TAG, "openStatsPage: no valid Activity reference");
                postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
                return;
            }
            // Pass the payload as an Intent extra so StatsActivity can inject it
            // into its own WebView without needing a reference to this engine instance.
            android.content.Intent intent = new android.content.Intent(activity, com.Regalia.StatsActivity.class);
            intent.putExtra("statsPayload", payload);
            activity.startActivity(intent);
            Log.i(TAG, "Stats page opened");
        } catch (Throwable e) {
            Log.e(TAG, "openStatsPage failed", e);
            postJsCallback("if(typeof showToast==='function')showToast('Stats unavailable')");
        }
    }

    // (v1.0.2: stats bridge methods removed — getStatsPayload, closeStatsPage,
    //  exportStatsHTML, statsRequestReview. StatsActivity has its own bridge;
    //  activityRef points to MainActivity so these were unreachable.)

    /**
     * Handle SAF file picker result for settings export.
     * Writes the pending export content to the user-chosen URI.
     *
     * v1.0.2 FEATURE: also handles PGN export (REQUEST_CODE_EXPORT_PGN) by
     * dispatching to onPGNExported() instead of onSettingsExported().
     */
    public void handleExportFilePickerResult(android.content.Intent data) {
        // Normal settings/PGN export path
        String content = _pendingExportContent;
        String exportType = _pendingExportType;
        _pendingExportContent = null;
        _pendingExportType = "settings"; // reset to default
        if (data == null || data.getData() == null || content == null) {
            Log.w(TAG, "handleExportFilePickerResult: invalid data or no pending content");
            return;
        }
        try {
            android.net.Uri uri = data.getData();
            // Take persistable permission so we can access the file later if needed
            try {
                context.getContentResolver().takePersistableUriPermission(
                    uri, android.content.Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            } catch (Throwable e) {
                Log.w(TAG, "takePersistableUriPermission failed (non-critical)", e);
            }
            // Write content to the user-chosen location via ContentResolver
            try (java.io.OutputStream os = context.getContentResolver().openOutputStream(uri);
                 java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(os, "UTF-8")) {
                writer.write(content);
                writer.flush();
                Log.i(TAG, (exportType.equals("pgn") ? "PGN" : "Settings") + " exported via SAF to: " + uri.toString());
            }
            // Notify JS of success — include the display name if available
            String displayName = exportType.equals("pgn") ? "Regalia_game.pgn" : "Regalia_engine_settings.txt";
            try {
                android.database.Cursor cursor = context.getContentResolver().query(uri, null, null, null, null);
                if (cursor != null) {
                    try {
                        int nameIdx = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                        if (nameIdx >= 0 && cursor.moveToFirst()) {
                            displayName = cursor.getString(nameIdx);
                        }
                    } finally {
                        cursor.close();
                    }
                }
            } catch (Throwable ignored) {}
            if (exportType.equals("pgn")) {
                postJsCallback("if(typeof onPGNExported==='function')onPGNExported(true," + escapeJsString(displayName) + ")");
            } else {
                postJsCallback("if(typeof onSettingsExported==='function')onSettingsExported(true," + escapeJsString(displayName) + ")");
            }
        } catch (Throwable e) {
            Log.e(TAG, "handleExportFilePickerResult failed", e);
            if (exportType.equals("pgn")) {
                postJsCallback("if(typeof onPGNExported==='function')onPGNExported(false,'')");
            } else {
                postJsCallback("if(typeof onSettingsExported==='function')onSettingsExported(false,'')");
            }
        }
    }

    /**
     * Request POST_NOTIFICATIONS permission (Android 13+ / API 33+).
     * Required for the foreground service notification that keeps the engine alive.
     * Called on first engine init to ensure the persistent notification can be shown.
     */
    @JavascriptInterface
    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33) { // Build.VERSION_CODES.TIRAMISU
            Activity activity = activityRef.get();
            if (activity != null) {
                try {
                    // Check if already granted
                    if (context.checkSelfPermission(
                            android.Manifest.permission.POST_NOTIFICATIONS
                    ) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        activity.requestPermissions(
                            new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                            1003
                        );
                        Log.i(TAG, "POST_NOTIFICATIONS permission requested");
                    }
                } catch (Throwable e) {
                    Log.w(TAG, "requestNotificationPermission failed", e);
                }
            }
        }
    }

    /**
     * Check if POST_NOTIFICATIONS permission has been granted (Android 13+).
     * Always returns true on Android 12 and below (not required).
     */
    @JavascriptInterface
    public boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return true;
        // FIX: Use checkSelfPermission() instead of checkCallingOrSelfPermission()
        // for the same reason as hasStoragePermission() — @JavascriptInterface context
        // caller identity may not match the app's own UID.
        return context.checkSelfPermission(
            android.Manifest.permission.POST_NOTIFICATIONS
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    /**
     * v18.6.0: Get the app-specific export directory path.
     * Creates the directory if it doesn't exist.
     * @return Absolute path to the export directory
     */
    @JavascriptInterface
    public String getExportPath() {
        File dir = new File(context.getFilesDir(), "export");
        if (!dir.exists()) dir.mkdirs();
        return dir.getAbsolutePath();
    }

    /**
     * Write text content to a file on external storage.
     * v18.6.0: Added double fallback — tries public directory first, then app-specific
     * directory, and finally copies to clipboard as last resort.
     * Includes retry mechanism (max 3 retries, 1 second each) for transient failures.
     * @return true if write succeeded to primary or fallback location, false otherwise
     */
    @JavascriptInterface
    public boolean writeTextFile(String path, String content) {
        // Try primary path with retry mechanism (max 3 retries, 1 second each)
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                java.io.File file = new java.io.File(path);
                java.io.File parentDir = file.getParentFile();
                if (parentDir != null && !parentDir.exists()) {
                    parentDir.mkdirs();
                }
                // FIX: Use try-with-resources to prevent stream leak on exception
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(file);
                     java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(fos, "UTF-8")) {
                    writer.write(content);
                    writer.flush();
                }
                Log.i(TAG, "File written: " + path);
                return true;
            } catch (Throwable e) {
                Log.w(TAG, "writeTextFile attempt " + attempt + "/3 failed: " + path, e);
                if (attempt < 3) {
                    try { Thread.sleep(1000); } catch (InterruptedException ignored) { break; }
                }
            }
        }

        // Fallback 1: Try app-specific export directory
        try {
            File fallbackDir = new File(context.getFilesDir(), "export");
            if (!fallbackDir.exists()) fallbackDir.mkdirs();
            String fileName = new java.io.File(path).getName();
            File fallbackFile = new File(fallbackDir, fileName);
            // FIX: Use try-with-resources to prevent stream leak on exception
            try (java.io.FileOutputStream fos = new java.io.FileOutputStream(fallbackFile);
                 java.io.OutputStreamWriter writer = new java.io.OutputStreamWriter(fos, "UTF-8")) {
                writer.write(content);
                writer.flush();
            }
            Log.i(TAG, "File written to fallback (app-specific): " + fallbackFile.getAbsolutePath());
            return true;
        } catch (Throwable e2) {
            Log.e(TAG, "writeTextFile fallback also failed", e2);
        }

        // Fallback 2: Copy to clipboard as last resort
        try {
            int sdk = Build.VERSION.SDK_INT;
            android.content.ClipboardManager clipboard = (android.content.ClipboardManager)
                    context.getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null) {
                android.content.ClipData clip = android.content.ClipData.newPlainText("Regalia Export", content);
                clipboard.setPrimaryClip(clip);
                Log.i(TAG, "writeTextFile: content copied to clipboard as last resort");
            }
        } catch (Throwable e3) {
            Log.w(TAG, "writeTextFile: clipboard fallback also failed", e3);
        }

        return false;
    }

    /**
     * Read text content from a file on external storage.
     * v18.6.0: Added READ_EXTERNAL_STORAGE permission check for Android 5-9.
     * On Android 10+ with scoped storage, app-specific directories don't need permission.
     * @return File content as string, or null if read failed
     */
    @JavascriptInterface
    public String readTextFile(String path) {
        // v18.6.0: Request READ_EXTERNAL_STORAGE on Android 5-9 if not already granted
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (context.checkSelfPermission(
                    android.Manifest.permission.READ_EXTERNAL_STORAGE
            ) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                // Try to request permission via the Activity
                Activity activity = activityRef.get();
                if (activity != null) {
                    try {
                        activity.requestPermissions(
                            new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE},
                            1002
                        );
                    } catch (Throwable e) {
                        Log.w(TAG, "readTextFile: could not request READ_EXTERNAL_STORAGE", e);
                    }
                }
                Log.w(TAG, "readTextFile: READ_EXTERNAL_STORAGE not granted for path: " + path);
                // Still attempt the read — permission may have been granted since last check
            }
        }

        try {
            java.io.File file = new java.io.File(path);
            if (!file.exists() || !file.canRead()) return null;
            // FIX: Use try-with-resources to prevent FileInputStream leak on exception
            try (java.io.FileInputStream fis = new java.io.FileInputStream(file);
                 java.io.BufferedReader reader = new java.io.BufferedReader(
                     new java.io.InputStreamReader(fis, "UTF-8")
                 )) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append("\n");
                }
                return sb.toString();
            }
        } catch (Throwable e) {
            Log.e(TAG, "readTextFile failed: " + path, e);
            return null;
        }
    }

    /**
     * Get default file system paths for the file browser.
     * @return JSON object with path strings
     */
    @JavascriptInterface
    public String getDefaultPaths() {
        try {
            JSONObject paths = new JSONObject();
            // External storage root
            String externalStorage = android.os.Environment.getExternalStorageDirectory().getAbsolutePath();
            paths.put("externalStorage", externalStorage);
            // Downloads directory
            File downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOWNLOADS
            );
            paths.put("downloads", downloadsDir.getAbsolutePath());
            // Documents directory
            File documentsDir = android.os.Environment.getExternalStoragePublicDirectory(
                android.os.Environment.DIRECTORY_DOCUMENTS
            );
            paths.put("documents", documentsDir.getAbsolutePath());
            return paths.toString();
        } catch (Throwable e) {
            Log.e(TAG, "getDefaultPaths failed", e);
            return "{\"externalStorage\":\"/sdcard\",\"downloads\":\"/storage/emulated/0/Download\",\"documents\":\"/storage/emulated/0/Documents\"}";
        }
    }

    /**
     * List files and directories at the given path.
     * FIX: On Android 11+ (API 30+), supplements java.io.File.listFiles() with
     * MediaStore query results to find .txt/.cfg files that scoped storage hides
     * from File API. Without this, TXT settings files in public directories
     * (Download, Documents) are invisible to the built-in file browser.
     * @return JSON array of file objects with name, path, isDirectory, size fields
     */
    @JavascriptInterface
    public String listFiles(String dirPath) {
        try {
            JSONArray result = new JSONArray();
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) return result.toString();

            // Use a TreeMap keyed by path to deduplicate File API + MediaStore results
            java.util.TreeMap<String, JSONObject> fileMap = new java.util.TreeMap<>();

            // Source 1: java.io.File.listFiles() — shows directories and some files
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("name", f.getName());
                        obj.put("path", f.getAbsolutePath());
                        obj.put("isDirectory", f.isDirectory());
                        obj.put("size", f.length());
                        fileMap.put(f.getAbsolutePath(), obj);
                    } catch (Throwable e) {
                        // Skip problematic files
                    }
                }
            }

            // Source 2: MediaStore query — on Android 11+ (API 30+), this finds files
            // in public directories that java.io.File.listFiles() cannot see due to
            // scoped storage restrictions (e.g., .txt files in Download/).
            if (Build.VERSION.SDK_INT >= 30) {
                try {
                    String[] projection = {
                        android.provider.MediaStore.MediaColumns.DISPLAY_NAME,
                        android.provider.MediaStore.MediaColumns.DATA,
                        android.provider.MediaStore.MediaColumns.SIZE
                    };
                    // Query MediaStore.Files for files in this directory
                    android.database.Cursor cursor = context.getContentResolver().query(
                        android.provider.MediaStore.Files.getContentUri("external"),
                        projection,
                        android.provider.MediaStore.MediaColumns.DATA + " LIKE ? AND " +
                        android.provider.MediaStore.MediaColumns.DATA + " NOT LIKE ?",
                        new String[]{dirPath + "/%", dirPath + "/%/%"},
                        null
                    );
                    if (cursor != null) {
                        try {
                            int nameIdx = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.DISPLAY_NAME);
                            int dataIdx = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.DATA);
                            int sizeIdx = cursor.getColumnIndexOrThrow(android.provider.MediaStore.MediaColumns.SIZE);
                            while (cursor.moveToNext()) {
                                try {
                                    String filePath = cursor.getString(dataIdx);
                                    if (filePath == null || fileMap.containsKey(filePath)) continue;
                                    String fileName = cursor.getString(nameIdx);
                                    if (fileName == null) continue;
                                    long fileSize = sizeIdx >= 0 ? cursor.getLong(sizeIdx) : 0;
                                    // Only include .txt and .cfg files from MediaStore
                                    // (these are the ones typically hidden by scoped storage)
                                    if (fileName.endsWith(".txt") || fileName.endsWith(".cfg")) {
                                        JSONObject obj = new JSONObject();
                                        obj.put("name", fileName);
                                        obj.put("path", filePath);
                                        obj.put("isDirectory", false);
                                        obj.put("size", fileSize);
                                        fileMap.put(filePath, obj);
                                    }
                                } catch (Throwable e) {
                                    // Skip problematic entries
                                }
                            }
                        } finally {
                            cursor.close();
                        }
                    }
                } catch (Throwable e) {
                    Log.w(TAG, "MediaStore query failed for: " + dirPath, e);
                }
            }

            // Convert TreeMap to sorted JSONArray: directories first, then files, both alphabetically
            java.util.List<JSONObject> dirs = new java.util.ArrayList<>();
            java.util.List<JSONObject> filList = new java.util.ArrayList<>();
            for (JSONObject obj : fileMap.values()) {
                try {
                    if (obj.getBoolean("isDirectory")) {
                        dirs.add(obj);
                    } else {
                        filList.add(obj);
                    }
                } catch (Throwable e) {}
            }
            // Sort both lists by name
            java.util.Collections.sort(dirs, (a, b) -> {
                try { return a.getString("name").compareToIgnoreCase(b.getString("name")); }
                catch (Throwable e) { return 0; }
            });
            java.util.Collections.sort(filList, (a, b) -> {
                try { return a.getString("name").compareToIgnoreCase(b.getString("name")); }
                catch (Throwable e) { return 0; }
            });
            for (JSONObject obj : dirs) result.put(obj);
            for (JSONObject obj : filList) result.put(obj);

            return result.toString();
        } catch (Throwable e) {
            Log.e(TAG, "listFiles failed: " + dirPath, e);
            return "[]";
        }
    }

    /**
     * v18.5.0: Scan for engines — returns empty array since only built-in engine is supported.
     * Kept as a stub for JS API compatibility.
     */
    @JavascriptInterface
    public String scanEngines() {
        return "[]";
    }

    /**
     * FIX: Get canonical parent directory path for a given path.
     * Uses java.io.File.getParent() for proper path resolution instead of
     * string concatenation with "/.." which creates non-canonical paths that
     * cause listFiles() to fail.
     * @param path The directory path
     * @return Parent directory path, or empty string if no parent
     */
    @JavascriptInterface
    public String getParentPath(String path) {
        try {
            if (path == null || path.isEmpty()) return "";
            File dir = new File(path);
            File parent = dir.getParentFile();
            if (parent != null) {
                return parent.getAbsolutePath();
            }
            return "";
        } catch (Throwable e) {
            Log.e(TAG, "getParentPath failed", e);
            return "";
        }
    }

    /**
     * FIX: Open the system file picker (SAF) for importing settings files.
     * This works properly on Android 11+ scoped storage where
     * java.io.File.listFiles() cannot see .txt files.
     * Uses ACTION_OPEN_DOCUMENT with text/plain MIME type.
     */
    @JavascriptInterface
    public void openSystemFilePicker() {
        try {
            // FIX: Use activityRef (WeakReference) instead of checking 'context instanceof Activity'.
            // Since v18.5.0, 'context' is Application context (getApplicationContext()), which
            // is NEVER an Activity, so the old instanceof check always failed — the file picker
            // could never be opened. Now we use the stored Activity reference instead.
            Activity activity = activityRef.get();
            if (activity == null) {
                Log.w(TAG, "openSystemFilePicker: no valid Activity reference");
                postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
                return;
            }
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);
            // v18.6.0 FIX: Use */* as primary type to show ALL files including .txt on all devices.
            // Some OEM file pickers (Xiaomi HyperOS) don't show .txt files when setType is
            // "text/plain" because the MIME type doesn't match. Using */* ensures all files
            // are visible, and EXTRA_MIME_TYPES provides hint for preferred types.
            intent.setType("*/*");
            intent.putExtra(android.content.Intent.EXTRA_MIME_TYPES, new String[]{"text/plain", "application/octet-stream"});
            activity.startActivityForResult(intent, REQUEST_CODE_IMPORT_SETTINGS);
        } catch (Throwable e) {
            Log.e(TAG, "openSystemFilePicker failed", e);
            postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /**
     * FIX: Handle SAF file picker result — read the selected file and import settings.
     * Called from MainActivity.onActivityResult when REQUEST_CODE_IMPORT_SETTINGS result arrives.
     *
     * v1.0.2 FIX: Previously this method called importSettings() (which fires
     * onSettingsImported callback with success/failure + message via postJsCallback)
     * AND ALSO fired its own showToast('Settings imported') + openEngineConfig()
     * directly. The result was: (1) duplicate toast ("Settings imported" appeared
     * twice), (2) the "Settings imported" toast appeared BEFORE the async
     * importSettings() actually finished, so on transient failure the user saw
     * a success toast followed by a silent no-op. Now we let importSettings()
     * own the toast/dialog via its onSettingsImported callback — single source
     * of truth, fired only after the import truly completes.
     */
    public void handleFilePickerResult(android.content.Intent data) {
        if (data == null || data.getData() == null) return;
        try {
            android.net.Uri uri = data.getData();
            // Persist permission to access this URI
            try {
                context.getContentResolver().takePersistableUriPermission(
                    uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Throwable e) {
                Log.w(TAG, "takePersistableUriPermission failed", e);
            }
            // v1.0.3 FIX: Close the settings dialog IMMEDIATELY before starting the
            // async import. The old approach waited for onSettingsImported (which fires
            // after the engine thread finishes applying settings — potentially seconds
            // later). During that wait, the dialog stayed open and the user saw no
            // feedback. Now we close the dialog right away, and the import continues
            // in the background. The onSettingsImported callback still fires to show
            // the success/failure toast.
            postJsCallback("try{showEngineConfig=false;var d=document.querySelector('.dov[role=\"dialog\"]');if(d)d.remove();var fb=document.getElementById('_fileBrowserOverlay');if(fb)fb.remove();if(typeof render==='function')render();}catch(e){}");

            // v1.0.2 FIX: Use try-with-resources on BufferedReader so the reader
            // (and its internal char buffer) is always closed, not just the
            // underlying InputStream. The previous pattern (close `is` in
            // finally) left the BufferedReader unclosed, relying on GC.
            String content;
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(
                            context.getContentResolver().openInputStream(uri), "UTF-8"))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append("\n");
                }
                content = sb.toString();
            }
            // Import the settings — onSettingsImported() callback in JS
            // will fire the appropriate toast (success or failure).
            importSettings(content);
        } catch (Throwable e) {
            Log.e(TAG, "handleFilePickerResult failed", e);
            // Only fire an error toast if the file read itself failed (importSettings
            // handles its own error reporting for parse/apply failures).
            postJsCallback("if(typeof showToast==='function')showToast('Failed to read file')");
        }
    }

    /**
     * Open SAF file picker for PGN file import.
     * Uses ACTION_OPEN_DOCUMENT with application/x-chess-pgn and text/plain MIME types.
     */
    @JavascriptInterface
    public void openPGNFilePicker() {
        try {
            Activity activity = activityRef.get();
            if (activity == null) {
                Log.w(TAG, "openPGNFilePicker: no valid Activity reference");
                postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
                return;
            }
            android.content.Intent intent = new android.content.Intent(android.content.Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(android.content.Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(android.content.Intent.EXTRA_MIME_TYPES, new String[]{"application/x-chess-pgn", "text/plain", "application/octet-stream"});
            activity.startActivityForResult(intent, REQUEST_CODE_IMPORT_PGN);
        } catch (Throwable e) {
            Log.e(TAG, "openPGNFilePicker failed", e);
            postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /**
     * v1.0.5 Round-6 Rev49 NEW: Toggle the board anti-shake stabilization on/off.
     * Called from the JS long-press handler on any board square.
     * Delegates to MainActivity.toggleStabilization() which handles sensor
     * registration and Toast notification (zh/en).
     */
    @JavascriptInterface
    public void toggleStabilization() {
        try {
            Activity activity = activityRef.get();
            if (activity instanceof MainActivity) {
                ((MainActivity) activity).toggleStabilization();
            } else {
                Log.w(TAG, "toggleStabilization: no MainActivity reference");
            }
        } catch (Throwable e) {
            Log.e(TAG, "toggleStabilization failed", e);
        }
    }

    /**
     * Handle SAF file picker result for PGN import.
     * Reads the file content and calls onPGNFileRead() in JavaScript.
     */
    public void handlePGNFilePickerResult(android.content.Intent data) {
        if (data == null || data.getData() == null) return;
        try {
            android.net.Uri uri = data.getData();
            try {
                context.getContentResolver().takePersistableUriPermission(
                    uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Throwable e) {
                Log.w(TAG, "takePersistableUriPermission failed", e);
            }
            // v1.0.2 FIX: Use try-with-resources on BufferedReader so the reader
            // (and its internal char buffer) is always closed, not just the
            // underlying InputStream. The previous pattern (close `is` in
            // finally) left the BufferedReader unclosed, relying on GC.
            String content;
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(
                            context.getContentResolver().openInputStream(uri), "UTF-8"))) {
                StringBuilder sb = new StringBuilder();
                String line;
                int lineCount = 0;
                final int MAX_LINES = 5000; // Prevent OOM on huge files
                // v1.0.8 PHASE 32 ROBUSTNESS: track truncation and notify JS so the
                //   PGN parser can surface a warning instead of silently parsing an
                //   incomplete game.
                boolean truncated = false;
                while ((line = reader.readLine()) != null) {
                    if (lineCount >= MAX_LINES) { truncated = true; break; }
                    sb.append(line).append("\n");
                    lineCount++;
                }
                content = sb.toString();
                if (truncated) {
                    Log.w(TAG, "PGN file truncated at " + MAX_LINES + " lines");
                    // Append a PGN comment so the JS parser surfaces the truncation
                    content += "\n{ Warning: file truncated at " + MAX_LINES + " lines by Regalia import guard }\n";
                }
            }
            // Sanitize: remove control characters that could break JS string parsing
            // (keep newline, tab, carriage return)
            content = content.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", "");
            // Pass content to JavaScript onPGNFileRead callback
            // Use JSON encoding for safe JS string passing — avoids syntax errors from
            // unescaped newlines, quotes, and special characters in PGN content
            String jsonContent;
            try {
                jsonContent = new org.json.JSONObject().put("content", content).toString();
            } catch (Throwable je) {
                Log.e(TAG, "JSON encoding failed for PGN content", je);
                jsonContent = "{\"content\":\"\"}";
            }
            postJsCallback("if(typeof onPGNFileRead==='function'){try{var _d=" + jsonContent + ";onPGNFileRead(_d.content);}catch(e){console.error('PGN file read callback error:',e);}}");
        } catch (Throwable e) {
            Log.e(TAG, "handlePGNFilePickerResult failed", e);
            postJsCallback("if(typeof showToast==='function')showToast('Failed to read PGN file')");
        }
    }
}
