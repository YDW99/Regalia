package com.Regalia;

/*
 * Regalia - Permission Helper
 * Copyright (C) 2026 Regalia
 *
 * Permission check patterns derived from DroidFish (EngineOptionsDialog.java)
 * Copyright (C) Peter Österlund (original DroidFish logic)
 * Modifications Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
 *
 * v1.2.0 Phase 73+: Extracted from StockfishNative.java to reduce God Module size.
 *                   Encapsulates all Android runtime permission checks and requests
 *                   invoked from JavaScript.
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

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import java.lang.ref.WeakReference;

/**
 * PermissionHelper — 权限辅助类 (v1.2.0 Phase 73+)
 *
 * 职责:
 *   - 存储权限检查与请求（hasStoragePermission / requestStoragePermission）
 *   - 通知权限检查与请求（hasNotificationPermission / requestNotificationPermission）
 *
 * 兼容性:
 *   - Android 13+ (API 33+) 使用 POST_NOTIFICATIONS 运行时权限
 *   - Android 10+ (API 29+) scoped storage 下应用私有目录无需存储权限
 *   - Android 5-9 (API 21-28) 使用 WRITE_EXTERNAL_STORAGE / READ_EXTERNAL_STORAGE
 */
public class PermissionHelper {
    private static final String TAG = "PermissionHelper";

    private final Context context;
    private final WeakReference<Activity> activityRef;

    public PermissionHelper(Context context, WeakReference<Activity> activityRef) {
        this.context = context.getApplicationContext();
        this.activityRef = activityRef;
    }

    /**
     * 检查是否拥有存储权限。
     * Android 13+: 无需运行时存储权限，SAF 处理所有文件访问。
     * Android 10-12: scoped storage 下应用私有目录无需权限，但 File API 访问公共目录需 READ_EXTERNAL_STORAGE。
     * Android 5-9: 需要 WRITE_EXTERNAL_STORAGE。
     */
    public boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT >= 33) {
            // Android 13+: 无需运行时存储权限——SAF 处理一切
            return true;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10-12: READ_EXTERNAL_STORAGE 对 File API 仍有效
            // FIX: 使用 checkSelfPermission() 而非 checkCallingOrSelfPermission()——
            //   在 @JavascriptInterface 上下文中，checkCallingOrSelfPermission() 使用
            //   WebView 的调用者身份，可能与应用自身 UID 不匹配，导致误报。
            return context.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE)
                    == PackageManager.PERMISSION_GRANTED;
        }
        // Android 9 及以下: 检查 WRITE_EXTERNAL_STORAGE
        return context.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
    }

    /**
     * 根据Android版本请求存储权限。
     * Android 9 及以下: WRITE_EXTERNAL_STORAGE
     * Android 10-12: READ_EXTERNAL_STORAGE（对 File API 仍有效）
     * Android 13+: 无需运行时权限——SAF 处理文件访问
     */
    public void requestStoragePermission() {
        Activity activity = activityRef.get();
        if (activity == null) return;
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                activity.requestPermissions(
                    new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                    1001
                );
            } else if (Build.VERSION.SDK_INT < 33) {
                activity.requestPermissions(
                    new String[]{Manifest.permission.READ_EXTERNAL_STORAGE},
                    1001
                );
            }
            // Android 13+: 无需请求
        } catch (Throwable e) {
            Log.w(TAG, "requestStoragePermission failed", e);
        }
    }

    /**
     * 检查是否拥有通知权限。
     * Android 13+ (API 33+) 需要 POST_NOTIFICATIONS 运行时权限。
     * Android 12 及以下默认拥有通知权限。
     */
    public boolean hasNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) {
            return true;
        }
        return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    /** 请求通知权限（Android 13+） */
    public void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) {
            return;
        }
        Activity activity = activityRef.get();
        if (activity == null) {
            Log.w(TAG, "requestNotificationPermission: activity is null");
            return;
        }
        try {
            activity.requestPermissions(
                new String[]{Manifest.permission.POST_NOTIFICATIONS},
                1003
            );
        } catch (Throwable e) {
            Log.w(TAG, "requestNotificationPermission failed", e);
        }
    }

    /**
     * 检查设备是否有振动器。
     */
    public boolean hasVibrator() {
        try {
            android.os.Vibrator v = (android.os.Vibrator)
                    context.getSystemService(Context.VIBRATOR_SERVICE);
            return v != null && v.hasVibrator();
        } catch (Throwable e) {
            return false;
        }
    }
}
