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
 * structs) became dead code -- StockfishNative.java declares ONLY nativeChmod
 * and nativeRenice. This file now contains only those two functions.
 *
 * Architecture (remaining):
 *   1. Java calls nativeChmod(path) -> sets file permissions to 0700 (DroidFish pattern)
 *   2. Java calls nativeRenice(pid, prio) -> changes process priority (DroidFish pattern)
 *
 * The Stockfish engine binary is packaged as libstockfish.so and executed
 * via ProcessBuilder -- no dlopen/JNI entry-point invocation is involved.
 */

#include <jni.h>
#include <android/log.h>
#include <unistd.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/resource.h>

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
    const char* path = env->GetStringUTFChars(jPath, NULL);
    if (!path) return JNI_FALSE;
    int result = chmod(path, 0700);
    env->ReleaseStringUTFChars(jPath, path);
    return (result == 0) ? JNI_TRUE : JNI_FALSE;
}

/**
 * Native reNice -- change process priority.
 * Derived from DroidFish EngineUtil.reNice() (nativeutil.cpp).
 * Copyright (C) Peter Osterlund (original DroidFish logic).
 * Modified by Regalia on 2026-06-12.
 *
 * Sets the priority of the given process to the specified value.
 * Lower values = higher priority. Typical engine priority: 10 (lower than default 0).
 *
 * v1.0.2: declared for API completeness (StockfishNative.java still declares
 * `private static native void nativeRenice(int pid, int prio);`). Currently
 * no caller invokes it -- kept to avoid changing the JNI symbol surface and
 * to preserve the DroidFish-derived pattern for future use.
 */
extern "C" JNIEXPORT void JNICALL
Java_com_Regalia_StockfishNative_nativeRenice(JNIEnv *env, jclass, jint pid, jint prio) {
    if (pid <= 0) return;
    setpriority(PRIO_PROCESS, pid, prio);
}
