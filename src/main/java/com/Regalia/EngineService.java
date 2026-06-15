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
 * The notification can be updated dynamically to show engine status info
 * (e.g., "Stockfish 18 · depth 22") via updateNotification().
 */

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
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

    private PowerManager.WakeLock wakeLock = null;
    private static boolean isRunning = false;
    private static String lastStatusInfo = "";

    @Override
    public void onCreate() {
        super.onCreate();
        isRunning = true;
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

        // Acquire partial wake lock to prevent CPU suspension during analysis
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Regalia:engine-analysis");
                wakeLock.acquire();
                Log.i(TAG, "Partial wake lock acquired");
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
            SharedPreferences prefs = getSharedPreferences("Regalia_prefs", MODE_PRIVATE);
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

        Notification notification;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder builder = new Notification.Builder(this, CHANNEL_ID)
                    .setContentTitle(title)
                    .setContentText(contentText)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setOngoing(true)
                    .setPriority(Notification.PRIORITY_LOW);
            notification = builder.build();
        } else {
            // Pre-Android 8: use deprecated constructor
            Notification.Builder builder = new Notification.Builder(this)
                    .setContentTitle(title)
                    .setContentText(contentText)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setOngoing(true);
            notification = builder.build();
        }
        return notification;
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
     * @param info    Status string (e.g., "Stockfish 18 · depth 22")
     */
    public static void updateNotification(Context context, String info) {
        if (!isRunning || info == null) return;
        lastStatusInfo = info;
        try {
            // Must use the service's own context to update the notification
            // since we need access to the notification channel
            android.app.NotificationManager nm =
                    (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            boolean en = false;
            try {
                SharedPreferences prefs = context.getSharedPreferences("Regalia_prefs", Context.MODE_PRIVATE);
                String lang = prefs.getString("lang", "");
                if (lang != null && !lang.isEmpty()) en = "en".equals(lang);
                else en = !java.util.Locale.getDefault().getLanguage().startsWith("zh");
            } catch (Throwable e) { /* default to zh */ }

            String title = "Regalia";
            Notification notification;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder builder = new Notification.Builder(context, CHANNEL_ID)
                        .setContentTitle(title)
                        .setContentText(info)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setOngoing(true)
                        .setPriority(Notification.PRIORITY_LOW);
                notification = builder.build();
            } else {
                Notification.Builder builder = new Notification.Builder(context)
                        .setContentTitle(title)
                        .setContentText(info)
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setOngoing(true);
                notification = builder.build();
            }
            nm.notify(NOTIFICATION_ID, notification);
        } catch (Throwable e) {
            Log.w(TAG, "Failed to update notification", e);
        }
    }
}
