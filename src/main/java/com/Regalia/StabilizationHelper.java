// StabilizationHelper.java — Sensor-based anti-shake (translation only) for the chess board.
// AI-GEN: AI assisted
// This code is AI-assisted and has been reviewed for AGPL v3 compliance.
//
// Copyright (C) 2026 Regalia
//
// ============================================================================
// SENSOR STRATEGY — translation only (OIS-style)
// ============================================================================
// Only ONE sensor is used:
//   - TYPE_LINEAR_ACCELERATION (gravity already removed by OS) for translation
//     anti-shake.
//
// The board's .bwrap element gets a CSS transform that counter-shifts the board
// in real time, so it appears "locked" to the world frame — mimicking camera
// optical image stabilization (OIS) for the translation axis.
//
// ============================================================================
// FIRST-PRINCIPLES AUDIT (per uploaded sensor docs)
// ============================================================================
// Cross-checked against the two uploaded reference docs:
//   (A) "Android传感器_阅读防抖_技术报告.md" (technical report on the three
//       Android sensors used for reading anti-shake).
//   (B) "元宝：三种传感器实现'阅读防抖'功能——对于开源软件可以实现吗？.md"
//       (community article confirming open-source feasibility and warning
//       about the deprecated TYPE_ORIENTATION sensor).
//
// Audit conclusions:
//
// 1. SENSOR CHOICE — VERIFIED CORRECT
//    - TYPE_LINEAR_ACCELERATION (gravity already removed by OS) for translation
//      anti-shake. ✓ Matches doc (A) §2 and doc (B) recommendation.
//    - Display.getRotation() for screen-orientation remap of translation axes. ✓
//
// 2. ANTI-SHAKE TRANSLATION — KEEP INTEGRATION (OIS principle)
//    Integration with strong decay (0.92/0.95) + clamp (±8px) prevents the
//    drift problem doc (A) §6.2.5 warns about.
//
// 3. SAMPLING RATE — SENSOR_DELAY_GAME (~50 Hz). ✓ Matches doc (A) §6.2.1.
// 4. LIFECYCLE — register on start(), unregister on stop()/onPause/onDestroy. ✓
// 5. FALLBACK — graceful degradation when sensor is missing. ✓
// 6. NO ZERO-BIAS CALIBRATION — rely on decay. ✓ (doc (A) §6.2.4)
//
// SENSORS NOT USED:
//   - TYPE_ACCELEROMETER: includes gravity, error-prone.
//   - TYPE_GYROSCOPE: redundant with linear_acceleration for translation.
//   - TYPE_GRAVITY: no longer needed (linear_acceleration has no gravity).
//   - TYPE_GEOMAGNETIC_ROTATION_VECTOR: lower accuracy than rotation vector.
//   - TYPE_TILT_DETECTOR: not exposed to non-system apps.
//   - TYPE_SIGNIFICANT_MOTION: one-shot trigger, not useful for tracking.
//   - TYPE_DEVICE_ORIENTATION / TYPE_ORIENTATION: deprecated since Android 2.2.

package com.Regalia;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Surface;
import android.view.WindowManager;
import android.webkit.WebView;

import java.lang.ref.WeakReference;

public class StabilizationHelper implements SensorEventListener {

    private static final String TAG = "Regalia/StabHelper";

    // Max board translation in CSS pixels.
    private static final float MAX_DISPLACEMENT_PX = 8.0f;

    // Decay for integration (slower = better tracking, returns to center ~300ms).
    private static final float VELOCITY_DECAY = 0.92f;
    private static final float DISPLACEMENT_DECAY = 0.95f;

    private static final long JS_CALLBACK_MIN_INTERVAL_MS = 16;

    private final SensorManager sensorManager;
    private final WeakReference<WebView> webViewRef;
    private final Handler mainHandler;
    private final WindowManager windowManager;

    private Sensor linAccelSensor;

    // Translation integration state (device frame, from linear_acceleration)
    private float velX = 0, velY = 0;
    private float dispX = 0, dispY = 0;

    private long lastJsCallbackTime = 0;

    public StabilizationHelper(Context context, WebView webView) {
        this.sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        this.webViewRef = new WeakReference<>(webView);
        this.mainHandler = new Handler(Looper.getMainLooper());
        WindowManager wm = null;
        try {
            wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        } catch (Throwable e) {
            Log.w(TAG, "WindowManager unavailable", e);
        }
        this.windowManager = wm;
    }

    public boolean start() {
        if (sensorManager == null) {
            Log.w(TAG, "SensorManager unavailable — stabilization disabled");
            return false;
        }
        // Resolve the only sensor we need (Rev64: rotation sensors removed).
        linAccelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);

        if (linAccelSensor == null) {
            Log.w(TAG, "TYPE_LINEAR_ACCELERATION unavailable — cannot do translation anti-shake");
        }

        int rate = SensorManager.SENSOR_DELAY_GAME;
        boolean anyRegistered = false;
        if (linAccelSensor != null) {
            sensorManager.registerListener(this, linAccelSensor, rate);
            anyRegistered = true;
        }

        // Reset state
        velX = velY = dispX = dispY = 0;
        lastJsCallbackTime = 0;

        Log.i(TAG, "Stabilization started (translation only). Sensors: linAccel=" + (linAccelSensor != null));
        return anyRegistered;
    }

    public void stop() {
        if (sensorManager != null) {
            try { sensorManager.unregisterListener(this); } catch (Throwable e) { Log.w(TAG, "unregister failed", e); }
        }
        // Reset board to center.
        applyTransform(0, 0);
        velX = velY = dispX = dispY = 0;
        Log.i(TAG, "Stabilization stopped");
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.sensor == null) return;
        int type = event.sensor.getType();
        if (type == Sensor.TYPE_LINEAR_ACCELERATION) {
            processLinearAcceleration(event.values[0], event.values[1]);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) { }

    private int getDisplayRotation() {
        if (windowManager == null) return Surface.ROTATION_0;
        try {
            return windowManager.getDefaultDisplay().getRotation();
        } catch (Throwable e) {
            return Surface.ROTATION_0;
        }
    }

    /**
     * Process linear acceleration (gravity already removed) to compute device
     * displacement, then derive the inverse board displacement for OIS.
     * Only X and Y axes are used (Z = toward/away, not visible).
     */
    private void processLinearAcceleration(float ax, float ay) {
        final float dt = 0.02f; // ~20ms at SENSOR_DELAY_GAME
        velX += ax * dt;
        velY += ay * dt;
        dispX += velX * dt;
        dispY += velY * dt;
        velX *= VELOCITY_DECAY;
        velY *= VELOCITY_DECAY;
        dispX *= DISPLACEMENT_DECAY;
        dispY *= DISPLACEMENT_DECAY;
        dispatchTransform();
    }

    /**
     * Compute the final board transform (translation only) and dispatch to
     * the WebView. Called from the linear-acceleration handler.
     * The per-orientation remap is needed because dispX/dispY are in device
     * frame (linear_acceleration is always in device-natural coordinates).
     */
    private void dispatchTransform() {
        int rot = getDisplayRotation();
        // --- Translation (OIS inverse) ---
        // dispX/dispY are in DEVICE-natural frame (linear_acceleration is always
        // device-natural, regardless of screen rotation). We need to remap them
        // to SCREEN frame and invert (OIS principle: board moves opposite to
        // device movement in the world frame, so the board appears "locked").
        //
        // First-principles derivation (Rev67, 2026.6.27):
        //   Device-natural axes: Dx = device-right, Dy = device-up (in ROTATION_0).
        //   dispX = displacement along Dx; dispY = displacement along Dy.
        //   CSS: +x = screen-right, +y = screen-down.
        //   OIS: if device moves world-right, board moves screen-left (CSS -x).
        //        if device moves world-up,   board moves screen-down (CSS +y).
        //
        //   ROTATION_0  (device upright, top up):
        //     Dx = world-right, Dy = world-up.
        //     device world-right (dispX>0) → board screen-left  → boardPxX = -dispX
        //     device world-up    (dispY>0) → board screen-down  → boardPxY = +dispY
        //
        //   ROTATION_90 (device rotated 90° CCW, top points LEFT):
        //     Dx = world-up,   Dy = world-left.
        //     device world-up   (dispX>0) → board screen-down  → boardPxY = +dispX
        //     device world-left (dispY>0) → board screen-right → boardPxX = +dispY
        //
        //   ROTATION_180 (device upside-down, top DOWN):
        //     Dx = world-left, Dy = world-down.
        //     device world-left  (dispX>0) → board screen-right → boardPxX = +dispX
        //     device world-down  (dispY>0) → board screen-up    → boardPxY = -dispY
        //
        //   ROTATION_270 (device rotated 90° CW, top points RIGHT):
        //     Dx = world-down, Dy = world-right.
        //     device world-down  (dispX>0) → board screen-up   → boardPxY = -dispX
        //     device world-right (dispY>0) → board screen-left → boardPxX = -dispY
        //
        // Rev67 FIX: ROTATION_90 and ROTATION_270 had boardPxX sign INVERTED.
        //   ROTATION_90 was -dispY (amplified shake); corrected to +dispY.
        //   ROTATION_270 was +dispY (amplified shake); corrected to -dispY.
        //   ROTATION_0 and ROTATION_180 were already correct.
        float boardPxX, boardPxY;
        final float SCALE = 2000.0f;
        switch (rot) {
            case Surface.ROTATION_90:
                boardPxX = +dispY * SCALE;
                boardPxY = +dispX * SCALE;
                break;
            case Surface.ROTATION_180:
                boardPxX = +dispX * SCALE;
                boardPxY = -dispY * SCALE;
                break;
            case Surface.ROTATION_270:
                boardPxX = -dispY * SCALE;
                boardPxY = -dispX * SCALE;
                break;
            case Surface.ROTATION_0:
            default:
                boardPxX = -dispX * SCALE;
                boardPxY = +dispY * SCALE;
                break;
        }
        if (boardPxX > MAX_DISPLACEMENT_PX) boardPxX = MAX_DISPLACEMENT_PX;
        else if (boardPxX < -MAX_DISPLACEMENT_PX) boardPxX = -MAX_DISPLACEMENT_PX;
        if (boardPxY > MAX_DISPLACEMENT_PX) boardPxY = MAX_DISPLACEMENT_PX;
        else if (boardPxY < -MAX_DISPLACEMENT_PX) boardPxY = -MAX_DISPLACEMENT_PX;

        // Throttle JS callback
        long now = System.currentTimeMillis();
        if (now - lastJsCallbackTime < JS_CALLBACK_MIN_INTERVAL_MS) return;
        lastJsCallbackTime = now;

        applyTransform(boardPxX, boardPxY);
    }

    /**
     * Push the transform (translation only) to the WebView.
     * Sets CSS custom properties --stab-x, --stab-y on :root.
     * The .bwrap.stabilized CSS rule consumes them.
     */
    private void applyTransform(float x, float y) {
        WebView wv = webViewRef.get();
        if (wv == null) return;
        String sx = String.format(java.util.Locale.US, "%.1f", x);
        String sy = String.format(java.util.Locale.US, "%.1f", y);
        final String finalJs = "(function(){var r=document.documentElement.style;"
                + "r.setProperty('--stab-x','" + sx + "px');"
                + "r.setProperty('--stab-y','" + sy + "px');"
                + "r.removeProperty('--stab-rot');" // Clear any stale --stab-rot from a previous session
                + "var b=document.querySelector('.bwrap');"
                + "if(b){b.classList.add('stabilized');}"
                + "})();";
        try {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    try {
                        WebView v = webViewRef.get();
                        if (v != null) v.evaluateJavascript(finalJs, null);
                    } catch (Throwable e) {
                        Log.w(TAG, "evaluateJavascript failed", e);
                    }
                }
            });
        } catch (Throwable e) {
            Log.w(TAG, "applyTransform post failed", e);
        }
    }
}
