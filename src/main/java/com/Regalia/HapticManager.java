package com.Regalia;

/*
 * Regalia - Haptic Feedback Manager
 * Copyright (C) 2026 Regalia
 *
 * Haptic/vibration patterns derived from DroidFish
 * (Copyright (C) Peter Österlund, GPL v3)
 * Modified by Regalia on 2026-06-15
 *
 * AI-GEN: AI assisted + DroidFish source code logic reference
 * This code was AI-assisted and has been reviewed for GPL v3 compliance.
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
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.util.Log;

/**
 * HapticManager - haptic (vibration) feedback for all interactive elements.
 *
 * v1.2.3 (God Class refactor round-17): extracted from StockfishNative.java
 *   (~420 lines: isHapticEnabled / performHaptic / performHapticInternal /
 *   tryPwleVibrate / fallbackVibrate). StockfishNative keeps thin
 *   {@code @JavascriptInterface} delegate wrappers so the JS API surface is
 *   unchanged. Piece-specific haptic "personalities" (pawn quiver, queen
 *   impact, king regal, knight jump-land, bishop glide, rook charge) are
 *   preserved verbatim from the inline implementation.
 */
public class HapticManager {
    private static final String TAG = "Regalia";

    private final Context context;
    private final SharedPreferences prefs;
    private final Handler mainHandler;

    public HapticManager(Context context, SharedPreferences prefs, Handler mainHandler) {
        this.context = context;
        this.prefs = prefs;
        this.mainHandler = mainHandler;
    }

    public boolean isHapticEnabled() {
        try {
            boolean systemEnabled = android.provider.Settings.System.getInt(
                context.getContentResolver(),
                android.provider.Settings.System.HAPTIC_FEEDBACK_ENABLED, 1
            ) != 0;
            boolean appEnabled = prefs.getBoolean("hapticFeedbackEnabled", true);
            // FIX: Both system AND app must be enabled. Previously used OR (||)
            // which meant disabling haptic in app settings had no effect.
            return systemEnabled && appEnabled;
        } catch (Exception e) {
            // v1.2.3 (S1181): Settings.System.getInt / getBoolean throw
            //   SettingNotFoundException / ClassCastException (Exception
            //   subtypes). Fail-open to true (haptic enabled) on lookup
            //   failure; Errors (OOM etc.) must propagate.
            return true;
        }
    }

    public void performHaptic(String type) {
        try {
            android.os.Vibrator vibrator = (android.os.Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;

            if (!isHapticEnabled()) return;

            int apiLevel = Build.VERSION.SDK_INT;
            final android.os.Vibrator finalVibrator = vibrator;

            Runnable hapticRunnable = new Runnable() {
                public void run() {
                    try {
                        performHapticInternal(finalVibrator, type, apiLevel);
                    } catch (Exception e) {
                        // v1.2.3 (S1181): vibrate() throws RuntimeException
                        //   subtypes at most — log and continue.
                        Log.w(TAG, "performHapticInternal failed: " + e.getMessage());
                    }
                }
            };

            mainHandler.post(hapticRunnable);
        } catch (Exception e) {
            // v1.2.3 (S1181): getSystemService / mainHandler.post throw
            //   RuntimeException subtypes at most — log and continue.
            Log.w(TAG, "performHaptic failed: " + e.getMessage());
        }
    }

    private void performHapticInternal(android.os.Vibrator vibrator, String type, int apiLevel) {
        switch (type) {
                case "BUTTON_PRESS":
                    if (apiLevel >= 31) {
                        try {
                            android.os.VibrationEffect effect = android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_CLICK);
                            vibrator.vibrate(effect);
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 15);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 15);
                    }
                    break;

                case "PIECE_SELECT":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.3f, 0.0f}, new long[]{0, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 31) {
                        try {
                            android.os.VibrationEffect effect = android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_TICK);
                            vibrator.vibrate(effect);
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 10);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 10);
                    }
                    break;

                case "PIECE_MOVE":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.0f}, new long[]{0, 40, 25})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 31) {
                        try {
                            android.os.VibrationEffect effect = android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_HEAVY_CLICK);
                            vibrator.vibrate(effect);
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 25);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 25);
                    }
                    break;

                // v1.0.8 PHASE 26: piece-specific haptics for pawn (light quiver),
                //   queen (massive impact), king (heavy regal).
                // v1.0.8 PHASE 27: added knight (jump + crisp landing),
                //   bishop (smooth glide), rook (charge + impact) haptics so all
                //   six piece types have distinct, personality-matched feedback.
                case "PAWN_MOVE":
                    // Light quiver — three tiny ticks (the "瑟瑟发抖" shiver)
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.15f, 0.05f, 0.15f, 0.05f, 0.15f, 0.0f}, new long[]{0, 12, 8, 12, 8, 12, 8})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 12, 8, 12, 8, 12};
                            int[] amplitudes = {0, 60, 20, 60, 20, 60};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 20);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 20);
                    }
                    break;

                case "KNIGHT_MOVE":
                    // Agile jump + crisp landing — a gentle lift-off ramp, a brief
                    // mid-air gap, then a sharp crisp "ding" tick (the L-shape
                    // parabolic jump + crisp ding landing from the sound/animation).
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.35f, 0.1f, 0.7f, 0.0f}, new long[]{0, 30, 40, 25, 15})) {
                        // PWLE: ramp up (lift-off) → gap (mid-air) → sharp peak (landing ding)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 30, 40, 25};
                            int[] amplitudes = {0, 100, 30, 200};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 60);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 60);
                    }
                    break;

                case "BISHOP_MOVE":
                    // Sharp smooth glide — a single smooth swell (no hard peak);
                    // the bishop slides swiftly and cleanly along the diagonal.
                    // Matches the sawtooth-glide + filter-sweep sound (270ms).
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.4f, 0.45f, 0.2f, 0.0f}, new long[]{0, 40, 50, 40, 20})) {
                        // PWLE: smooth ramp up → smooth ramp down (bell-curve, no tick)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 40, 50, 40};
                            int[] amplitudes = {0, 120, 140, 60};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 70);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 70);
                    }
                    break;

                case "ROOK_MOVE":
                    // Fierce charge-dash-impact — a low charge rumble, a brief dash
                    // gap, then a heavy impact thud (matches the 3-stage rook sound
                    // and the light board shake on landing).
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.15f, 0.85f, 0.3f, 0.5f, 0.0f}, new long[]{0, 25, 35, 60, 25, 40, 20})) {
                        // PWLE: low charge → gap (dash whoosh) → heavy impact thud
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 25, 35, 60, 25, 40};
                            int[] amplitudes = {0, 150, 40, 255, 80, 150};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 120);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 120);
                    }
                    break;

                case "QUEEN_MOVE":
                    // Massive impact — the "铿锵有声、掷地有声" resounding slam
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.8f, 0.3f, 1.0f, 0.2f, 0.7f, 0.0f}, new long[]{0, 60, 40, 120, 50, 80, 40})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 60, 40, 120, 50, 80};
                            int[] amplitudes = {0, 200, 80, 255, 130, 180};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 300);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 300);
                    }
                    break;

                case "KING_MOVE":
                    // Heavy regal — four measured thuds (the "威严庄重" solemn steps)
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.2f, 0.6f, 0.2f, 0.6f, 0.2f, 0.6f, 0.0f}, new long[]{0, 50, 60, 50, 60, 50, 60, 50, 40})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 50, 60, 50, 60, 50, 60, 50};
                            int[] amplitudes = {0, 180, 60, 180, 60, 180, 60, 180};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 250);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 250);
                    }
                    break;

                case "PIECE_CAPTURE":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.2f, 0.6f, 0.0f}, new long[]{0, 30, 20, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 31) {
                        try {
                            vibrator.vibrate(android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_DOUBLE_CLICK));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 40);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 40);
                    }
                    break;

                case "SLIDER_DRAG":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.15f, 0.0f}, new long[]{0, 15, 10})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 8);
                    }
                    break;

                case "TAB_SWITCH":
                    if (apiLevel >= 31) {
                        try {
                            vibrator.vibrate(android.os.VibrationEffect.createPredefined(
                                android.os.VibrationEffect.EFFECT_CLICK));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 20);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 20);
                    }
                    break;

                case "TOGGLE_ON":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.2f, 0.5f, 0.0f}, new long[]{0, 30, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 30);
                    }
                    break;

                case "TOGGLE_OFF":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.5f, 0.2f, 0.0f}, new long[]{0, 30, 30, 20})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 20);
                    }
                    break;

                case "CHECK_ALERT":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.8f, 0.3f, 0.8f, 0.3f, 0.8f, 0.0f}, new long[]{0, 50, 30, 50, 30, 50, 30})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 50, 30, 50, 30, 50};
                            int[] amplitudes = {0, 255, 100, 255, 100, 255};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 200);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 200);
                    }
                    break;

                case "GAME_OVER":
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.6f, 0.3f, 0.8f, 0.1f, 0.0f}, new long[]{0, 100, 50, 200, 80, 50})) {
                        // PWLE succeeded (or falls through to waveform below)
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 100, 50, 200, 80};
                            int[] amplitudes = {0, 200, 100, 255, 30};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 400);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 400);
                    }
                    break;

                // v1.0.8 PHASE 28: CASTLE and PROMOTION haptics (previously fell to
                //   the 15ms default — castling felt LESS tactile than a normal move,
                //   promotion had no celebratory feedback).
                // v1.0.8 PHASE 29: CASTLE redesigned to match the new rapid "snap +
                //   slam" sound (playCastleRookMove in ui.js). The old pattern
                //   (40-30-50ms, amplitudes 160/50/200) was too gentle and too slow
                //   for the new impactful sound. New pattern mirrors the two-stage
                //   audio design:
                //     Stage 1 (0-35ms): sharp intense snap — amplitude 255 (max),
                //                       matching the 110Hz thump + noise crack
                //     Stage 2 (45-105ms): heavy rumble slam — amplitude 220,
                //                         matching the sawtooth down-sweep + shimmer
                //   Total ~105ms (vs old 120ms) — tighter, more decisive.
                //   The "威严的迅猛" (majestic rapidity) feel: the king commands,
                //   the rook obeys instantly with a heavy thud.
                case "CASTLE":
                    // Two-stage snap + slam — synchronized with playCastleRookMove
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 1.0f, 0.3f, 0.85f, 0.0f}, new long[]{0, 35, 10, 60, 15})) {
                        // PWLE succeeded
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 35, 10, 60};
                            int[] amplitudes = {0, 255, 80, 220};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 105);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 105);
                    }
                    break;

                case "PROMOTION":
                    // Celebratory ascending triad — three rising pulses
                    if (apiLevel >= 35 && tryPwleVibrate(vibrator, new float[]{0.0f, 0.3f, 0.15f, 0.5f, 0.2f, 0.8f, 0.0f}, new long[]{0, 30, 20, 30, 20, 50, 20})) {
                        // PWLE succeeded
                    } else if (apiLevel >= 26) {
                        try {
                            long[] timings = {0, 30, 20, 30, 20, 50};
                            int[] amplitudes = {0, 80, 30, 140, 50, 220};
                            vibrator.vibrate(android.os.VibrationEffect.createWaveform(timings, amplitudes, -1));
                        } catch (Exception e) { // v1.2.3 (S1181): vibrate() throws RuntimeException subtypes
                            fallbackVibrate(vibrator, apiLevel, 100);
                        }
                    } else {
                        fallbackVibrate(vibrator, apiLevel, 100);
                    }
                    break;

                default:
                    fallbackVibrate(vibrator, apiLevel, 15);
                    break;
            }
    }

    // v1.0.8 PHASE 28 (bug fix): tryPwleVibrate now returns boolean (true if
    //   PWLE succeeded, false if it fell back). The internal fallback was a
    //   single OneShot which lost the multi-stage pattern (e.g. queen's
    //   charge-impact became a single 390ms buzz). Now: if PWLE fails, return
    //   false so the case statement's API 26+ waveform branch can run (which
    //   has the correct multi-stage pattern). The old internal fallback is
    //   removed — no more silent single-buzz degradation.
    // v1.2.3 round-20 (known-issue E-3): PWLE reflection is now probed ONCE
    //   per process and cached. Previously every haptic event ran the full
    //   Class.forName + 3× getMethod + constructor sequence; on devices whose
    //   public SDK lacks the PWLE surface (the common case today — the
    //   Composition/PWLE methods are hidden on most API-35 ROMs) the
    //   reflection threw on EVERY call, producing a silent per-call overhead
    //   and a logcat line per haptic. Now: UNKNOWN → probe once; AVAILABLE →
    //   reuse the cached Method/Constructor handles; UNAVAILABLE → skip
    //   reflection entirely and go straight to the waveform fallback (one
    //   diagnostic Log.d at probe time, not per call).
    private static final int PWLE_UNKNOWN = 0;
    private static final int PWLE_AVAILABLE = 1;
    private static final int PWLE_UNAVAILABLE = 2;
    private static volatile int pwleState = PWLE_UNKNOWN;
    private static java.lang.reflect.Constructor<?> pwleCtor = null;
    private static java.lang.reflect.Method pwleStartMethod = null;
    private static java.lang.reflect.Method pwleAddPwleRampMethod = null;
    private static java.lang.reflect.Method pwleComposeMethod = null;

    private boolean tryPwleVibrate(android.os.Vibrator vibrator, float[] amplitudes, long[] durations) {
        if (Build.VERSION.SDK_INT < 35) return false;
        if (pwleState == PWLE_UNAVAILABLE) return false;
        try {
            if (pwleState == PWLE_UNKNOWN) {
                Class<?> builderClass = Class.forName("android.os.VibrationEffect$Composition");
                pwleStartMethod = builderClass.getMethod("startPwle");
                pwleAddPwleRampMethod = builderClass.getMethod("addPwleRamp", long.class, float.class);
                pwleComposeMethod = builderClass.getMethod("compose");
                pwleCtor = builderClass.getDeclaredConstructor();
                pwleState = PWLE_AVAILABLE;
                Log.d(TAG, "PWLE haptics available (probed once, cached)");
            }

            Object composition = pwleCtor.newInstance();
            pwleStartMethod.invoke(composition);

            for (int i = 0; i < amplitudes.length; i++) {
                pwleAddPwleRampMethod.invoke(composition, durations[i], amplitudes[i]);
            }

            Object effect = pwleComposeMethod.invoke(composition);
            vibrator.vibrate((android.os.VibrationEffect) effect);
            return true;
        } catch (Throwable e) {
            // INTENTIONAL Throwable (S1181 justified): reflection against
            //   android.os.VibrationEffect$Composition can fail with
            //   NoSuchMethodError / NoClassDefFoundError on OEM ROMs whose
            //   API-35 surface differs from AOSP — those are Errors, not
            //   Exceptions, and must be tolerated by falling back.
            pwleState = PWLE_UNAVAILABLE;
            pwleCtor = null;
            pwleStartMethod = null;
            pwleAddPwleRampMethod = null;
            pwleComposeMethod = null;
            Log.d(TAG, "PWLE not available (cached; no further reflection attempts) — falling back to waveform: " + e);
            return false;
        }
    }

    private void fallbackVibrate(android.os.Vibrator vibrator, int apiLevel, long durationMs) {
        try {
            if (apiLevel >= 26) {
                vibrator.vibrate(android.os.VibrationEffect.createOneShot(durationMs, 128));
            } else {
                vibrator.vibrate(durationMs);
            }
        } catch (Throwable e) {
            // INTENTIONAL Throwable (S1181 justified): vibrate(long) /
            //   vibrate(VibrationEffect) on broken OEM driver stacks can throw
            //   unchecked Errors; haptic is best-effort, so stay silent.
            // Silent - vibrator unavailable
        }
    }
}
