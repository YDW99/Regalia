package com.Regalia;

/*
 * Regalia - Engine Foreground Service
 * Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted
 * This code was AI-assisted and has been reviewed for AGPL v3 compliance.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 *
 * Foreground service to keep the chess engine process alive on Android
 * 14/15 (especially Xiaomi HyperOS 3). Without this service, the OS
 * aggressively kills the engine subprocess when the app goes to
 * background, causing "engine not responding" errors and forced restarts.
 *
 * The service shows a persistent notification with engine process info
 * and holds a PARTIAL_WAKE_LOCK to prevent CPU suspension during analysis.
 * It auto-stops when the engine is shut down.
 *
 * The notification text is bilingual: it reads the app's language setting
 * from SharedPreferences and displays the appropriate language string.
 * v1.0.1: The notification shows ONLY three states — ready / analyzing / error.
 * Detailed depth/nps/score data is shown in the in-app eval bar instead.
 * The notification can be updated dynamically via updateNotification().
 */

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

public class EngineService extends Service {

    private static final String TAG = "EngineService";
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "regalia_engine_channel";
    // v1.0.2 FIX: Must match StockfishNative.PREFS_NAME ("RegaliaEngine"). The
    // previous code read from "Regalia_prefs" which is NEVER written to by any
    // code path — saveLangPref() writes to "RegaliaEngine". This mismatch caused
    // the foreground-service notification language to always fall back to the
    // system default, ignoring the user's in-app language preference.
    private static final String PREFS_NAME = "RegaliaEngine";

    private PowerManager.WakeLock wakeLock = null;
    // v1.0.8 PHASE 24 (bug fix): volatile — read from JS binder thread
    //   (updateNotification, start) and service main thread (onCreate/onDestroy).
    private static volatile boolean isRunning = false;
    // v1.0.7 PHASE 19 (thread safety): lastStatusInfo is written from the JS
    // binder thread (via updateEngineNotification) and read from the service
    // main thread (in buildNotification/onCreate). Without volatile, stale
    // reads can cause the notification to display an old status.
    private static volatile String lastStatusInfo = "";

    /**
     * v1.0.1: Build the PendingIntent that opens MainActivity when the user taps
     * the persistent notification. We pre-build this once per service instance and
     * reuse it for every notification update (cheap to construct, but no point
     * re-doing it 1×/sec during engine progress updates).
     *
     * PendingIntent flags:
     *   - FLAG_IMMUTABLE (mandatory on Android 12+/API 31+)
     *   - FLAG_UPDATE_CURRENT: update extras if a new PendingIntent with the same
     *     requestCode is created — keeps the intent fresh.
     *   - On API 23+ we use FLAG_IMMUTABLE; on older devices FLAG_UPDATE_CURRENT only.
     */
    private PendingIntent buildContentIntent() {
        try {
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            return PendingIntent.getActivity(this, 0, intent, flags);
        } catch (Throwable e) {
            Log.w(TAG, "buildContentIntent failed", e);
            return null;
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        // v1.2.1 round-10 (review-E P3): Moved `isRunning = true` to AFTER
        //   startForeground() succeeds. Previously it was set at the very top of
        //   onCreate, before createNotificationChannel() and startForeground().
        //   If startForeground() threw (e.g. ForegroundServiceTypeNotAllowed on
        //   Android 14+ when the FGS subtype property is missing — round-9 added
        //   it, but a future regression could re-trigger the crash), isRunning
        //   would be left `true` while the service is actually dead. Callers
        //   (EngineService.start, updateNotification) would then no-op or
        //   attempt to update a non-existent notification. Now isRunning only
        //   flips true once the service is genuinely in the foreground state.
        Log.i(TAG, "Engine service created");

        // Create notification channel (required Android 8+)
        createNotificationChannel();

        // Start as foreground service with a minimal notification
        Notification notification = buildNotification();

        // On Android 14+ (API 34+), startForeground() must include
        // the foreground service type parameter.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification,
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        isRunning = true;

        // Acquire partial wake lock to prevent CPU suspension during analysis.
        // v1.1.0 Phase 57+: Use a bounded timeout (30 min) as a safety net — if the
        // Service is silently killed by the OEM and onDestroy never runs, the wake
        // lock will still be released automatically. The 30-minute window is well
        // beyond any single analysis session; longer sessions can re-acquire by
        // re-entering the foreground state.
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Regalia:engine-analysis");
                wakeLock.acquire(30L * 60L * 1000L); // 30 minutes
                Log.i(TAG, "Partial wake lock acquired (30min timeout)");
            }
        } catch (Throwable e) {
            Log.w(TAG, "Wake lock acquire failed", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "Engine service started");
        // START_STICKY: if the service is killed, restart it
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        isRunning = false;
        lastStatusInfo = "";

        // Release wake lock
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
                Log.i(TAG, "Partial wake lock released");
            } catch (Throwable e) {
                Log.w(TAG, "Wake lock release failed", e);
            }
            wakeLock = null;
        }

        Log.i(TAG, "Engine service destroyed");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // Not bindable
    }

    private boolean isEnglishMode() {
        try {
            // v1.0.2 FIX: Read from PREFS_NAME ("RegaliaEngine") to match
            // StockfishNative.saveLangPref(). Previously read from "Regalia_prefs"
            // which is never written — caused the notification language to always
            // fall back to system default, ignoring the user's in-app choice.
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String lang = prefs.getString("lang", "");
            if (lang != null && !lang.isEmpty()) return "en".equals(lang);
            // Fallback: detect system language
            return !java.util.Locale.getDefault().getLanguage().startsWith("zh");
        } catch (Throwable e) {
            return false;
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                String channelName = isEnglishMode() ? "Chess Engine" : "国际象棋引擎";
                String channelDesc = isEnglishMode()
                        ? "Chess engine analysis is running"
                        : "国际象棋引擎分析运行中";
                NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        channelName,
                        NotificationManager.IMPORTANCE_LOW // Low: no sound, no heads-up
                );
                channel.setDescription(channelDesc);
                channel.setShowBadge(false);
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) {
                    nm.createNotificationChannel(channel);
                }
            } catch (Throwable e) {
                Log.w(TAG, "Notification channel creation failed", e);
            }
        }
    }

    private Notification buildNotification() {
        boolean en = isEnglishMode();
        String title = "Regalia";
        String contentText;
        if (lastStatusInfo != null && !lastStatusInfo.isEmpty()) {
            contentText = lastStatusInfo;
        } else {
            contentText = en ? "Engine analysis running" : "引擎分析运行中";
        }

        PendingIntent contentIntent = buildContentIntent();
        // v1.0.5 Rev55: Use the shared notification-builder helper to avoid
        // duplicating the builder configuration between buildNotification()
        // and updateNotification(). Both methods construct identical
        // notifications (same title, content, icon, flags, channel) — only
        // the content text differs, which is passed as a parameter.
        return _buildNotificationWithContent(this, title, contentText, contentIntent);
    }

    /**
     * Check if the engine foreground service is currently running.
     */
    public static boolean isServiceRunning() {
        return isRunning;
    }

    /**
     * Start the engine foreground service from the given context.
     * Safe to call multiple times — no-op if already running.
     */
    public static void start(Context context) {
        if (isRunning) return;
        try {
            Intent intent = new Intent(context, EngineService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
            Log.i(TAG, "Engine service start requested");
        } catch (Throwable e) {
            Log.w(TAG, "Failed to start engine service", e);
        }
    }

    /**
     * Stop the engine foreground service.
     */
    public static void stop(Context context) {
        try {
            Intent intent = new Intent(context, EngineService.class);
            context.stopService(intent);
            Log.i(TAG, "Engine service stop requested");
        } catch (Throwable e) {
            Log.w(TAG, "Failed to stop engine service", e);
        }
    }

    /**
     * Update the foreground service notification with engine process info.
     * This is called from JS to show real-time engine status in the
     * persistent notification, improving perceived responsiveness and
     * preventing the OS from killing the service (since the notification
     * is actively updated, the OS knows it's still in use).
     *
     * @param context Android context
     * @param info    Status string (v1.0.1: one of "ready" / "analyzing" / "error: ...")
     */
    public static void updateNotification(Context context, String info) {
        if (!isRunning || info == null) return;
        lastStatusInfo = info;
        try {
            // v1.2.3 round-13 (P3): corrected misleading comment — NotificationManager.notify
            //   works with any Context; the channel is looked up by CHANNEL_ID string,
            //   not by Context identity. The caller-supplied context (typically an Activity
            //   from the JS bridge) is fine here.
            android.app.NotificationManager nm =
                    (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            String title = "Regalia";

            // v1.0.5 Rev55: Build PendingIntent to open MainActivity on tap.
            PendingIntent contentIntent = null;
            try {
                Intent intent = new Intent(context, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    piFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                contentIntent = PendingIntent.getActivity(context, 0, intent, piFlags);
            } catch (Throwable e) { /* fallback: no content intent */ }

            // v1.0.5 Rev55: Use the shared helper (was duplicated inline here).
            Notification notification = _buildNotificationWithContent(context, title, info, contentIntent);
            nm.notify(NOTIFICATION_ID, notification);
        } catch (Throwable e) {
            Log.w(TAG, "Failed to update notification", e);
        }
    }

    /**
     * v1.0.5 Rev55: Shared notification builder — used by both buildNotification()
     * (instance method, called from onCreate) and updateNotification() (static
     * method, called from JS bridge with a possibly-different context).
     *
     * Builds a notification with the standard Regalia engine-service configuration:
     *   - Title: "Regalia"
     *   - Content: passed in (one of "ready" / "analyzing" / "error: ...")
     *   - Small icon: app launcher icon
     *   - Ongoing (non-dismissable while service runs)
     *   - No timestamp, no re-alert, local-only, service category, low priority
     *   - FLAG_NO_CLEAR (defense-in-depth on top of setOngoing)
     *
     * @param context    Context for the Notification.Builder
     * @param title      Notification title
     * @param contentText Notification content text
     * @param contentIntent PendingIntent fired on tap (may be null)
     * @return configured Notification
     */
    private static Notification _buildNotificationWithContent(Context context, String title,
                                                              String contentText,
                                                              PendingIntent contentIntent) {
        Notification notification;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder builder = new Notification.Builder(context, CHANNEL_ID)
                    .setContentTitle(title)
                    .setContentText(contentText)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setOngoing(true)              // non-dismissable while service runs
                    .setShowWhen(false)            // cleaner look — no timestamp
                    .setOnlyAlertOnce(true)        // don't re-sound on every update
                    .setLocalOnly(true)            // don't mirror to other devices
                    .setCategory(Notification.CATEGORY_SERVICE)
                    .setPriority(Notification.PRIORITY_LOW);
            if (contentIntent != null) builder.setContentIntent(contentIntent);
            notification = builder.build();
        } else {
            // Pre-Android 8: use deprecated constructor (no channel)
            Notification.Builder builder = new Notification.Builder(context)
                    .setContentTitle(title)
                    .setContentText(contentText)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setOngoing(true)
                    .setPriority(Notification.PRIORITY_LOW);
            if (contentIntent != null) builder.setContentIntent(contentIntent);
            notification = builder.build();
        }
        // FLAG_NO_CLEAR: prevent the notification from being cleared by "Clear all"
        // (in addition to setOngoing which prevents swipe-dismiss on most Android versions).
        // Note: Android 14+ may still allow user dismissal of foreground service
        // notifications, but the foreground service itself stays alive. Re-posting
        // via updateNotification() restores the notification.
        notification.flags |= Notification.FLAG_NO_CLEAR;
        return notification;
    }
}
