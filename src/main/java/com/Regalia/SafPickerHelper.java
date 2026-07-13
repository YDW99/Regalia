package com.Regalia;

/*
 * Regalia - SAF Picker Helper
 * Copyright (C) 2026 Regalia
 *
 * SAF file picker patterns derived from DroidFish (EngineOptionsDialog.java)
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0 Phase 73+: Extracted from StockfishNative.java to reduce God Module size.
 *                   Encapsulates all Storage Access Framework (SAF) file picker
 *                   operations: export (settings/PGN) and import (settings/PGN).
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
import android.content.Intent;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.lang.ref.WeakReference;

/**
 * SafPickerHelper — SAF 文件选择器辅助类 (v1.2.0 Phase 73+)
 *
 * 职责:
 *   - 导出文件选择器: openExportFilePicker (设置) / openPGNExportFilePicker (PGN)
 *   - 导入文件选择器: openSystemFilePicker (设置) / openPGNFilePicker (PGN)
 *   - 导出结果处理: handleExportResult — 写入内容到用户选择的 URI
 *   - 导入结果处理: handleImportResult (设置) / handlePGNImportResult (PGN)
 *   - 取消挂起的导出: cancelPendingExport
 *
 * 安全设计:
 *   - PGN 导入有 5000 行截断保护防止 OOM
 *   - PGN 内容经过控制字符过滤，防止破坏 JS 字符串解析
 *   - 导出内容通过 JSON 编码安全传递到 JS
 *   - 持久化 URI 权限以便后续访问
 *
 * 线程安全: 挂起内容字段使用 volatile，确保跨线程可见性。
 */
public class SafPickerHelper {
    private static final String TAG = "SafPickerHelper";

    // SAF 请求码（与 StockfishNative 中的常量保持一致）
    public static final int REQUEST_CODE_IMPORT_SETTINGS = 1001;
    public static final int REQUEST_CODE_EXPORT_SETTINGS = 1002;
    public static final int REQUEST_CODE_IMPORT_PGN = 1003;
    public static final int REQUEST_CODE_EXPORT_PGN = 1004;

    // PGN 导入行数上限，防止 OOM
    private static final int PGN_MAX_LINES = 5000;

    private final Context context;
    private final WeakReference<Activity> activityRef;
    private final Callbacks callbacks;

    /** 挂起的导出内容 — SAF 选择器返回前临时存储 */
    private volatile String _pendingExportContent = null;
    /** 挂起的导出类型 — "settings" 或 "pgn" */
    private volatile String _pendingExportType = "settings";

    /** 回调接口 — 由 StockfishNative 实现 */
    public interface Callbacks {
        /** 在主线程执行 JS 表达式 */
        void postJsCallback(String jsExpression);
        /** 转义 JS 字符串字面量 */
        String escapeJsString(String s);
        /** 导入设置内容（由设置导入处理器调用） */
        void importSettings(String content);
    }

    public SafPickerHelper(Context context, WeakReference<Activity> activityRef, Callbacks callbacks) {
        this.context = context.getApplicationContext();
        this.activityRef = activityRef;
        this.callbacks = callbacks;
    }

    // ===================== 导出选择器 =====================

    /** 打开 SAF 导出选择器（设置文件） */
    public void openExportFilePicker(String content) {
        if (content == null || content.isEmpty()) {
            Log.w(TAG, "openExportFilePicker: empty content, skipping");
            return;
        }
        _pendingExportContent = content;
        _pendingExportType = "settings";
        Activity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, "openExportFilePicker: no valid Activity reference");
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("text/plain");
            intent.putExtra(Intent.EXTRA_TITLE, "Regalia_engine_settings.txt");
            activity.startActivityForResult(intent, REQUEST_CODE_EXPORT_SETTINGS);
            Log.i(TAG, "SAF export file picker opened");
        } catch (Throwable e) {
            Log.e(TAG, "openExportFilePicker failed", e);
            _pendingExportContent = null;
            _pendingExportType = "settings";
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /** 打开 SAF 导出选择器（PGN 文件） */
    public void openPGNExportFilePicker(String content) {
        if (content == null || content.isEmpty()) {
            Log.w(TAG, "openPGNExportFilePicker: empty content, skipping");
            return;
        }
        _pendingExportContent = content;
        _pendingExportType = "pgn";
        Activity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, "openPGNExportFilePicker: no valid Activity reference");
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/x-chess-pgn");
            intent.putExtra(Intent.EXTRA_TITLE, "Regalia_game.pgn");
            activity.startActivityForResult(intent, REQUEST_CODE_EXPORT_PGN);
            Log.i(TAG, "SAF PGN export file picker opened");
        } catch (Throwable e) {
            Log.e(TAG, "openPGNExportFilePicker failed", e);
            _pendingExportContent = null;
            _pendingExportType = "settings";
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /** 取消挂起的导出（用户取消了 SAF 选择器） */
    public void cancelPendingExport() {
        _pendingExportContent = null;
        _pendingExportType = "settings";
        try {
            callbacks.postJsCallback("if(typeof onExportCancelled==='function')onExportCancelled();");
        } catch (Throwable ignored) {
            // 通知 JS 失败不阻塞流程
        }
    }

    /** 处理 SAF 导出结果 — 写入内容到用户选择的 URI */
    public void handleExportResult(Intent data) {
        String content = _pendingExportContent;
        String exportType = _pendingExportType;
        _pendingExportContent = null;
        _pendingExportType = "settings"; // 重置为默认
        if (data == null || data.getData() == null || content == null) {
            Log.w(TAG, "handleExportResult: invalid data or no pending content");
            return;
        }
        try {
            Uri uri = data.getData();
            // v1.2.1: 不再 takePersistableUriPermission —— 一次性导出不需要持久授权，
            //   transient FLAG_GRANT_WRITE_URI_PERMISSION from ACTION_CREATE_DOCUMENT
            //   已足够写入本次文件。持久授权会长期占用 SAF 512 上限。
            writeContentToUri(uri, content);
            String displayName = queryDisplayName(uri, exportType);
            notifyExportSuccess(exportType, displayName);
        } catch (Throwable e) {
            Log.e(TAG, "handleExportResult failed", e);
            notifyExportFailure(exportType);
        }
    }

    // v1.2.1: takePersistableWritePermission 已删除 —— 一次性导出不需要持久授权。

    /** 将内容写入 URI */
    private void writeContentToUri(Uri uri, String content) throws Throwable {
        try (OutputStream os = context.getContentResolver().openOutputStream(uri);
             OutputStreamWriter writer = new OutputStreamWriter(os, "UTF-8")) {
            writer.write(content);
            writer.flush();
            Log.i(TAG, "Exported via SAF to: " + uri.toString());
        }
    }

    /** 查询 URI 的显示名称 */
    private String queryDisplayName(Uri uri, String exportType) {
        String displayName = exportType.equals("pgn") ? "Regalia_game.pgn" : "Regalia_engine_settings.txt";
        try {
            android.database.Cursor cursor = context.getContentResolver().query(uri, null, null, null, null);
            if (cursor != null) {
                try {
                    int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIdx >= 0 && cursor.moveToFirst()) {
                        displayName = cursor.getString(nameIdx);
                    }
                } finally {
                    cursor.close();
                }
            }
        } catch (Throwable ignored) {
            // 查询显示名称失败不影响导出成功
        }
        return displayName;
    }

    /** 通知 JS 导出成功 */
    private void notifyExportSuccess(String exportType, String displayName) {
        if (exportType.equals("pgn")) {
            callbacks.postJsCallback("if(typeof onPGNExported==='function')onPGNExported(true," + callbacks.escapeJsString(displayName) + ")");
        } else {
            callbacks.postJsCallback("if(typeof onSettingsExported==='function')onSettingsExported(true," + callbacks.escapeJsString(displayName) + ")");
        }
    }

    /** 通知 JS 导出失败 */
    private void notifyExportFailure(String exportType) {
        if (exportType.equals("pgn")) {
            callbacks.postJsCallback("if(typeof onPGNExported==='function')onPGNExported(false,'')");
        } else {
            callbacks.postJsCallback("if(typeof onSettingsExported==='function')onSettingsExported(false,'')");
        }
    }

    // ===================== 导入选择器 =====================

    /** 打开 SAF 导入选择器（设置文件） */
    public void openSystemFilePicker() {
        Activity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, "openSystemFilePicker: no valid Activity reference");
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            // v18.6.0 FIX: 使用 */* 作为主类型，显示所有文件包括 .txt
            // 某些 OEM 文件选择器（小米 HyperOS）在 setType 为 "text/plain" 时不显示 .txt 文件
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/plain", "application/octet-stream"});
            activity.startActivityForResult(intent, REQUEST_CODE_IMPORT_SETTINGS);
        } catch (Throwable e) {
            Log.e(TAG, "openSystemFilePicker failed", e);
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /** 打开 SAF 导入选择器（PGN 文件） */
    public void openPGNFilePicker() {
        Activity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, "openPGNFilePicker: no valid Activity reference");
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/x-chess-pgn", "text/plain", "application/octet-stream"});
            activity.startActivityForResult(intent, REQUEST_CODE_IMPORT_PGN);
        } catch (Throwable e) {
            Log.e(TAG, "openPGNFilePicker failed", e);
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('File picker unavailable')");
        }
    }

    /** 处理 SAF 设置导入结果 */
    public void handleImportResult(Intent data) {
        if (data == null || data.getData() == null) return;
        try {
            Uri uri = data.getData();
            // v1.2.1: 不再 takePersistableUriPermission —— 一次性读取不需要持久授权。
            // v1.0.3 FIX: 立即关闭设置对话框，不等异步导入完成
            callbacks.postJsCallback("try{showEngineConfig=false;var d=document.querySelector('.dov[role=\"dialog\"]');if(d)d.remove();var fb=document.getElementById('_fileBrowserOverlay');if(fb)fb.remove();if(typeof render==='function')render();}catch(e){}");
            String content = readTextFromUri(uri);
            // 导入设置 — JS 端 onSettingsImported 回调会显示 toast
            callbacks.importSettings(content);
        } catch (Throwable e) {
            Log.e(TAG, "handleImportResult failed", e);
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Failed to read file')");
        }
    }

    /** 处理 SAF PGN 导入结果 */
    public void handlePGNImportResult(Intent data) {
        if (data == null || data.getData() == null) return;
        try {
            Uri uri = data.getData();
            // v1.2.1: 不再 takePersistableUriPermission —— 一次性读取不需要持久授权。
            String content = readPgnFromUri(uri);
            content = sanitizePgnContent(content);
            String jsonContent = encodePgnAsJson(content);
            callbacks.postJsCallback("if(typeof onPGNFileRead==='function'){try{var _d=" + jsonContent + ";onPGNFileRead(_d.content);}catch(e){console.error('PGN file read callback error:',e);}}");
        } catch (Throwable e) {
            Log.e(TAG, "handlePGNImportResult failed", e);
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Failed to read PGN file')");
        }
    }

    // v1.2.1: takePersistableReadPermission 已删除 —— 一次性读取不需要持久授权。

    /** 从 URI 读取文本内容（设置文件） */
    private String readTextFromUri(Uri uri) throws Throwable {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        context.getContentResolver().openInputStream(uri), "UTF-8"))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString();
        }
    }

    /** 从 URI 读取 PGN 内容（含截断保护） */
    private String readPgnFromUri(Uri uri) throws Throwable {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(
                        context.getContentResolver().openInputStream(uri), "UTF-8"))) {
            StringBuilder sb = new StringBuilder();
            String line;
            int lineCount = 0;
            boolean truncated = false;
            while ((line = reader.readLine()) != null) {
                if (lineCount >= PGN_MAX_LINES) { truncated = true; break; }
                sb.append(line).append("\n");
                lineCount++;
            }
            String content = sb.toString();
            if (truncated) {
                Log.w(TAG, "PGN file truncated at " + PGN_MAX_LINES + " lines");
                content += "\n{ Warning: file truncated at " + PGN_MAX_LINES + " lines by Regalia import guard }\n";
            }
            return content;
        }
    }

    /** 过滤控制字符（保留换行、制表符、回车） */
    private String sanitizePgnContent(String content) {
        return content.replaceAll("[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F]", "");
    }

    /** 将 PGN 内容编码为 JSON，安全传递到 JS */
    private String encodePgnAsJson(String content) {
        try {
            return new JSONObject().put("content", content).toString();
        } catch (Throwable je) {
            Log.e(TAG, "JSON encoding failed for PGN content", je);
            return "{\"content\":\"\"}";
        }
    }
}
