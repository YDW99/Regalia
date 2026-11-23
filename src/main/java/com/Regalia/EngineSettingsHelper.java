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
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
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

    // v1.2.3 round-79 (ROB-04, SonarCloud S1192/S2447): import diagnostics and
    //   key names are extracted to constants — the literal fragments were
    //   previously duplicated up to 11 times across the import paths.
    private static final String LINE_PREFIX = "line ";
    private static final String MSG_NOT_AN_INTEGER = "' is not an integer";
    private static final String MSG_NOT_A_BOOLEAN = "' is not a boolean (expected true/false)";
    private static final String MSG_HAS_NO_VALUE = "' has no value";

    private static final String KEY_ENGINE_NAME = "engine.name";
    private static final String KEY_ENGINE_PATH = "engine.path";
    private static final String KEY_THREADS = "engine.threads";
    private static final String KEY_HASH = "engine.hash";
    private static final String KEY_MOVE_OVERHEAD = "engine.moveOverhead";
    private static final String KEY_MULTI_PV = "engine.multiPV";
    private static final String KEY_PONDER = "engine.ponder";
    private static final String KEY_SHOW_WDL = "engine.showWDL";
    private static final String KEY_SKILL_LEVEL = "engine.skillLevel";
    private static final String KEY_LIMIT_STRENGTH = "engine.limitStrength";
    private static final String KEY_ELO = "engine.elo";
    private static final String KEY_AUTO_CONFIG = "engine.autoConfig";

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
            sb.append(KEY_ENGINE_NAME + "=").append(callbacks.getEngineName()).append("\n");
            sb.append(KEY_ENGINE_PATH + "=").append(callbacks.getCurrentEnginePath() != null ? callbacks.getCurrentEnginePath() : "").append("\n");
            sb.append(KEY_THREADS + "=").append(callbacks.getEngineThreads()).append("\n");
            sb.append(KEY_HASH + "=").append(callbacks.getEngineHash()).append("\n");
            sb.append(KEY_MOVE_OVERHEAD + "=").append(callbacks.getEngineMoveOverhead()).append("\n");
            sb.append(KEY_MULTI_PV + "=").append(callbacks.getEngineMultiPV()).append("\n");
            sb.append(KEY_PONDER + "=").append(callbacks.getEnginePonder()).append("\n");
            sb.append(KEY_SHOW_WDL + "=").append(callbacks.getEngineShowWDL()).append("\n");
            sb.append(KEY_SKILL_LEVEL + "=").append(callbacks.getEngineSkillLevel()).append("\n");
            sb.append(KEY_LIMIT_STRENGTH + "=").append(callbacks.getEngineLimitElo()).append("\n");
            sb.append(KEY_ELO + "=").append(callbacks.getEngineElo()).append("\n");
            sb.append(KEY_AUTO_CONFIG + "=").append(callbacks.isAutoConfigEnabled()).append("\n");

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
     * v1.2.3 round-79 (ROB-04, two-phase validate→apply):
     *   旧实现逐行"先应用后计数"，未知键静默跳过（返回 0），NumberFormatException
     *   仅记日志继续，末尾无条件 success=true —— 无效输入一律报成功。
     *   本实现分两阶段：
     *     ① 校验阶段逐行解析全部键值（未知键 / 非法整数 / 非法布尔 / 空值
     *        均以"行号 + 原因"拒绝整份文件，不应用任何设置，保持原子性）；
     *     ② 全部通过后才统一应用（值已在校验阶段解析并按 Phase 71 上限钳制）。
     *   只读元数据键 engine.name / engine.path（exportSettings() 输出）被显式
     *   识别并跳过 —— 应用自身导出的配置必须能原样恢复导入（round-78 严格化
     *   曾误伤这两个键，CodeRabbit PR#60 已指出）。其余未知键仍然拒绝。
     *   布尔仅接受显式 true/false（大小写不敏感）—— 旧 Boolean.parseBoolean
     *   把任意文本静默转为 false。0 个有效键不报成功。
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

                try {
                    if (txtContent == null || txtContent.trim().isEmpty()) {
                        throw new IllegalArgumentException("Empty settings content");
                    }

                    // ① 校验阶段：任何一行失败即整份拒绝（ImportRejectException 携带行号与原因）
                    List<PendingSetting> pending = validateSettings(txtContent);

                    if (pending.isEmpty()) {
                        // v1.2.3 round-79 (ROB-04): 0 个有效键不得报 "Imported 0 … successfully"
                        success = false;
                        message = "No applicable settings found (only comments, blank lines and read-only metadata)";
                    } else {
                        // ② 应用阶段：全部值已在校验时解析与钳制
                        int appliedCount = 0;
                        int clampedCount = 0;
                        Set<String> explicitlySet = new HashSet<>();
                        for (PendingSetting setting : pending) {
                            applySetting(setting, explicitlySet);
                            appliedCount++;
                            if (setting.clamped) {
                                clampedCount++;
                            }
                        }

                        // 若显式导入 threads/hash 且 autoConfig 开启，禁用 autoConfig
                        int skippedAutoConfigCount = handleAutoConfigOverride(explicitlySet);

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
                        message = buildImportMessage(appliedCount, skippedAutoConfigCount, clampedCount);
                        Log.i(TAG, message); // mobsf-ignore: android_logging
                    }
                } catch (ImportRejectException e) {
                    // 校验失败：不应用任何设置（原子性），消息含首个错误的行号与原因
                    success = false;
                    message = e.getMessage();
                } catch (Throwable e) {
                    Log.e(TAG, "Error importing settings", e);
                    message = e.getMessage() != null ? e.getMessage() : "Import failed";
                } // mobsf-ignore: android_logging

                notifyImportResult(success, message);
            }
        }, "importSettings");
    }

    /**
     * v1.2.3 round-79 (ROB-04): 校验阶段。逐行解析并返回待应用设置列表（值已
     * 解析与钳制）。任何无效输入抛出 {@link ImportRejectException}（含行号与
     * 原因），调用方不应用任何设置。
     */
    private List<PendingSetting> validateSettings(String txtContent) {
        List<PendingSetting> pending = new ArrayList<>();
        String[] lines = txtContent.split("\\r?\\n");
        for (int index = 0; index < lines.length; index++) {
            String line = lines[index].trim();
            if (line.isEmpty() || line.startsWith("#")) continue;

            int eqIndex = line.indexOf('=');
            if (eqIndex <= 0) {
                throw new ImportRejectException(
                        LINE_PREFIX + (index + 1) + ": malformed line (expected key=value): '" + abbreviate(line) + "'");
            }
            if (eqIndex >= line.length() - 1) {
                String key = line.substring(0, eqIndex).trim();
                throw new ImportRejectException(
                        LINE_PREFIX + (index + 1) + ": setting '" + key + MSG_HAS_NO_VALUE);
            }

            String key = line.substring(0, eqIndex).trim();
            String value = line.substring(eqIndex + 1).trim();

            if (KEY_ENGINE_NAME.equals(key) || KEY_ENGINE_PATH.equals(key)) {
                // v1.2.3 round-79 (ROB-04, CodeRabbit PR#60): read-only metadata keys
                //   produced by exportSettings() — recognized and skipped (not counted
                //   as applicable settings, never rejected) so the app can re-import
                //   its own exports. All other unknown keys are still rejected below.
                Log.i(TAG, "importSettings: skipping read-only metadata key " + key); // mobsf-ignore: android_logging
                continue;
            }

            pending.add(validateSetting(key, value, index + 1));
        }
        return pending;
    }

    /** 校验单个键值并产出待应用设置（值已解析与钳制）。抛 {@link ImportRejectException} 表示拒绝。 */
    private PendingSetting validateSetting(String key, String value, int lineNumber) {
        switch (key) {
            case KEY_THREADS: {
                int t = parseInteger(key, value, lineNumber);
                int cpuCores = Runtime.getRuntime().availableProcessors();
                int threadsCap = Math.max(1, cpuCores * 2);
                boolean clamped = false;
                if (t > threadsCap) {
                    Log.w(TAG, "importSettings: " + KEY_THREADS + "=" + t + " exceeds 2x CPU cores (" + threadsCap + "), capping"); // mobsf-ignore: android_logging
                    t = threadsCap;
                    clamped = true;
                } // mobsf-ignore: android_logging
                return new PendingSetting(KEY_THREADS, t, clamped);
            }
            case KEY_HASH: {
                int h = parseInteger(key, value, lineNumber);
                long maxMemoryMB = Runtime.getRuntime().maxMemory() / (1024 * 1024);
                long hashCap = Math.max(16, maxMemoryMB / 2);
                boolean clamped = false;
                if (h > hashCap) {
                    Log.w(TAG, "importSettings: " + KEY_HASH + "=" + h + "MB exceeds 50% of heap (" + hashCap + "MB), capping"); // mobsf-ignore: android_logging
                    h = (int) hashCap;
                    clamped = true;
                } // mobsf-ignore: android_logging
                return new PendingSetting(KEY_HASH, h, clamped);
            }
            case KEY_MOVE_OVERHEAD: {
                int ms = parseInteger(key, value, lineNumber);
                boolean clamped = false;
                if (ms > 1000) {
                    Log.w(TAG, "importSettings: " + KEY_MOVE_OVERHEAD + "=" + ms + "ms exceeds 1000ms, capping"); // mobsf-ignore: android_logging
                    ms = 1000;
                    clamped = true;
                } // mobsf-ignore: android_logging
                return new PendingSetting(KEY_MOVE_OVERHEAD, ms, clamped);
            }
            case KEY_MULTI_PV:
                return new PendingSetting(KEY_MULTI_PV,
                        Math.max(1, Math.min(8, parseInteger(key, value, lineNumber))), false);
            case KEY_SKILL_LEVEL:
                return new PendingSetting(KEY_SKILL_LEVEL,
                        Math.max(0, Math.min(20, parseInteger(key, value, lineNumber))), false);
            case KEY_ELO:
                // v1.2.1 (round-5 review): align with EngineConfigHelper's 500-3500 range
                // (previously 1-3200 — inconsistent with the canonical setter, allowing
                // out-of-range values to slip through import and later be silently
                // re-clamped on the next setEngineLimitElo call).
                return new PendingSetting(KEY_ELO,
                        Math.max(500, Math.min(3500, parseInteger(key, value, lineNumber))), false);
            case KEY_PONDER:
                return new PendingSetting(KEY_PONDER, parseBoolean(key, value, lineNumber), false);
            case KEY_SHOW_WDL:
                return new PendingSetting(KEY_SHOW_WDL, parseBoolean(key, value, lineNumber), false);
            case KEY_LIMIT_STRENGTH:
                return new PendingSetting(KEY_LIMIT_STRENGTH, parseBoolean(key, value, lineNumber), false);
            case KEY_AUTO_CONFIG:
                return new PendingSetting(KEY_AUTO_CONFIG, parseBoolean(key, value, lineNumber), false);
            default:
                // v1.2.3 round-79 (ROB-04): unknown keys used to be silently skipped
                // (applySettingLine returned 0). A misspelled key ("engine.thread"…)
                // now fails the whole import instead of being accepted as "success"
                // with the setting ignored.
                throw new ImportRejectException(
                        LINE_PREFIX + lineNumber + ": unknown setting key '" + key + "'");
        }
    }

    /** 解析整数；非法值抛含行号与原因的 {@link ImportRejectException}。 */
    private int parseInteger(String key, String value, int lineNumber) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            throw new ImportRejectException(
                    LINE_PREFIX + lineNumber + ": setting '" + key + "' value '" + value + "'" + MSG_NOT_AN_INTEGER);
        }
    }

    /**
     * v1.2.3 round-79 (ROB-04): 布尔仅接受显式 true/false（大小写不敏感）。
     * 旧 Boolean.parseBoolean 把任意非 "true" 文本静默转为 false。
     */
    private boolean parseBoolean(String key, String value, int lineNumber) {
        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;
        throw new ImportRejectException(
                LINE_PREFIX + lineNumber + ": setting '" + key + "' value '" + value + "'" + MSG_NOT_A_BOOLEAN);
    }

    /** 应用阶段：将校验产物写入引擎设置（带持久化）并记录显式键。 */
    private void applySetting(PendingSetting setting, Set<String> explicitlySet) {
        switch (setting.key) {
            case KEY_THREADS:
                callbacks.setEngineThreads(setting.intValue);
                explicitlySet.add(KEY_THREADS);
                break;
            case KEY_HASH:
                callbacks.setEngineHash(setting.intValue);
                explicitlySet.add(KEY_HASH);
                break;
            case KEY_MOVE_OVERHEAD:
                callbacks.setEngineMoveOverhead(setting.intValue);
                explicitlySet.add(KEY_MOVE_OVERHEAD);
                break;
            case KEY_MULTI_PV:
                callbacks.setEngineMultiPV(setting.intValue);
                break;
            case KEY_SKILL_LEVEL:
                callbacks.setEngineSkillLevel(setting.intValue);
                break;
            case KEY_ELO:
                callbacks.setEngineElo(setting.intValue);
                break;
            case KEY_PONDER:
                callbacks.setEnginePonder(setting.boolValue);
                break;
            case KEY_SHOW_WDL:
                callbacks.setEngineShowWDL(setting.boolValue);
                break;
            case KEY_LIMIT_STRENGTH:
                callbacks.setEngineLimitElo(setting.boolValue);
                break;
            case KEY_AUTO_CONFIG:
                callbacks.setAutoConfigEnabled(setting.boolValue);
                // v1.2.3 round-46 (PR53 CR#13): record the explicit key —
                //   without this, handleAutoConfigOverride's
                //   explicitlySet.contains(KEY_AUTO_CONFIG) was always
                //   false, so a file combining autoConfig=true with
                //   threads/hash had the user's explicit choice overridden
                //   (round-44 C11's stated goal was defeated).
                explicitlySet.add(KEY_AUTO_CONFIG);
                break;
            default:
                // validateSetting 的 default 分支已拒绝一切未知键；此处不可达。
                Log.w(TAG, "applySetting: unexpected key " + setting.key); // mobsf-ignore: android_logging
                break;
        }
    }

    /** 若显式导入 threads/hash 且 autoConfig 开启，禁用 autoConfig。返回 1 表示已禁用 */
    private int handleAutoConfigOverride(Set<String> explicitlySet) {
        if (!callbacks.isAutoConfigEnabled()) return 0;
        // v1.2.3 round-44 (C11): 若用户在同一份导入文件里显式设置了
        //   engine.autoConfig，尊重其显式选择 —— 不因 threads/hash 的存在而
        //   覆盖它（导入文件即用户意图的最终来源）。
        if (explicitlySet.contains(KEY_AUTO_CONFIG)) {
            Log.w(TAG, "Import explicitly sets engine.autoConfig — keeping user's choice, not overriding");
            return 0;
        }
        if (!explicitlySet.contains(KEY_THREADS) && !explicitlySet.contains(KEY_HASH)) return 0;
        Log.i(TAG, "User explicitly imported threads/hash — disabling autoConfig for this apply cycle");
        callbacks.setAutoConfigEnabled(false);
        return 1;
    }

    /** 构建导入结果消息 */
    private String buildImportMessage(int appliedCount, int skippedAutoConfigCount, int clampedCount) {
        String message = "Imported " + appliedCount + " settings successfully";
        if (clampedCount > 0) {
            message += " (" + clampedCount + " clamped to safe ranges)";
        }
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

    /** 校验阶段的待应用设置（值已解析与钳制）。 */
    private static final class PendingSetting {
        final String key;
        final int intValue;
        final boolean boolValue;
        final boolean clamped;

        PendingSetting(String key, int intValue, boolean clamped) {
            this.key = key;
            this.intValue = intValue;
            this.boolValue = false;
            this.clamped = clamped;
        }

        PendingSetting(String key, boolean boolValue, boolean clamped) {
            this.key = key;
            this.intValue = 0;
            this.boolValue = boolValue;
            this.clamped = clamped;
        }
    }

    /** 校验失败（含行号与原因）。v1.2.3 round-79 (ROB-04)。 */
    private static final class ImportRejectException extends IllegalArgumentException {
        ImportRejectException(String message) {
            super(message);
        }
    }

    /** 行内容过长时截断（避免错误消息复制整行长文本）。 */
    private static String abbreviate(String line) {
        return line.length() <= 64 ? line : line.substring(0, 64) + "…";
    }
}
