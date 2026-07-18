// StabilizationHelper.java — Sensor-based anti-shake (translation only) for the chess board.
// AI-GEN: AI assisted
// This code is AI-assisted and has been reviewed for AGPL v3 compliance.
//
// Copyright (C) 2026 Regalia
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.
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
// FIRST-PRINCIPLES AUDIT
// ============================================================================
// Design cross-checked against Android sensor best-practices docs (sensor
// reading anti-shake technical report + community article on deprecated
// TYPE_ORIENTATION).
//
// Audit conclusions:
//
// 1. SENSOR CHOICE — VERIFIED CORRECT
//    - TYPE_LINEAR_ACCELERATION (gravity already removed by OS) for translation
//      anti-shake. ✓
//    - Display.getRotation() for screen-orientation remap of translation axes. ✓
//
// 2. ANTI-SHAKE TRANSLATION — KEEP INTEGRATION (OIS principle)
//    Integration with strong decay (0.92/0.95) + clamp (±8px) prevents drift.
//
// 3. SAMPLING RATE — SENSOR_DELAY_GAME (~50 Hz). ✓
// 4. LIFECYCLE — register on start(), unregister on stop()/onPause/onDestroy. ✓
// 5. FALLBACK — graceful degradation when sensor is missing. ✓
// 6. NO ZERO-BIAS CALIBRATION — rely on decay. ✓
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
        // v1.2.3 P2 (Round 17 P2-3): Defensive idempotency guard. The
        //   callers (onResume, toggleStabilization) always pair stop() before
        //   start(), but Android's SensorManager.registerListener is not
        //   guaranteed idempotent across OEM ROMs — some HyperOS / MIUI
        //   builds double-deliver events when the same listener is registered
        //   twice without an intervening unregisterListener. Unregister first
        //   so a stray start() (e.g. onResume called without onPause) cannot
        //   double-register.
        try { sensorManager.unregisterListener(this); } catch (Throwable ignored) {}
        // Resolve the only sensor we need (Rev64: rotation sensors removed).
        linAccelSensor = sensorManager.getDefaultSensor(Sensor.TYPE_LINEAR_ACCELERATION);

        if (linAccelSensor == null) {
            Log.w(TAG, "TYPE_LINEAR_ACCELERATION unavailable — cannot do translation anti-shake");
        }

        int rate = SensorManager.SENSOR_DELAY_GAME;
        boolean anyRegistered = false;
        if (linAccelSensor != null) {
            // v1.2.3 round-13 (P1): registerListener returns false on some OEM
            //   ROMs when the sensor is in an error state or already registered
            //   to another listener. Without checking, start() would report
            //   success and the caller would think stabilization is on, but no
            //   onSensorChanged events would ever fire — leaving the user with
            //   a silently-broken feature.
            boolean registered = sensorManager.registerListener(this, linAccelSensor, rate);
            if (registered) {
                anyRegistered = true;
            } else {
                Log.w(TAG, "registerListener returned false for TYPE_LINEAR_ACCELERATION — stabilization inactive");
            }
        }

        // Reset state
        velX = velY = dispX = dispY = 0;
        lastJsCallbackTime = 0;
        _lastSensorNanos = 0; // v1.0.8 PHASE 32: reset so first event uses nominal dt

        // v1.2.1 round-10 (review-E P2): one-time clear of any stale
        //   --stab-rot CSS variable from a previous session (Rev64 removed
        //   rotation sensors, so this var is never set anymore, but older
        //   DOM state from a prior app run may still have it). Moved here
        //   from applyTransform() which ran it ~50 times per second.
        try {
            mainHandler.post(new Runnable() {
                @Override
                public void run() {
                    WebView v = webViewRef.get();
                    if (v != null) {
                        v.evaluateJavascript(
                            "(function(){document.documentElement.style.removeProperty('--stab-rot');})();",
                            null);
                    }
                }
            });
        } catch (Throwable e) {
            Log.w(TAG, "one-time --stab-rot clear failed", e);
        }

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
        _lastSensorNanos = 0; // v1.0.8 PHASE 32: reset on stop too
        Log.i(TAG, "Stabilization stopped");
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event == null || event.sensor == null) return;
        int type = event.sensor.getType();
        if (type == Sensor.TYPE_LINEAR_ACCELERATION) {
            // v1.0.8 PHASE 32 ROBUSTNESS: pass the event timestamp so dt can be
            //   computed from actual inter-event intervals instead of a hardcoded
            //   0.02f. SENSOR_DELAY_GAME nominally delivers at ~50Hz but actual
            //   rate is device-dependent and varies with load.
            processLinearAcceleration(event.values[0], event.values[1], event.timestamp);
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

    // v1.0.8 PHASE 32 ROBUSTNESS: track last event timestamp for dt computation
    private long _lastSensorNanos = 0;

    /**
     * Process linear acceleration (gravity already removed) to compute device
     * displacement, then derive the inverse board displacement for OIS.
     * Only X and Y axes are used (Z = toward/away, not visible).
     *
     * v1.0.8 PHASE 32: dt is now computed from the actual inter-event interval
     *   (event.timestamp) instead of a hardcoded 0.02f. This corrects integration
     *   error on devices whose SENSOR_DELAY_GAME rate differs from 50Hz. The dt
     *   is clamped to [0.001, 0.1] seconds to reject outliers (e.g., the first
     *   event after registration which has no prior reference, or a long gap
     *   from a system stall that would cause a huge velocity spike).
     */
    private void processLinearAcceleration(float ax, float ay, long eventNanos) {
        float dt;
        if (_lastSensorNanos == 0) {
            // First event — no reference; use nominal 20ms
            dt = 0.02f;
        } else {
            long deltaNanos = eventNanos - _lastSensorNanos;
            // Clamp to [1ms, 100ms] to reject outliers
            float dtSec = deltaNanos / 1e9f;
            if (dtSec < 0.001f) dtSec = 0.001f;
            else if (dtSec > 0.1f) dtSec = 0.1f;
            dt = dtSec;
        }
        _lastSensorNanos = eventNanos;
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
        // v1.0.8 PHASE 30: simplified clamp (was 4-line if/else chain)
        boardPxX = Math.max(-MAX_DISPLACEMENT_PX, Math.min(MAX_DISPLACEMENT_PX, boardPxX));
        boardPxY = Math.max(-MAX_DISPLACEMENT_PX, Math.min(MAX_DISPLACEMENT_PX, boardPxY));

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
        // v1.2.1 round-10 (review-E P2): removed r.removeProperty('--stab-rot')
        //   from this hot path. The --stab-rot CSS variable was never set in
        //   the current codebase (Rev64 removed rotation sensors), so the
        //   removeProperty was a no-op executed ~50 times per second. The
        //   one-time clear is now done in start() (above).
        final String finalJs = "(function(){var r=document.documentElement.style;"
                + "r.setProperty('--stab-x','" + sx + "px');"
                + "r.setProperty('--stab-y','" + sy + "px');"
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
