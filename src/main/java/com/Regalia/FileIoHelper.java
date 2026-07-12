package com.Regalia;

/*
 * Regalia - File I/O Helper
 * Copyright (C) 2026 Regalia
 *
 * File I/O patterns derived from DroidFish (EngineUtil.java, EngineOptionsDialog.java)
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0 Phase 73+: Extracted from StockfishNative.java to reduce God Module size.
 *                   Encapsulates all file I/O operations invoked from JavaScript:
 *                   writeTextFile, readTextFile, getDefaultPaths, listFiles,
 *                   scanEngines, getParentPath, getExportPath, loadAssetAsBase64.
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

import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.TreeMap;

/**
 * FileIoHelper — 文件 I/O 辅助类 (v1.2.0 Phase 73+)
 *
 * 职责:
 *   - 文本文件读写（writeTextFile / readTextFile）
 *   - 默认路径获取（getExportPath / getDefaultPaths）
 *   - 目录列表（listFiles，含 MediaStore 后备查询）
 *   - 父目录解析（getParentPath）
 *   - Asset 读取为 Base64（loadAssetAsBase64）
 *   - 引擎扫描（scanEngines，v18.5.0 起为空桩，保持 JS API 兼容）
 *
 * 安全设计:
 *   - 写入操作有三重后备：主路径 → 应用私有目录 → 剪贴板
 *   - 读取操作检查 READ_EXTERNAL_STORAGE 权限（Android 5-9）
 *   - listFiles 在 Android 11+ 使用 MediaStore 补充查询被 scoped storage 隐藏的文件
 *   - Asset 读取验证路径不含 ".." 防止目录穿越
 */
public class FileIoHelper {
    private static final String TAG = "FileIoHelper";

    private final Context context;
    private final WeakReference<Activity> activityRef;

    public FileIoHelper(Context context, WeakReference<Activity> activityRef) {
        this.context = context.getApplicationContext();
        this.activityRef = activityRef;
    }

    /** 获取应用私有导出目录路径（确保目录存在） */
    public String getExportPath() {
        File dir = new File(context.getFilesDir(), "export");
        if (!dir.exists()) {
            if (!dir.mkdirs()) {
                Log.w(TAG, "getExportPath: mkdirs failed for " + dir.getAbsolutePath());
            }
        }
        return dir.getAbsolutePath();
    }

    /**
     * 将文本内容写入文件。
     * v18.6.0: 三重后备——主路径（3 次重试）→ 应用私有目录 → 剪贴板。
     *
     * @param path 目标文件路径
     * @param content 文本内容
     * @return true 表示写入成功（主路径或后备路径）
     */
    public boolean writeTextFile(String path, String content) {
        // 主路径：最多 3 次重试，每次间隔 1 秒
        for (int attempt = 1; attempt <= 3; attempt++) {
            if (writeToFileInternal(path, content, "attempt " + attempt + "/3")) {
                return true;
            }
            if (attempt < 3) {
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        // 后备 1：应用私有导出目录
        String fallbackPath = new File(context.getFilesDir(), "export")
                .getAbsolutePath() + "/" + new File(path).getName();
        if (writeToFileInternal(fallbackPath, content, "fallback (app-specific)")) {
            return true;
        }

        // 后备 2：复制到剪贴板作为最后手段
        copyToClipboardAsLastResort(content);
        return false;
    }

    /** 内部写入方法，返回 true 表示成功 */
    private boolean writeToFileInternal(String path, String content, String tag) {
        try {
            File file = new File(path);
            File parentDir = file.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                if (!parentDir.mkdirs()) {
                    Log.w(TAG, "writeToFileInternal: mkdirs failed for " + parentDir.getAbsolutePath());
                }
            }
            try (FileOutputStream fos = new FileOutputStream(file);
                 OutputStreamWriter writer = new OutputStreamWriter(fos, "UTF-8")) {
                writer.write(content);
                writer.flush();
            }
            Log.i(TAG, "File written (" + tag + "): " + path);
            return true;
        } catch (Throwable e) {
            Log.w(TAG, "writeTextFile " + tag + " failed: " + path, e);
            return false;
        }
    }

    /** 剪贴板后备：将内容复制到系统剪贴板 */
    private void copyToClipboardAsLastResort(String content) {
        try {
            android.content.ClipboardManager clipboard = (android.content.ClipboardManager)
                    context.getSystemService(Context.CLIPBOARD_SERVICE);
            if (clipboard != null) {
                android.content.ClipData clip = android.content.ClipData.newPlainText("Regalia Export", content);
                clipboard.setPrimaryClip(clip);
                Log.i(TAG, "writeTextFile: content copied to clipboard as last resort");
            }
        } catch (Throwable e) {
            Log.w(TAG, "writeTextFile: clipboard fallback also failed", e);
        }
    }

    /**
     * 读取文本文件内容。
     * v18.6.0: Android 5-9 需要 READ_EXTERNAL_STORAGE 权限。
     * Android 10+ scoped storage 下应用私有目录无需权限。
     *
     * @param path 文件路径
     * @return 文件内容字符串，失败返回 null
     */
    public String readTextFile(String path) {
        // Android 5-9: 检查并请求 READ_EXTERNAL_STORAGE
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            ensureReadExternalStoragePermission();
        }

        try {
            File file = new File(path);
            if (!file.exists() || !file.canRead()) return null;
            try (FileInputStream fis = new FileInputStream(file);
                 BufferedReader reader = new BufferedReader(
                     new InputStreamReader(fis, "UTF-8")
                 )) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line).append("\n");
                }
                return sb.toString();
            }
        } catch (Throwable e) {
            Log.e(TAG, "readTextFile failed: " + path, e);
            return null;
        }
    }

    /** 请求 READ_EXTERNAL_STORAGE 权限（Android 5-9） */
    private void ensureReadExternalStoragePermission() {
        if (context.checkSelfPermission(android.Manifest.permission.READ_EXTERNAL_STORAGE)
                != PackageManager.PERMISSION_GRANTED) {
            Activity activity = activityRef.get();
            if (activity != null) {
                try {
                    activity.requestPermissions(
                        new String[]{android.Manifest.permission.READ_EXTERNAL_STORAGE},
                        1002
                    );
                } catch (Throwable e) {
                    Log.w(TAG, "could not request READ_EXTERNAL_STORAGE", e);
                }
            }
        }
    }

    /**
     * 获取默认文件系统路径（外部存储、Downloads、Documents）。
     * @return JSON 对象字符串，失败返回硬编码默认值
     */
    public String getDefaultPaths() {
        try {
            JSONObject paths = new JSONObject();
            paths.put("externalStorage", Environment.getExternalStorageDirectory().getAbsolutePath());
            paths.put("downloads", Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOWNLOADS).getAbsolutePath());
            paths.put("documents", Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_DOCUMENTS).getAbsolutePath());
            return paths.toString();
        } catch (Throwable e) {
            Log.e(TAG, "getDefaultPaths failed", e);
            return "{\"externalStorage\":\"/sdcard\",\"downloads\":\"/storage/emulated/0/Download\",\"documents\":\"/storage/emulated/0/Documents\"}";
        }
    }

    /**
     * 列出目录下的文件和子目录。
     * FIX: Android 11+ (API 30+) 补充 MediaStore 查询，发现被 scoped storage 隐藏的 .txt/.cfg 文件。
     *
     * @param dirPath 目录路径
     * @return JSON 数组字符串，目录在前文件在后，均按名称排序
     */
    public String listFiles(String dirPath) {
        try {
            JSONArray result = new JSONArray();
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) return result.toString();

            // TreeMap 按路径去重 File API + MediaStore 结果
            TreeMap<String, JSONObject> fileMap = new TreeMap<>();

            // 来源 1: java.io.File.listFiles() — 显示目录和部分文件
            addFileApiResults(dir, fileMap);

            // 来源 2: MediaStore 查询 — Android 11+ 发现被隐藏的文件
            if (Build.VERSION.SDK_INT >= 30) {
                addMediaStoreResults(dirPath, fileMap);
            }

            // 转换为排序后的 JSONArray：目录在前，文件在后
            return buildSortedListingResult(fileMap);
        } catch (Throwable e) {
            Log.e(TAG, "listFiles failed: " + dirPath, e);
            return "[]";
        }
    }

    /** 使用 java.io.File.listFiles() 填充文件映射 */
    private void addFileApiResults(File dir, TreeMap<String, JSONObject> fileMap) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            try {
                JSONObject obj = new JSONObject();
                obj.put("name", f.getName());
                obj.put("path", f.getAbsolutePath());
                obj.put("isDirectory", f.isDirectory());
                obj.put("size", f.length());
                fileMap.put(f.getAbsolutePath(), obj);
            } catch (Throwable e) {
                // 跳过有问题的文件
            }
        }
    }

    /** 使用 MediaStore 查询补充文件列表（Android 11+） */
    private void addMediaStoreResults(String dirPath, TreeMap<String, JSONObject> fileMap) {
        try {
            String[] projection = {
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.DATA,
                MediaStore.MediaColumns.SIZE
            };
            android.database.Cursor cursor = context.getContentResolver().query(
                MediaStore.Files.getContentUri("external"),
                projection,
                MediaStore.MediaColumns.DATA + " LIKE ? AND " +
                MediaStore.MediaColumns.DATA + " NOT LIKE ?",
                new String[]{dirPath + "/%", dirPath + "/%/%"},
                null
            );
            if (cursor == null) return;
            try {
                int nameIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME);
                int dataIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA);
                int sizeIdx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE);
                while (cursor.moveToNext()) {
                    addMediaStoreEntry(cursor, nameIdx, dataIdx, sizeIdx, fileMap);
                }
            } finally {
                cursor.close();
            }
        } catch (Throwable e) {
            Log.w(TAG, "MediaStore query failed for: " + dirPath, e);
        }
    }

    /** 添加单个 MediaStore 条目到文件映射（仅 .txt/.cfg） */
    private void addMediaStoreEntry(android.database.Cursor cursor, int nameIdx, int dataIdx,
                                     int sizeIdx, TreeMap<String, JSONObject> fileMap) {
        try {
            String filePath = cursor.getString(dataIdx);
            if (filePath == null || fileMap.containsKey(filePath)) return;
            String fileName = cursor.getString(nameIdx);
            if (fileName == null) return;
            // 仅包含 .txt 和 .cfg 文件（这些通常被 scoped storage 隐藏）
            if (!fileName.endsWith(".txt") && !fileName.endsWith(".cfg")) return;
            long fileSize = sizeIdx >= 0 ? cursor.getLong(sizeIdx) : 0;
            JSONObject obj = new JSONObject();
            obj.put("name", fileName);
            obj.put("path", filePath);
            obj.put("isDirectory", false);
            obj.put("size", fileSize);
            fileMap.put(filePath, obj);
        } catch (Throwable e) {
            // 跳过有问题的条目
        }
    }

    /** 将文件映射转换为排序后的 JSON 数组（目录在前，文件在后） */
    private String buildSortedListingResult(TreeMap<String, JSONObject> fileMap) throws Throwable {
        JSONArray result = new JSONArray();
        List<JSONObject> dirs = new ArrayList<>();
        List<JSONObject> files = new ArrayList<>();
        for (JSONObject obj : fileMap.values()) {
            if (obj.getBoolean("isDirectory")) {
                dirs.add(obj);
            } else {
                files.add(obj);
            }
        }
        sortByName(dirs);
        sortByName(files);
        for (JSONObject obj : dirs) result.put(obj);
        for (JSONObject obj : files) result.put(obj);
        return result.toString();
    }

    /** 按名称排序 JSON 对象列表（忽略大小写） */
    private void sortByName(List<JSONObject> list) {
        Collections.sort(list, (a, b) -> {
            try { return a.getString("name").compareToIgnoreCase(b.getString("name")); }
            catch (Throwable e) { return 0; }
        });
    }

    /**
     * v18.5.0: 扫描引擎——仅支持内置引擎，返回空数组。
     * 保留为桩函数以维持 JS API 兼容性。
     */
    public String scanEngines() {
        return "[]";
    }

    /**
     * 获取规范化的父目录路径。
     * 使用 java.io.File.getParentFile() 而非字符串拼接 "/.."。
     *
     * @param path 目录路径
     * @return 父目录路径，无父目录返回空字符串
     */
    public String getParentPath(String path) {
        try {
            if (path == null || path.isEmpty()) return "";
            File dir = new File(path);
            File parent = dir.getParentFile();
            return parent != null ? parent.getAbsolutePath() : "";
        } catch (Throwable e) {
            Log.w(TAG, "getParentPath failed: " + path, e);
            return "";
        }
    }

    /**
     * 将 Asset 文件读取为 Base64 编码字符串。
     * 安全检查：路径不含 ".." 防止目录穿越。
     *
     * @param assetPath Asset 路径（相对路径）
     * @return Base64 编码字符串，失败返回空字符串
     */
    public String loadAssetAsBase64(String assetPath) {
        if (assetPath == null || assetPath.isEmpty()) return "";
        // 安全：禁止 ".." 防止目录穿越
        if (assetPath.contains("..")) {
            Log.w(TAG, "loadAssetAsBase64: path traversal blocked: " + assetPath);
            return "";
        }
        try (InputStream is = context.getAssets().open(assetPath)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            while ((bytesRead = is.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            return Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
        } catch (IOException e) {
            Log.w(TAG, "loadAssetAsBase64: asset not found: " + assetPath);
            return "";
        } catch (Throwable e) {
            Log.e(TAG, "loadAssetAsBase64 failed: " + assetPath, e);
            return "";
        }
    }
}
