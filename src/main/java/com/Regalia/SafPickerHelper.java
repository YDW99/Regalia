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
 *   - 设置导入有 1,000,000 字符上限（SETTINGS_MAX_CHARS），超限快速失败 (v1.2.3 round-41)
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

    // v1.2.3 round-49 (review-4 P2-1): PGN 导入字符数硬上限（10MB）。
    //   行数上限（PGN_MAX_LINES）挡不住「单行超大」文件 —— readLine() 会在
    //   行数检查执行前把整行物化进内存。分块读 + 字符硬上限后内存占用严格
    //   不超过 PGN_MAX_CHARS + 一个 8KB 块缓冲（同 readTextFromUri 的
    //   round-46 CR#15 修法）。超限直接 IOException → 既有 catch → toast。
    private static final int PGN_MAX_CHARS = 10_000_000;

    // v1.2.3 round-41: 设置导入字符数上限（1MB），防止 OOM。
    //   与 PGN 导入的行数截断不同，设置文件是 JSON，截断会破坏解析，
    //   因此超限直接快速失败（抛 IOException → 既有 catch → toast）。
    private static final int SETTINGS_MAX_CHARS = 1_000_000;

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
        // v1.2.3 round-62 (dedup): thin wrapper — the launch logic lives in
        //   openCreateDocumentPicker (was a line-for-line duplicate pair).
        openCreateDocumentPicker(content, "settings", "text/plain",
                "Regalia_engine_settings.txt", REQUEST_CODE_EXPORT_SETTINGS, "openExportFilePicker");
    }

    /** 打开 SAF 导出选择器（PGN 文件） */
    public void openPGNExportFilePicker(String content) {
        // v1.2.3 round-62 (dedup): thin wrapper — see openExportFilePicker.
        openCreateDocumentPicker(content, "pgn", "application/x-chess-pgn",
                "Regalia_game.pgn", REQUEST_CODE_EXPORT_PGN, "openPGNExportFilePicker");
    }

    /**
     * v1.2.3 round-62 (dedup, guide §5.1 item 3): single CREATE_DOCUMENT
     * launch path for both export flavors (settings / PGN). The two public
     * pickers were line-for-line Sonar duplicate blocks differing only in
     * export type, MIME type, suggested file name, request code and log
     * label. Behavior preserved verbatim: empty-content guard, pending
     * export state, Activity-null guard with JS toast, and the catch path
     * that drops the pending content and resets the type to the default
     * ("settings").
     */
    private void openCreateDocumentPicker(String content, String exportType, String mimeType,
                                           String suggestedName, int requestCode, String logLabel) {
        if (content == null || content.isEmpty()) {
            Log.w(TAG, logLabel + ": empty content, skipping");
            return;
        }
        _pendingExportContent = content;
        _pendingExportType = exportType;
        Activity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, logLabel + ": no valid Activity reference");
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, suggestedName);
            activity.startActivityForResult(intent, requestCode);
            Log.i(TAG, "SAF export file picker opened: " + exportType);
        } catch (Throwable e) {
            Log.e(TAG, logLabel + " failed", e);
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
        } catch (Exception ignored) {
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
        // v1.2.1 round-9: openOutputStream can return null per Android docs
        //   (e.g. if the URI provider is unavailable). Without this check,
        //   the OutputStreamWriter constructor would throw NPE.
        OutputStream os = context.getContentResolver().openOutputStream(uri);
        if (os == null) {
            throw new java.io.IOException("openOutputStream returned null for " + uri);
        }
        try (OutputStream autoClose = os;
             OutputStreamWriter writer = new OutputStreamWriter(autoClose, "UTF-8")) {
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
        // v1.2.3 round-62 (dedup): thin wrapper — the launch logic lives in
        //   openOpenDocumentPicker (was a line-for-line duplicate pair).
        openOpenDocumentPicker(new String[]{"text/plain", "application/octet-stream"},
                REQUEST_CODE_IMPORT_SETTINGS, "openSystemFilePicker");
    }

    /** 打开 SAF 导入选择器（PGN 文件） */
    public void openPGNFilePicker() {
        // v1.2.3 round-62 (dedup): thin wrapper — see openSystemFilePicker.
        openOpenDocumentPicker(new String[]{"application/x-chess-pgn", "text/plain", "application/octet-stream"},
                REQUEST_CODE_IMPORT_PGN, "openPGNFilePicker");
    }

    /**
     * v1.2.3 round-62 (dedup, guide §5.1 item 3): single OPEN_DOCUMENT launch
     * path for both import flavors (settings / PGN). The two public pickers
     * were line-for-line Sonar duplicate blocks differing only in
     * EXTRA_MIME_TYPES and the request code. Behavior preserved verbatim:
     * Activity-null guard with JS toast, the all-files primary MIME type
     * (v18.6.0 FIX kept: some OEM pickers — Xiaomi HyperOS — hide .txt
     * files when the primary type is "text/plain"), and the catch path
     * with its JS toast.
     */
    private void openOpenDocumentPicker(String[] mimeTypes, int requestCode, String logLabel) {
        Activity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, logLabel + ": no valid Activity reference");
            callbacks.postJsCallback("if(typeof showToast==='function')showToast('Activity unavailable')");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);
            activity.startActivityForResult(intent, requestCode);
        } catch (Throwable e) {
            Log.e(TAG, logLabel + " failed", e);
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
        // v1.2.3 round-62 (dedup): the bounded chunked read loop moved to
        //   FileIoHelper.readCappedText — shared with readPgnFromUri and
        //   StatsActivity's PGN import (was a 3-way Sonar duplicate block).
        //   Settings semantics: char cap only (no line cap), same too-large
        //   message as before.
        return FileIoHelper.readCappedText(context.getContentResolver(), uri,
                SETTINGS_MAX_CHARS, 0, "Settings file", null);
    }

    /** 从 URI 读取 PGN 内容（含截断保护） */
    private String readPgnFromUri(Uri uri) throws Throwable {
        // v1.2.3 round-62 (dedup): the chunked read + line-cap loop moved to
        //   FileIoHelper.readCappedText (3-way duplicate collapsed: this
        //   method, readTextFromUri, StatsActivity's PGN import). The PGN
        //   truncation warning comment stays HERE — it is PGN content, not
        //   generic I/O. All round-46/49/54 semantics preserved verbatim by
        //   the shared helper (char cap throws, 8KB chunks, readLine()-
        //   compatible CR/LF/CRLF folding, stop-at-line-cap).
        boolean[] truncated = new boolean[1];
        String content = FileIoHelper.readCappedText(context.getContentResolver(), uri,
                PGN_MAX_CHARS, PGN_MAX_LINES, "PGN file", truncated);
        if (truncated[0]) {
            Log.w(TAG, "PGN file truncated at " + PGN_MAX_LINES + " lines");
            content += "\n{ Warning: file truncated at " + PGN_MAX_LINES + " lines by Regalia import guard }\n";
        }
        return content;
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
