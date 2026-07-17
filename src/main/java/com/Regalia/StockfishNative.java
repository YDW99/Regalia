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
 * v18.5.0: Refactored to consolidate engine binary resolution (APK-extract
 *   and nativeLibraryDir paths) into resolveEngineBinary(). JNI is still used
 *   for chmod/renice via engine_jni.cpp — see EngineProcessManager.
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
import java.util.Arrays;
import java.util.Collections;
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
 * Version: v1.1.0
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

    // v18.4.0: ELO_MAP synced with JS ELO_MATCH for consistent level display.
    // v1.2.0 Phase 81: Moved to EngineConfigHelper (only used by setGameDifficulty).
    // v1.0.5: Synced with the application version (was stale at v1.0.2).
    // v1.2.0: Updated for v1.2.0 release.
    // v1.2.1: Updated for v1.2.1 release.
    // v1.2.1 round-10 (review-E P3): Derive from BuildConfig.VERSION_NAME so this
    //   stays in sync with build.gradle's versionName without manual edits.
    //   Despite the name "ENGINE_VERSION", this is the APP version exposed to JS
    //   via getEngineVersion() (the Stockfish engine version is reported by the
    //   engine itself via the "uci" handshake's "id name" line, stored in
    //   `engineName`). Kept the field name for API stability.
    private static final String ENGINE_VERSION = "v" + BuildConfig.VERSION_NAME;
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

    // v1.2.0 Phase 73: Manager class instances (God Module split)
    // These encapsulate specific concerns, reducing StockfishNative's complexity.
    // v1.2.1: EngineConfigManager / UciProtocolHandler / MessageBus deleted (round-4 cleanup —
    //   never used: EngineConfigManager had no method callers, UciProtocolHandler's latch
    //   mechanism was bypassed by inline reader loop, MessageBus had no JS subscribers).
    private final PgnCacheManager _pgnCacheManager;
    private final JsBridgeGateway _jsBridgeGateway;
    private final EngineProcessManager _engineProcessManager;
    private final EngineHealthMonitor _engineHealthMonitor;
    // v1.2.0 Phase 73+: Additional helper classes for further God Module reduction
    private final FileIoHelper _fileIoHelper;
    private final PermissionHelper _permissionHelper;
    // v1.2.3 (God Class round-17): haptic feedback manager, extracted from this class.
    private HapticManager _hapticManager;
    private final SafPickerHelper _safPickerHelper;
    private final EngineSettingsHelper _engineSettingsHelper;
    // v1.2.0 Phase 81: Engine config helper — extracted from StockfishNative to reduce God Module size.
    // Encapsulates setAutoConfig/detectHardwareAndConfigure/applySettings/UCI option setters/
    // setGameDifficulty/forceFullStrength. StockfishNative retains thin @JavascriptInterface delegates.
    private final EngineConfigHelper _engineConfigHelper;

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

    // v1.2.3 P1 (Round 17 P1-3 / Round 18 A-P1-2): Batch eval flag.
    //   When JS starts an analyze-all batch, it calls engineEvalDeepBeginBatch()
    //   once. Subsequent engineEvalDeep() calls during the batch skip the
    //   redundant forceFullStrength() + applyEvalModeOptions() setoption storm
    //   (5 setoptions × N steps = 5N redundant UCI round-trips). The batch is
    //   closed by engineEvalDeepEndBatch() which restores gameplay options via
    //   applySettings(). The flag is volatile because the JS binder thread sets
    //   it while the engine executor thread reads it.
    private volatile boolean _evalDeepBatchActive = false;

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
    // v1.2.1: _lastResponseTime 与 _autoRecoveryCount 已迁移到 EngineHealthMonitor
    //   作为唯一状态持有者（消除字段重复）。所有读写通过 _engineHealthMonitor 进行。
    private static final int MAX_AUTO_RECOVERY = 3; // Conservative: prevent restart loops on HyperOS 3
    private static final int RECOVERY_COUNT_RESET_INTERVAL_MS = 120000; // 2 min — reset counter after stable operation
    // v1.2.1 round-10 (review-D P3): extracted magic number — 50 MB minimum
    //   engine binary size, used to validate the extracted Stockfish ELF before
    //   execution. Previously hardcoded as `50000000L` in 4 places.
    private static final long MIN_ENGINE_BINARY_SIZE = 50_000_000L;
    // v1.2.1 round-10 (review-D P3): extracted magic number — grace period
    //   (ms) to wait after sending "stop" for a ponder search's bestmove to
    //   arrive before assuming the engine is idle. Was a bare `100` literal.
    private static final int PONDER_STOP_GRACE_MS = 100;
    // v1.2.1 round-10 regression: extracted magic number — grace period (ms)
    //   to wait after Process.destroy() (SIGTERM) for the engine process to
    //   exit gracefully before probing isProcessAlive() and falling back to
    //   destroyForciblySafe() (SIGKILL). Used in cleanupEngineResources() and
    //   shutdown(). Was a bare `100` literal in 2 places. Same value as
    //   PONDER_STOP_GRACE_MS but different semantic — kept separate so each
    //   can be tuned independently if future profiling suggests different
    //   optimal values (process-exit latency vs. UCI bestmove latency).
    private static final int PROCESS_DESTROY_GRACE_MS = 100;
    private volatile long _lastRecoveryTimestamp = 0;
    // Restart lock: prevents concurrent restartEngine/recoverEngine calls
    private final Object _restartLock = new Object();
    private volatile boolean _restartInProgress = false;
    // v1.2.1: 记录 recoverEngine 启动时间，用于检测 _restartInProgress 卡死
    //   （inner task 被 shutdownNow 静默丢弃时 finally 不会执行，标志会永久卡住）。
    private volatile long _restartStartTimeMs = 0L;
    private static final long RESTART_STALE_THRESHOLD_MS = 30_000L;

    // v1.2.1 round-10: All _restartInProgress = false writes MUST go through
    //   this helper so they take _restartLock — matching the locked =true writes
    //   in recoverEngine/restartEngine. Previously the bare writes raced with
    //   concurrent =true writes (review-D P2).
    private void _clearRestartInProgress() {
        synchronized (_restartLock) {
            _restartInProgress = false;
        }
    }
    // v1.2.1: 引擎线程死亡标记。ChessApp 的 UncaughtExceptionHandler 在 SF-*
    //   线程异常退出时调用 markEngineThreadDead() 设置此标记；heartbeat 检查
    //   此标记，若为 true 则触发 recoverEngine —— 否则引擎进程虽然活着但读
    //   线程已死，isProcessAlive() 返回 true 导致 heartbeat 误判健康，AI
    //   静默不动直到 15-30s zombie 超时。
    // v1.2.1 round-7 (audit note): These fields are `static volatile` — they
    //   assume a single engine instance per process (the app's design).
    //   If multi-engine support is ever added, this must be promoted to
    //   per-instance fields on the StockfishNative object itself.
    private static volatile boolean sEngineThreadDied = false;
    private static volatile String sEngineThreadDiedName = null;
    // v1.2.0 Phase 73+: REQUEST_CODE_* constants moved to SafPickerHelper and
    // re-exported below for MainActivity compatibility.
    private final Object _startEngineLock = new Object();
    // v1.1.0 Phase 58: Dedicated lock for engineWriter access. Decoupled from
    //   the `this` monitor (used by startHeartbeat) so shutdown()'s interrupt+
    //   join on the heartbeat thread is not blocked by an in-flight writer I/O.
    private final Object _writerLock = new Object();

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
    // v1.2.1 round-7 (R3): validate eventName in the structured postJsCallback
    // overload. ECMAScript IdentifierName subset (no reserved words, no
    // Unicode escapes, no keywords) — sufficient for our onXxx callback names.
    private static final Pattern EVENT_NAME_PATTERN = Pattern.compile("^[A-Za-z_$][A-Za-z0-9_$]*$");
    // v1.2.3 P1 (Round 17 P1-2): Pre-compiled CR/LF stripper pattern for UCI
    //   command sanitization. Previously sendSetOptionAndWait called
    //   String.replaceAll("[\\r\\n]", "") on every invocation, re-compiling
    //   the regex every time. Reusing one Pattern avoids that per-call cost.
    private static final Pattern NEWLINE_PATTERN = Pattern.compile("[\\r\\n]");

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
    // v1.1.2 PHASE 71 (concurrency fix): dedicated lock for the
    //   _discardingPonderBestmove flag. Previously, engineStop() set the flag
    //   (outside any lock) while the reader thread's bestmove handler read it
    //   (also outside any lock) — a TOCTOU window where engineStop sets the
    //   flag AFTER the reader's check but BEFORE handleBestMove, causing the
    //   stopped search's bestmove to be processed as a real AI move. All
    //   set/check-and-clear operations now go through synchronized blocks on
    //   this lock so the check-and-clear is atomic w.r.t. engineStop's set.
    private final Object _discardFlagLock = new Object();
    // v1.2.1 round-10 (review-D P3): moved from line ~1175 (mid-class) to the
    //   main field block for readability. Holds the pending Chess960 mode so
    //   the flag survives engine restarts and is re-applied by startEngineInternal.
    private volatile boolean _pendingChess960 = false;
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

        // v1.2.0 Phase 73: Initialize manager class instances (God Module split)
        // v1.2.1: EngineConfigManager / UciProtocolHandler / MessageBus instantiations removed (round-4 cleanup).
        this._pgnCacheManager = new PgnCacheManager(this.context);
        this._jsBridgeGateway = new JsBridgeGateway(this.context);
        this._engineProcessManager = new EngineProcessManager(new EngineProcessManager.ChmodProvider() {
            @Override
            public boolean nativeChmod(String path) {
                return StockfishNative.nativeChmod(path);
            }
            // v1.2.1 round-9: isEnglishMode() and postProgress(int, String)
            //   overrides removed — the ChmodProvider interface was slimmed
            //   to just nativeChmod (the only method makeExecutable calls).
            //   The previous overrides were dead code left over from the
            //   round-4 cleanup that removed extractEngineFromApk().
        });
        // v1.2.1: EngineHealthMonitor slimmed to a state holder — no callback wiring needed.
        this._engineHealthMonitor = new EngineHealthMonitor();
        // v1.2.0 Phase 73+: Initialize additional helper classes
        this._fileIoHelper = new FileIoHelper(this.context, this.activityRef);
        this._permissionHelper = new PermissionHelper(this.context, this.activityRef);
        // v1.2.1 round-10 (review-E P2): the dead Phase-73 HapticHelper (never
        //   wired in) was removed; performHaptic then called the inline
        //   performHapticInternal directly.
        // v1.2.3 (God Class round-17): the inline haptic implementation
        //   (~420 lines) has now been properly extracted into HapticManager
        //   and is wired here — the real, fully-wired successor of the
        //   removed dead HapticHelper. The @JavascriptInterface delegates
        //   (isHapticEnabled / performHaptic) keep the JS API surface identical.
        this._hapticManager = new HapticManager(this.context, this.prefs, this.mainHandler);
        this._safPickerHelper = new SafPickerHelper(this.context, this.activityRef, new SafPickerHelper.Callbacks() {
            @Override
            public void postJsCallback(String jsExpression) {
                StockfishNative.this.postJsCallback(jsExpression);
            }
            @Override
            public String escapeJsString(String s) {
                return StockfishNative.escapeJsString(s);
            }
            @Override
            public void importSettings(String content) {
                StockfishNative.this.importSettings(content);
            }
        });
        this._engineSettingsHelper = new EngineSettingsHelper(this.context, new EngineSettingsHelper.Callbacks() {
            @Override public String getEngineName() { return engineName; }
            @Override public String getEngineAuthor() { return engineAuthor; }
            @Override public String getCurrentEnginePath() { return currentEnginePath; }
            @Override public String getEngineVersion() { return ENGINE_VERSION; }
            @Override public int getEngineThreads() { return engineThreads; }
            @Override public int getEngineHash() { return engineHash; }
            @Override public int getEngineMoveOverhead() { return engineMoveOverhead; }
            @Override public int getEngineMultiPV() { return engineMultiPV; }
            @Override public boolean getEnginePonder() { return enginePonder; }
            @Override public boolean getEngineShowWDL() { return engineShowWDL; }
            @Override public int getEngineSkillLevel() { return engineSkillLevel; }
            @Override public boolean getEngineLimitElo() { return engineLimitElo; }
            @Override public int getEngineElo() { return engineElo; }
            @Override public boolean isAutoConfigEnabled() { return autoConfigEnabled; }
            @Override public boolean isEngineReady() { return engineReady; }
            @Override public void setEngineThreads(int v) { engineThreads = v; saveIntSetting("engineThreads", v); }
            @Override public void setEngineHash(int v) { engineHash = v; saveIntSetting("engineHash", v); }
            @Override public void setEngineMoveOverhead(int v) { engineMoveOverhead = v; saveIntSetting("engineMoveOverhead", v); }
            @Override public void setEngineMultiPV(int v) { engineMultiPV = v; saveIntSetting("engineMultiPV", v); }
            @Override public void setEnginePonder(boolean v) { enginePonder = v; saveBoolSetting("enginePonder", v); }
            @Override public void setEngineShowWDL(boolean v) { engineShowWDL = v; saveBoolSetting("engineShowWDL", v); }
            @Override public void setEngineSkillLevel(int v) { engineSkillLevel = v; saveIntSetting("engineSkillLevel", v); }
            @Override public void setEngineLimitElo(boolean v) { engineLimitElo = v; saveBoolSetting("engineLimitElo", v); }
            @Override public void setEngineElo(int v) { engineElo = v; saveIntSetting("engineElo", v); }
            @Override public void setAutoConfigEnabled(boolean v) { autoConfigEnabled = v; saveBoolSetting("autoConfig", v); }
            @Override public void stopAndWaitForBestmove(String callerTag) { StockfishNative.this.stopAndWaitForBestmove(callerTag); }
            @Override public void applySettings() { StockfishNative.this.applySettings(); }
            @Override public void notifyEngineInfo() { StockfishNative.this.notifyEngineInfo(); }
            @Override public void postJsCallback(String jsExpression) { StockfishNative.this.postJsCallback(jsExpression); }
            @Override public void safeExecute(Runnable r, String tag) { StockfishNative.this._safeExecute(r, tag); }
        });
        // v1.2.0 Phase 81: Engine config helper — Callbacks provide raw field access
        // (field + persist, no UCI command) so the helper owns all UCI command dispatch.
        this._engineConfigHelper = new EngineConfigHelper(this.context, new EngineConfigHelper.Callbacks() {
            @Override public boolean isEngineReady() { return engineReady; }
            @Override public boolean isAutoConfigEnabled() { return autoConfigEnabled; }
            @Override public int getEngineThreads() { return engineThreads; }
            @Override public int getEngineHash() { return engineHash; }
            @Override public int getEngineMoveOverhead() { return engineMoveOverhead; }
            @Override public int getEngineMultiPV() { return engineMultiPV; }
            @Override public boolean getEnginePonder() { return enginePonder; }
            @Override public boolean getEngineShowWDL() { return engineShowWDL; }
            @Override public int getEngineSkillLevel() { return engineSkillLevel; }
            @Override public boolean getEngineLimitElo() { return engineLimitElo; }
            @Override public int getEngineElo() { return engineElo; }
            @Override public void setThreadsField(int v) { engineThreads = v; saveIntSetting("engineThreads", v); }
            @Override public void setHashField(int v) { engineHash = v; saveIntSetting("engineHash", v); }
            @Override public void setMoveOverheadField(int v) { engineMoveOverhead = v; saveIntSetting("engineMoveOverhead", v); }
            @Override public void setMultiPVField(int v) { engineMultiPV = v; saveIntSetting("engineMultiPV", v); }
            @Override public void setPonderField(boolean v) { enginePonder = v; saveBoolSetting("enginePonder", v); }
            @Override public void setShowWDLField(boolean v) { engineShowWDL = v; saveBoolSetting("engineShowWDL", v); }
            @Override public void setSkillLevelField(int v) { engineSkillLevel = v; saveIntSetting("engineSkillLevel", v); }
            @Override public void setLimitEloField(boolean v) { engineLimitElo = v; saveBoolSetting("engineLimitElo", v); }
            @Override public void setEloField(int v) { engineElo = v; saveIntSetting("engineElo", v); }
            @Override public void setAutoConfigField(boolean v) { autoConfigEnabled = v; saveBoolSetting("autoConfig", v); }
            @Override public boolean engineSupportsOption(String name) { return StockfishNative.this.engineSupportsOption(name); }
            @Override public void sendSetOptionAndWait(String name, String value) { StockfishNative.this.sendSetOptionAndWait(name, value); }
            @Override public void sendUciCommand(String command) { StockfishNative.this.sendUciCommand(command); }
            @Override public void notifyEngineInfo() { StockfishNative.this.notifyEngineInfo(); }
            @Override public void postJsCallback(String jsExpression) { StockfishNative.this.postJsCallback(jsExpression); }
            @Override public void postJsCallback(String eventName, Object... args) { StockfishNative.this.postJsCallback(eventName, args); }
        });
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
        _clearRestartInProgress(); // Reset lock for fresh init
        try {
            _engineExecutor.execute(new Runnable() {
                public void run() {
                    try {
                        startEngine();
                    } catch (Throwable e) {
                        Log.e(TAG, "Failed to initialize engine", e);
                        initStarted = false;
                        engineReady = false;
                        _clearRestartInProgress();
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
                        _clearRestartInProgress();
                        postJsCallback("onEngineError(" + escapeJsString(t.getMessage() != null ? t.getMessage() : "Unknown error") + ")");
                    }
                }
            });
        }
    }

    /**
     * v1.2.1: 由 ChessApp 的 UncaughtExceptionHandler 调用 —— 当 SF-* 线程
     *   因未捕获异常退出时设置死亡标记。Heartbeat 会检测此标记并触发
     *   recoverEngine —— 否则引擎进程虽然活着但读线程已死，isProcessAlive()
     *   返回 true 导致 heartbeat 误判健康，AI 静默不动直到 15-30s zombie 超时。
     */
    public static void markEngineThreadDead(String threadName) {
        sEngineThreadDied = true;
        sEngineThreadDiedName = threadName;
        Log.e("StockfishNative", "Engine thread marked dead: " + threadName);
    }

    /** v1.2.1: 在引擎成功启动后清除死亡标记 */
    private void clearEngineThreadDeadFlag() {
        sEngineThreadDied = false;
        sEngineThreadDiedName = null;
    }

    /**
     * v1.2.3 (S1141): Graceful sleep helper — sleeps {@code ms}, and on
     *   InterruptedException restores the thread's interrupt flag so callers
     *   can still observe the interrupt (via {@code isInterrupted()}) before
     *   returning. Extracted to eliminate the nested-try pattern flagged by
     *   SonarCloud java:S1141 and to keep the re-interrupt idiom consistent
     *   across all process-cleanup / ponder-stop grace sleeps.
     */
    private static void sleepGracefully(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private boolean isProcessAlive() {
        if (engineProcess == null) return false;
        // v1.2.1 round-10 (review-D P3): Process.isAlive() is API 26+ only.
        //   Previously every call (heartbeat ~1Hz + every UCI send path) took
        //   the NoSuchMethodError hit on API 23-25 (minSdk=23). Pre-check
        //   SDK_INT so the common path (API 26+) is a direct virtual invoke
        //   with no try/catch overhead, and the legacy path uses exitValue()
        //   probing.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return engineProcess.isAlive();
        }
        try {
            engineProcess.exitValue();
            return false;
        } catch (IllegalThreadStateException ex) {
            return true;
        } catch (Throwable e) {
            return false;
        }
    }

    // v1.0.2 FIX: Safe wrapper for Process.destroyForcibly() — that method is
    // API 26+ only, but our minSdk is 23. On API 23-25, fall back to a second
    // destroy() call (the OS will eventually reap the process). Also uses
    // isProcessAlive() instead of engineProcess.isAlive() for the same reason.
    private void destroyForciblySafe() {
        if (engineProcess == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                engineProcess.destroyForcibly();
            } else {
                // API 23-25: destroyForcibly() not available; second destroy()
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
        // v1.2.1: 同时清空 _discardingPonderBestmove 残留标志 —— 否则上一次
        //   engineStop() 在 STATE_NONE 路径上设置的丢弃标志会持续到下一次
        //   bestmove 到达时被错误地丢弃（TOCTOU 残留 bug 修复）。
        if (currentState == STATE_NONE && !_isPondering) {
            synchronized (_discardFlagLock) {
                _discardingPonderBestmove = false;
            }
            return;
        }

        if (_isPondering) {
            _isPondering = false;
            // v1.2.1 round-10 (review-D P2): set _discardingPonderBestmove under
            //   _discardFlagLock so the reader thread's check-and-clear is
            //   atomic w.r.t. this set. Previously the bare write raced with
            //   the reader's locked clear.
            synchronized (_discardFlagLock) {
                _discardingPonderBestmove = true; // FIX: Discard the ponder's bestmove when it arrives
            }
            synchronized (stateLock) {
                currentState = STATE_NONE;
            }
            sendUciCommand("stop");
            sleepGracefully(PONDER_STOP_GRACE_MS);
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
                // v1.1.0 Phase 58: P0 concurrency fix — only set the discard flag if
                //   we STILL own the latch. If the bestmove handler already captured
                //   and cleared _stopLatch (race-free under _stopLatchLock), then
                //   the bestmove was actually received just before our timeout fired
                //   — in that case the late bestmove was already consumed by the
                //   handler and we must NOT arm the discard flag (it would
                //   incorrectly discard the NEXT legitimate bestmove).
                // v1.2.1 round-9: Fixed lock mismatch — the discard flag is read
                //   and cleared by the bestmove reader thread under _discardFlagLock
                //   (line ~1871), so the write here MUST also be under
                //   _discardFlagLock to provide mutual exclusion. Previously this
                //   write was under _stopLatchLock (the wrong lock), creating a
                //   TOCTOU window where the reader could observe a stale `false`
                //   value while this write was in flight, or vice versa.
                synchronized (_stopLatchLock) {
                    if (_stopLatch == stopLatch) {
                        // We still own it — bestmove hasn't arrived. Arm the discard.
                        synchronized (_discardFlagLock) {
                            _discardingPonderBestmove = true;
                        }
                        _stopLatch = null;
                        Log.w(TAG, callerTag + ": stopAndWaitForBestmove timed out — discarding late bestmove");
                        // v1.2.3 P2 (Round 17 P2-5): After a stop-timeout, check
                        //   whether the engine process is actually alive. A
                        //   frozen-but-alive engine will recover on its own (the
                        //   discard flag handles the late bestmove); a DEAD
                        //   process needs proactive recovery, otherwise the next
                        //   call will fail with "Engine not ready" and the user
                        //   has to manually restart. Marking the thread dead
                        //   triggers the heartbeat's Check-0 recovery path.
                        if (engineProcess != null && !isProcessAlive()) {
                            Log.e(TAG, callerTag + ": stop timeout + engine process dead — marking for recovery");
                            engineReady = false;
                            try {
                                markEngineThreadDead("stopAndWaitForBestmove(" + callerTag + ")");
                            } catch (Throwable t) {
                                Log.w(TAG, "markEngineThreadDead call failed", t);
                            }
                        }
                    } else {
                        // bestmove handler already claimed the latch just before our
                        // timeout — the late bestmove was already consumed. Do NOT
                        // arm the discard flag.
                        Log.d(TAG, callerTag + ": stopAndWaitForBestmove timed out but bestmove was already consumed (race resolved)");
                    }
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // v1.2.0 Phase 73: re-interrupt
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
                    // v1.1.2 PHASE 71 (concurrency fix): serialize readyOkLatchHolder
                    //   access on _readyOkLock so that a concurrent sendSetOptionAndWait
                    //   call (JS binder thread) cannot overwrite our latch mid-wait.
                    synchronized (_readyOkLock) {
                        readyOkLatchHolder = newGameLatch;
                        sendUciCommand("isready");
                        try {
                            boolean gotReadyOk = newGameLatch.await(5, TimeUnit.SECONDS);
                            if (!gotReadyOk) Log.w(TAG, "Timeout waiting for readyok after ucinewgame");
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt(); // v1.2.0 Phase 73: re-interrupt
                            Log.w(TAG, "engineGoNewGame: interrupted waiting for readyok");
                        } finally {
                            readyOkLatchHolder = null;
                        }
                    }
                }
                // v1.1.0 Phase 56: Send setGameDifficulty BEFORE position fen
                //   (consistency with engineGoTimed — cleaner UCI ordering).
                setGameDifficulty(level);
                sendUciCommand("position fen " + fen);
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
                    // v1.1.2 PHASE 71 (concurrency fix): serialize readyOkLatchHolder
                    //   access on _readyOkLock (same as engineGoInternal above).
                    synchronized (_readyOkLock) {
                        readyOkLatchHolder = newGameLatch;
                        sendUciCommand("isready");
                        try {
                            boolean gotReadyOk = newGameLatch.await(5, TimeUnit.SECONDS);
                            if (!gotReadyOk) Log.w(TAG, "Timeout waiting for readyok after ucinewgame");
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt(); // v1.2.0 Phase 73: re-interrupt
                            Log.w(TAG, "engineGoTimed: interrupted waiting for readyok");
                        } finally {
                            readyOkLatchHolder = null;
                        }
                    }
                }
                // v1.1.0 Phase 56: Send setGameDifficulty BEFORE position fen.
                //   Previously, setGameDifficulty was called BETWEEN position fen
                //   and go — UCI commands are processed in order by the engine,
                //   so this worked, but it's cleaner per the UCI spec to send
                //   all setoption commands BEFORE position fen (the spec
                //   recommends setoption be sent during initialization or before
                //   position/go). This also ensures the engine applies the
                //   difficulty settings to the search from the very start.
                setGameDifficulty(level);
                sendUciCommand("position fen " + fen);

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
                // v1.2.3 P1 (Round 17 P1-3 / Round 18 A-P1-2): Skip the
                //   forceFullStrength() + applyEvalModeOptions() setoption
                //   storm when inside a batch — the batch's begin-hook already
                //   set these once, and they don't change between steps.
                //   5 setoptions × N steps = 5N UCI round-trips saved.
                if (!_evalDeepBatchActive) {
                    forceFullStrength();
                    // v1.0.4 Rev32 UCI EVAL OPTIMIZATION: same as engineEval —
                    // Contempt=0, MultiPV=1, UCI_ShowWDL=true for objective deep eval.
                    applyEvalModeOptions();
                }
                sendUciCommand("position fen " + fen);
                sendUciCommand("go depth 22");
            }
        }, "engineEvalDeep");
    }

    /**
     * v1.2.3 P1 (Round 17 P1-3 / Round 18 A-P1-2): Begin a batch of
     * engineEvalDeep() calls. Sets the eval-mode UCI options once
     * (forceFullStrength + applyEvalModeOptions) and marks the batch active
     * so subsequent engineEvalDeep() calls skip the per-step setoption storm.
     * Caller MUST pair with engineEvalDeepEndBatch() to restore gameplay
     * options (applySettings). Safe to call when the engine is not ready —
     * the flag is set but the option application is skipped; the first
     * engineEvalDeep() will then fail-fast with onEngineError.
     */
    @JavascriptInterface
    public void engineEvalDeepBeginBatch() {
        _evalDeepBatchActive = true;
        _safeExecute(new Runnable() { // tag: engineEvalDeepBeginBatch
            public void run() {
                if (!engineReady) {
                    // Flag stays set; engineEvalDeep will fail-fast.
                    return;
                }
                // Stop any in-flight gameplay search before changing options.
                stopAndWaitForBestmove("engineEvalDeepBeginBatch");
                synchronized (stateLock) {
                    currentState = STATE_EVAL;
                }
                forceFullStrength();
                applyEvalModeOptions();
            }
        }, "engineEvalDeepBeginBatch");
    }

    /**
     * v1.2.3 P1 (Round 17 P1-3 / Round 18 A-P1-2): End a batch of
     * engineEvalDeep() calls. Clears the batch flag and restores the
     * user's gameplay UCI options via applySettings(). Safe to call when
     * no batch was started (idempotent).
     */
    @JavascriptInterface
    public void engineEvalDeepEndBatch() {
        _evalDeepBatchActive = false;
        _safeExecute(new Runnable() { // tag: engineEvalDeepEndBatch
            public void run() {
                if (!engineReady) return;
                // Stop any in-flight eval search before restoring options.
                stopAndWaitForBestmove("engineEvalDeepEndBatch");
                synchronized (stateLock) {
                    currentState = STATE_NONE;
                }
                // Restore gameplay-appropriate UCI options (Skill Level,
                // UCI_LimitStrength, MultiPV, Contempt, etc.).
                applySettings();
            }
        }, "engineEvalDeepEndBatch");
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
            // v1.1.2 Phase 69 (UCI guide §3.3): UCI_AnalyseMode=true tells the
            //   engine to search more thoroughly (explore suboptimal moves for
            //   comprehensive variations). This is the correct mode for review
            //   analysis. The engine restores it to false via restoreGameplayOptions().
            if (engineSupportsOption("UCI_AnalyseMode")) {
                sendUciCommand("setoption name UCI_AnalyseMode value true");
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
            // v1.1.2 Phase 69 (UCI guide §3.3): Restore UCI_AnalyseMode=false for
            //   gameplay. The engine should not waste time exploring suboptimal
            //   moves during actual games.
            if (engineSupportsOption("UCI_AnalyseMode")) {
                sendUciCommand("setoption name UCI_AnalyseMode value false");
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
     * v1.2.0 Phase 81: Delegates to EngineConfigHelper.setGameDifficulty().
     * Kept as package-private so internal callers (engineGo, engineEval, etc.)
     * can still invoke it via StockfishNative.this.setGameDifficulty().
     */
    void setGameDifficulty(int level) {
        _engineConfigHelper.setGameDifficulty(level);
    }

    /**
     * Force full-strength engine play for evaluation and hint searches.
     * v1.2.0 Phase 81: Delegates to EngineConfigHelper.forceFullStrength().
     */
    void forceFullStrength() {
        _engineConfigHelper.forceFullStrength();
    }

    @JavascriptInterface
    public void syncGameDifficulty(int level) {
        _engineConfigHelper.syncGameDifficulty(level);
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
    // 兼容 Android 6.0 (API 23, minSdk) 及以上，包括小米澎湃 OS 3。
    @JavascriptInterface
    public boolean isSystemDarkMode() {
        try {
            // v1.2.1 round-10 (review-D P3): `context` is a final field set in
            //   the constructor — it can never be null. Removed the dead
            //   `if (ctx == null) return true;` guard.
            android.content.Context ctx = context;
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
        // v1.2.1 round-10 (review-D P2): bail out early if a shutdown was
        //   requested between the time the recovery task was scheduled and
        //   the time it actually starts running. Without this check, a race
        //   between recoverEngine's inner task (which calls startEngine) and
        //   a concurrent shutdown() would spawn a fresh engine process AFTER
        //   the user asked to quit, leaking the new process and its executor.
        if (shutdownRequested) {
            Log.i(TAG, "startEngineInternal: shutdownRequested — aborting engine start");
            _clearRestartInProgress();
            return;
        }

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
            _clearRestartInProgress(); // v1.0.8 PHASE 30: clear restart lock so future recoverEngine() calls can proceed
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
            _clearRestartInProgress(); // v1.0.8 PHASE 30: clear restart lock so future recoverEngine() calls can proceed
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
        // v1.2.3 round-18 (bug fix): also reset optionsBuilder — on a
        //   handshake retry the previous JSONArray was still live, so every
        //   "option name" line was appended a second time (duplicated options
        //   in the engine-config panel after engine restart).
        optionsBuilder = null;

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
            Thread.currentThread().interrupt(); // v1.2.0 Phase 73: re-interrupt
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
        // v1.1.2 PHASE 71 (concurrency fix): acquire _readyOkLock for the
        //   set+wait so that a concurrent sendSetOptionAndWait call (from the
        //   JS binder thread) cannot overwrite our readyOkLatchHolder mid-wait.
        synchronized (_readyOkLock) {
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
                Thread.currentThread().interrupt(); // v1.2.0 Phase 73: re-interrupt
                Log.e(TAG, "Interrupted waiting for readyok");
                cleanupFailedEngine();
                initStarted = false;
                postJsCallback("onEngineError(" + escapeJsString(isEnglishMode() ? "Engine initialization interrupted" : "\u5f15\u64ce\u521d\u59cb\u5316\u88ab\u4e2d\u65ad") + ")");
                return;
            } finally {
                readyOkLatchHolder = null;
            }
        }

        // Step 6: Apply settings with correct ordering
        engineReady = true;
        postJsCallback("onInitProgress(80, " + escapeJsString(isEnglishMode() ? "Applying engine configuration..." : "\u6b63\u5728\u5e94\u7528\u5f15\u64ce\u914d\u7f6e...") + ")");
        applySettings();

        // v1.0.4 NEW: Re-apply the Chess960 mode flag if it was set before the
        // (re)start. Without this, an engine auto-recovery after a crash would
        // silently drop UCI_Chess960=true and the user's Chess960 game would
        // be analyzed as standard chess (wrong castling handling).
        // v1.2.1: 此前只在 _pendingChess960==true 时重新应用，导致用户从
        //   Chess960 切回标准棋后崩溃恢复会把 UCI_Chess960=true 错误地保留。
        //   现在根据 _pendingChess960 的实际值应用 true 或 false。
        if (engineSupportsOption("UCI_Chess960")) {
            try {
                sendSetOptionAndWait("UCI_Chess960", _pendingChess960 ? "true" : "false");
            } catch (Exception e) {
                Log.w(TAG, "Failed to re-apply UCI_Chess960 after engine start: " + e.getMessage());
            }
        }

        // Step 7: Engine ready (90% -> 100%)
        postJsCallback("onInitProgress(90, " + escapeJsString(isEnglishMode() ? "Engine ready!" : "\u5f15\u64ce\u5c31\u7eea\uff01") + ")");
        Log.i(TAG, "Stockfish engine ready: " + engineName);
        _engineHealthMonitor.resetRecoveryCount();
        _clearRestartInProgress(); // Clear restart lock on successful start
        clearEngineThreadDeadFlag(); // v1.2.1: 引擎成功启动，清除前次死亡标记
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
        } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

        if (!isProcessAlive()) {
            Log.w(TAG, "Engine process not alive after 800ms, retrying check (1000ms)...");
            try {
                Thread.sleep(1000);
            } catch (InterruptedException e) { Thread.currentThread().interrupt(); }

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
    // v1.1.2 PHASE 71 (concurrency fix): dedicated lock for readyOkLatchHolder.
    //   Previously, the JS binder thread (sendSetOptionAndWait) and the executor
    //   thread (startEngineInternal / engineGoInternal ucinewgame path) both
    //   wrote the single volatile `readyOkLatchHolder` field without
    //   synchronization. If they overlapped, one latch was lost → 3-second
    //   timeout in sendSetOptionAndWait (or 10s in startEngineInternal). The
    //   engine only emits ONE readyok per isready, so concurrent isready
    //   commands are fundamentally racy. Serialize all readyOk set+wait
    //   operations on this lock so that at most one thread is waiting for
    //   readyok at a time.
    private final Object _readyOkLock = new Object();

    // ===================== R1/R2 FIX: Extracted recovery helpers =====================

    /**
     * Clean up engine process resources (streams, process, reader thread).
     * Used by both readEngineOutput() EOF/IOException paths and heartbeat
     * zombie recovery to avoid duplicate code.
     */
    private void cleanupEngineResources() {
        // v1.2.1 round-9: Reset currentState to STATE_NONE FIRST so that any
        //   buffered bestmove/info lines the reader thread processes during
        //   the teardown below (before it sees `interrupt()`) route through
        //   the STATE_NONE branches of handleBestMove / handleInfo / etc.
        //   and become no-ops. Without this, a stale bestmove could fire
        //   onBestMove / onHintMove / onEngineEval for a position being
        //   torn down, racing with onEngineRestarting() and corrupting the
        //   JS-side state machine. shutdown() (line ~2500) and engineStop()
        //   (line ~3066) both reset state; cleanupEngineResources was the
        //   only teardown path that didn't.
        synchronized (stateLock) {
            currentState = STATE_NONE;
        }
        // Close process streams
        if (engineProcess != null) {
            try { engineProcess.getInputStream().close(); } catch (Throwable ignored) {}
            try { engineProcess.getOutputStream().close(); } catch (Throwable ignored) {}
            try { engineProcess.getErrorStream().close(); } catch (Throwable ignored) {}
            try {
                engineProcess.destroy();
                sleepGracefully(PROCESS_DESTROY_GRACE_MS);
                // v1.0.2 FIX: use isProcessAlive() + destroyForciblySafe() —
                // direct engineProcess.isAlive() / destroyForcibly() throw
                // NoSuchMethodError on API 23-25 (minSdk).
                if (isProcessAlive()) destroyForciblySafe();
            } catch (Throwable ignored) {}
            engineProcess = null;
        }
        // Close writer
        // v1.1.1 Phase 60 (audit P0-3.1): Use _writerLock (not `this`) for writer
        //   access — consistent with the heartbeat path's _writerLock usage (Phase 58).
        //   The old `synchronized(this)` was inconsistent with the heartbeat's
        //   `synchronized(_writerLock)`, risking writer being closed mid-write by
        //   the heartbeat thread. All engineWriter access now goes through _writerLock.
        synchronized (_writerLock) {
            if (engineWriter != null) {
                try { engineWriter.close(); } catch (IOException ignored) {}
                engineWriter = null;
            }
        }
        // Interrupt reader thread
        if (readerThread != null) {
            readerThread.interrupt();
            try { readerThread.join(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } catch (Throwable ignored) {}
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
        // v1.2.3 round-13 (P1): clear the eval-deep-batch flag so a crashed
        //   engine doesn't leave it set on the new engine. Without this, if
        //   the engine crashes between engineEvalDeepBeginBatch() and
        //   engineEvalDeepEndBatch() (e.g. HyperOS kills the process mid-batch),
        //   subsequent engineEvalDeep() calls skip forceFullStrength() +
        //   applyEvalModeOptions() and run with gameplay Contempt=24 and the
        //   user's MultiPV setting instead of the intended eval-mode options,
        //   producing biased eval results.
        _evalDeepBatchActive = false;
        // v1.2.1 round-10 (review-D P2): clear under _discardFlagLock for
        //   consistency with all other writes.
        synchronized (_discardFlagLock) {
            _discardingPonderBestmove = false;
        }
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
                // v1.2.1: stale detection —— inner task 可能被 shutdownNow() 静默
                //   丢弃（execute() 成功但任务从未运行），导致 _restartInProgress
                //   永久卡住、未来 recoverEngine 全部早退。超过阈值则强制重置。
                long stuckMs = System.currentTimeMillis() - _restartStartTimeMs;
                if (stuckMs < RESTART_STALE_THRESHOLD_MS) {
                    Log.w(TAG, "Recovery skipped — restart already in progress (" + reason + ")");
                    return;
                }
                Log.w(TAG, "Stale _restartInProgress detected (" + (stuckMs/1000)
                        + "s), forcing reset for new recovery (" + reason + ")");
            }
            _restartInProgress = true;
            _restartStartTimeMs = System.currentTimeMillis();
        }

        // Reset recovery count if engine has been stable for a while
        long timeSinceLastRecovery = System.currentTimeMillis() - _lastRecoveryTimestamp;
        if (timeSinceLastRecovery > RECOVERY_COUNT_RESET_INTERVAL_MS && _engineHealthMonitor.getRecoveryCount() > 0) {
            Log.i(TAG, "Resetting auto-recovery count (" + _engineHealthMonitor.getRecoveryCount() + ") after " + (timeSinceLastRecovery/1000) + "s of stable operation");
            _engineHealthMonitor.resetRecoveryCount();
        }

        if (_engineHealthMonitor.getRecoveryCount() >= MAX_AUTO_RECOVERY) {
            Log.e(TAG, "Auto-recovery limit reached (" + MAX_AUTO_RECOVERY + "), giving up. Reason: " + reason);
            _clearRestartInProgress();
            postJsCallback("onEngineError(" + escapeJsString(userMessage) + ")");
            return;
        }
        _engineHealthMonitor.incrementRecoveryCount();
        _lastRecoveryTimestamp = System.currentTimeMillis();
        final int attemptNum = _engineHealthMonitor.getRecoveryCount();

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
        // v1.2.1 round-10 (review-D P2): re-check shutdownRequested AFTER
        //   recreating the executor but BEFORE scheduling the delayed task.
        //   If shutdown() raced between the top-of-method check and the
        //   executor recreation, the freshly-created executor would be
        //   leaked (no shutdown hook registered). Bail out cleanly instead.
        if (shutdownRequested) {
            Log.i(TAG, "recoverEngine: shutdownRequested after executor recreation — aborting (" + reason + ")");
            _clearRestartInProgress();
            return;
        }

        final int delay = Math.min(1000 + (attemptNum - 1) * 500, 5000); // Cap at 5s
        try {
            _engineExecutor.execute(new Runnable() {
                public void run() {
                    try {
                        Thread.sleep(delay);
                        if (shutdownRequested) { _clearRestartInProgress(); return; }
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
                                    _clearRestartInProgress();
                                }
                            }
                        });
                    } catch (InterruptedException e) {
                        // v1.2.3 round-12 (SonarCloud Bug #2 fix, java:S2142):
                        //   Thread.sleep() throws InterruptedException AND clears
                        //   the thread's interrupt flag. The previous catch
                        //   (Throwable t) swallowed it without re-asserting the
                        //   flag, so the subsequent shutdownRequested check (and
                        //   any downstream blocking calls) could not observe the
                        //   interrupt. On app shutdown / process termination this
                        //   meant the recovery task kept running past the
                        //   shutdown signal, leaking the engine process
                        //   (potential zombie). Restore the flag and bail out
                        //   cleanly so the executor can be torn down promptly.
                        Thread.currentThread().interrupt();
                        _clearRestartInProgress();
                        Log.i(TAG, "Auto-recovery sleep interrupted — aborting attempt " + attemptNum + " (" + reason + ")");
                        return;
                    } catch (Throwable t) {
                        Log.e(TAG, "Auto-recovery attempt " + attemptNum + " failed (" + reason + ")", t);
                        _clearRestartInProgress();
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
                            _clearRestartInProgress();
                        }
                    }
                });
            } catch (Throwable t2) {
                _clearRestartInProgress();
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
                _engineHealthMonitor.onResponseReceived();
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
        _engineHealthMonitor.onResponseReceived();

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
                // v1.1.0 Phase 58: P0 concurrency fix — eliminate stopLatch TOCTOU race.
                //   Previously: read _stopLatch (volatile), if non-null countDown+return,
                //   else check _discardingPonderBestmove. The race window was:
                //     1. bestmove handler reads _stopLatch = X (non-null)
                //     2. stopAndWaitForBestmove's await() times out, sets
                //        _discardingPonderBestmove = true, finally{} clears _stopLatch = null
                //     3. bestmove handler calls X.countDown() and returns — but the discard
                //        flag is now stuck TRUE, incorrectly discarding the NEXT legitimate
                //        bestmove.
                //   Fix: atomically capture-and-clear _stopLatch under _stopLatchLock so
                //   exactly one consumer (either the bestmove handler OR the timeout path)
                //   "owns" the latch. If we capture it, we countDown and the timeout path
                //   sees null (no discard). If the timeout path already cleared it, we see
                //   null and fall through to the discard check.
                CountDownLatch stopLatch;
                synchronized (_stopLatchLock) {
                    stopLatch = _stopLatch;
                    if (stopLatch != null) {
                        _stopLatch = null;  // claim ownership; stopAndWaitForBestmove sees null
                    }
                }
                if (stopLatch != null) {
                    // v1.2.1: 同时清空 _discardingPonderBestmove —— 该 bestmove
                    //   已被 latch 路径消费，不应再被 discard 路径处理；否则
                    //   engineStop() 在 latch 持有期间设置的丢弃标志会持续到
                    //   下一次合法 bestmove，导致 AI 静默不动（P0 修复）。
                    synchronized (_discardFlagLock) {
                        _discardingPonderBestmove = false;
                    }
                    stopLatch.countDown();
                    return;
                }
                // v1.0.8 PHASE 33: FIX: Discard bestmove from a stopped ponder.
                //   _isPondering is already false by the time the bestmove arrives
                //   (stopPonder/stopAndWaitForBestmove set it before sending "stop"),
                //   so without this discard flag the stale bestmove would route to
                //   handleBestMove() with STATE_NONE and corrupt the state machine.
                // v1.1.2 PHASE 71 (concurrency fix): atomically check-and-clear
                //   _discardingPonderBestmove under _discardFlagLock so that a
                //   concurrent engineStop() cannot set the flag AFTER our check
                //   but BEFORE handleBestMove — that TOCTOU window would let the
                //   stopped search's bestmove be processed as a real AI move.
                boolean _shouldDiscard;
                synchronized (_discardFlagLock) {
                    _shouldDiscard = _discardingPonderBestmove;
                    _discardingPonderBestmove = false;
                }
                if (_shouldDiscard) {
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
                // v1.1.2 Phase 67: P2 fix — wrap Long.parseLong in try-catch so a
                // malformed/malicious engine output cannot crash info-line processing.
                try { nodes = Long.parseLong(nodesMatcher.group(1)); }
                catch (NumberFormatException ignored) { nodes = null; }
            }
            Matcher npsMatcher = NPS_PATTERN.matcher(line);
            if (npsMatcher.find()) {
                try { nps = Long.parseLong(npsMatcher.group(1)); }
                catch (NumberFormatException ignored) { nps = null; }
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
     * Synchronized on `this` to prevent command interleaving from concurrent threads.
     * v1.1.1 Phase 60 (audit P0-3.1): Writer access is now inside _writerLock
     *   to be consistent with cleanupEngineResources/shutdown/heartbeat — prevents
     *   the writer being closed mid-write by a concurrent cleanup path. The `this`
     *   monitor is retained for command ordering (only one command at a time).
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
        // v1.1.1 Phase 60: Acquire _writerLock for the actual write so that
        //   cleanup paths (which now also use _writerLock) cannot close the
        //   writer while we're mid-write. Re-check engineWriter != null inside
        //   the lock in case a cleanup ran between the outer check and here.
        synchronized (_writerLock) {
            if (engineWriter == null) {
                Log.e(TAG, "Cannot send command - engine writer became null");
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
    }

    /**
     * Send a setoption command and wait for readyok confirmation.
     * v1.1.2 PHASE 71 (concurrency fix): the entire set+wait is synchronized
     *   on _readyOkLock so that concurrent callers (e.g. JS binder thread
     *   applying settings while executor thread starts a new game) do not
     *   overwrite each other's readyOkLatchHolder. The engine only emits ONE
     *   readyok per isready, so concurrent isready commands are inherently
     *   racy — serialization ensures at most one thread is waiting for
     *   readyok at a time. The 3-second per-call timeout bounds the worst-case
     *   wait for a queued caller.
     */
    private boolean sendSetOptionAndWait(String name, String value) {
        if (!engineReady || engineWriter == null) {
            Log.w(TAG, "Cannot set option " + name + " - engine not ready");
            return false;
        }
        // v1.2.1: Strip CR/LF from name/value to prevent UCI command injection
        //   (a malicious value could otherwise inject an extra UCI line).
        // v1.2.3 P1 (Round 17 P1-2): Reuse a pre-compiled Pattern instead of
        //   calling String.replaceAll(regex, ...) on every invocation. The
        //   String.replaceAll overload re-compiles the regex every call (~µs
        //   overhead per call, called many times during engine init + settings
        //   apply). Pre-compiling to a static Pattern + Matcher is the standard
        //   idiom and avoids the per-call compile cost.
        String safeName = stripNewlines(name);
        String safeValue = stripNewlines(value);
        synchronized (_readyOkLock) {
            final CountDownLatch latch = new CountDownLatch(1);
            readyOkLatchHolder = latch;
            sendUciCommand("setoption name " + safeName + " value " + safeValue);
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
                Thread.currentThread().interrupt(); // v1.2.0 Phase 73: re-interrupt
                Log.w(TAG, "Interrupted waiting for readyok after setting " + name);
                readyOkLatchHolder = null;
                return false;
            } finally {
                // v1.1.2 PHASE 71: clear the holder under the lock so the next
                // caller starts from a clean state.
                readyOkLatchHolder = null;
            }
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
        // v1.2.3 (robustness, dev-guide §5.1 direction-1): reject null/blank
        //   JS before wrapping — an empty payload would evaluate to the
        //   no-op `try{}catch(e){...}`, silently masking caller bugs; a null
        //   payload would produce the misleading script "try{null}catch...".
        if (jsExpression == null || jsExpression.trim().isEmpty()) {
            Log.w(TAG, "postJsCallback: null/empty JS expression, skipping");
            return;
        }
        final String cleanJs = jsExpression;
        try {
            mainHandler.post(new Runnable() {
                public void run() {
                    try {
                        // v1.1.0 Phase 57+: Guard against callbacks executing after the
                        // host Activity is finishing or destroyed. evaluateJavascript on
                        // a destroyed WebView throws IllegalStateException on some OEM
                        // ROMs (notably HyperOS 3), causing engine-init retries to
                        // crash the process instead of degrading gracefully.
                        Activity activity = activityRef.get();
                        if (activity != null && (activity.isFinishing() || activity.isDestroyed())) {
                            Log.d(TAG, "postJsCallback: host activity is finishing/destroyed, skipping: " + cleanJs);
                            return;
                        }
                        WebView webView = cachedWebViewRef.get();
                        if (webView == null) {
                            // Try to get WebView from Activity reference
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

    /**
     * v1.2.1 round-7 (security hardening, R3): Structured JS callback helper.
     * Builds a JS call of the form {@code eventName(arg0, arg1, ...)} where each
     * argument is JSON-encoded via {@link JSONArray} — guaranteeing proper
     * escaping of strings, numbers, booleans, and null. Callers MUST prefer
     * this method over the raw {@link #postJsCallback(String)} variant whenever
     * the arguments come from anything other than a hard-coded literal, so that
     * JS-injection-via-forgotten-escaping cannot occur by construction.
     *
     * <p>Examples:
     * <pre>{@code
     * postJsCallback("onEngineError", "Engine not ready");
     * postJsCallback("onInitProgress", 25, "Locating engine file...");
     * postJsCallback("onBestMove", "e2e4", null);
     * }</pre>
     *
     * @param eventName global JS function name to invoke (must match ^[A-Za-z_$][A-Za-z0-9_$]*$)
     * @param args arguments to pass; each is JSON-encoded (String/Number/Boolean/null/Object)
     */
    private void postJsCallback(String eventName, Object... args) {
        if (eventName == null || eventName.isEmpty()) {
            Log.w(TAG, "postJsCallback: eventName is null/empty, skipping");
            return;
        }
        // Defend against a malformed eventName being used to inject JS. The
        // regex below is the ECMAScript IdentifierName spec (subset; no
        // reserved words or Unicode escapes). If a caller passes a non-
        // identifier, we refuse to dispatch rather than risk eval-style
        // injection through the function-name slot.
        if (!EVENT_NAME_PATTERN.matcher(eventName).matches()) {
            Log.w(TAG, "postJsCallback: rejected non-identifier eventName: " + eventName);
            return;
        }
        // Build the args list as a JSON array, then strip the outer [] so the
        // result is a comma-separated JS argument list. JSONArray.toString()
        // produces valid JSON, which is a strict subset of JS expression
        // syntax — so the resulting string is safe to splice into a JS call.
        String argsJs;
        try {
            argsJs = new JSONArray(args).toString();
        } catch (Throwable t) {
            // JSONArray can throw on non-encodable values (very unlikely for
            // our caller-controlled inputs, but be defensive).
            Log.e(TAG, "postJsCallback: failed to encode args for " + eventName, t);
            return;
        }
        // Strip leading '[' and trailing ']' (length is >= 2 because "[]" is
        // the empty-array encoding).
        if (argsJs.length() >= 2 && argsJs.charAt(0) == '[' && argsJs.charAt(argsJs.length() - 1) == ']') {
            argsJs = argsJs.substring(1, argsJs.length() - 1);
        } else {
            // Defensive: should never happen — JSONArray always emits [].
            argsJs = "";
        }
        postJsCallback(eventName + "(" + argsJs + ")");
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
            try { _heartbeatThread.join(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } catch (Throwable ignored) {}
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

        // v1.1.1 Phase 60 (audit P0-3.1): Use _writerLock (not `this`) for writer
        //   access — consistent with cleanupEngineResources() and the heartbeat path.
        synchronized (_writerLock) {
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
                // v1.2.3 round-13 (P2): use the named constant instead of a
                //   bare 200 literal. cleanupEngineResources() and
                //   cleanupFailedEngine() both use PROCESS_DESTROY_GRACE_MS
                //   (=100); this shutdown() path used 200 — an undocumented
                //   divergence. The 100ms grace is sufficient per the original
                //   v1.0.2 comment (process.destroy() returns immediately and
                //   the engine exits promptly on SIGTERM). Aligning prevents
                //   future drift and matches the documentation in BUILDING.md.
                sleepGracefully(PROCESS_DESTROY_GRACE_MS);
                // v1.0.2 FIX: use isProcessAlive() + destroyForciblySafe() —
                // direct engineProcess.isAlive() / destroyForcibly() throw
                // NoSuchMethodError on API 23-25 (minSdk).
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
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
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

        // v1.1.1 Phase 60 (audit P0-3.1): Use _writerLock (not `this`) for writer
        //   access — consistent with cleanupEngineResources() and the heartbeat path.
        synchronized (_writerLock) {
            if (engineWriter != null) {
                try { engineWriter.close(); } catch (IOException ignored) {}
                engineWriter = null;
            }
        }

        if (engineProcess != null) {
            try {
                engineProcess.destroy();
                sleepGracefully(PROCESS_DESTROY_GRACE_MS);
                // v1.0.2 FIX: use isProcessAlive() + destroyForciblySafe() —
                // direct engineProcess.isAlive() / destroyForcibly() throw
                // NoSuchMethodError on API 23-25 (minSdk).
                if (isProcessAlive()) destroyForciblySafe();
            } catch (Throwable ignored) {}
            engineProcess = null;
        }

        if (readerThread != null) {
            readerThread.interrupt();
            try { readerThread.join(1000); } catch (InterruptedException e) { Thread.currentThread().interrupt(); } catch (Throwable ignored) {}
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
                        Thread.currentThread().interrupt(); // v1.2.0 Phase 73: re-interrupt
                        break;
                    }
                    if (!_heartbeatRunning || shutdownRequested) break;

                    // v1.2.1: Check 0 —— Engine-thread-alive health. SF-Reader /
                    //   SF-Heartbeat 等线程因未捕获异常退出时，ChessApp 的
                    //   UncaughtExceptionHandler 调用 markEngineThreadDead() 设置
                    //   此标记。引擎进程可能仍存活，但读线程已死，bestmove 永远
                    //   不会被消费 —— 必须主动恢复。
                    if (sEngineThreadDied) {
                        Log.e(TAG, "Heartbeat: engine thread died (" + sEngineThreadDiedName
                                + "), attempting restart");
                        recoverEngine("heartbeat-thread-died",
                                "\u5f15\u64ce\u7ebf\u7a0b\u5d29\u6e83\uff0c\u8bf7\u5c1d\u8bd5\u624b\u52a8\u91cd\u542f");
                        continue; // Skip other checks this cycle
                    }

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
                        long timeSinceLastResponse = System.currentTimeMillis() - _engineHealthMonitor.getLastResponseTime();
                        if (timeSinceLastResponse > ZOMBIE_SEARCH_TIMEOUT_MS) {
                            Log.e(TAG, "Heartbeat: engine zombie detected (no response for " + timeSinceLastResponse + " ms), attempting recovery");
                            // v1.1.0 Phase 58: P0 concurrency fix — use _writerLock instead
                            //   of synchronized(StockfishNative.this). The old monitor used
                            //   the same lock as startHeartbeat() (which is `synchronized`
                            //   on `this`), creating a deadlock risk: if shutdown() ran
                            //   while the heartbeat held `this` monitor inside the
                            //   engineWriter.write() call, shutdown's
                            //   _heartbeatThread.join(1000) would wait for the heartbeat
                            //   to release `this` — but the heartbeat was blocked on I/O.
                            //   _writerLock is a separate lock dedicated to engineWriter
                            //   access, so shutdown's interrupt/join is not blocked by
                            //   heartbeat's writer access. cleanupEngineResources() and
                            //   recoverEngine() use their own locks (_restartLock,
                            //   _stopLatchLock) and do not hold _writerLock.
                            synchronized (_writerLock) {
                                try {
                                    if (engineWriter != null) {
                                        engineWriter.write("quit\n");
                                        engineWriter.flush();
                                    }
                                } catch (IOException ignored) {}
                            }
                            // Wait briefly for graceful exit
                            sleepGracefully(200); if (Thread.currentThread().isInterrupted()) break;
                            // Clean up all resources
                            cleanupEngineResources();
                            // Wait before restarting
                            sleepGracefully(500); if (Thread.currentThread().isInterrupted()) break;
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
                // v1.2.1: stale detection —— 与 recoverEngine 保持一致
                long stuckMs = System.currentTimeMillis() - _restartStartTimeMs;
                if (stuckMs < RESTART_STALE_THRESHOLD_MS) {
                    Log.w(TAG, "restartEngine: skipping — restart already in progress");
                    return;
                }
                Log.w(TAG, "restartEngine: stale _restartInProgress detected (" + (stuckMs/1000) + "s), forcing reset");
            }
            _restartInProgress = true;
            _restartStartTimeMs = System.currentTimeMillis();
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
                    _engineHealthMonitor.resetRecoveryCount();
                    shutdown();
                    try {
                        Thread.sleep(500);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                    // Recreate the executor since shutdown() destroyed it
                    _engineExecutor = _createEngineExecutor();
                    initStarted = false;
                    // v1.2.3 round-13 (P0): shutdown() sets shutdownRequested=true.
                    //   startEngineInternal() guards on shutdownRequested at the top
                    //   (added v1.2.1 round-10 to prevent recoverEngine from racing
                    //   with concurrent shutdown). Without resetting the flag here,
                    //   the restart path bails at that guard and the engine never
                    //   restarts — leaving the user with a permanently dead engine.
                    //   A concurrent shutdown() between this reset and startEngine()
                    //   would re-set the flag and startEngine would correctly bail,
                    //   preserving the L1474 guard's original race protection.
                    shutdownRequested = false;
                    _engineExecutor.execute(new Runnable() {
                        public void run() {
                            try {
                                startEngine();
                            } catch (Throwable e) {
                                Log.e(TAG, "Engine restart failed", e);
                                postJsCallback("onEngineError(" + escapeJsString((isEnglishMode() ? "Engine restart failed: " : "\u5f15\u64ce\u91cd\u542f\u5931\u8d25: ") + (e.getMessage() != null ? e.getMessage() : "Unknown")) + ")");
                            } finally {
                                _clearRestartInProgress();
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
                        _engineHealthMonitor.resetRecoveryCount();
                        cleanupEngineResources();
                        startEngine();
                    } catch (Throwable t) {
                        Log.e(TAG, "Engine restart retry failed", t);
                        postJsCallback("onEngineError(" + escapeJsString((isEnglishMode() ? "Engine restart failed: " : "\u5f15\u64ce\u91cd\u542f\u5931\u8d25: ") + (t.getMessage() != null ? t.getMessage() : "Unknown")) + ")");
                    } finally {
                        _clearRestartInProgress();
                    }
                }
            });
        }
    }

    /**
     * v1.2.3 P1 (Round 17 P1-2): Strip CR/LF from a UCI command argument
     * using the pre-compiled {@link #NEWLINE_PATTERN}. Returns "" for null
     * input (UCI does not distinguish empty from null). Centralizing this
     * here keeps the sanitization rule in one place if we ever need to
     * tighten it further (e.g. reject other control chars).
     */
    private static String stripNewlines(String s) {
        if (s == null) return "";
        return NEWLINE_PATTERN.matcher(s).replaceAll("");
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
                // v1.2.3 round-13 (P3): removed explicit `case '\u0000'` — the
                //   default branch below handles all C0 controls (0x00-0x1F)
                //   via String.format("\\u%04x", ...), producing the identical
                //   "\\u0000" output. The explicit case was unreachable for any
                //   different behavior.
                default:
                    // v1.2.1 round-10 (review-D P3): The previous guard
                    //   `c != '\t' && c != '\n' && c != '\r'` was dead code —
                    //   those three chars are caught by explicit cases above.
                    //   Escape other C0 control chars (0x00-0x1F) as backslash-u-XXXX.
                    if (c < 0x20) {
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
        return _engineSettingsHelper.getEngineInfo();
    }

    // ===================== AUTO / MANUAL CONFIG =====================
    // v1.2.0 Phase 81: Config logic extracted to EngineConfigHelper.
    //                   StockfishNative retains @JavascriptInterface delegates.

    @JavascriptInterface
    public void setAutoConfig(boolean enabled) {
        _engineConfigHelper.setAutoConfig(enabled);
    }

    @JavascriptInterface
    public boolean isAutoConfig() {
        return autoConfigEnabled;
    }

    /**
     * P1 FIX: Check if the current engine supports a given UCI option name.
     * Uses the cached supportedOptionNames Set for O(1) lookup instead of
     * re-parsing the engineOptionsJson string on every call.
     *
     * v1.2.0 Phase 81: Retained on StockfishNative (not extracted) because it
     *   is called from many non-config paths (setChess960Mode, startEngine,
     *   onUciReady, etc.) and is a pure query on supportedOptionNames.
     *   EngineConfigHelper accesses it via the Callbacks.engineSupportsOption()
     *   bridge.
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
     * v1.2.0 Phase 81: Delegates to EngineConfigHelper.applySettings().
     * Kept as package-private so EngineSettingsHelper.Callbacks.applySettings()
     * can call it via StockfishNative.this.applySettings().
     */
    void applySettings() {
        _engineConfigHelper.applySettings();
    }

    @JavascriptInterface
    public void setEngineThreads(int threads) {
        _engineConfigHelper.setEngineThreads(threads);
    }

    @JavascriptInterface
    public void setEngineHash(int hashMB) {
        _engineConfigHelper.setEngineHash(hashMB);
    }

    @JavascriptInterface
    public void setEngineMoveOverhead(int ms) {
        _engineConfigHelper.setEngineMoveOverhead(ms);
    }

    @JavascriptInterface
    public void setEngineMultiPV(int multiPV) {
        _engineConfigHelper.setEngineMultiPV(multiPV);
    }

    @JavascriptInterface
    public void setEnginePonder(boolean enabled) {
        _engineConfigHelper.setEnginePonder(enabled);
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
        // v1.2.1 round-10 (review-D P2): set under _discardFlagLock — see
        //   stopAndWaitForBestmove for the rationale.
        synchronized (_discardFlagLock) {
            _discardingPonderBestmove = true; // Discard the ponder's bestmove when it arrives
        }
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
            // v1.1.2 PHASE 71 (concurrency fix): set _discardingPonderBestmove
            //   under _discardFlagLock so the reader thread's bestmove handler
            //   cannot observe a half-set flag (the check-and-clear in the reader
            //   is now atomic w.r.t. this set).
            synchronized (_discardFlagLock) {
                _discardingPonderBestmove = true;
            }
            try {
                sendUciCommand("stop");
            } catch (Throwable e) {
                Log.w(TAG, "engineStop: sendUciCommand failed", e);
            }
            // v1.2.1: 若被打断的是 STATE_EVAL，需要主动恢复 gameplay 选项 ——
            //   applyEvalModeOptions() 设置的 Contempt=0/MultiPV=1/UCI_AnalyseMode=true
            //   否则会泄漏到下一次 gameplay 搜索（handleBestMove 的 STATE_EVAL 分支
            //   才会调用 restoreGameplayOptions()，但 discard 路径不会进入该分支）。
            if (stateBefore == STATE_EVAL) {
                try { restoreGameplayOptions(); }
                catch (Throwable t) { Log.w(TAG, "engineStop: restoreGameplayOptions failed", t); }
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
        if (!_jsBridgeGateway.isUciCommandAllowed(command)) {
            Log.w(TAG, "sendToEngine: blocked non-whitelisted command: " + command);
            return;
        }
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
        // v1.2.3 P1 (Round 17 P1-3): Track tmpFile in a finally-cleaned local
        //   so it cannot leak. Previously, if Files.move failed with
        //   AtomicMoveNotSupportedException and the legacy rename also failed
        //   (e.g. cross-device on some OEM ROMs), the code fell through to
        //   Files.copy() — but never deleted tmpFile afterwards. Over time
        //   this leaked a stale .tmp on every save, and a later save could
        //   read a half-written tmp if the FS crashed mid-write. The finally
        //   block now guarantees tmpFile cleanup regardless of the path taken.
        File tmpFile = new File(context.getFilesDir(), EVAL_CACHE_FILE + ".tmp");
        boolean success = false;
        try {
            File finalFile = new File(context.getFilesDir(), EVAL_CACHE_FILE);
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
                    // tmpFile was consumed by the move — mark it so the finally
                    // block does not attempt a redundant (and harmless) delete.
                    tmpFile = null;
                    success = true;
                    return true;
                } catch (java.nio.file.AtomicMoveNotSupportedException e) {
                    // Cross-device tmp/final — fall through to legacy path.
                    // tmpFile is still on disk; the legacy path will consume it.
                    Log.w(TAG, "saveEvalCacheSync: ATOMIC_MOVE not supported, falling back");
                }
            }
            // Legacy path (API 23-25 or cross-device fallback)
            // v1.2.0 Phase 73 (SonarCloud B29): check delete() return value
            if (finalFile.exists() && !finalFile.delete()) {
                Log.w(TAG, "saveEvalCacheSync: failed to delete old cache file");
            }
            if (tmpFile.renameTo(finalFile)) {
                // renameTo consumed the tmp file — mark null so finally skips.
                tmpFile = null;
                success = true;
                return true;
            }
            // Fallback: copy tmp to final if rename fails (cross-device?)
            Log.w(TAG, "saveEvalCacheSync: rename failed, falling back to copy");
            java.nio.file.Files.copy(tmpFile.toPath(), finalFile.toPath(),
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            // copy did NOT consume tmpFile — finally will delete it.
            success = true;
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "saveEvalCacheSync failed", e);
            return false;
        } finally {
            // v1.2.3 P1 (Round 17 P1-3): Always clean up the tmp file when it
            //   still exists (i.e. the legacy-copy path was taken or any path
            //   threw). Skipping when tmpFile==null avoids a spurious delete
            //   of a file that was already consumed by move/rename.
            if (tmpFile != null) {
                try {
                    if (!tmpFile.delete() && tmpFile.exists()) {
                        Log.w(TAG, "saveEvalCacheSync: failed to clean up tmp file (success=" + success + ")");
                    }
                } catch (Throwable ignored) {
                    // Best-effort cleanup — never mask the original result.
                }
            }
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

    // v1.2.3 round-13 (P3): removed dead _pgnCacheDir() and _sanitizeCacheName()
    //   private wrappers. Both were leftover scaffolding from the v1.2.0 Phase
    //   73 extraction — all PGN cache @JavascriptInterface methods below
    //   delegate directly to _pgnCacheManager and never called these wrappers.
    //   R8 confirmed they were stripped as unused (proguard usage.txt).

    // v1.2.0 Phase 73: PGN cache methods delegate to PgnCacheManager.
    // The @JavascriptInterface signatures are preserved for JS compatibility.

    @JavascriptInterface
    public String listPGNCaches() {
        return _pgnCacheManager.listCaches();
    }

    @JavascriptInterface
    public boolean savePGNCache(String name, String pgn) {
        return _pgnCacheManager.save(name, pgn);
    }

    @JavascriptInterface
    public String getPGNCache(String name) {
        return _pgnCacheManager.get(name);
    }

    @JavascriptInterface
    public boolean deletePGNCache(String name) {
        return _pgnCacheManager.delete(name);
    }

    @JavascriptInterface
    public int deletePGNCaches(String namesJson) {
        return _pgnCacheManager.deleteBatch(namesJson);
    }

    @JavascriptInterface
    public boolean renamePGNCache(String oldName, String newName) {
        return _pgnCacheManager.rename(oldName, newName);
    }

    @JavascriptInterface
    public boolean setPGNCacheTags(String name, String tagsJson) {
        return _pgnCacheManager.setTags(name, tagsJson);
    }

    @JavascriptInterface
    public String getPGNCacheTags(String name) {
        return _pgnCacheManager.getTags(name);
    }

    // ===================== MULTIPV / WDL / SKILL =====================

    @JavascriptInterface
    public String getMultiPVResult() {
        return _lastMultiPVJson;
    }

    @JavascriptInterface
    public void setEngineShowWDL(boolean enabled) {
        _engineConfigHelper.setEngineShowWDL(enabled);
    }

    /**
     * v18.5.0: Alias for setEngineShowWDL — matches the JS API contract.
     */
    @JavascriptInterface
    public void setShowWDL(boolean enabled) {
        _engineConfigHelper.setShowWDL(enabled);
    }

    @JavascriptInterface
    public void setEngineSkillLevel(int level) {
        _engineConfigHelper.setEngineSkillLevel(level);
    }

    // v1.0.6 NEW: JS-side getter for the current Skill Level value.
    // Used by _aiOpponentNameWithLevel() to render "SL<N>" in the AI opponent
    // bar and in PGN [White]/[Black] tags when the AI is in SL mode.
    @JavascriptInterface
    public int getEngineSkillLevel() {
        return _engineConfigHelper.getEngineSkillLevel();
    }

    @JavascriptInterface
    public void setEngineLimitElo(boolean enabled, int elo) {
        _engineConfigHelper.setEngineLimitElo(enabled, elo);
    }

    /**
     * v18.5.0: Convenience alias matching the JS API contract.
     */
    @JavascriptInterface
    public void setLimitStrength(boolean enabled, int elo) {
        _engineConfigHelper.setLimitStrength(enabled, elo);
    }

    /**
     * v18.5.0: Set the engine ELO independently (only effective when UCI_LimitStrength is true).
     */
    @JavascriptInterface
    public void setElo(int elo) {
        _engineConfigHelper.setElo(elo);
    }

    // ===================== SETTINGS QUERY / EXPORT / IMPORT =====================
    // v1.2.0 Phase 73+: Delegated to EngineSettingsHelper

    @JavascriptInterface
    public String getEngineSettings() {
        return _engineSettingsHelper.getEngineSettings();
    }

    @JavascriptInterface
    public String exportSettings() {
        return _engineSettingsHelper.exportSettings();
    }

    /** v18.5.0: Alias for exportSettings — matches the JS API contract. */
    @JavascriptInterface
    public String exportEngineSettings() {
        return _engineSettingsHelper.exportSettings();
    }

    @JavascriptInterface
    public void importSettings(String txtContent) {
        _engineSettingsHelper.importSettings(txtContent);
    }

    /** v18.5.0: Alias for importSettings — matches the JS API contract. */
    @JavascriptInterface
    public void importEngineSettings(String txtContent) {
        _engineSettingsHelper.importSettings(txtContent);
    }

    // ===================== HAPTIC FEEDBACK =====================

    @JavascriptInterface
    public int getApiLevel() {
        return Build.VERSION.SDK_INT;
    }

    @JavascriptInterface
    public boolean hasVibrator() {
        return _permissionHelper.hasVibrator();
    }

    @JavascriptInterface
    public boolean isHapticEnabled() {
        // v1.2.3 (God Class round-17): delegate to HapticManager — JS API unchanged.
        return _hapticManager.isHapticEnabled();
    }

    @JavascriptInterface
    public void performHaptic(String type) {
        // v1.2.3 (God Class round-17): delegate to HapticManager — JS API unchanged.
        _hapticManager.performHaptic(type);
    }


    @JavascriptInterface
    public void setHapticEnabled(boolean enabled) {
        saveBoolSetting("hapticFeedbackEnabled", enabled);
        Log.i(TAG, "Haptic feedback preference set to: " + enabled);
    }



    // ===================== ASSET LOADING =====================
    // v1.2.0 Phase 73+: Delegated to FileIoHelper

    @JavascriptInterface
    public String loadAssetAsBase64(String assetPath) {
        return _fileIoHelper.loadAssetAsBase64(assetPath);
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
        // v1.2.1 round-10 (review-E P2): Use case-insensitive scheme check.
        //   Uri.parse + equalsIgnoreCase accepts "HTTP://...", "Https://..."
        //   which are valid per RFC 3986 §3.1 (scheme is case-insensitive).
        //   The previous case-sensitive startsWith() rejected these URLs.
        if (!_isHttpUrl(trimmed)) {
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

    // v1.2.1 round-10 (review-E P2): case-insensitive http(s) scheme check.
    //   Used by StockfishNative.openUrlInBrowser; mirrored in StatsActivity
    //   and ChessWebViewClient via the same Uri.parse + equalsIgnoreCase idiom.
    private static boolean _isHttpUrl(String url) {
        if (url == null || url.isEmpty()) return false;
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        return "http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme);
    }

    // ===================== ENGINE BINARY EXTRACTION HELPERS =====================

    /**
     * Extract engine binary from APK's lib/ directory to filesDir.
     * Fallback for OEM ROMs that skip extraction of large native libraries during install.
     */
    private File extractEngineFromApk() {
        File destFile = new File(context.getFilesDir(), ENGINE_LIB_NAME);

        // FIX: Also verify ELF header on cached file to prevent using corrupted extraction
        if (destFile.exists() && destFile.length() > MIN_ENGINE_BINARY_SIZE && isElfFile(destFile)) {
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
                            // v1.2.1 (round-4 bugfix): ZipEntry.getSize() may return -1
                            //   (unknown size) — direct division yields a negative pct and
                            //   a misleading "MB/-1MB" suffix. Fall back to a flat 25%.
                            long entrySize = entry.getSize();
                            int pct = (entrySize > 0)
                                    ? 12 + (int) (total * 13 / entrySize)
                                    : 25;
                            String sizeStr = (entrySize > 0)
                                    ? (total / 1048576) + "MB/" + (entrySize / 1048576) + "MB"
                                    : (total / 1048576) + "MB";
                            postJsCallback("onInitProgress(" + pct + ", " + escapeJsString((isEnglishMode() ? "Extracting engine... " : "\u6b63\u5728\u63d0\u53d6\u5f15\u64ce... ") + sizeStr) + ")");
                        }
                    }
                    out.flush();
                    Log.i(TAG, "Extracted engine: " + total + " bytes");
                }
            }

            makeExecutable(destFile);

            if (destFile.exists() && destFile.canRead() && destFile.length() > MIN_ENGINE_BINARY_SIZE) {
                if (isElfFile(destFile)) {
                    Log.i(TAG, "Engine extracted successfully, size=" + destFile.length());
                    currentEnginePath = destFile.getAbsolutePath();
                    return destFile;
                } else {
                    Log.e(TAG, "Extracted engine failed ELF header verification");
                    if (!destFile.delete()) Log.w(TAG, "Failed to delete: " + destFile.getAbsolutePath());
                }
            } else {
                Log.e(TAG, "Extracted engine file is invalid (size=" + (destFile.exists() ? destFile.length() : 0) + ")");
                if (!destFile.delete()) Log.w(TAG, "Failed to delete: " + destFile.getAbsolutePath());
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
        if (destFile.exists() && destFile.length() > MIN_ENGINE_BINARY_SIZE && isElfFile(destFile)) {
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

        if (destFile.exists() && destFile.canRead() && destFile.length() > MIN_ENGINE_BINARY_SIZE) {
            if (isElfFile(destFile)) {
                Log.i(TAG, "Engine extracted from assets successfully, size=" + destFile.length());
                currentEnginePath = destFile.getAbsolutePath();
                return destFile;
            } else {
                Log.e(TAG, "Asset-extracted engine failed ELF verification — deleting");
                if (!destFile.delete()) Log.w(TAG, "Failed to delete: " + destFile.getAbsolutePath());
            }
        } else {
            Log.e(TAG, "Asset-extracted engine is invalid (size=" + (destFile.exists() ? destFile.length() : 0) + ")");
            if (!destFile.delete()) Log.w(TAG, "Failed to delete: " + destFile.getAbsolutePath());
        }
        return null;
    }

    /**
     * Make a file executable using multiple methods for maximum compatibility.
     * v1.2.1: 委派给 EngineProcessManager.makeExecutable —— 该方法已封装相同的多级
     *   fallback 逻辑（nativeChmod → setExecutable → /system/bin/chmod → sh -c），
     *   并通过 ChmodProvider 回调使用本类的 nativeChmod 实现。消除重复代码。
     */
    private void makeExecutable(File file) {
        _engineProcessManager.makeExecutable(file);
    }

    // (v18.5.0: copyFile() removed — dead code after engine-import removal; extract* uses inline streams.)

    // ===================== FILE I/O FOR SETTINGS EXPORT/IMPORT =====================

    // ===================== PERMISSIONS =====================
    // v1.2.0 Phase 73+: Delegated to PermissionHelper

    @JavascriptInterface
    public boolean hasStoragePermission() {
        return _permissionHelper.hasStoragePermission();
    }

    @JavascriptInterface
    public void requestStoragePermission() {
        _permissionHelper.requestStoragePermission();
    }

    // (MANAGE_EXTERNAL_STORAGE methods removed — SAF handles all public-dir I/O, no special permission needed, API 19+.)

    // v1.2.0 Phase 73+: SAF request codes — retained as constants for MainActivity compatibility
    static final int REQUEST_CODE_EXPORT_SETTINGS = SafPickerHelper.REQUEST_CODE_EXPORT_SETTINGS;
    static final int REQUEST_CODE_EXPORT_PGN = SafPickerHelper.REQUEST_CODE_EXPORT_PGN;
    static final int REQUEST_CODE_IMPORT_SETTINGS = SafPickerHelper.REQUEST_CODE_IMPORT_SETTINGS;
    static final int REQUEST_CODE_IMPORT_PGN = SafPickerHelper.REQUEST_CODE_IMPORT_PGN;

    // ===================== SAF FILE PICKER (EXPORT) =====================
    // v1.2.0 Phase 73+: Delegated to SafPickerHelper

    /** v1.0.8 PHASE 24: Cancel a pending export (user dismissed the SAF picker). */
    public void cancelPendingExport() {
        _safPickerHelper.cancelPendingExport();
    }

    /** Open SAF export picker for settings (TXT) */
    @JavascriptInterface
    public void openExportFilePicker(String content) {
        _safPickerHelper.openExportFilePicker(content);
    }

    /** Open SAF export picker for PGN */
    @JavascriptInterface
    public void openPGNExportFilePicker(String content) {
        _safPickerHelper.openPGNExportFilePicker(content);
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

    /** Handle SAF export result — writes pending content to user-chosen URI */
    public void handleExportFilePickerResult(android.content.Intent data) {
        _safPickerHelper.handleExportResult(data);
    }

    // v1.2.0 Phase 73+: Notification permission delegated to PermissionHelper

    @JavascriptInterface
    public void requestNotificationPermission() {
        _permissionHelper.requestNotificationPermission();
    }

    @JavascriptInterface
    public boolean hasNotificationPermission() {
        return _permissionHelper.hasNotificationPermission();
    }

    // ===================== FILE I/O =====================
    // v1.2.0 Phase 73+: Delegated to FileIoHelper to reduce God Module size.

    @JavascriptInterface
    public String getExportPath() {
        return _fileIoHelper.getExportPath();
    }

    @JavascriptInterface
    public boolean writeTextFile(String path, String content) {
        if (!_jsBridgeGateway.isPathInSandbox(path)) {
            Log.w(TAG, "writeTextFile: path rejected by sandbox check");
            return false;
        }
        return _fileIoHelper.writeTextFile(path, content);
    }

    @JavascriptInterface
    public String readTextFile(String path) {
        if (!_jsBridgeGateway.isPathInSandbox(path)) {
            Log.w(TAG, "readTextFile: path rejected by sandbox check");
            return null;
        }
        return _fileIoHelper.readTextFile(path);
    }

    @JavascriptInterface
    public String getDefaultPaths() {
        return _fileIoHelper.getDefaultPaths();
    }

    @JavascriptInterface
    public String listFiles(String dirPath) {
        return _fileIoHelper.listFiles(dirPath);
    }

    @JavascriptInterface
    public String scanEngines() {
        return _fileIoHelper.scanEngines();
    }

    @JavascriptInterface
    public String getParentPath(String path) {
        return _fileIoHelper.getParentPath(path);
    }

    // ===================== SAF FILE PICKER (IMPORT) =====================
    // v1.2.0 Phase 73+: Delegated to SafPickerHelper

    /** Open SAF import picker for settings (TXT) */
    @JavascriptInterface
    public void openSystemFilePicker() {
        _safPickerHelper.openSystemFilePicker();
    }

    /** Handle SAF import result — reads file and imports settings */
    public void handleFilePickerResult(android.content.Intent data) {
        _safPickerHelper.handleImportResult(data);
    }

    /** Open SAF import picker for PGN */
    @JavascriptInterface
    public void openPGNFilePicker() {
        _safPickerHelper.openPGNFilePicker();
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

    /** Handle SAF PGN import result — reads file and calls onPGNFileRead JS callback */
    public void handlePGNFilePickerResult(android.content.Intent data) {
        _safPickerHelper.handlePGNImportResult(data);
    }
}
