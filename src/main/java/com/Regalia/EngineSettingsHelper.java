package com.Regalia;

/*
 * Regalia - Engine Settings Helper
 * Copyright (C) 2026 Regalia
 *
 * Engine settings patterns derived from DroidFish (EngineOptionsDialog.java)
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0 Phase 73+: Extracted from StockfishNative.java to reduce God Module size.
 *                   Encapsulates engine settings query, export (TXT format), and
 *                   import (TXT format parsing with range capping).
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
import android.util.Log;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * EngineSettingsHelper — 引擎设置辅助类 (v1.2.0 Phase 73+)
 *
 * 职责:
 *   - 查询引擎信息 (getEngineInfo)
 *   - 查询引擎设置 JSON (getEngineSettings)
 *   - 导出设置为 TXT 格式 (exportSettings / exportEngineSettings)
 *   - 导入 TXT 格式设置 (importSettings / importEngineSettings)
 *
 * 安全设计:
 *   - 导入时对 threads/hash/moveOverhead/multiPV/skillLevel/elo 应用范围钳制
 *   - v1.1.2 Phase 71 上限: threads ≤ 2×CPU核心, hash ≤ 50% JVM堆, moveOverhead ≤ 1000ms
 *   - 导入显式 threads/hash 时自动禁用 autoConfig 以尊重用户意图
 *
 * 回调接口:
 *   导入方法通过 Callbacks 接口访问 StockfishNative 的引擎状态和方法，
 *   避免暴露内部字段。
 */
public class EngineSettingsHelper {
    private static final String TAG = "EngineSettingsHelper";

    private final Context context;
    private final Callbacks callbacks;

    /** 回调接口 — 由 StockfishNative 实现 */
    public interface Callbacks {
        // 引擎状态查询
        String getEngineName();
        String getEngineAuthor();
        String getCurrentEnginePath();
        String getEngineVersion();
        int getEngineThreads();
        int getEngineHash();
        int getEngineMoveOverhead();
        int getEngineMultiPV();
        boolean getEnginePonder();
        boolean getEngineShowWDL();
        int getEngineSkillLevel();
        boolean getEngineLimitElo();
        int getEngineElo();
        boolean isAutoConfigEnabled();
        boolean isEngineReady();

        // 设置写入（带持久化）
        void setEngineThreads(int v);
        void setEngineHash(int v);
        void setEngineMoveOverhead(int v);
        void setEngineMultiPV(int v);
        void setEnginePonder(boolean v);
        void setEngineShowWDL(boolean v);
        void setEngineSkillLevel(int v);
        void setEngineLimitElo(boolean v);
        void setEngineElo(int v);
        void setAutoConfigEnabled(boolean v);

        // 引擎操作
        void stopAndWaitForBestmove(String callerTag);
        void applySettings();
        void notifyEngineInfo();
        void postJsCallback(String jsExpression);
        void safeExecute(Runnable r, String tag);
    }

    public EngineSettingsHelper(Context context, Callbacks callbacks) {
        this.context = context.getApplicationContext();
        this.callbacks = callbacks;
    }

    // ===================== 查询方法 =====================

    /** 构建引擎信息 JSON（名称、作者、路径、线程、哈希、自动配置） */
    public String getEngineInfo() {
        try {
            JSONObject info = new JSONObject();
            info.put("name", callbacks.getEngineName());
            info.put("author", callbacks.getEngineAuthor());
            info.put("path", callbacks.getCurrentEnginePath() != null ? callbacks.getCurrentEnginePath() : "");
            info.put("threads", callbacks.getEngineThreads());
            info.put("hash", callbacks.getEngineHash());
            info.put("autoConfig", callbacks.isAutoConfigEnabled());
            return info.toString();
        } catch (Throwable e) {
            Log.e(TAG, "Error building engine info", e);
            return "{}";
        }
    }

    /** 构建引擎设置 JSON（所有可配置参数） */
    public String getEngineSettings() {
        try {
            JSONObject settings = new JSONObject();
            settings.put("threads", callbacks.getEngineThreads());
            settings.put("hash", callbacks.getEngineHash());
            settings.put("moveOverhead", callbacks.getEngineMoveOverhead());
            settings.put("multiPV", callbacks.getEngineMultiPV());
            settings.put("ponder", callbacks.getEnginePonder());
            settings.put("showWDL", callbacks.getEngineShowWDL());
            settings.put("skillLevel", callbacks.getEngineSkillLevel());
            settings.put("limitStrength", callbacks.getEngineLimitElo());
            settings.put("elo", callbacks.getEngineElo());
            settings.put("autoConfig", callbacks.isAutoConfigEnabled());
            return settings.toString();
        } catch (Throwable e) {
            Log.e(TAG, "Error building engine settings JSON", e);
            return "{}";
        }
    }

    // ===================== 导出方法 =====================

    /** 导出所有引擎设置为 TXT 格式（键值对 + 注释头） */
    public String exportSettings() {
        try {
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
            String timestamp = sdf.format(new Date());

            StringBuilder sb = new StringBuilder();
            sb.append("# Regalia Engine Configuration\n");
            sb.append("# Version: ").append(callbacks.getEngineVersion()).append("\n");
            sb.append("# Export Time: ").append(timestamp).append("\n");
            sb.append("#\n");
            sb.append("engine.name=").append(callbacks.getEngineName()).append("\n");
            sb.append("engine.path=").append(callbacks.getCurrentEnginePath() != null ? callbacks.getCurrentEnginePath() : "").append("\n");
            sb.append("engine.threads=").append(callbacks.getEngineThreads()).append("\n");
            sb.append("engine.hash=").append(callbacks.getEngineHash()).append("\n");
            sb.append("engine.moveOverhead=").append(callbacks.getEngineMoveOverhead()).append("\n");
            sb.append("engine.multiPV=").append(callbacks.getEngineMultiPV()).append("\n");
            sb.append("engine.ponder=").append(callbacks.getEnginePonder()).append("\n");
            sb.append("engine.showWDL=").append(callbacks.getEngineShowWDL()).append("\n");
            sb.append("engine.skillLevel=").append(callbacks.getEngineSkillLevel()).append("\n");
            sb.append("engine.limitStrength=").append(callbacks.getEngineLimitElo()).append("\n");
            sb.append("engine.elo=").append(callbacks.getEngineElo()).append("\n");
            sb.append("engine.autoConfig=").append(callbacks.isAutoConfigEnabled()).append("\n");

            return sb.toString();
        } catch (Throwable e) {
            Log.e(TAG, "Error exporting settings", e);
            return "# Error exporting settings\n";
        }
    }

    // ===================== 导入方法 =====================

    /**
     * 从 TXT 格式导入引擎设置。
     *
     * 解析键值对，对每个参数应用范围钳制（Phase 71 上限），
     * 持久化到 SharedPreferences，并在引擎就绪时下发 UCI 命令。
     *
     * v1.0.2 FIX: 若用户显式导入 threads/hash 且 autoConfig 开启，
     *   自动禁用 autoConfig 以尊重用户显式意图（否则 detectHardwareAndConfigure
     *   会静默覆盖）。
     * v1.0.2 FIX: 引擎就绪时先 stopAndWaitForBestmove 再 applySettings，
     *   避免引擎忙于搜索时 setoption 超时。
     */
    public void importSettings(String txtContent) {
        callbacks.safeExecute(new Runnable() {
            public void run() {
                boolean success = false;
                String message = "";
                int appliedCount = 0;
                int skippedAutoConfigCount = 0;

                try {
                    if (txtContent == null || txtContent.trim().isEmpty()) {
                        throw new IllegalArgumentException("Empty settings content");
                    }

                    // 跟踪显式导入的键，用于判断是否需要禁用 autoConfig
                    Set<String> explicitlySet = new HashSet<>();

                    String[] lines = txtContent.split("\\r?\\n");
                    for (String line : lines) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;

                        int eqIndex = line.indexOf('=');
                        if (eqIndex <= 0 || eqIndex >= line.length() - 1) continue;

                        String key = line.substring(0, eqIndex).trim();
                        String value = line.substring(eqIndex + 1).trim();

                        try {
                            appliedCount += applySettingLine(key, value, explicitlySet);
                        } catch (NumberFormatException e) {
                            Log.w(TAG, "Invalid value for " + key + ": " + value);
                        }
                    }

                    // 若显式导入 threads/hash 且 autoConfig 开启，禁用 autoConfig
                    skippedAutoConfigCount = handleAutoConfigOverride(explicitlySet);

                    // 引擎就绪时下发 UCI 命令
                    if (callbacks.isEngineReady()) {
                        try {
                            callbacks.stopAndWaitForBestmove("importSettings");
                        } catch (Throwable t) {
                            Log.w(TAG, "stopAndWaitForBestmove during import failed", t);
                        }
                        callbacks.applySettings();
                        callbacks.notifyEngineInfo();
                    } else {
                        Log.i(TAG, "Engine not ready — settings saved, will apply on next engineReady");
                    }

                    success = true;
                    message = buildImportMessage(appliedCount, skippedAutoConfigCount);
                    Log.i(TAG, message);
                } catch (Throwable e) {
                    Log.e(TAG, "Error importing settings", e);
                    message = e.getMessage() != null ? e.getMessage() : "Import failed";
                }

                notifyImportResult(success, message);
            }
        }, "importSettings");
    }

    /** 解析单行设置并应用，返回 1 表示成功应用，0 表示跳过 */
    private int applySettingLine(String key, String value, Set<String> explicitlySet) throws NumberFormatException {
        switch (key) {
            case "engine.threads": {
                int t = Math.max(1, Math.min(1024, Integer.parseInt(value)));
                int cpuCores = Runtime.getRuntime().availableProcessors();
                int threadsCap = Math.max(1, cpuCores * 2);
                if (t > threadsCap) {
                    Log.w(TAG, "importSettings: engine.threads=" + t + " exceeds 2x CPU cores (" + threadsCap + "), capping");
                    t = threadsCap;
                }
                callbacks.setEngineThreads(t);
                explicitlySet.add("engine.threads");
                return 1;
            }
            case "engine.hash": {
                int h = Math.max(1, Math.min(1048576, Integer.parseInt(value)));
                long maxMemoryMB = Runtime.getRuntime().maxMemory() / (1024 * 1024);
                long hashCap = Math.max(16, maxMemoryMB / 2);
                if (h > hashCap) {
                    Log.w(TAG, "importSettings: engine.hash=" + h + "MB exceeds 50% of heap (" + hashCap + "MB), capping");
                    h = (int) hashCap;
                }
                callbacks.setEngineHash(h);
                explicitlySet.add("engine.hash");
                return 1;
            }
            case "engine.moveOverhead": {
                int ms = Math.max(0, Math.min(10000, Integer.parseInt(value)));
                if (ms > 1000) {
                    Log.w(TAG, "importSettings: engine.moveOverhead=" + ms + "ms exceeds 1000ms, capping");
                    ms = 1000;
                }
                callbacks.setEngineMoveOverhead(ms);
                return 1;
            }
            case "engine.multiPV":
                callbacks.setEngineMultiPV(Math.max(1, Math.min(8, Integer.parseInt(value))));
                return 1;
            case "engine.ponder":
                callbacks.setEnginePonder(Boolean.parseBoolean(value));
                return 1;
            case "engine.showWDL":
                callbacks.setEngineShowWDL(Boolean.parseBoolean(value));
                return 1;
            case "engine.skillLevel":
                callbacks.setEngineSkillLevel(Math.max(0, Math.min(20, Integer.parseInt(value))));
                return 1;
            case "engine.limitStrength":
                callbacks.setEngineLimitElo(Boolean.parseBoolean(value));
                return 1;
            case "engine.elo":
                // v1.2.1 (round-5 review): align with EngineConfigHelper's 500-3500 range
                // (previously 1-3200 — inconsistent with the canonical setter, allowing
                // out-of-range values to slip through import and later be silently
                // re-clamped on the next setEngineLimitElo call).
                callbacks.setEngineElo(Math.max(500, Math.min(3500, Integer.parseInt(value))));
                return 1;
            case "engine.autoConfig":
                callbacks.setAutoConfigEnabled(Boolean.parseBoolean(value));
                return 1;
            default:
                return 0;
        }
    }

    /** 若显式导入 threads/hash 且 autoConfig 开启，禁用 autoConfig。返回 1 表示已禁用 */
    private int handleAutoConfigOverride(Set<String> explicitlySet) {
        if (!callbacks.isAutoConfigEnabled()) return 0;
        if (!explicitlySet.contains("engine.threads") && !explicitlySet.contains("engine.hash")) return 0;
        Log.i(TAG, "User explicitly imported threads/hash — disabling autoConfig for this apply cycle");
        callbacks.setAutoConfigEnabled(false);
        return 1;
    }

    /** 构建导入结果消息 */
    private String buildImportMessage(int appliedCount, int skippedAutoConfigCount) {
        String message = "Imported " + appliedCount + " settings successfully";
        if (skippedAutoConfigCount > 0) {
            message += " (autoConfig disabled to honor explicit threads/hash)";
        }
        if (!callbacks.isEngineReady()) {
            message += " (engine not ready — will apply on next start)";
        }
        return message;
    }

    /** 通知 JS 导入结果 */
    private void notifyImportResult(boolean success, String message) {
        try {
            JSONObject result = new JSONObject();
            result.put("success", success);
            result.put("message", message);
            callbacks.postJsCallback("onSettingsImported(" + result.toString() + ")");
        } catch (Throwable e) {
            Log.w(TAG, "Error posting settings imported callback", e);
        }
    }
}
