/*
 * Regalia - Engine JNI Bridge
 * Copyright (C) 2026 Regalia
 *
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Osterlund (original DroidFish logic:
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
 * v1.0.2 REDUNDANCY (audit): the v18.5.0 release removed the engine-import
 * feature. The 500+ lines implementing dlopen/pipe/pthread engine loading
 * (nativeLoadEngine, nativeStartEngine, nativeSendCommand, nativeReadOutput,
 * nativeDestroyEngine, nativeIsEngineRunning, nativeGetEngineEntryType, plus
 * findEngineEntryPoint + engineThreadFunc + EngineHandle/EngineEntryType
 * structs) became dead code -- StockfishNative.java declares ONLY nativeChmod.
 * This file now contains only that one function.
 * (v1.2.3 round-48, RED-3: the nativeRenice implementation was removed too --
 *  round-47 (S1144) had already deleted its Java declaration, leaving the C++
 *  function an orphan exported symbol with no caller.)
 *
 * Architecture (remaining):
 *   1. Java calls nativeChmod(path) -> sets file permissions to 0700 (DroidFish pattern)
 *
 * The Stockfish engine binary is packaged as libstockfish.so and executed
 * via ProcessBuilder -- no dlopen/JNI entry-point invocation is involved.
 */

#include <jni.h>
#include <android/log.h>
#include <unistd.h>
#include <string.h>
#include <errno.h>
#include <sys/stat.h>

#define TAG "EngineJniBridge"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)
#define LOGW(...) __android_log_print(ANDROID_LOG_WARN, TAG, __VA_ARGS__)

/**
 * Native chmod -- sets file permissions to 0700 (rwx------).
 * Derived from DroidFish EngineUtil.chmod() (nativeutil.cpp).
 * Copyright (C) Peter Osterlund (original DroidFish logic).
 * Modified by Regalia on 2026-06-12.
 *
 * SECURITY FIX v1.0.3: Changed from 0744 (rwxr--r--) to 0700 (rwx------).
 *   - 0744 granted "others" read permission, allowing any user/process on
 *     the device to read the engine binary (information disclosure risk).
 *   - 0700 restricts access to the file owner only, following the principle
 *     of least privilege. The engine binary only needs to be accessible by
 *     the app that owns it.
 *   - SonarCloud Hotspot #7: https://github.com/YDW99/Regalia/issues/34
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
    // v1.2.3 round-37 (SonarCloud cpp:S4962): use nullptr instead of NULL
    //   for type-safe null pointer constant (C++11). Behavior is identical
    //   for GetStringUTFChars (it accepts jboolean* or nullptr).
    const char* path = env->GetStringUTFChars(jPath, nullptr);
    if (!path) return JNI_FALSE;
    int result = chmod(path, 0700);
    // v1.2.3 P2 (Round 17 P2-4): Log errno on chmod failure. Previously a
    //   silent JNI_FALSE return left no diagnostic trail — a chmod failure
    //   (e.g. ENOENT for a race-deleted file, EACCES for a read-only fs,
    //   EPERM for SELinux denial) was indistinguishable from success at the
    //   Java layer except by the boolean return. Logging errno + strerror
    //   here lets logcat pinpoint the cause during engine-binary setup.
    if (result != 0) {
        // v1.2.3 round-44 (F5): snapshot errno + strerror_r (plain strerror
        //   uses a shared static buffer — not thread-safe).
        int saved_errno = errno;
        char errbuf[256];
        strerror_r(saved_errno, errbuf, sizeof(errbuf));
        LOGE("nativeChmod failed for %s: %s (errno=%d)", path, errbuf, saved_errno);
    }
    env->ReleaseStringUTFChars(jPath, path);
    return (result == 0) ? JNI_TRUE : JNI_FALSE;
}

// v1.2.3 round-48 (RED-3): the Java_com_Regalia_StockfishNative_nativeRenice
//   implementation was deleted here — round-47 (S1144) removed the
//   `nativeRenice` declaration from StockfishNative.java (no Java callers),
//   so the C++ function was an orphan exported symbol. Along with it went
//   <sys/resource.h> (only setpriority/PRIO_* used it).
