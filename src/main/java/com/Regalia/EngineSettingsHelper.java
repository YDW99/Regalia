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
        } catch (Exception e) {
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
     * v1.2.3 round-78 (ROB-04): import is now a TWO-PHASE transaction —
     *   validate every line first, apply nothing until the whole file parses.
     *   Previously each line was applied as it was parsed and any invalid
     *   value (NumberFormatException was logged only, Boolean.parseBoolean
     *   silently mapped every misspelling to false, unknown keys returned 0)
     *   still ended in success=true with "Imported N settings
     *   successfully" — a file with zero valid lines imported 0 settings
     *   "successfully", and a mid-file error left the first half applied
     *   with no indication which keys failed. Now: booleans accept only
     *   explicit true/false; a single invalid value or unknown key rejects
     *   the WHOLE import before anything is persisted; the result object
     *   carries applied / rejected / clamped counters for the JS side.
     */
    public void importSettings(String txtContent) {
        callbacks.safeExecute(new Runnable() {
            public void run() {
                boolean success = false;
                String message = "";
                int appliedCount = 0;
                int clampedCount = 0;
                int rejectedCount = 0;
                int skippedAutoConfigCount = 0;

                try {
                    if (txtContent == null || txtContent.trim().isEmpty()) {
                        throw new IllegalArgumentException("Empty settings content");
                    }

                    // 跟踪显式导入的键，用于判断是否需要禁用 autoConfig
                    Set<String> explicitlySet = new HashSet<>();

                    // v1.2.3 round-78 (ROB-04): PHASE 1 — validate every line.
                    //   Nothing is persisted until the whole file parses.
                    java.util.List<ParsedSetting> parsed = new java.util.ArrayList<>();
                    java.util.List<String> errors = new java.util.ArrayList<>();
                    String[] lines = txtContent.split("\\r?\\n");
                    for (int i = 0; i < lines.length; i++) {
                        String line = lines[i].trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;

                        int eqIndex = line.indexOf('=');
                        // 格式宽容（与旧实现一致）：非 key=value 行径直跳过，
                        //   不计入错误 —— 导出文件可能携带说明性文字行。
                        if (eqIndex <= 0 || eqIndex >= line.length() - 1) continue;

                        String key = line.substring(0, eqIndex).trim();
                        String value = line.substring(eqIndex + 1).trim();

                        String err = validateSettingLine(i + 1, key, value, parsed, explicitlySet);
                        if (err != null) {
                            errors.add(err);
                        }
                    }

                    if (!errors.isEmpty()) {
                        // v1.2.3 round-78 (ROB-04): fail closed — nothing applied.
                        rejectedCount = errors.size();
                        success = false;
                        message = "Import rejected: " + errors.get(0)
                                + (errors.size() > 1
                                   ? " (" + (errors.size() - 1) + " more error"
                                     + (errors.size() > 2 ? "s" : "") + ")"
                                   : "")
                                + " — nothing applied";
                        Log.w(TAG, message); // mobsf-ignore: android_logging
                        notifyImportResult(success, message, appliedCount, rejectedCount, clampedCount);
                        return;
                    }

                    if (parsed.isEmpty()) {
                        // v1.2.3 round-78 (ROB-04): a file whose every line was a
                        //   comment / non-key=value line is NOT "Imported 0
                        //   settings successfully" — report it as a failure.
                        throw new IllegalArgumentException("No valid settings lines found");
                    }

                    // v1.2.3 round-78 (ROB-04): PHASE 2 — apply. Reached only
                    //   when every line validated; each setter persists via
                    //   SharedPreferences exactly as before.
                    for (ParsedSetting p : parsed) {
                        applyParsedSetting(p);
                        appliedCount++;
                        if (p.clamped) clampedCount++;
                    }

                    // 若显式导入 threads/hash 且 autoConfig 开启，禁用 autoConfig
                    skippedAutoConfigCount = handleAutoConfigOverride(explicitlySet);

                    // 引擎就绪时下发 UCI 命令
                    if (callbacks.isEngineReady()) {
                        try {
                            callbacks.stopAndWaitForBestmove("importSettings");
                        } catch (Exception t) {
                            Log.w(TAG, "stopAndWaitForBestmove during import failed", t);
                        }
                        callbacks.applySettings();
                        callbacks.notifyEngineInfo();
                    } else {
                        Log.i(TAG, "Engine not ready — settings saved, will apply on next engineReady");
                    }

                    success = true;
                    message = buildImportMessage(appliedCount, clampedCount, skippedAutoConfigCount);
                    Log.i(TAG, message); // mobsf-ignore: android_logging
                } catch (Throwable e) {
                    Log.e(TAG, "Error importing settings", e); // mobsf-ignore: android_logging
                    message = e.getMessage() != null ? e.getMessage() : "Import failed";
                } // mobsf-ignore: android_logging

                notifyImportResult(success, message, appliedCount, rejectedCount, clampedCount);
            }
        }, "importSettings");
    }

    /** v1.2.3 round-78 (ROB-04): validate 阶段的解析结果 —— 一个已解析、
        已范围钳制的待应用行。value 只可能是 Integer 或 Boolean。 */
    private static final class ParsedSetting {
        final String key;
        final Object value;
        final boolean clamped; // 数值被钳制到范围/硬件上限（原始值越界）
        ParsedSetting(String key, Object value, boolean clamped) {
            this.key = key;
            this.value = value;
            this.clamped = clamped;
        }
    }

    /**
     * v1.2.3 round-78 (ROB-04): validate 单行设置（不持久化任何东西）。
     * 解析成功时把钳制后的值加入 parsed 并在 explicitlySet 登记键，返回 null；
     * 解析失败时返回错误描述（非 null），由调用方收集 —— 有任一错误则整体
     * 拒绝导入（全或无），不静默部分应用。
     */
    private String validateSettingLine(int lineNumber, String key, String value,
                                       java.util.List<ParsedSetting> parsed,
                                       Set<String> explicitlySet) {
        switch (key) {
            case "engine.threads": {
                int raw;
                try {
                    raw = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    return "line " + lineNumber + ": engine.threads value '"
                            + value + "' is not an integer";
                }
                int t = Math.max(1, Math.min(1024, raw));
                int threadsCap = Math.max(1, Runtime.getRuntime().availableProcessors() * 2);
                if (t > threadsCap) {
                    Log.w(TAG, "importSettings: engine.threads=" + t + " exceeds 2x CPU cores (" + threadsCap + "), capping"); // mobsf-ignore: android_logging
                    t = threadsCap;
                } // mobsf-ignore: android_logging
                parsed.add(new ParsedSetting(key, t, t != raw));
                explicitlySet.add(key);
                return null;
            }
            case "engine.hash": {
                int raw;
                try {
                    raw = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    return "line " + lineNumber + ": engine.hash value '"
                            + value + "' is not an integer";
                }
                int h = Math.max(1, Math.min(1048576, raw));
                long maxMemoryMB = Runtime.getRuntime().maxMemory() / (1024 * 1024);
                long hashCap = Math.max(16, maxMemoryMB / 2);
                if (h > hashCap) {
                    Log.w(TAG, "importSettings: engine.hash=" + h + "MB exceeds 50% of heap (" + hashCap + "MB), capping"); // mobsf-ignore: android_logging
                    h = (int) hashCap;
                } // mobsf-ignore: android_logging
                parsed.add(new ParsedSetting(key, h, h != raw));
                explicitlySet.add(key);
                return null;
            }
            case "engine.moveOverhead": {
                int raw;
                try {
                    raw = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    return "line " + lineNumber + ": engine.moveOverhead value '"
                            + value + "' is not an integer";
                }
                int ms = Math.max(0, Math.min(10000, raw));
                if (ms > 1000) {
                    Log.w(TAG, "importSettings: engine.moveOverhead=" + ms + "ms exceeds 1000ms, capping"); // mobsf-ignore: android_logging
                    ms = 1000;
                } // mobsf-ignore: android_logging
                parsed.add(new ParsedSetting(key, ms, ms != raw));
                return null;
            }
            case "engine.multiPV": {
                int raw;
                try {
                    raw = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    return "line " + lineNumber + ": engine.multiPV value '"
                            + value + "' is not an integer";
                }
                int v = Math.max(1, Math.min(8, raw));
                parsed.add(new ParsedSetting(key, v, v != raw));
                return null;
            }
            case "engine.skillLevel": {
                int raw;
                try {
                    raw = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    return "line " + lineNumber + ": engine.skillLevel value '"
                            + value + "' is not an integer";
                }
                int v = Math.max(0, Math.min(20, raw));
                parsed.add(new ParsedSetting(key, v, v != raw));
                return null;
            }
            case "engine.elo": {
                // v1.2.1 (round-5 review): align with EngineConfigHelper's 500-3500 range
                // (previously 1-3200 — inconsistent with the canonical setter, allowing
                // out-of-range values to slip through import and later be silently
                // re-clamped on the next setEngineLimitElo call).
                int raw;
                try {
                    raw = Integer.parseInt(value);
                } catch (NumberFormatException e) {
                    return "line " + lineNumber + ": engine.elo value '"
                            + value + "' is not an integer";
                }
                int v = Math.max(500, Math.min(3500, raw));
                parsed.add(new ParsedSetting(key, v, v != raw));
                return null;
            }
            case "engine.ponder": {
                Boolean b = parseStrictBoolean(value);
                if (b == null) {
                    return "line " + lineNumber + ": engine.ponder value '"
                            + value + "' is not a boolean (expected true/false)";
                }
                parsed.add(new ParsedSetting(key, b, false));
                return null;
            }
            case "engine.showWDL": {
                Boolean b = parseStrictBoolean(value);
                if (b == null) {
                    return "line " + lineNumber + ": engine.showWDL value '"
                            + value + "' is not a boolean (expected true/false)";
                }
                parsed.add(new ParsedSetting(key, b, false));
                return null;
            }
            case "engine.limitStrength": {
                Boolean b = parseStrictBoolean(value);
                if (b == null) {
                    return "line " + lineNumber + ": engine.limitStrength value '"
                            + value + "' is not a boolean (expected true/false)";
                }
                parsed.add(new ParsedSetting(key, b, false));
                return null;
            }
            case "engine.autoConfig": {
                Boolean b = parseStrictBoolean(value);
                if (b == null) {
                    return "line " + lineNumber + ": engine.autoConfig value '"
                            + value + "' is not a boolean (expected true/false)";
                }
                parsed.add(new ParsedSetting(key, b, false));
                // v1.2.3 round-46 (PR53 CR#13): record the explicit key —
                //   without this, handleAutoConfigOverride's
                //   explicitlySet.contains("engine.autoConfig") was always
                //   false, so a file combining autoConfig=true with
                //   threads/hash had the user's explicit choice overridden
                //   (round-44 C11's stated goal was defeated).
                explicitlySet.add(key);
                return null;
            }
            default:
                // v1.2.3 round-78 (ROB-04): unknown keys used to be silently
                //   skipped (applySettingLine returned 0). A misspelled key
                //   ("engine.thread"…) now fails the whole import instead of
                //   being accepted as "success" with the setting ignored.
                return "line " + lineNumber + ": unknown setting key '" + key + "'";
        }
    }

    /**
     * v1.2.3 round-78 (ROB-04): 布尔值只接受明确的 true/false（大小写不敏感）。
     * Boolean.parseBoolean 把任何非 "true" 文本静默转为 false —— 导入文件里
     * "engine.ponder=ture"（拼写错误）会被静默应用为 false。返回 null 表示
     * 输入既不是 true 也不是 false，由调用方作为整体拒绝处理。
     */
    private static Boolean parseStrictBoolean(String raw) {
        String v = raw.trim().toLowerCase(Locale.ROOT);
        if ("true".equals(v)) return Boolean.TRUE;
        if ("false".equals(v)) return Boolean.FALSE;
        return null;
    }

    /**
     * v1.2.3 round-78 (ROB-04): apply 阶段 —— 把 validate 阶段已解析且钳制的
     * 值写入回调 setter（每个 setter 与旧实现一样立即持久化）。
     * 仅在整份文件全部 validate 通过后才会到达这里（全或无）。
     */
    private void applyParsedSetting(ParsedSetting p) {
        switch (p.key) {
            case "engine.threads": callbacks.setEngineThreads((Integer) p.value); return;
            case "engine.hash": callbacks.setEngineHash((Integer) p.value); return;
            case "engine.moveOverhead": callbacks.setEngineMoveOverhead((Integer) p.value); return;
            case "engine.multiPV": callbacks.setEngineMultiPV((Integer) p.value); return;
            case "engine.skillLevel": callbacks.setEngineSkillLevel((Integer) p.value); return;
            case "engine.elo": callbacks.setEngineElo((Integer) p.value); return;
            case "engine.ponder": callbacks.setEnginePonder((Boolean) p.value); return;
            case "engine.showWDL": callbacks.setEngineShowWDL((Boolean) p.value); return;
            case "engine.limitStrength": callbacks.setEngineLimitElo((Boolean) p.value); return;
            case "engine.autoConfig": callbacks.setAutoConfigEnabled((Boolean) p.value); return;
            default:
                // unreachable — validateSettingLine only adds known keys
                Log.w(TAG, "applyParsedSetting: unknown key skipped: " + p.key); // mobsf-ignore: android_logging
        }
    }

    /** 若显式导入 threads/hash 且 autoConfig 开启，禁用 autoConfig。返回 1 表示已禁用 */
    private int handleAutoConfigOverride(Set<String> explicitlySet) {
        if (!callbacks.isAutoConfigEnabled()) return 0;
        // v1.2.3 round-44 (C11): 若用户在同一份导入文件里显式设置了
        //   engine.autoConfig，尊重其显式选择 —— 不因 threads/hash 的存在而
        //   覆盖它（导入文件即用户意图的最终来源）。
        if (explicitlySet.contains("engine.autoConfig")) {
            Log.w(TAG, "Import explicitly sets engine.autoConfig — keeping user's choice, not overriding");
            return 0;
        }
        if (!explicitlySet.contains("engine.threads") && !explicitlySet.contains("engine.hash")) return 0;
        Log.i(TAG, "User explicitly imported threads/hash — disabling autoConfig for this apply cycle");
        callbacks.setAutoConfigEnabled(false);
        return 1;
    }

    /** 构建导入结果消息（v1.2.3 round-78 (ROB-04)：含钳制计数） */
    private String buildImportMessage(int appliedCount, int clampedCount, int skippedAutoConfigCount) {
        String message = "Imported " + appliedCount + " settings successfully";
        if (clampedCount > 0) {
            message += " (" + clampedCount + " value"
                    + (clampedCount > 1 ? "s" : "") + " clamped to range)";
        }
        if (skippedAutoConfigCount > 0) {
            message += " (autoConfig disabled to honor explicit threads/hash)";
        }
        if (!callbacks.isEngineReady()) {
            message += " (engine not ready — will apply on next start)";
        }
        return message;
    }

    /** 通知 JS 导入结果。
     *  v1.2.3 round-78 (ROB-04): 新增 applied/rejected/clamped 计数字段
     *  （JSON 增字段对旧 JS 向后兼容 —— 未知字段被忽略，success/message
     *  语义不变）。rejected > 0 意味着全或无导入整体被拒绝、无任何应用。 */
    private void notifyImportResult(boolean success, String message,
                                    int appliedCount, int rejectedCount, int clampedCount) {
        try {
            JSONObject result = new JSONObject();
            result.put("success", success);
            result.put("message", message);
            result.put("applied", appliedCount);
            result.put("rejected", rejectedCount);
            result.put("clamped", clampedCount);
            callbacks.postJsCallback("onSettingsImported(" + result.toString() + ")");
        } catch (Throwable e) {
            Log.w(TAG, "Error posting settings imported callback", e);
        }
    }
}
