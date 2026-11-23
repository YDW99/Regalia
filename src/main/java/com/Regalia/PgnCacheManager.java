package com.Regalia;

/*
 * Regalia - PGN Cache Manager
 * Copyright (C) 2026 Regalia
 *
 * Engine management logic derived from DroidFish
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0: Extracted from StockfishNative.java (Phase 73 God Module split).
 *         Encapsulates all PGN cache CRUD operations with sandbox-safe path handling.
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

import org.json.JSONArray;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * PgnCacheManager — PGN 缓存的 CRUD 操作管理器 (v1.2.0 Phase 73)
 *
 * 职责:
 *   - PGN 缓存目录的创建与访问
 *   - 缓存名称的安全净化（防止目录穿越攻击）
 *   - PGN 文件的读写、删除、重命名
 *   - 标签 (tags) 文件的读写
 *   - 批量删除操作
 *
 * 所有路径操作均被限制在应用私有目录 pgn_cache/ 下，杜绝路径穿越。
 *
 * v1.2.3 round-79 (ROB-03): 读写上限矩阵 —
 *   - MAX_PGN_WRITE_BYTES / MAX_PGN_READ_CHARS: 单个 PGN 条目的写入字节 /
 *     读取字符上限（写前检查、读取循环内追加前检查）；
 *   - MAX_TAGS_FILE_BYTES: 标签文件对称上限（getTags 文件级 + 读取循环级，
 *     setTags 序列化字节级 — 超限保留旧文件并返回 false）；
 *   - evictIfNeeded 的预算只统计受管文件（.pgn 与 .tags.json），孤儿
 *     .tags.json 成为第二优先淘汰候选，杂散文件受控忽略（不统计、不淘汰）。
 *   读取循环一律使用 sw.getBuffer().length() —— java.io.StringWriter 没有
 *   size() 方法（round-78 曾误用，属编译阻断级错误）。
 */
public class PgnCacheManager {
    private static final String TAG = "PgnCacheManager";

    private static final String PGN_CACHE_DIR = "pgn_cache";

    // v1.2.3 round-44 (E9): LRU 淘汰上限。PGN 缓存此前无界增长（用户长期
    //   使用后 pgn_cache/ 可占数百 MB）。超过上限时按 lastModified 升序
    //   删除最旧的 .pgn 及其关联 .tags.json，直到回到上限以内。
    private static final long MAX_CACHE_BYTES = 50L * 1024 * 1024; // 50MB

    // v1.2.3 round-79 (ROB-03): 单个 PGN 条目的写上限（UTF-8 字节，写前检查）。
    //   32MB = 预算上限的 64%；足以容纳预算内最大合法 PGN，同时阻止超大
    //   输入在"写完才淘汰"的窗口里绕过预算语义。
    private static final long MAX_PGN_WRITE_BYTES = 32L * 1024 * 1024; // 32MB

    // v1.2.3 round-79 (ROB-03): 单个 PGN 条目的读取字符上限（读取循环内、
    //   追加前检查）。64M chars 覆盖 50MB 预算内所有合法 PGN 的 UTF-8 解码。
    private static final int MAX_PGN_READ_CHARS = 64 * 1024 * 1024;

    // v1.2.3 round-79 (ROB-03): 标签文件的对称上限（1 MiB）。getTags 在
    //   文件级与读取循环级执行；setTags 在序列化字节级执行（写前检查，
    //   超限保留旧文件并返回 false，与 getTags 的拒绝语义对称）。
    private static final long MAX_TAGS_FILE_BYTES = 1024L * 1024; // 1 MiB

    // v1.2.3 round-80 (SonarCloud S1192): the per-file cap refusal logs shared
    //   the literal " bytes): " three times (save / setTags / getTags) — it is
    //   now a named constant.
    private static final String CAP_REFUSAL_BYTES_SUFFIX = " bytes): ";

    // v1.2.3 round-79 (ROB-03): 标签读取的字符上限（2M chars ≥ 1 MiB 文件的
    //   最坏 UTF-8 解码膨胀；读取循环内、追加前检查，防 file.length() 竞态）。
    private static final int MAX_TAGS_READ_CHARS = 2 * 1024 * 1024;

    // v1.2.3 round-30 (perf): pre-compiled patterns for sanitizeName.
    //   String.replaceAll(String, String) recompiles the Pattern on every
    //   call; sanitizeName is invoked on every PGN cache operation
    //   (save/get/delete/rename/setTags/getTags).
    private static final Pattern ILLEGAL_CHARS = Pattern.compile("[/\\\\:*?\"<>|]");
    private static final Pattern CONTROL_CHARS = Pattern.compile("[\\x00-\\x1f\\x7f]");

    private final Context context;
    // v1.2.3 round-44 (E10): 缓存目录实例在构造器解析并 mkdirs 一次，
    //   getCacheDir() 从「每次新建 File + exists() 系统调用」改为直接返回
    //   缓存字段（该方法在 save/get/delete/rename/setTags/getTags 每次调用
    //   都会走一到两遍）。
    private final File cacheDir;

    public PgnCacheManager(Context context) {
        this.context = context.getApplicationContext();
        this.cacheDir = new File(this.context.getFilesDir(), PGN_CACHE_DIR);
        // v1.2.3 round-45 (PR53 R4, java:S1066): collapsed nested if.
        if (!cacheDir.exists() && !cacheDir.mkdirs()) {
            Log.w(TAG, "PgnCacheManager: mkdirs failed for " + cacheDir.getAbsolutePath()); // mobsf-ignore: android_logging
        }
    }

    /** 获取 PGN 缓存目录（构造时已创建；v1.2.3 round-44 (E10) 返回缓存字段） */
    public File getCacheDir() {
        return cacheDir;
    }

    /**
     * 净化缓存名称：剥离路径分隔符、控制字符，限制长度。
     * @return 净化后的名称，或 null（输入无效）
     */
    public String sanitizeName(String name) {
        if (name == null) return null;
        String s = name.trim();
        // 移除路径类字符（禁止目录穿越）
        s = ILLEGAL_CHARS.matcher(s).replaceAll("");
        // 移除控制字符
        s = CONTROL_CHARS.matcher(s).replaceAll("");
        // 限制长度，避免文件系统问题
        if (s.length() > 100) s = s.substring(0, 100);
        return s.isEmpty() ? null : s;
    }

    /** 列出所有 PGN 缓存条目（按修改时间倒序），返回 JSON 数组字符串 */
    public String listCaches() {
        try {
            File dir = getCacheDir();
            File[] files = dir.listFiles();
            if (files == null) return "[]";
            // 按修改时间倒序排序
            Arrays.sort(files, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
            JSONArray arr = new JSONArray();
            // 预加载所有标签文件到 Map，实现 O(1) 查询
            Map<String, JSONArray> tagMap = new HashMap<>();
            for (File f : files) {
                String fn = f.getName();
                if (fn.endsWith(".tags.json")) {
                    String baseName = fn.substring(0, fn.length() - ".tags.json".length());
                    try {
                        String content = getTags(baseName);
                        tagMap.put(baseName, new JSONArray(content));
                    } catch (Throwable ignored) {
                        // 标签文件损坏不影响列表
                    }
                }
            }
            for (File f : files) {
                if (!f.isFile()) continue;
                String fn = f.getName();
                if (fn.endsWith(".tags.json")) continue; // 跳过标签文件
                // v1.2.3 round-44 (E2): 只列出 .pgn 条目 —— 目录中的杂散文件
                //   （备份、半成品临时文件）不应作为缓存条目暴露给 JS。过滤后
                //   fn 必然以 .pgn 结尾，displayName 直接截尾。
                if (!fn.endsWith(".pgn")) continue;
                String displayName = fn.substring(0, fn.length() - 4);
                try {
                    org.json.JSONObject obj = new org.json.JSONObject();
                    obj.put("name", displayName);
                    obj.put("size", f.length());
                    obj.put("mtime", f.lastModified());
                    JSONArray tags = tagMap.get(displayName);
                    obj.put("tags", tags != null ? tags : new JSONArray());
                    arr.put(obj);
                } catch (Throwable ignored) {
                    // 单条目损坏不影响整体列表
                }
            }
            return arr.toString();
        } catch (Throwable e) {
            Log.w(TAG, "listCaches failed", e);
            return "[]";
        }
    }

    /** 保存 PGN 缓存。返回 true 表示成功 */
    public boolean save(String name, String pgn) {
        if (name == null || pgn == null) return false;
        String safe = sanitizeName(name);
        if (safe == null) return false;
        try {
            // v1.2.3 round-79 (ROB-03): 单文件写上限 —— 写前检查 UTF-8 字节数，
            //   超限拒绝写入（旧文件保持原样），避免超大输入直接绕过预算语义。
            long pgnBytes = pgn.getBytes(StandardCharsets.UTF_8).length;
            if (pgnBytes > MAX_PGN_WRITE_BYTES) {
                Log.w(TAG, "save refused: content exceeds per-file write cap (" + pgnBytes + CAP_REFUSAL_BYTES_SUFFIX + safe); // mobsf-ignore: android_logging
                return false;
            } // mobsf-ignore: android_logging
            File file = new File(getCacheDir(), safe + ".pgn");
            AtomicFileStore.writeUtf8(file, pgn);
            Log.i(TAG, "PGN cache saved: " + safe + " (" + pgn.length() + " chars)"); // mobsf-ignore: android_logging
            evictIfNeeded(); // v1.2.3 round-44 (E9): 保存成功后做 LRU 淘汰
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "save failed for name=" + safe, e); // mobsf-ignore: android_logging
            return false;
        } // mobsf-ignore: android_logging
    }

    /** 读取 PGN 缓存内容。返回 null 表示不存在或读取失败 */
    public String get(String name) {
        if (name == null) return null;
        String safe = sanitizeName(name);
        if (safe == null) return null;
        try {
            File file = new File(getCacheDir(), safe + ".pgn");
            if (!file.exists() || !file.isFile()) return null;
            try (FileInputStream fis = new FileInputStream(file);
                 InputStreamReader reader = new InputStreamReader(fis, "UTF-8");
                 StringWriter sw = new StringWriter()) {
                char[] buf = new char[8192];
                int n;
                while ((n = reader.read(buf)) > 0) {
                    // v1.2.3 round-79 (ROB-03): 读取上限（追加前检查）。
                    //   StringWriter 没有 size() 方法 —— 长度一律取
                    //   sw.getBuffer().length()（round-78 曾误用不存在的
                    //   sw.size()，属编译阻断级错误，CodeRabbit PR#60 已指出）。
                    if (sw.getBuffer().length() + n > MAX_PGN_READ_CHARS) {
                        Log.w(TAG, "get refused: content exceeds per-file read cap: " + safe); // mobsf-ignore: android_logging
                        return null;
                    } // mobsf-ignore: android_logging
                    sw.write(buf, 0, n);
                }
                return sw.toString();
            }
        } catch (Exception e) {
            Log.w(TAG, "get failed for name=" + safe, e); // mobsf-ignore: android_logging
            return null;
        } // mobsf-ignore: android_logging
    }

    /** 删除单个 PGN 缓存条目（同时删除关联的标签文件）。返回 true 表示至少一项删除成功 */
    public boolean delete(String name) {
        if (name == null) return false;
        String safe = sanitizeName(name);
        if (safe == null) return false;
        try {
            File file = new File(getCacheDir(), safe + ".pgn");
            // v1.2.3 round-13 (P2): track any deletion so orphan tags cleanup
            //   is reported as success. Previously the method returned only
            //   pgnDeleted, so a successful tags-only cleanup (e.g. after a
            //   previous save() for the PGN failed mid-write, or the PGN was
            //   deleted out-of-band) returned false, misleading deleteBatch's
            //   count and hiding partial-success states.
            boolean anyDeleted = false;
            if (file.exists()) {
                boolean pgnDeleted = file.delete();
                if (!pgnDeleted) {
                    Log.w(TAG, "delete: failed to delete PGN file " + safe); // mobsf-ignore: android_logging
                }
                anyDeleted = anyDeleted || pgnDeleted;
            }
            // 同时删除关联的标签文件
            File tagsFile = new File(getCacheDir(), safe + ".tags.json");
            if (tagsFile.exists()) {
                boolean tagsDeleted = tagsFile.delete();
                if (!tagsDeleted) {
                    Log.w(TAG, "delete: failed to delete tags file " + safe); // mobsf-ignore: android_logging
                }
                anyDeleted = anyDeleted || tagsDeleted;
            }
            return anyDeleted;
        } catch (Throwable e) {
            Log.w(TAG, "delete failed for name=" + safe, e); // mobsf-ignore: android_logging
            return false;
        } // mobsf-ignore: android_logging
    }

    /** 批量删除 PGN 缓存。namesJson 为 JSON 字符串数组，返回成功删除的条目数 */
    public int deleteBatch(String namesJson) {
        if (namesJson == null) return 0;
        int deleted = 0;
        try {
            JSONArray arr = new JSONArray(namesJson);
            for (int i = 0; i < arr.length(); i++) {
                String name = arr.optString(i, "");
                if (delete(name)) deleted++;
            }
        } catch (Throwable e) {
            Log.w(TAG, "deleteBatch failed", e);
        }
        return deleted;
    }

    /**
     * 原子重命名 PGN 缓存条目（同时重命名标签文件）。
     *
     * v1.2.3 round-79 (ROB-09): 返回语义修正 —— PGN 文件已改名但标签迁移/
     *   删除失败（"PGN renamed but tags lost/failed"的部分成功）现在返回
     *   false 而非 true：旧名 PGN 已不存在、新名条目缺标签，调用方必须
     *   刷新缓存列表（JS 侧 chess.src/ui.js 与 chess.html 的失败分支已同步
     *   刷新），否则列表保留旧名导致打开失败。完全成功（或条目本无标签）
     *   仍返回 true。
     */
    public boolean rename(String oldName, String newName) {
        if (oldName == null || newName == null) return false;
        String oldSafe = sanitizeName(oldName);
        String newSafe = sanitizeName(newName);
        if (oldSafe == null || newSafe == null) return false;
        if (oldSafe.equals(newSafe)) return true; // 空操作
        try {
            File oldFile = new File(getCacheDir(), oldSafe + ".pgn");
            File newFile = new File(getCacheDir(), newSafe + ".pgn");
            if (!oldFile.exists()) return false;
            if (newFile.exists()) return false; // 拒绝覆盖
            if (!oldFile.renameTo(newFile)) {
                Log.w(TAG, "rename: renameTo failed " + oldSafe + " -> " + newSafe);
                return false;
            }
            // 同时重命名标签文件
            File oldTags = new File(getCacheDir(), oldSafe + ".tags.json");
            boolean tagsLost = false;
            if (oldTags.exists()) {
                File newTags = new File(getCacheDir(), newSafe + ".tags.json");
                if (!oldTags.renameTo(newTags)) {
                    // v1.2.3 round-44 (E1): renameTo 失败 → 复制-删除回退；
                    //   仍失败 → 删除原 tags 文件。孤儿防护：旧名 tags 残留
                    //   会关联到已不存在的旧名 PGN，或在名称被复用时张冠李戴
                    //   —— 宁可丢标签也不能留错标签。
                    if (copyAndDelete(oldTags, newTags)) {
                        Log.i(TAG, "rename: tags moved via copy-delete fallback " + oldSafe); // mobsf-ignore: android_logging
                    } else {
                        Log.w(TAG, "rename: tags copy-delete failed, deleting original tags " + oldSafe); // mobsf-ignore: android_logging
                        if (!oldTags.delete()) {
                            // v1.2.3 round-79 (ROB-09): 旧名 tags 残留成为孤儿；
                            //   evictIfNeeded 的孤儿候选最终会回收。
                            Log.w(TAG, "rename: failed to delete original tags file (orphan retained) " + oldSafe); // mobsf-ignore: android_logging
                        }
                        // v1.2.3 round-79 (ROB-09): PGN 已改名、标签丢失/迁移失败
                        //   —— 部分成功报 false，调用方须刷新缓存列表。
                        tagsLost = true;
                    }
                }
            }
            if (tagsLost) {
                Log.w(TAG, "PGN renamed but tags lost/failed: " + oldSafe + " -> " + newSafe); // mobsf-ignore: android_logging
                return false;
            }
            Log.i(TAG, "PGN cache renamed: " + oldSafe + " -> " + newSafe);
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "rename failed: " + oldSafe + " -> " + newSafe, e);
            return false;
        } // mobsf-ignore: android_logging
    }

    /**
     * 设置 PGN 缓存条目的标签。tagsJson 为 JSON 字符串数组。
     *
     * v1.2.3 round-79 (ROB-03, CodeRabbit PR#60): 序列化结果的 UTF-8 字节数
     *   在写入前检查（与 getTags 的读取上限对称）。超限时保留旧文件并返回
     *   false —— 避免"确认保存成功后标签又被读取上限隐藏"的不一致。
     * v1.2.3 round-79 (SonarCloud S1141): 原嵌套 try（删除失败回退空数组写）
     *   提取为 {@link #clearTagsFile}。
     */
    public boolean setTags(String name, String tagsJson) {
        if (name == null) return false;
        String safe = sanitizeName(name);
        if (safe == null) return false;
        try {
            File tagsFile = new File(getCacheDir(), safe + ".tags.json");
            JSONArray arr;
            if (tagsJson == null || tagsJson.trim().isEmpty()) {
                arr = new JSONArray();
            } else {
                arr = new JSONArray(tagsJson);
            }
            if (arr.length() == 0) {
                // 无标签 - 删除文件（失败回退空数组写，见 clearTagsFile）
                return clearTagsFile(tagsFile, safe);
            }
            String serialized = arr.toString();
            long serializedBytes = serialized.getBytes(StandardCharsets.UTF_8).length;
            if (serializedBytes > MAX_TAGS_FILE_BYTES) {
                // 超限：保留旧文件并返回 false（getTags 之后仍能读到旧标签）
                Log.w(TAG, "setTags refused: serialized tags exceed per-file cap (" + serializedBytes + CAP_REFUSAL_BYTES_SUFFIX + safe); // mobsf-ignore: android_logging
                return false;
            } // mobsf-ignore: android_logging
            AtomicFileStore.writeUtf8(tagsFile, serialized);
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "setTags failed for name=" + safe, e); // mobsf-ignore: android_logging
            return false;
        } // mobsf-ignore: android_logging
    }

    /**
     * v1.2.3 round-79 (SonarCloud S1141): 清空标签文件 —— 删除失败（fd 占用/
     *   瞬态错误）时回退原子写入空数组 "[]"（getTags 解析后语义等价于无标签）；
     *   仍失败返回 false，让调用方知道清空未生效，而不是静默吞掉。
     *   （原为 setTags 内的嵌套 try 块，v1.2.3 round-44 (E3) 引入。）
     */
    private boolean clearTagsFile(File tagsFile, String safe) {
        if (!tagsFile.exists()) {
            return true;
        }
        if (tagsFile.delete()) {
            return true;
        }
        Log.w(TAG, "setTags: delete failed, falling back to empty-array write " + safe); // mobsf-ignore: android_logging
        try {
            AtomicFileStore.writeUtf8(tagsFile, "[]");
        } catch (Exception e2) {
            Log.w(TAG, "setTags: empty-array fallback failed " + safe, e2); // mobsf-ignore: android_logging
            return false;
        }
        return true;
    }

    /**
     * v1.2.3 round-44 (E1): 复制 src 到 dst（+fsync）成功后删除 src。
     * v1.2.3 round-46 (PR53 CR#25): 复制中途失败时删除可能已截断的 dst ——
     * 此前异常路径直接 return false，残留的半截 .tags.json 会让 JS 侧
     * JSON.parse 抛异常；源文件仍在，删除残次副本可安全重试。
     */
    private static boolean copyAndDelete(File src, File dst) {
        try {
            byte[] buf = new byte[8192];
            try (FileInputStream fis = new FileInputStream(src);
                 FileOutputStream fos = new FileOutputStream(dst)) {
                int n;
                while ((n = fis.read(buf)) > 0) {
                    fos.write(buf, 0, n);
                }
                fos.flush();
                try { fos.getFD().sync(); } catch (Exception ignored) {
                    // best-effort
                }
            }
            return src.delete();
        } catch (Exception e) {
            Log.w(TAG, "copyAndDelete failed: " + src + " -> " + dst, e);
            try {
                if (dst.exists() && !dst.delete()) {
                    Log.w(TAG, "copyAndDelete: could not remove truncated dst " + dst); // mobsf-ignore: android_logging
                }
            } catch (Throwable e2) {
                Log.w(TAG, "copyAndDelete: dst cleanup failed", e2);
            }
            return false;
        }
    }

    /**
     * v1.2.3 round-44 (E9): LRU 淘汰 —— 缓存目录的受管文件（.pgn 与
     *   .tags.json）总大小超过 MAX_CACHE_BYTES 时，按 lastModified 升序删除
     *   最旧的 .pgn（含关联 .tags.json），直到回到上限以内；若仍超限，
     *   继续淘汰最旧的孤儿 .tags.json（其 .pgn 已不存在的残留标签）。
     *   在 save() 成功后调用；best-effort，失败仅记录日志。
     *
     * v1.2.3 round-79 (ROB-03): 预算语义修正 —— 此前统计**全部**文件总量
     *   （含杂散文件）却只淘汰 .pgn，杂散文件（备份、半成品临时文件）会让
     *   总量永远降不回预算。现在：受管文件计入预算并参与淘汰（孤儿标签为
     *   第二优先候选）；杂散文件显式"受控忽略"（不计入预算、不被本方法
     *   删除——清理策略属用户决策，见 listCaches 的 E2 过滤注释）。淘汰排空
     *   后仍超限（单个受管文件超过预算自身）输出警告。
     */
    private void evictIfNeeded() {
        try {
            File dir = getCacheDir();
            File[] files = dir.listFiles();
            if (files == null) return;
            long total = 0;
            java.util.List<File> pgns = new java.util.ArrayList<>();
            java.util.List<File> orphanTags = new java.util.ArrayList<>();
            for (File f : files) {
                if (!f.isFile()) continue;
                String fn = f.getName();
                if (fn.endsWith(".pgn")) {
                    // 受管：计入预算，作为第一优先淘汰候选
                    total += f.length();
                    pgns.add(f);
                } else if (fn.endsWith(".tags.json")) {
                    // 受管：计入预算；是否孤儿稍后判定（其 .pgn 可能存在）
                    total += f.length();
                }
                // 其余杂散文件：ROB-03 受控忽略 —— 不计入预算、不被本方法
                //   删除（避免删除用户自置文件，同时杜绝杂散体积使 LRU 永远
                //   超预算的死锁）。
            }
            if (total <= MAX_CACHE_BYTES) return;
            // 收集孤儿标签（.tags.json 存在而同名 .pgn 不存在）——第二优先候选
            for (File f : files) {
                if (!f.isFile()) continue;
                String fn = f.getName();
                if (fn.endsWith(".tags.json")) {
                    String base = fn.substring(0, fn.length() - ".tags.json".length());
                    File pgn = new File(dir, base + ".pgn");
                    if (!pgn.exists()) {
                        orphanTags.add(f);
                    }
                }
            }
            // v1.2.3 round-81 (CodeRabbit PR#60 outside-diff Minor): sort via
            //   Collections.sort() — List.sort() is a java.util.List DEFAULT
            //   interface method added in API 24; on minSdk 23 devices the call
            //   raises NoSuchMethodError at runtime. The round-80 S9412 cleanup
            //   swapped Collections.sort for List.sort here, silently raising
            //   the floor above minSdk. Collections.sort works on every API
            //   level; the S9412 "modernize" advice does not apply while
            //   minSdk is 23 (bootclasspath default methods are never
            //   desugared), so the S9412 finding is accepted as a deliberate
            //   false positive for this project.
            Collections.sort(pgns, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
            for (File f : pgns) {
                if (total <= MAX_CACHE_BYTES) break;
                String fn = f.getName();
                String base = fn.substring(0, fn.length() - 4);
                long len = f.length();
                File tags = new File(dir, base + ".tags.json");
                long tagsLen = tags.exists() ? tags.length() : 0;
                if (f.delete()) {
                    total -= len;
                } else {
                    Log.w(TAG, "evictIfNeeded: failed to delete " + fn); // mobsf-ignore: android_logging
                    continue;
                } // mobsf-ignore: android_logging
                if (tags.exists()) {
                    if (tags.delete()) {
                        total -= tagsLen;
                    } else {
                        Log.w(TAG, "evictIfNeeded: failed to delete tags " + base); // mobsf-ignore: android_logging
                    }
                } // mobsf-ignore: android_logging
                Log.i(TAG, "evictIfNeeded: evicted LRU cache entry " + base); // mobsf-ignore: android_logging
            }
            if (total > MAX_CACHE_BYTES) {
                // v1.2.3 round-79 (ROB-03): 受管 PGN 已排空仍超限 —— 淘汰最旧
                //   的孤儿标签（其 .pgn 已不存在的残留）。
                // v1.2.3 round-81 (CodeRabbit PR#60 outside-diff Minor): same
                //   Collections.sort() reasoning as the pgns sort above —
                //   List.sort() needs API 24, minSdk is 23.
                Collections.sort(orphanTags, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
                for (File tags : orphanTags) {
                    if (total <= MAX_CACHE_BYTES) break;
                    long tagsLen = tags.length();
                    if (tags.delete()) {
                        total -= tagsLen;
                        Log.i(TAG, "evictIfNeeded: evicted orphan tags " + tags.getName()); // mobsf-ignore: android_logging
                    } else {
                        Log.w(TAG, "evictIfNeeded: failed to delete orphan tags " + tags.getName()); // mobsf-ignore: android_logging
                    } // mobsf-ignore: android_logging
                }
            }
            if (total > MAX_CACHE_BYTES) {
                // 单个受管文件超过预算自身（或删除全部失败）—— 无法靠淘汰回到
                //   上限，输出警告供用户察觉；新保存的巨型条目会保留在预算外。
                Log.w(TAG, "evictIfNeeded: still over budget after LRU drain (total=" + total + " bytes); a single managed entry exceeds the budget"); // mobsf-ignore: android_logging
            }
        } catch (Throwable e) {
            Log.w(TAG, "evictIfNeeded failed", e);
        }
    }

    /**
     * 获取 PGN 缓存条目的标签。返回 JSON 字符串数组（无标签时返回 "[]"）。
     *
     * v1.2.3 round-79 (ROB-03): 双级读取上限 —— 文件级（File.length() 快速
     *   拒绝）+ 读取循环级（追加前检查，防 file.length() 与实际读取内容的
     *   竞态差异）。超限返回 "[]"（调用方语义等价于无标签）。
     *   读取循环长度一律使用 sw.getBuffer().length() —— StringWriter 没有
     *   size() 方法（round-78 曾误用，编译阻断级）。
     */
    public String getTags(String name) {
        if (name == null) return "[]";
        String safe = sanitizeName(name);
        if (safe == null) return "[]";
        try {
            File tagsFile = new File(getCacheDir(), safe + ".tags.json");
            if (!tagsFile.exists() || !tagsFile.isFile()) return "[]";
            if (tagsFile.length() > MAX_TAGS_FILE_BYTES) {
                Log.w(TAG, "getTags refused: file exceeds per-file read cap (" + tagsFile.length() + CAP_REFUSAL_BYTES_SUFFIX + safe); // mobsf-ignore: android_logging
                return "[]";
            } // mobsf-ignore: android_logging
            try (FileInputStream fis = new FileInputStream(tagsFile);
                 InputStreamReader reader = new InputStreamReader(fis, "UTF-8");
                 StringWriter sw = new StringWriter()) {
                char[] buf = new char[4096];
                int n;
                while ((n = reader.read(buf)) > 0) {
                    if (sw.getBuffer().length() + n > MAX_TAGS_READ_CHARS) {
                        Log.w(TAG, "getTags refused: content grew past read cap: " + safe); // mobsf-ignore: android_logging
                        return "[]";
                    } // mobsf-ignore: android_logging
                    sw.write(buf, 0, n);
                }
                return sw.toString();
            }
        } catch (Exception e) {
            Log.w(TAG, "getTags failed for name=" + safe, e); // mobsf-ignore: android_logging
            return "[]";
        } // mobsf-ignore: android_logging
    }
}
