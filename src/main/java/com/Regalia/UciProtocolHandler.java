package com.Regalia;

/*
 * Regalia - UCI Protocol Handler
 * Copyright (C) 2026 Regalia
 *
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Österlund (original DroidFish logic:
 *   UCIEngineBase.java, DroidComputerPlayer.java patterns)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0: Extracted from StockfishNative.java (Phase 73 God Module split).
 *         Encapsulates UCI protocol commands, response parsing, and option setting.
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

import java.io.IOException;
import java.io.OutputStreamWriter;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * UciProtocolHandler — UCI 协议处理器 (v1.2.0 Phase 73)
 *
 * 职责:
 *   - UCI 命令发送（position, go, stop, setoption, ucinewgame, isready 等）
 *   - UCI 响应解析（uciok, readyok, bestmove, info 等）
 *   - setoption 同步等待（通过 isready/readyok 握手确认选项已应用）
 *   - bestmove 同步等待（通过 CountDownLatch）
 *
 * 线程安全: 所有状态使用 Atomic* 类或 volatile，确保跨线程可见性。
 *          写入器访问通过 writerLock 保护，防止并发写入冲突。
 */
public class UciProtocolHandler {
    private static final String TAG = "UciProtocolHandler";

    private final Object writerLock = new Object();

    /** UCI 握手超时（毫秒） */
    public static final int UCI_HANDSHAKE_TIMEOUT_MS = 10000;
    /** readyok 等待超时（毫秒） */
    public static final int READYOK_TIMEOUT_MS = 5000;
    /** bestmove 等待超时（毫秒） */
    public static final int BESTMOVE_TIMEOUT_MS = 30000;

    // UCI 握手状态
    private final AtomicReference<CountDownLatch> uciOkLatchHolder = new AtomicReference<>(null);
    private final AtomicReference<CountDownLatch> readyOkLatchHolder = new AtomicReference<>(null);
    private final AtomicReference<CountDownLatch> bestmoveLatchHolder = new AtomicReference<>(null);
    private final AtomicReference<String> bestmoveResult = new AtomicReference<>(null);

    // v1.2.0 Phase 73 (SonarCloud): 使用 AtomicBoolean 替代 volatile boolean
    private final AtomicBoolean isUciHandshakeActive = new AtomicBoolean(false);

    // 支持的 UCI 选项名集合
    private final java.util.Set<String> supportedOptionNames = new java.util.HashSet<>();

    /** UCI 响应回调接口 */
    public interface UciCallback {
        OutputStreamWriter getEngineWriter();
        void onUciOk(String engineName, String engineAuthor, String optionsJson);
        void onReadyOk();
        void onBestMove(String bestmove, String ponder);
        void onInfo(String line);
        void onEngineError(String message);
        boolean isEnglishMode();
    }

    private final UciCallback callback;

    public UciProtocolHandler(UciCallback callback) {
        this.callback = callback;
    }

    /** 获取支持的选项名集合 */
    public java.util.Set<String> getSupportedOptionNames() {
        return supportedOptionNames;
    }

    /** 重置握手状态 */
    public void resetHandshakeState() {
        uciOkLatchHolder.set(null);
        readyOkLatchHolder.set(null);
        bestmoveLatchHolder.set(null);
        bestmoveResult.set(null);
        isUciHandshakeActive.set(false);
        supportedOptionNames.clear();
    }

    /**
     * 发送 UCI 命令到引擎（线程安全）。
     * @param command UCI 命令字符串
     */
    public void sendCommand(String command) {
        synchronized (writerLock) {
            OutputStreamWriter writer = callback.getEngineWriter();
            if (writer == null) {
                Log.w(TAG, "Cannot send command — writer is null: " + command);
                return;
            }
            try {
                writer.write(command + "\n");
                writer.flush();
            } catch (IOException e) {
                Log.e(TAG, "Failed to send command: " + command, e);
                callback.onEngineError(callback.isEnglishMode()
                        ? "Engine communication error"
                        : "\u5f15\u64ce\u901a\u4fe1\u9519\u8bef");
            }
        }
    }

    /**
     * 同步设置 UCI 选项并等待 readyok 确认。
     * @param name 选项名
     * @param value 选项值
     * @return true 表示选项设置成功
     */
    public boolean setOptionAndWait(String name, String value) {
        if (!supportedOptionNames.contains(name)) {
            Log.d(TAG, "Option not supported by engine, skipping: " + name);
            return false;
        }
        CountDownLatch latch = new CountDownLatch(1);
        readyOkLatchHolder.set(latch);
        try {
            sendCommand("setoption name " + name + " value " + value);
            sendCommand("isready");
            boolean ok = latch.await(READYOK_TIMEOUT_MS, TimeUnit.MILLISECONDS);
            if (!ok) {
                Log.w(TAG, "Timeout waiting for readyok after setoption " + name);
            }
            return ok;
        } catch (InterruptedException e) {
            // v1.2.0 Phase 73 (SonarCloud B17): 重新设置中断标志
            Thread.currentThread().interrupt();
            Log.w(TAG, "Interrupted waiting for readyok: " + name);
            return false;
        } finally {
            readyOkLatchHolder.set(null);
        }
    }

    /** 等待 bestmove 结果 */
    public String waitForBestmove(int timeoutMs) {
        CountDownLatch latch = new CountDownLatch(1);
        bestmoveLatchHolder.set(latch);
        try {
            boolean ok = latch.await(timeoutMs, TimeUnit.MILLISECONDS);
            if (!ok) {
                Log.w(TAG, "Timeout waiting for bestmove");
                return null;
            }
            return bestmoveResult.get();
        } catch (InterruptedException e) {
            // v1.2.0 Phase 73 (SonarCloud B18): 重新设置中断标志
            Thread.currentThread().interrupt();
            Log.w(TAG, "Interrupted waiting for bestmove");
            return null;
        } finally {
            bestmoveLatchHolder.set(null);
            bestmoveResult.set(null);
        }
    }

    /** 等待 uciok */
    public boolean waitForUciOk(int timeoutMs) {
        CountDownLatch latch = new CountDownLatch(1);
        uciOkLatchHolder.set(latch);
        isUciHandshakeActive.set(true);
        try {
            boolean ok = latch.await(timeoutMs, TimeUnit.MILLISECONDS);
            if (!ok) {
                Log.w(TAG, "Timeout waiting for uciok");
            }
            return ok;
        } catch (InterruptedException e) {
            // v1.2.0 Phase 73 (SonarCloud B07): 重新设置中断标志
            Thread.currentThread().interrupt();
            Log.w(TAG, "Interrupted waiting for uciok");
            return false;
        } finally {
            uciOkLatchHolder.set(null);
            isUciHandshakeActive.set(false);
        }
    }

    /**
     * 处理引擎输出行（由读取线程调用）。
     * @param line 引擎输出行
     */
    public void handleLine(String line) {
        if (line == null || line.isEmpty()) return;

        if (line.startsWith("uciok")) {
            CountDownLatch latch = uciOkLatchHolder.get();
            if (latch != null) {
                latch.countDown();
            }
            return;
        }

        if (line.startsWith("readyok")) {
            CountDownLatch latch = readyOkLatchHolder.get();
            if (latch != null) {
                latch.countDown();
            }
            callback.onReadyOk();
            return;
        }

        if (line.startsWith("bestmove")) {
            // 解析 bestmove 和 ponder
            String bestmove = "";
            String ponder = "";
            Matcher m = Pattern.compile("bestmove\\s+(\\S+)(?:\\s+ponder\\s+(\\S+))?").matcher(line);
            if (m.find()) {
                bestmove = m.group(1);
                ponder = m.group(2);
            }
            bestmoveResult.set(bestmove);
            CountDownLatch latch = bestmoveLatchHolder.get();
            if (latch != null) {
                latch.countDown();
            }
            callback.onBestMove(bestmove, ponder);
            return;
        }

        if (line.startsWith("id ")) {
            handleIdLine(line);
            return;
        }

        if (line.startsWith("option ")) {
            handleOptionLine(line);
            return;
        }

        if (line.startsWith("info ")) {
            callback.onInfo(line);
            return;
        }

        // 其他输出记录为调试信息
        Log.d(TAG, "Engine output: " + line);
    }

    /** 处理 id 行（id name / id author） */
    private void handleIdLine(String line) {
        // id name 和 id author 由握手阶段处理，这里仅记录
        Log.d(TAG, "Engine id: " + line);
    }

    /** 处理 option 行，收集支持的选项名 */
    private void handleOptionLine(String line) {
        try {
            Matcher m = Pattern.compile("option\\s+name\\s+(.+?)\\s+type\\s+\\w+").matcher(line);
            if (m.find()) {
                String optionName = m.group(1).trim();
                supportedOptionNames.add(optionName);
            }
        } catch (Throwable e) {
            Log.w(TAG, "Failed to parse option line: " + line, e);
        }
    }

    /** 是否正在进行 UCI 握手 */
    public boolean isUciHandshakeActive() {
        return isUciHandshakeActive.get();
    }

    /** 通知 UCI 握手完成（引擎名/作者/选项已收集） */
    public void notifyUciOk(String engineName, String engineAuthor, String optionsJson) {
        callback.onUciOk(engineName, engineAuthor, optionsJson);
    }
}
