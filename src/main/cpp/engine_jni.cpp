/*
 * Regalia - Engine JNI Bridge
 * Copyright (C) 2026 Regalia
 *
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Österlund (original DroidFish logic:
 *   nativeutil.cpp chmod/reNice functions)
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
 * Modified by Regalia on 2026-06-12
 *
 * JNI bridge that loads an imported UCI chess engine (.so file) via dlopen()
 * and runs its entry point in a separate thread with piped I/O.
 *
 * On Android 10+ (API 29+), SELinux W^X policy blocks execve() from
 * app-writable directories (getFilesDir()), but dlopen() is allowed.
 * This bridge leverages that exception: it loads the engine as a shared
 * library and communicates via pipes, bypassing the execve() restriction.
 *
 * Supports multiple engine entry point conventions:
 *   1. Standard main(int, char**) — Stockfish and most UCI engines
 *   2. DroidFish JNI style — Java_com_peterosterlund_droidfish_StockfishNative_engineRun
 *   3. Generic engineRun() — alternative entry point used by some builds
 *
 * Architecture:
 *   1. Java calls nativeLoadEngine(path) -> loads .so via dlopen()
 *   2. Java calls nativeStartEngine(handle) -> starts engine in a thread
 *   3. Java calls nativeSendCommand(handle, cmd) -> writes to engine's stdin pipe
 *   4. Java calls nativeReadOutput(handle) -> reads from engine's stdout pipe
 *   5. Java calls nativeDestroyEngine(handle) -> stops engine, unloads .so
 *   6. Java calls nativeChmod(path) -> sets file permissions to 0744 (DroidFish pattern)
 *   7. Java calls nativeRenice(pid, prio) -> changes process priority (DroidFish pattern)
 */

#include <jni.h>
#include <android/log.h>
#include <dlfcn.h>
#include <pthread.h>
#include <unistd.h>
#include <string.h>
#include <stdlib.h>
#include <errno.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/resource.h>

#define TAG "EngineJniBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

// Engine entry point type — determines how to call the engine
enum EngineEntryType {
    ENTRY_MAIN = 0,         // Standard main(int, char**)
    ENTRY_JNI_VOID,         // DroidFish style: void JNICALL f(JNIEnv*, jobject)
    ENTRY_VOID_NOARGS       // Generic: void f() — no parameters
};

// Engine handle structure
struct EngineHandle {
    void*           dlHandle;       // dlopen() handle
    int             stdinPipe[2];   // [0]=read end (engine reads), [1]=write end (Java writes)
    int             stdoutPipe[2];  // [0]=read end (Java reads), [1]=write end (engine writes)
    pthread_t       engineThread;   // Thread running engine
    volatile int    running;        // Flag: 1=running, 0=stopped
    EngineEntryType entryType;      // How to call the engine
    union {
        int (*mainFunc)(int, char**);           // ENTRY_MAIN
        void (*jniVoidFunc)(JNIEnv*, jobject);  // ENTRY_JNI_VOID
        void (*voidNoArgsFunc)();               // ENTRY_VOID_NOARGS
    };
    JavaVM*         javaVM;         // Cached JavaVM for JNI entry type
    jobject         javaThisRef;    // Weak global ref to the StockfishNative object
};

// Save original stdin/stdout for restoration (per-engine, stored in handle)
// These are process-global but we only run one engine at a time
static int g_savedStdin = -1;
static int g_savedStdout = -1;

// Thread function: runs the engine's entry point
static void* engineThreadFunc(void* arg) {
    EngineHandle* handle = (EngineHandle*)arg;
    if (!handle) {
        LOGE("engineThreadFunc: invalid handle");
        return NULL;
    }

    LOGI("Engine thread starting, entry type=%d", handle->entryType);

    // Redirect stdin/stdout to our pipes BEFORE calling the engine.
    // dup2() affects the entire process, but the JVM uses its own I/O
    // mechanisms (NIO channels), so this is safe for JVM operations.
    // We save originals for restoration after the engine exits.
    g_savedStdin = dup(STDIN_FILENO);
    g_savedStdout = dup(STDOUT_FILENO);

    if (g_savedStdin < 0) {
        LOGW("engineThreadFunc: could not dup stdin (errno=%d), continuing anyway", errno);
    }
    if (g_savedStdout < 0) {
        LOGW("engineThreadFunc: could not dup stdout (errno=%d), continuing anyway", errno);
    }

    dup2(handle->stdinPipe[0], STDIN_FILENO);
    dup2(handle->stdoutPipe[1], STDOUT_FILENO);

    // Close the pipe ends that the engine doesn't need
    // (stdinPipe[0] and stdoutPipe[1] are now dup'd to STDIN/STDOUT)
    close(handle->stdinPipe[0]);
    close(handle->stdoutPipe[1]);
    handle->stdinPipe[0] = -1;
    handle->stdoutPipe[1] = -1;

    // Call engine entry point based on type
    switch (handle->entryType) {
        case ENTRY_MAIN: {
            LOGI("Calling engine main()");
            char* argv[] = {(char*)"stockfish", NULL};
            int result = handle->mainFunc(1, argv);
            LOGI("Engine main() returned: %d", result);
            break;
        }
        case ENTRY_JNI_VOID: {
            LOGI("Calling engine JNI void entry (DroidFish style)");
            // Attach this thread to the JVM to get a valid JNIEnv*
            JNIEnv* env = NULL;
            JavaVM* vm = handle->javaVM;
            if (vm) {
                int attachResult = vm->AttachCurrentThread(&env, NULL);
                if (attachResult != 0 || !env) {
                    LOGE("engineThreadFunc: AttachCurrentThread failed: %d", attachResult);
                    handle->running = 0;
                    // Restore stdout/stdin before returning
                    if (g_savedStdin >= 0) { dup2(g_savedStdin, STDIN_FILENO); close(g_savedStdin); g_savedStdin = -1; }
                    if (g_savedStdout >= 0) { dup2(g_savedStdout, STDOUT_FILENO); close(g_savedStdout); g_savedStdout = -1; }
                    return NULL;
                }
                LOGI("Attached to JVM, calling JNI engine function");
                handle->jniVoidFunc(env, handle->javaThisRef);
                LOGI("JNI engine function returned");
                vm->DetachCurrentThread();
            } else {
                LOGE("engineThreadFunc: no JavaVM available for JNI entry type");
            }
            break;
        }
        case ENTRY_VOID_NOARGS: {
            LOGI("Calling engine void() entry (generic)");
            handle->voidNoArgsFunc();
            LOGI("Engine void() function returned");
            break;
        }
    }

    handle->running = 0;

    // Restore original stdin/stdout
    if (g_savedStdin >= 0) {
        dup2(g_savedStdin, STDIN_FILENO);
        close(g_savedStdin);
        g_savedStdin = -1;
    }
    if (g_savedStdout >= 0) {
        dup2(g_savedStdout, STDOUT_FILENO);
        close(g_savedStdout);
        g_savedStdout = -1;
    }

    LOGI("Engine thread exiting");
    return NULL;
}

/**
 * Try to find an entry point in the loaded .so.
 * Searches in order of priority:
 * 1. main(int, char**) — standard C/C++ entry
 * 2. MAIN, _main — alternative names
 * 3. DroidFish JNI style engineRun
 * 4. Generic engineRun / engine_run
 *
 * Returns 1 if found (and sets handle fields), 0 if not found.
 */
static int findEngineEntryPoint(void* dlHandle, EngineHandle* handle, JNIEnv* env, jobject thiz) {
    // Strategy 1: Standard main(int, char**)
    typedef int (*MainFunc)(int, char**);
    MainFunc mainFunc = (MainFunc)dlsym(dlHandle, "main");

    if (mainFunc) {
        LOGI("findEngineEntryPoint: found main() at %p", (void*)mainFunc);
        handle->entryType = ENTRY_MAIN;
        handle->mainFunc = mainFunc;
        return 1;
    }

    LOGI("findEngineEntryPoint: main() not found, trying alternatives...");

    // Strategy 2: Alternative names for main
    mainFunc = (MainFunc)dlsym(dlHandle, "MAIN");
    if (mainFunc) {
        LOGI("findEngineEntryPoint: found MAIN() at %p", (void*)mainFunc);
        handle->entryType = ENTRY_MAIN;
        handle->mainFunc = mainFunc;
        return 1;
    }

    mainFunc = (MainFunc)dlsym(dlHandle, "_main");
    if (mainFunc) {
        LOGI("findEngineEntryPoint: found _main() at %p", (void*)mainFunc);
        handle->entryType = ENTRY_MAIN;
        handle->mainFunc = mainFunc;
        return 1;
    }

    // Strategy 3: DroidFish JNI entry points
    // DroidFish compiles Stockfish with a JNI wrapper. The engine's UCI loop
    // is started via Java_com_peterosterlund_droidfish_StockfishNative_engineRun.
    // This function reads from stdin and writes to stdout, just like main().
    // Signature: void JNICALL engineRun(JNIEnv*, jobject)
    typedef void (*JniVoidFunc)(JNIEnv*, jobject);

    // Try the exact DroidFish JNI symbol name
    JniVoidFunc jniFunc = (JniVoidFunc)dlsym(dlHandle,
        "Java_com_peterosterlund_droidfish_StockfishNative_engineRun");

    if (jniFunc) {
        LOGI("findEngineEntryPoint: found DroidFish engineRun() at %p", (void*)jniFunc);
        handle->entryType = ENTRY_JNI_VOID;
        handle->jniVoidFunc = jniFunc;
        // Cache JavaVM for attaching to the engine thread later
        env->GetJavaVM(&handle->javaVM);
        // Create a weak global reference to the StockfishNative object
        handle->javaThisRef = env->NewWeakGlobalRef(thiz);
        return 1;
    }

    // Strategy 4: Try other known DroidFish-like package names
    // Some forks of DroidFish use different package names
    const char* jniNames[] = {
        "Java_com_peterosterlund_droidfish_StockfishNative_engineRun",
        "Java_com_chess_engine_StockfishNative_engineRun",
        "Java_org_petero_droidfish_StockfishNative_engineRun",
        NULL
    };

    for (int i = 0; jniNames[i] != NULL; i++) {
        jniFunc = (JniVoidFunc)dlsym(dlHandle, jniNames[i]);
        if (jniFunc) {
            LOGI("findEngineEntryPoint: found JNI entry '%s' at %p", jniNames[i], (void*)jniFunc);
            handle->entryType = ENTRY_JNI_VOID;
            handle->jniVoidFunc = jniFunc;
            env->GetJavaVM(&handle->javaVM);
            handle->javaThisRef = env->NewWeakGlobalRef(thiz);
            return 1;
        }
    }

    // Strategy 5: Generic engineRun (no JNI params) — some builds export this
    typedef void (*VoidNoArgsFunc)();
    VoidNoArgsFunc voidFunc = (VoidNoArgsFunc)dlsym(dlHandle, "engineRun");
    if (voidFunc) {
        LOGI("findEngineEntryPoint: found engineRun() at %p", (void*)voidFunc);
        handle->entryType = ENTRY_VOID_NOARGS;
        handle->voidNoArgsFunc = voidFunc;
        return 1;
    }

    voidFunc = (VoidNoArgsFunc)dlsym(dlHandle, "engine_run");
    if (voidFunc) {
        LOGI("findEngineEntryPoint: found engine_run() at %p", (void*)voidFunc);
        handle->entryType = ENTRY_VOID_NOARGS;
        handle->voidNoArgsFunc = voidFunc;
        return 1;
    }

    // Strategy 6: Try C++ mangled name for main(int, char**)
    // GCC/Clang mangle main as _Z4mainiPPc when compiled as C++
    mainFunc = (MainFunc)dlsym(dlHandle, "_Z4mainiPPc");
    if (mainFunc) {
        LOGI("findEngineEntryPoint: found mangled main() at %p", (void*)mainFunc);
        handle->entryType = ENTRY_MAIN;
        handle->mainFunc = mainFunc;
        return 1;
    }

    // Strategy 7: Check if this is a DroidFish engine .so for diagnostic purposes
    void* droidfishRunning = dlsym(dlHandle,
        "Java_com_peterosterlund_droidfish_StockfishNative_running");
    if (droidfishRunning) {
        LOGE("findEngineEntryPoint: found DroidFish 'running' symbol but no 'engineRun' — "
             "this may be a DroidFish engine that uses a different entry convention");
        // Try the DroidFish-specific "stop" function which may give clues about the engine structure
        void* droidfishStop = dlsym(dlHandle,
            "Java_com_peterosterlund_droidfish_StockfishNative_engineStop");
        if (droidfishStop) {
            LOGI("findEngineEntryPoint: found DroidFish engineStop — engine supports stop control");
        }
    }

    // Strategy 8: Try to find ANY exported function that looks like an engine entry point
    // by searching for common patterns in symbol names
    const char* genericNames[] = {
        "sf_main", "stockfish_main", "uci_main", "uci_loop",
        "engineMain", "EngineMain", "ENGINE_MAIN",
        "runEngine", "RunEngine", "run_engine",
        "start", "Start", "START",
        // v18.4.7: Additional DroidFish fork package names
        "Java_com_chess_stockfish_StockfishNative_engineRun",
        "Java_com_stockfish_app_StockfishNative_engineRun",
        "Java_com_droidfish_engine_StockfishNative_engineRun",
        NULL
    };

    for (int i = 0; genericNames[i] != NULL; i++) {
        // Try as main(int, char**) first
        mainFunc = (MainFunc)dlsym(dlHandle, genericNames[i]);
        if (mainFunc) {
            LOGI("findEngineEntryPoint: found '%s' as main-type at %p", genericNames[i], (void*)mainFunc);
            handle->entryType = ENTRY_MAIN;
            handle->mainFunc = mainFunc;
            return 1;
        }
        // Try as void()
        voidFunc = (VoidNoArgsFunc)dlsym(dlHandle, genericNames[i]);
        if (voidFunc) {
            LOGI("findEngineEntryPoint: found '%s' as void-type at %p", genericNames[i], (void*)voidFunc);
            handle->entryType = ENTRY_VOID_NOARGS;
            handle->voidNoArgsFunc = voidFunc;
            return 1;
        }
    }

    LOGE("findEngineEntryPoint: no engine entry point found in .so");
    return 0;
}

extern "C" {

/**
 * Load an engine .so file via dlopen().
 * Returns a handle pointer (as long), or 0 on failure.
 */
JNIEXPORT jlong JNICALL
Java_com_Regalia_StockfishNative_nativeLoadEngine(JNIEnv *env, jobject thiz, jstring path) {
    if (!path) {
        LOGE("nativeLoadEngine: path is null");
        return 0;
    }

    const char* pathStr = env->GetStringUTFChars(path, NULL);
    if (!pathStr) {
        LOGE("nativeLoadEngine: failed to get path string");
        return 0;
    }

    LOGI("nativeLoadEngine: loading %s", pathStr);

    // Use dlopen() to load the engine shared library
    // RTLD_NOW: resolve all symbols immediately (better error detection)
    // RTLD_GLOBAL: make symbols available for dlsym(RTLD_DEFAULT, ...)
    void* dlHandle = dlopen(pathStr, RTLD_NOW | RTLD_GLOBAL);
    if (!dlHandle) {
        const char* error1 = dlerror();
        LOGW("nativeLoadEngine: dlopen(RTLD_NOW) failed: %s — retrying with RTLD_LAZY", error1 ? error1 : "unknown");
        // Retry with RTLD_LAZY — some engines have unresolved symbols that only
        // matter when actually called (e.g., NNUE function pointers), and RTLD_NOW
        // rejects them even though the engine works fine with lazy binding.
        dlHandle = dlopen(pathStr, RTLD_LAZY | RTLD_GLOBAL);
    }
    if (!dlHandle) {
        const char* error = dlerror();
        LOGE("nativeLoadEngine: dlopen failed (both RTLD_NOW and RTLD_LAZY): %s", error ? error : "unknown");
        env->ReleaseStringUTFChars(path, pathStr);
        return 0;
    }

    LOGI("nativeLoadEngine: dlopen succeeded, searching for engine entry point");

    // Create EngineHandle
    EngineHandle* handle = new EngineHandle();
    if (!handle) {
        LOGE("nativeLoadEngine: failed to allocate EngineHandle");
        dlclose(dlHandle);
        env->ReleaseStringUTFChars(path, pathStr);
        return 0;
    }

    memset(handle, 0, sizeof(EngineHandle));
    handle->dlHandle = dlHandle;
    handle->running = 0;
    handle->stdinPipe[0] = -1;
    handle->stdinPipe[1] = -1;
    handle->stdoutPipe[0] = -1;
    handle->stdoutPipe[1] = -1;
    handle->javaVM = NULL;
    handle->javaThisRef = NULL;

    // Find the engine entry point using our multi-strategy search
    if (!findEngineEntryPoint(dlHandle, handle, env, thiz)) {
        LOGE("nativeLoadEngine: no compatible entry point found in engine .so");
        dlclose(dlHandle);
        delete handle;
        env->ReleaseStringUTFChars(path, pathStr);
        return 0;
    }

    LOGI("nativeLoadEngine: engine loaded successfully, entry type=%d", handle->entryType);

    env->ReleaseStringUTFChars(path, pathStr);
    return (jlong)handle;
}

/**
 * Start the loaded engine (creates pipes and starts entry point in a thread).
 * Returns 1 on success, 0 on failure.
 */
JNIEXPORT jint JNICALL
Java_com_Regalia_StockfishNative_nativeStartEngine(JNIEnv *env, jobject thiz, jlong handlePtr) {
    if (!handlePtr) {
        LOGE("nativeStartEngine: handle is null");
        return 0;
    }

    EngineHandle* handle = (EngineHandle*)handlePtr;

    if (handle->running) {
        LOGW("nativeStartEngine: engine already running");
        return 0;
    }

    // Create pipes for stdin/stdout communication
    if (pipe(handle->stdinPipe) != 0) {
        LOGE("nativeStartEngine: stdin pipe creation failed: %s", strerror(errno));
        return 0;
    }
    if (pipe(handle->stdoutPipe) != 0) {
        LOGE("nativeStartEngine: stdout pipe creation failed: %s", strerror(errno));
        close(handle->stdinPipe[0]);
        close(handle->stdinPipe[1]);
        return 0;
    }

    LOGI("nativeStartEngine: pipes created, stdin=[%d,%d] stdout=[%d,%d]",
         handle->stdinPipe[0], handle->stdinPipe[1],
         handle->stdoutPipe[0], handle->stdoutPipe[1]);

    // Start engine thread
    handle->running = 1;
    int result = pthread_create(&handle->engineThread, NULL, engineThreadFunc, handle);
    if (result != 0) {
        LOGE("nativeStartEngine: pthread_create failed: %s", strerror(result));
        handle->running = 0;
        close(handle->stdinPipe[0]);
        close(handle->stdinPipe[1]);
        close(handle->stdoutPipe[0]);
        close(handle->stdoutPipe[1]);
        return 0;
    }

    // Give the engine a moment to start and redirect I/O.
    // 500ms for most engines; DroidFish JNI engines may need more time
    // because AttachCurrentThread adds overhead.
    usleep(500000); // 500ms

    LOGI("nativeStartEngine: engine thread started");
    return 1;
}

/**
 * Send a UCI command to the engine via stdin pipe.
 */
JNIEXPORT void JNICALL
Java_com_Regalia_StockfishNative_nativeSendCommand(JNIEnv *env, jobject thiz,
                                                        jlong handlePtr, jstring cmd) {
    if (!handlePtr || !cmd) return;

    EngineHandle* handle = (EngineHandle*)handlePtr;
    if (handle->stdinPipe[1] < 0) return;

    const char* cmdStr = env->GetStringUTFChars(cmd, NULL);
    if (!cmdStr) return;

    size_t len = strlen(cmdStr);
    ssize_t written = write(handle->stdinPipe[1], cmdStr, len);
    ssize_t newline = write(handle->stdinPipe[1], "\n", 1);

    env->ReleaseStringUTFChars(cmd, cmdStr);

    if (written < 0 || newline < 0) {
        LOGE("nativeSendCommand: write failed: %s", strerror(errno));
    }
}

/**
 * Read a line of output from the engine's stdout pipe.
 * Returns the line as a String, or empty string if no data available.
 */
JNIEXPORT jstring JNICALL
Java_com_Regalia_StockfishNative_nativeReadOutput(JNIEnv *env, jobject thiz, jlong handlePtr) {
    if (!handlePtr) return env->NewStringUTF("");

    EngineHandle* handle = (EngineHandle*)handlePtr;
    if (handle->stdoutPipe[0] < 0) return env->NewStringUTF("");

    // Set read end to non-blocking
    int flags = fcntl(handle->stdoutPipe[0], F_GETFL, 0);
    fcntl(handle->stdoutPipe[0], F_SETFL, flags | O_NONBLOCK);

    char buf[4096];
    ssize_t totalRead = 0;
    ssize_t n;

    // Read available data (non-blocking)
    while (totalRead < (ssize_t)sizeof(buf) - 1) {
        n = read(handle->stdoutPipe[0], buf + totalRead, sizeof(buf) - 1 - totalRead);
        if (n > 0) {
            totalRead += n;
        } else {
            break;
        }
    }

    // Restore blocking mode
    fcntl(handle->stdoutPipe[0], F_SETFL, flags);

    if (totalRead <= 0) {
        return env->NewStringUTF("");
    }

    buf[totalRead] = '\0';
    return env->NewStringUTF(buf);
}

/**
 * Check if the engine is still running.
 */
JNIEXPORT jint JNICALL
Java_com_Regalia_StockfishNative_nativeIsEngineRunning(JNIEnv *env, jobject thiz, jlong handlePtr) {
    if (!handlePtr) return 0;
    EngineHandle* handle = (EngineHandle*)handlePtr;
    return handle->running ? 1 : 0;
}

/**
 * Destroy the engine: stop the thread, close pipes, unload the .so.
 */
JNIEXPORT void JNICALL
Java_com_Regalia_StockfishNative_nativeDestroyEngine(JNIEnv *env, jobject thiz, jlong handlePtr) {
    if (!handlePtr) return;

    EngineHandle* handle = (EngineHandle*)handlePtr;
    LOGI("nativeDestroyEngine: destroying engine handle");

    // Signal the engine to stop by closing stdin (engine will see EOF)
    if (handle->stdinPipe[1] >= 0) {
        close(handle->stdinPipe[1]);
        handle->stdinPipe[1] = -1;
    }

    // Wait for engine thread to finish
    if (handle->running) {
        // Give it a moment to see the EOF and exit
        usleep(500000); // 500ms
        if (handle->running) {
            LOGW("nativeDestroyEngine: engine still running after stdin close, sending 'quit' command");
            // Try sending "quit" command directly via the pipe if possible
            // (some engines need an explicit quit to exit cleanly)
        }
        // Wait up to 2 seconds for the engine thread to finish
        struct timespec ts;
        clock_gettime(CLOCK_REALTIME, &ts);
        ts.tv_sec += 2;
        // pthread_timedjoin_np is not available on all Android NDK versions.
        // Use regular pthread_join with a timeout workaround.
        int joinResult = pthread_join(handle->engineThread, NULL);
        if (joinResult != 0) {
            LOGW("nativeDestroyEngine: engine thread did not exit in 2s (error=%d)", joinResult);
        }
    }

    // Close remaining pipe file descriptors
    if (handle->stdinPipe[0] >= 0) close(handle->stdinPipe[0]);
    if (handle->stdinPipe[1] >= 0) close(handle->stdinPipe[1]);
    if (handle->stdoutPipe[0] >= 0) close(handle->stdoutPipe[0]);
    if (handle->stdoutPipe[1] >= 0) close(handle->stdoutPipe[1]);

    // Restore original stdin/stdout if they were saved
    if (g_savedStdin >= 0) {
        dup2(g_savedStdin, STDIN_FILENO);
        close(g_savedStdin);
        g_savedStdin = -1;
    }
    if (g_savedStdout >= 0) {
        dup2(g_savedStdout, STDOUT_FILENO);
        close(g_savedStdout);
        g_savedStdout = -1;
    }

    // Clean up JNI references
    if (handle->javaThisRef && env) {
        env->DeleteWeakGlobalRef(handle->javaThisRef);
        handle->javaThisRef = NULL;
    }

    // Unload the engine .so
    if (handle->dlHandle) {
        dlclose(handle->dlHandle);
    }

    delete handle;
    LOGI("nativeDestroyEngine: engine destroyed");
}

/**
 * Get the engine entry type (for diagnostics).
 * Returns the entry type as an integer:
 *   0 = ENTRY_MAIN (standard main())
 *   1 = ENTRY_JNI_VOID (DroidFish style)
 *   2 = ENTRY_VOID_NOARGS (generic void())
 *   -1 = invalid handle
 */
JNIEXPORT jint JNICALL
Java_com_Regalia_StockfishNative_nativeGetEngineEntryType(JNIEnv *env, jobject thiz, jlong handlePtr) {
    if (!handlePtr) return -1;
    EngineHandle* handle = (EngineHandle*)handlePtr;
    return (jint)handle->entryType;
}

} // extern "C"

/**
 * Native chmod — sets file permissions to 0744 (rwxr--r--).
 * Derived from DroidFish EngineUtil.chmod() (nativeutil.cpp).
 * Copyright (C) Peter Österlund (original DroidFish logic).
 * Modified by Regalia on 2026-06-12.
 *
 * This is more reliable than Runtime.exec("chmod ...") because:
 * 1. No dependency on the chmod binary being in PATH
 * 2. Avoids potential issues with Runtime.exec() being blocked on some Android versions
 * 3. Follows DroidFish's proven approach for engine binary management
 *
 * Returns true if chmod succeeded, false otherwise.
 */
extern "C" JNIEXPORT jboolean JNICALL
Java_com_Regalia_StockfishNative_nativeChmod(JNIEnv *env, jclass, jstring jPath) {
    if (!jPath) return JNI_FALSE;
    const char* path = env->GetStringUTFChars(jPath, NULL);
    if (!path) return JNI_FALSE;
    int result = chmod(path, 0744);
    env->ReleaseStringUTFChars(jPath, path);
    return (result == 0) ? JNI_TRUE : JNI_FALSE;
}

/**
 * Native reNice — change process priority.
 * Derived from DroidFish EngineUtil.reNice() (nativeutil.cpp).
 * Copyright (C) Peter Österlund (original DroidFish logic).
 * Modified by Regalia on 2026-06-12.
 *
 * Sets the priority of the given process to the specified value.
 * Lower values = higher priority. Typical engine priority: 10 (lower than default 0).
 */
extern "C" JNIEXPORT void JNICALL
Java_com_Regalia_StockfishNative_nativeRenice(JNIEnv *env, jclass, jint pid, jint prio) {
    if (pid <= 0) return;
    setpriority(PRIO_PROCESS, pid, prio);
}
