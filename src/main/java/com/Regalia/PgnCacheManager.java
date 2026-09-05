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
import java.io.OutputStreamWriter;
import java.io.StringWriter;
import java.util.regex.Pattern;
import java.util.Arrays;
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
 */
public class PgnCacheManager {
    private static final String TAG = "PgnCacheManager";

    private static final String PGN_CACHE_DIR = "pgn_cache";

    // v1.2.3 round-44 (E9): LRU 淘汰上限。PGN 缓存此前无界增长（用户长期
    //   使用后 pgn_cache/ 可占数百 MB）。超过上限时按 lastModified 升序
    //   删除最旧的 .pgn 及其关联 .tags.json，直到回到上限以内。
    private static final long MAX_CACHE_BYTES = 50L * 1024 * 1024; // 50MB

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
            Log.w(TAG, "PgnCacheManager: mkdirs failed for " + cacheDir.getAbsolutePath());
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
            File file = new File(getCacheDir(), safe + ".pgn");
            try (FileOutputStream fos = new FileOutputStream(file);
                 OutputStreamWriter writer = new OutputStreamWriter(fos, "UTF-8")) {
                writer.write(pgn);
                writer.flush();
                // v1.2.3 round-18 (robustness): fsync before close so the PGN
                //   survives a process crash right after save() returns true —
                //   same guarantee setTags() already provides (see its
                //   fos.getFD().sync() below).
                try { fos.getFD().sync(); } catch (Throwable ignored) {
                    // best-effort on filesystems without fsync support
                }
            }
            Log.i(TAG, "PGN cache saved: " + safe + " (" + pgn.length() + " chars)");
            evictIfNeeded(); // v1.2.3 round-44 (E9): 保存成功后做 LRU 淘汰
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "save failed for name=" + safe, e);
            return false;
        }
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
                    sw.write(buf, 0, n);
                }
                return sw.toString();
            }
        } catch (Throwable e) {
            Log.w(TAG, "get failed for name=" + safe, e);
            return null;
        }
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
                    Log.w(TAG, "delete: failed to delete PGN file " + safe);
                }
                anyDeleted = anyDeleted || pgnDeleted;
            }
            // 同时删除关联的标签文件
            File tagsFile = new File(getCacheDir(), safe + ".tags.json");
            if (tagsFile.exists()) {
                boolean tagsDeleted = tagsFile.delete();
                if (!tagsDeleted) {
                    Log.w(TAG, "delete: failed to delete tags file " + safe);
                }
                anyDeleted = anyDeleted || tagsDeleted;
            }
            return anyDeleted;
        } catch (Throwable e) {
            Log.w(TAG, "delete failed for name=" + safe, e);
            return false;
        }
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

    /** 原子重命名 PGN 缓存条目（同时重命名标签文件）。返回 true 表示成功 */
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
            if (oldTags.exists()) {
                File newTags = new File(getCacheDir(), newSafe + ".tags.json");
                if (!oldTags.renameTo(newTags)) {
                    // v1.2.3 round-44 (E1): renameTo 失败 → 复制-删除回退；
                    //   仍失败 → 删除原 tags 文件。孤儿防护：旧名 tags 残留
                    //   会关联到已不存在的旧名 PGN，或在名称被复用时张冠李戴
                    //   —— 宁可丢标签也不能留错标签。
                    if (copyAndDelete(oldTags, newTags)) {
                        Log.i(TAG, "rename: tags moved via copy-delete fallback " + oldSafe);
                    } else {
                        Log.w(TAG, "rename: tags copy-delete failed, deleting original tags " + oldSafe);
                        if (!oldTags.delete()) {
                            Log.w(TAG, "rename: failed to delete original tags file " + oldSafe);
                        }
                    }
                }
            }
            Log.i(TAG, "PGN cache renamed: " + oldSafe + " -> " + newSafe);
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "rename failed: " + oldSafe + " -> " + newSafe, e);
            return false;
        }
    }

    /** 设置 PGN 缓存条目的标签。tagsJson 为 JSON 字符串数组 */
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
                // 无标签 - 删除文件
                if (tagsFile.exists()) {
                    if (!tagsFile.delete()) {
                        // v1.2.3 round-44 (E3): delete() 失败（fd 占用/瞬态
                        //   错误）→ 回退写入空数组 "[]" + fsync（getTags 解析
                        //   后语义等价于无标签）；仍失败返回 false，让调用方
                        //   知道清空未生效，而不是静默吞掉。
                        Log.w(TAG, "setTags: delete failed, falling back to empty-array write " + safe);
                        try (FileOutputStream fos = new FileOutputStream(tagsFile);
                             OutputStreamWriter writer = new OutputStreamWriter(fos, "UTF-8")) {
                            writer.write("[]");
                            writer.flush();
                            try { fos.getFD().sync(); } catch (Throwable ignored) {
                                // sync 失败不阻塞写入
                            }
                        } catch (Throwable e2) {
                            Log.w(TAG, "setTags: empty-array fallback failed " + safe, e2);
                            return false;
                        }
                    }
                }
                return true;
            }
            try (FileOutputStream fos = new FileOutputStream(tagsFile);
                 OutputStreamWriter writer = new OutputStreamWriter(fos, "UTF-8")) {
                writer.write(arr.toString());
                writer.flush();
                try { fos.getFD().sync(); } catch (Throwable ignored) {
                    // sync 失败不阻塞写入
                }
            }
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "setTags failed for name=" + safe, e);
            return false;
        }
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
                try { fos.getFD().sync(); } catch (Throwable ignored) {
                    // best-effort
                }
            }
            return src.delete();
        } catch (Throwable e) {
            Log.w(TAG, "copyAndDelete failed: " + src + " -> " + dst, e);
            try {
                if (dst.exists() && !dst.delete()) {
                    Log.w(TAG, "copyAndDelete: could not remove truncated dst " + dst);
                }
            } catch (Throwable e2) {
                Log.w(TAG, "copyAndDelete: dst cleanup failed", e2);
            }
            return false;
        }
    }

    /**
     * v1.2.3 round-44 (E9): LRU 淘汰 —— 缓存目录总大小超过 MAX_CACHE_BYTES
     * 时，按 lastModified 升序删除最旧的 .pgn（含关联 .tags.json），直到
     * 回到上限以内。在 save() 成功后调用；best-effort，失败仅记录日志。
     */
    private void evictIfNeeded() {
        try {
            File dir = getCacheDir();
            File[] files = dir.listFiles();
            if (files == null) return;
            long total = 0;
            java.util.List<File> pgns = new java.util.ArrayList<>();
            for (File f : files) {
                if (!f.isFile()) continue;
                total += f.length();
                if (f.getName().endsWith(".pgn")) pgns.add(f);
            }
            if (total <= MAX_CACHE_BYTES) return;
            java.util.Collections.sort(pgns,
                    (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
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
                    Log.w(TAG, "evictIfNeeded: failed to delete " + fn);
                    continue;
                }
                if (tags.exists()) {
                    if (tags.delete()) {
                        total -= tagsLen;
                    } else {
                        Log.w(TAG, "evictIfNeeded: failed to delete tags " + base);
                    }
                }
                Log.i(TAG, "evictIfNeeded: evicted LRU cache entry " + base);
            }
        } catch (Throwable e) {
            Log.w(TAG, "evictIfNeeded failed", e);
        }
    }

    /** 获取 PGN 缓存条目的标签。返回 JSON 字符串数组（无标签时返回 "[]"） */
    public String getTags(String name) {
        if (name == null) return "[]";
        String safe = sanitizeName(name);
        if (safe == null) return "[]";
        try {
            File tagsFile = new File(getCacheDir(), safe + ".tags.json");
            if (!tagsFile.exists() || !tagsFile.isFile()) return "[]";
            try (FileInputStream fis = new FileInputStream(tagsFile);
                 InputStreamReader reader = new InputStreamReader(fis, "UTF-8");
                 StringWriter sw = new StringWriter()) {
                char[] buf = new char[4096];
                int n;
                while ((n = reader.read(buf)) > 0) {
                    sw.write(buf, 0, n);
                }
                return sw.toString();
            }
        } catch (Throwable e) {
            Log.w(TAG, "getTags failed for name=" + safe, e);
            return "[]";
        }
    }
}
