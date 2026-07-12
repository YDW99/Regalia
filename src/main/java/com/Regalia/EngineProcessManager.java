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
 *         Encapsulates engine process lifecycle: start/stop/restart, binary
 *         extraction from APK/assets, chmod/renice, and process health checks.
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

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * EngineProcessManager — 引擎进程管理器 (v1.2.0 Phase 73)
 *
 * 职责:
 *   - 引擎二进制文件定位与提取（nativeLibraryDir / APK / assets）
 *   - 引擎进程启停（ProcessBuilder）
 *   - 进程健康检查（isAlive / destroyForcibly）
 *   - 文件可执行权限设置（nativeChmod / File.setExecutable / chmod 命令）
 *   - ELF 文件头校验
 *   - 进程资源清理（流关闭、线程中断）
 *
 * 设计原则:
 *   - 所有 InterruptedException 均重新设置中断标志（SonarCloud B07-B38 修复）
 *   - 所有 delete()/renameTo() 返回值均被检查（SonarCloud B27-B35 修复）
 *   - 进程销毁使用 API 兼容的 isProcessAlive/destroyForciblySafe
 */
public class EngineProcessManager {
    private static final String TAG = "EngineProcessManager";

    private static final String ENGINE_LIB_NAME = "libstockfish.so";

    private final Context context;
    private final ChmodProvider chmodProvider;

    /** 引擎进程 */
    private Process engineProcess;
    /** 引擎读取器 */
    private BufferedReader engineReader;
    /** 引擎写入器 */
    private OutputStreamWriter engineWriter;
    /** 读取线程 */
    private Thread readerThread;
    /** 当前引擎路径 */
    private String currentEnginePath;

    /** chmod 提供者接口（由 StockfishNative 提供 JNI 实现） */
    public interface ChmodProvider {
        boolean nativeChmod(String path);
        boolean isEnglishMode();
        void postProgress(int pct, String message);
    }

    public EngineProcessManager(Context context, ChmodProvider chmodProvider) {
        this.context = context.getApplicationContext();
        this.chmodProvider = chmodProvider;
    }

    /** 获取引擎进程 */
    public Process getEngineProcess() {
        return engineProcess;
    }

    /** 设置引擎进程（用于 UCI 握手后保留引用） */
    public void setEngineProcess(Process process) {
        this.engineProcess = process;
    }

    public BufferedReader getEngineReader() {
        return engineReader;
    }

    public void setEngineReader(BufferedReader reader) {
        this.engineReader = reader;
    }

    public OutputStreamWriter getEngineWriter() {
        return engineWriter;
    }

    public void setEngineWriter(OutputStreamWriter writer) {
        this.engineWriter = writer;
    }

    public Thread getReaderThread() {
        return readerThread;
    }

    public void setReaderThread(Thread thread) {
        this.readerThread = thread;
    }

    public String getCurrentEnginePath() {
        return currentEnginePath;
    }

    /** 检查进程是否存活（API 兼容版） */
    public boolean isProcessAlive() {
        if (engineProcess == null) return false;
        try {
            engineProcess.exitValue();
            return false;
        } catch (IllegalThreadStateException e) {
            return true;
        }
    }

    /** 强制销毁进程（API 兼容版） */
    public void destroyForciblySafe() {
        if (engineProcess == null) return;
        try {
            engineProcess.destroy();
        } catch (Throwable ignored) {
            // 销毁失败不阻塞流程
        }
    }

    /** 解析引擎二进制文件路径 */
    public File resolveEngineBinary() {
        // 1. 优先使用 nativeLibraryDir（extractNativeLibs="true" 时已解压且可执行）
        try {
            ApplicationInfo appInfo = context.getApplicationInfo();
            if (appInfo != null && appInfo.nativeLibraryDir != null) {
                File nativeDir = new File(appInfo.nativeLibraryDir);
                if (nativeDir.isDirectory()) {
                    File[] candidates = nativeDir.listFiles();
                    if (candidates != null) {
                        for (File f : candidates) {
                            String name = f.getName();
                            if (name.equals(ENGINE_LIB_NAME) || name.equals("stockfish")
                                    || name.startsWith("stockfish")) {
                                if (f.canExecute() || f.canRead()) {
                                    Log.i(TAG, "Using engine from nativeLibraryDir: " + f.getAbsolutePath());
                                    currentEnginePath = f.getAbsolutePath();
                                    return f;
                                }
                            }
                        }
                    }
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "nativeLibraryDir lookup failed", e);
        }

        // 2. 从 APK 提取
        File fromApk = extractEngineFromApk();
        if (fromApk != null) return fromApk;

        return null;
    }

    /** 从 APK 提取引擎二进制 */
    public File extractEngineFromApk() {
        File destFile = new File(context.getFilesDir(), ENGINE_LIB_NAME);

        // 验证缓存文件的 ELF 头
        if (destFile.exists() && destFile.length() > 50000000 && isElfFile(destFile)) {
            Log.i(TAG, "Using previously extracted engine: " + destFile.getAbsolutePath()
                    + " size=" + destFile.length());
            makeExecutable(destFile);
            currentEnginePath = destFile.getAbsolutePath();
            return destFile;
        }

        // 尝试从 assets 提取
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

            chmodProvider.postProgress(12, chmodProvider.isEnglishMode()
                    ? "Extracting engine from APK..."
                    : "\u6b63\u5728\u4ece\u5b89\u88c5\u5305\u63d0\u53d6\u5f15\u64ce...");
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
                     FileOutputStream out = new FileOutputStream(destFile)) {
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
                            chmodProvider.postProgress(pct, (chmodProvider.isEnglishMode()
                                    ? "Extracting engine... "
                                    : "\u6b63\u5728\u63d0\u53d6\u5f15\u64ce... ")
                                    + (total / 1048576) + "MB/" + (entry.getSize() / 1048576) + "MB");
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
                    // v1.2.0 Phase 73 (SonarCloud B27): 检查 delete() 返回值
                    if (!destFile.delete()) {
                        Log.w(TAG, "Failed to delete corrupted engine file: " + destFile.getAbsolutePath());
                    }
                }
            } else {
                Log.e(TAG, "Extracted engine file is invalid (size="
                        + (destFile.exists() ? destFile.length() : 0) + ")");
                // v1.2.0 Phase 73 (SonarCloud B28): 检查 delete() 返回值
                if (!destFile.delete()) {
                    Log.w(TAG, "Failed to delete invalid engine file: " + destFile.getAbsolutePath());
                }
            }
        } catch (Throwable e) {
            Log.e(TAG, "Failed to extract engine from APK", e);
        }
        return null;
    }

    /** 从 assets/engines/ 提取引擎二进制 */
    public File extractEngineFromAssets() {
        File destFile = new File(context.getFilesDir(), ENGINE_LIB_NAME);

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
             FileOutputStream out = new FileOutputStream(destFile)) {
            byte[] buffer = new byte[262144];
            int len;
            long total = 0;
            long lastProgress = 0;
            while ((len = in.read(buffer)) > 0) {
                out.write(buffer, 0, len);
                total += len;
                if (total - lastProgress > 10485760) {
                    lastProgress = total;
                    int pct = 12 + (int) (total * 13L / 114115752L);
                    chmodProvider.postProgress(pct, (chmodProvider.isEnglishMode()
                            ? "Extracting engine... "
                            : "\u6b63\u5728\u63d0\u53d6\u5f15\u64ce... ")
                            + (total / 1048576) + "MB");
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
                // v1.2.0 Phase 73 (SonarCloud B30): 检查 delete() 返回值
                if (!destFile.delete()) {
                    Log.w(TAG, "Failed to delete corrupted asset engine file");
                }
            }
        } else {
            Log.e(TAG, "Asset-extracted engine is invalid (size="
                    + (destFile.exists() ? destFile.length() : 0) + ")");
            // v1.2.0 Phase 73 (SonarCloud B31): 检查 delete() 返回值
            if (!destFile.delete()) {
                Log.w(TAG, "Failed to delete invalid asset engine file");
            }
        }
        return null;
    }

    /** 多策略设置文件可执行权限 */
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
                    // v1.2.0 Phase 73 (SonarCloud B13): 重新设置中断标志
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
                        // v1.2.0 Phase 73 (SonarCloud B14): 重新设置中断标志
                        Thread.currentThread().interrupt();
                    } catch (Throwable ignored) {
                        // 最后的 fallback 失败不阻塞流程
                    }
                }
            }
        } catch (Throwable e) {
            Log.w(TAG, "Failed to make executable: " + file.getAbsolutePath(), e);
        }
    }

    /** 验证文件是否为 ELF 格式 */
    public boolean isElfFile(File file) {
        if (file == null || !file.exists() || !file.canRead()) return false;
        try (java.io.FileInputStream fis = new java.io.FileInputStream(file)) {
            byte[] magic = new byte[4];
            int read = fis.read(magic);
            if (read != 4) return false;
            // ELF magic: 0x7F 'E' 'L' 'F'
            return magic[0] == 0x7F && magic[1] == 'E' && magic[2] == 'L' && magic[3] == 'F';
        } catch (Throwable e) {
            return false;
        }
    }

    /** 启动引擎进程（通过 ProcessBuilder） */
    public boolean startProcess(File engineBin) {
        if (engineBin == null || !engineBin.canExecute()) {
            Log.e(TAG, "Engine binary not executable: " + (engineBin != null ? engineBin.getAbsolutePath() : "null"));
            return false;
        }
        try {
            ProcessBuilder pb = new ProcessBuilder(engineBin.getAbsolutePath());
            pb.redirectErrorStream(true);
            engineProcess = pb.start();
            return true;
        } catch (IOException e) {
            Log.e(TAG, "Failed to start engine process", e);
            engineProcess = null;
            return false;
        }
    }

    /** 初始化 I/O 流和读取线程 */
    public void initStreams(Runnable readLoop) {
        if (engineProcess == null) return;
        try {
            engineReader = new BufferedReader(new InputStreamReader(engineProcess.getInputStream()));
            engineWriter = new OutputStreamWriter(engineProcess.getOutputStream());
            readerThread = new Thread(readLoop, "SF-Reader");
            readerThread.setDaemon(true);
            readerThread.start();
        } catch (Throwable e) {
            Log.e(TAG, "Failed to init streams", e);
        }
    }

    /** 清理所有引擎资源（进程、流、线程） */
    public void cleanupResources(Runnable postCleanup) {
        // 关闭进程流
        if (engineProcess != null) {
            try { engineProcess.getInputStream().close(); } catch (Throwable ignored) {}
            try { engineProcess.getOutputStream().close(); } catch (Throwable ignored) {}
            try { engineProcess.getErrorStream().close(); } catch (Throwable ignored) {}
            try {
                engineProcess.destroy();
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    // v1.2.0 Phase 73 (SonarCloud B15): 重新设置中断标志
                    Thread.currentThread().interrupt();
                }
                if (isProcessAlive()) destroyForciblySafe();
            } catch (Throwable ignored) {}
            engineProcess = null;
        }
        // 关闭写入器
        if (engineWriter != null) {
            try { engineWriter.close(); } catch (IOException ignored) {}
            engineWriter = null;
        }
        // 中断读取线程
        if (readerThread != null) {
            readerThread.interrupt();
            try {
                readerThread.join(1000);
            } catch (InterruptedException e) {
                // v1.2.0 Phase 73 (SonarCloud B19): 重新设置中断标志
                Thread.currentThread().interrupt();
            }
            readerThread = null;
        }
        engineReader = null;
        if (postCleanup != null) {
            postCleanup.run();
        }
    }
}
