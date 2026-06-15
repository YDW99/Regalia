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
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
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
 * Version: v18.5.0
 */
public class StockfishNative {

    private static final String TAG = "StockfishNative";

    // v18.5.0: Load native JNI library for chmod/renice operations
    static {
        try {
            System.loadLibrary("engine_bridge");
            Log.i("StockfishNative", "Native JNI library loaded successfully");
        } catch (UnsatisfiedLinkError e) {
            Log.w("StockfishNative", "Native JNI library not available (non-critical): " + e.getMessage());
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
    private static final String ENGINE_VERSION = "v1.0.0";
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

    private Process engineProcess;
    private BufferedReader engineReader;
    private OutputStreamWriter engineWriter;
    private Thread readerThread;

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

    // Stored WDL (Win/Draw/Loss) data during STATE_EVAL
    private volatile int _storedWdlW = -1;
    private volatile int _storedWdlD = -1;
    private volatile int _storedWdlL = -1;

    // Maximum reasonable search depth
    private static final int MAX_REASONABLE_DEPTH = 60;
    // Expected depth limit for eval searches (go depth N)
    private volatile int _evalDepthLimit = 15;

    private volatile boolean _heartbeatRunning = false;
    private Thread _heartbeatThread = null;
    private static final int HEARTBEAT_INTERVAL_MS = 5000; // 5 seconds (fast detection for aggressive OEM process killers)
    private static final long ZOMBIE_TIMEOUT_MS = 30000; // 30 seconds (faster than 60s — HyperOS kills processes aggressively)
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
    private ExecutorService _engineExecutor = _createEngineExecutor();

    private static ExecutorService _createEngineExecutor() {
        return Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "SF-Exec");
            t.setPriority(Thread.NORM_PRIORITY);
            return t;
        });
    }

    // v18.4.1: Extended bestmove pattern to capture optional ponder move
    private static final Pattern BESTMOVE_PATTERN = Pattern.compile("^bestmove\\s+(\\S+)(?:\\s+ponder\\s+(\\S+))?");
    private static final Pattern INFO_DEPTH_PATTERN = Pattern.compile("^info\\s+depth\\s+(\\d+)");
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
    private boolean autoConfigEnabled = true;

    // Current UCI option values (loaded from prefs or defaults)
    private int engineThreads = 2;
    private int engineHash = 64;
    private int engineMoveOverhead = 30;
    private int engineMultiPV = 1;
    private boolean enginePonder = false;
    private boolean engineShowWDL = true;
    private int engineSkillLevel = 20;
    private boolean engineLimitElo = false;
    private int engineElo = 2800;

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

    private void postJsCallbackJson(String funcName, String jsonPayload) {
        postJsCallback(funcName + "(" + jsonPayload + ")");
    }

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
     */
    @JavascriptInterface
    public void engineGoDepth(final String fen, final int depth) {
        _engineExecutor.execute(new Runnable() {
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
                _lastEvalDepth = 0;
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
                _evalDepthLimit = depth;
                forceFullStrength();
                sendUciCommand("position fen " + fen);
                sendUciCommand("go depth " + depth);
            }
        });
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
            stopLatch.await(1, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Log.w(TAG, callerTag + ": interrupted waiting for stop bestmove");
        } finally {
            synchronized (_stopLatchLock) {
                if (_stopLatch == stopLatch) {
                    _stopLatch = null;
                }
            }
        }
    }

    private void engineGoInternal(final String fen, final int level, final boolean needNewGame) {
        _engineExecutor.execute(new Runnable() {
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
        });
    }

    @JavascriptInterface
    public void engineHint(final String fen) {
        _engineExecutor.execute(new Runnable() {
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
        });
    }

    @JavascriptInterface
    public void engineEval(final String fen) {
        _engineExecutor.execute(new Runnable() {
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
                _lastEvalDepth = 0;
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
                _evalDepthLimit = 15;
                forceFullStrength();
                sendUciCommand("position fen " + fen);
                sendUciCommand("go depth 15");
            }
        });
    }

    @JavascriptInterface
    public void engineEvalDeep(final String fen) {
        _engineExecutor.execute(new Runnable() {
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
                _lastEvalDepth = 0;
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
                _evalDepthLimit = 22;
                forceFullStrength();
                sendUciCommand("position fen " + fen);
                sendUciCommand("go depth 22");
            }
        });
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
     * v1.0.0: Get the Android system language for i18n auto-detection.
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

    @JavascriptInterface
    public boolean isEngineReady() {
        return engineReady;
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

        String msg = isEnglishMode() ? "Stockfish engine binary not found, please reinstall" : "\u672a\u627e\u5230Stockfish\u5f15\u64ce\u4e8c\u8fdb\u5236\u6587\u4ef6\uff0c\u8bf7\u91cd\u65b0\u5b89\u88c5\u5e94\u7528";
        Log.e(TAG, msg);
        postJsCallback("onEngineError(" + escapeJsString(msg) + ")");
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
                postJsCallback("onEngineError(" + escapeJsString(
                        "\u65e0\u6cd5\u542f\u52a8\u5f15\u64ce\u8fdb\u7a0b: " + e1.getMessage()) + ")");
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
                if (engineProcess.isAlive()) engineProcess.destroyForcibly();
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
                if (_isPondering) {
                    _isPondering = false;
                    synchronized (stateLock) {
                        currentState = STATE_NONE;
                    }
                    Log.d(TAG, "Discarding bestmove from ponder stop");
                    return;
                }
                // FIX: Discard bestmove from a ponder stop that was initiated by
                // stopAndWaitForBestmove(). When we stop pondering to start a new
                // search (e.g., entering review mode), the ponder's bestmove arrives
                // after _isPondering has been set to false but before the new search
                // starts. Without this check, the stale bestmove would be routed to
                // handleBestMove() with STATE_NONE, corrupting the state machine.
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
                        try {
                            JSONObject pvInfo = new JSONObject();
                            pvInfo.put("index", multiPVIndex);
                            pvInfo.put("depth", depth);
                            pvInfo.put("scoreCp", hasCp ? scoreCp : JSONObject.NULL);
                            pvInfo.put("scoreMate", hasMate ? scoreMate : JSONObject.NULL);
                            pvInfo.put("wdlW", wdlW);
                            pvInfo.put("wdlD", wdlD);
                            pvInfo.put("wdlL", wdlL);
                            pvInfo.put("pv", pvMoves);
                            postJsCallback("onMultiPVProgress(" + pvInfo.toString() + ")");
                        } catch (Throwable e) {
                            Log.w(TAG, "Error sending MultiPV progress", e);
                        }
                    } else {
                        postJsCallback("onEngineProgress(" + depth + ", "
                                + (nodes != null ? nodes : "null") + ", "
                                + (nps != null ? nps : "null") + ", "
                                + (hasCp ? scoreCp : "null") + ", "
                                + (hasMate ? scoreMate : "null") + ", "
                                + wdlW + ", " + wdlD + ", " + wdlL + ")");
                    }
                    break;

                case STATE_EVAL:
                    if (depth <= _evalDepthLimit) {
                        _lastEvalDepth = depth;
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
                        try {
                            JSONObject pvInfo = new JSONObject();
                            pvInfo.put("index", multiPVIndex);
                            pvInfo.put("depth", depth);
                            pvInfo.put("scoreCp", hasCp ? scoreCp : JSONObject.NULL);
                            pvInfo.put("scoreMate", hasMate ? scoreMate : JSONObject.NULL);
                            pvInfo.put("wdlW", wdlW);
                            pvInfo.put("wdlD", wdlD);
                            pvInfo.put("wdlL", wdlL);
                            pvInfo.put("pv", pvMoves);
                            postJsCallback("onMultiPVProgress(" + pvInfo.toString() + ")");
                        } catch (Throwable e) {
                            Log.w(TAG, "Error sending MultiPV progress", e);
                        }
                    } else {
                        postJsCallback("onEngineProgress(" + depth + ", "
                                + (nodes != null ? nodes : "null") + ", "
                                + (nps != null ? nps : "null") + ", "
                                + (hasCp ? scoreCp : "null") + ", "
                                + (hasMate ? scoreMate : "null") + ", "
                                + wdlW + ", " + wdlD + ", " + wdlL + ")");
                    }
                    break;

                case STATE_PONDER:
                    postJsCallback("onPonderProgress(" + depth + ", "
                            + (nodes != null ? nodes : "null") + ", "
                            + (nps != null ? nps : "null") + ", "
                            + (hasCp ? scoreCp : "null") + ", "
                            + (hasMate ? scoreMate : "null") + ")");
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
                {
                    postJsCallback("onMultiPVResult(" + multiPVJson + ")");
                }
                break;
            case STATE_HINT:
                postJsCallback("onHintMove(" + escapeJsString(uciMove) + ")");
                {
                    postJsCallback("onMultiPVResult(" + multiPVJson + ")");
                }
                break;
            case STATE_EVAL:
                if (_storedEvalMate != null) {
                    postJsCallback("onEngineEval(" + _storedEvalCp + ", " + _storedEvalMate + ", " + _lastEvalDepth + ", " + _storedWdlW + ", " + _storedWdlD + ", " + _storedWdlL + ")");
                } else if (_storedEvalCp != null) {
                    postJsCallback("onEngineEval(" + _storedEvalCp + ", null, " + _lastEvalDepth + ", " + _storedWdlW + ", " + _storedWdlD + ", " + _storedWdlL + ")");
                } else {
                    postJsCallback("onEngineEval(0, null, " + _lastEvalDepth + ", " + _storedWdlW + ", " + _storedWdlD + ", " + _storedWdlL + ")");
                }
                {
                    postJsCallback("onMultiPVResult(" + multiPVJson + ")");
                }
                _storedEvalCp = null;
                _storedEvalMate = null;
                _storedWdlW = -1; _storedWdlD = -1; _storedWdlL = -1;
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
                if (engineProcess.isAlive()) {
                    engineProcess.destroyForcibly();
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
                if (engineProcess.isAlive()) engineProcess.destroyForcibly();
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

    private void startHeartbeat() {
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
                    if (engineReady) {
                        boolean isSearching = (currentState != STATE_NONE);
                        long timeSinceLastResponse = System.currentTimeMillis() - _lastResponseTime;
                        long effectiveTimeout = isSearching ? ZOMBIE_SEARCH_TIMEOUT_MS : ZOMBIE_TIMEOUT_MS;
                        if (timeSinceLastResponse > effectiveTimeout) {
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
    private int detectBigCoreCount() {
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
        return bigCores;
    }

    // ===================== UCI OPTION SETTERS =====================

    /**
     * P1 FIX: Check if the current engine supports a given UCI option name.
     * Uses the cached supportedOptionNames Set for O(1) lookup instead of
     * re-parsing the engineOptionsJson string on every call.
     */
    private boolean engineSupportsOption(String optionName) {
        if (supportedOptionNames.isEmpty()) {
            // No option info available — assume supported (safe default for built-in Stockfish)
            return true;
        }
        boolean supported = supportedOptionNames.contains(optionName);
        if (!supported) {
            Log.i(TAG, "Engine does not support option: " + optionName + " (skipping)");
        }
        return supported;
    }

    /**
     * Apply all current settings to the engine in the correct order.
     */
    private void applySettings() {
        if (!engineReady) {
            Log.w(TAG, "Cannot apply settings - engine not ready");
            return;
        }

        Log.i(TAG, "Applying engine settings (autoConfig=" + autoConfigEnabled + ")");

        if (autoConfigEnabled) {
            detectHardwareAndConfigure();
            if (!engineReady) return;
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
        } else {
            if (engineSupportsOption("Threads")) {
                sendSetOptionAndWait("Threads", String.valueOf(engineThreads));
                if (!engineReady) return;
            }
            if (engineSupportsOption("Hash")) {
                sendSetOptionAndWait("Hash", String.valueOf(engineHash));
                if (!engineReady) return;
            }
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

    @JavascriptInterface
    public void startPonder(final String fenWithPonderMove) {
        if (!engineReady || !enginePonder) return;
        _engineExecutor.execute(new Runnable() {
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
                sendUciCommand("go ponder");
            }
        });
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
     * Update the foreground service notification with engine process info.
     * This keeps the notification actively showing engine status (e.g.,
     * "Stockfish 18 · depth 22"), which prevents the OS from killing
     * the service on aggressive memory managers like Xiaomi HyperOS 3.
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
            SharedPreferences.Editor editor = context.getSharedPreferences("Regalia_prefs", Context.MODE_PRIVATE).edit();
            editor.putString("lang", lang);
            editor.apply();
        } catch (Throwable e) {
            Log.w(TAG, "saveLangPref failed", e);
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
        _engineExecutor.execute(new Runnable() {
            public void run() {
                boolean success = false;
                String message = "";
                int appliedCount = 0;

                try {
                    if (txtContent == null || txtContent.trim().isEmpty()) {
                        throw new IllegalArgumentException("Empty settings content");
                    }

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
                                    appliedCount++;
                                    break;
                                case "engine.hash":
                                    engineHash = Math.max(1, Math.min(1048576, Integer.parseInt(value)));
                                    saveIntSetting("engineHash", engineHash);
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

                    if (engineReady) {
                        applySettings();
                    }

                    success = true;
                    message = "Imported " + appliedCount + " settings successfully";
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
        });
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
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.3f, 0.0f}, new long[]{0, 30, 20});
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
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.0f}, new long[]{0, 40, 25});
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

                case "PIECE_CAPTURE":
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.2f, 0.6f, 0.0f}, new long[]{0, 30, 20, 30, 20});
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
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.15f, 0.0f}, new long[]{0, 15, 10});
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
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.2f, 0.5f, 0.0f}, new long[]{0, 30, 30, 20});
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 30);
                    }
                    break;

                case "TOGGLE_OFF":
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.2f, 0.0f}, new long[]{0, 30, 30, 20});
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 20);
                    }
                    break;

                case "CHECK_ALERT":
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.8f, 0.3f, 0.8f, 0.3f, 0.8f, 0.0f}, new long[]{0, 50, 30, 50, 30, 50, 30});
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
                    if (apiLevel >= 35) {
                        tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.3f, 0.8f, 0.1f, 0.0f}, new long[]{0, 100, 50, 200, 80, 50});
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

    private void tryPwleVibrate(android.os.Vibrator vibrator, float[] amplitudes, long[] durations) {
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
                return;
            } catch (Throwable e) {
                Log.d(TAG, "PWLE not available, using fallback");
            }
        }
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                long totalDuration = 0;
                float maxAmp = 0;
                for (int i = 0; i < durations.length; i++) { totalDuration += durations[i]; }
                for (int i = 0; i < amplitudes.length; i++) { if (amplitudes[i] > maxAmp) maxAmp = amplitudes[i]; }
                int ampInt = Math.max(1, Math.round(maxAmp * 255));
                vibrator.vibrate(android.os.VibrationEffect.createOneShot(totalDuration, ampInt));
            } catch (Throwable e) {
                fallbackVibrate(vibrator, Build.VERSION.SDK_INT, 30);
            }
        } else {
            fallbackVibrate(vibrator, Build.VERSION.SDK_INT, 30);
        }
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
                    int pct = 12 + (int) (total / 114115752L * 13);
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
                try {
                    Process p = Runtime.getRuntime().exec(
                            new String[]{"/system/bin/chmod", "755", file.getAbsolutePath()});
                    p.waitFor(2, TimeUnit.SECONDS);
                } catch (Throwable e2) {
                    try {
                        Process p = Runtime.getRuntime().exec(
                                new String[]{"/system/bin/sh", "-c",
                                        "chmod 755 " + file.getAbsolutePath()});
                        p.waitFor(2, TimeUnit.SECONDS);
                    } catch (Throwable ignored) {}
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "Failed to make executable: " + file.getAbsolutePath(), e);
        }
    }

    // v18.5.0: Removed unused copyFile() method — it was dead code since v18.5.0
    // removed engine import functionality. The only file copying that happens
    // is in extractEngineFromApk/extractEngineFromAssets which use inline streams.

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

    // REMOVED: hasAllFilesAccess() and requestAllFilesAccess() — MANAGE_EXTERNAL_STORAGE
    // permission has been removed. SAF (Storage Access Framework) is now used for all
    // file read/write operations in public directories (Download, Documents, etc.).
    // SAF works without any special permissions on all Android versions (API 19+).

    /** Request code for SAF file picker (export settings via ACTION_CREATE_DOCUMENT) */
    static final int REQUEST_CODE_EXPORT_SETTINGS = 1002;

    /** Pending export content — stored temporarily until SAF picker returns a URI */
    private volatile String _pendingExportContent = null;

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
            postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /**
     * Handle SAF file picker result for settings export.
     * Writes the pending export content to the user-chosen URI.
     */
    public void handleExportFilePickerResult(android.content.Intent data) {
        String content = _pendingExportContent;
        _pendingExportContent = null;
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
                Log.i(TAG, "Settings exported via SAF to: " + uri.toString());
            }
            // Notify JS of success — include the display name if available
            String displayName = "Regalia_engine_settings.txt";
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
            postJsCallback("if(typeof onSettingsExported==='function')onSettingsExported(true," + escapeJsString(displayName) + ")");
        } catch (Throwable e) {
            Log.e(TAG, "handleExportFilePickerResult failed", e);
            postJsCallback("if(typeof onSettingsExported==='function')onSettingsExported(false,'')");
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
            // Read file content via ContentResolver
            java.io.InputStream is = context.getContentResolver().openInputStream(uri);
            if (is != null) {
                try {
                    java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(is, "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    String content = sb.toString();
                    // Import the settings
                    importSettings(content);
                    postJsCallback("if(typeof showToast==='function')showToast('Settings imported')");
                    postJsCallback("if(typeof openEngineConfig==='function')openEngineConfig()");
                } finally {
                    is.close();
                }
            }
        } catch (Throwable e) {
            Log.e(TAG, "handleFilePickerResult failed", e);
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
            java.io.InputStream is = context.getContentResolver().openInputStream(uri);
            if (is != null) {
                try {
                    java.io.BufferedReader reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(is, "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    int lineCount = 0;
                    final int MAX_LINES = 5000; // Prevent OOM on huge files
                    while ((line = reader.readLine()) != null && lineCount < MAX_LINES) {
                        sb.append(line).append("\n");
                        lineCount++;
                    }
                    String content = sb.toString();
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
                } finally {
                    is.close();
                }
            }
        } catch (Throwable e) {
            Log.e(TAG, "handlePGNFilePickerResult failed", e);
            postJsCallback("if(typeof showToast==='function')showToast('Failed to read PGN file')");
        }
    }
}
