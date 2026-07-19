package com.Regalia;

/*
 * Regalia - Engine Health Monitor
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
 * v1.2.1 (round-4 cleanup): Slimmed to a pure state holder. The heartbeat
 *         thread, zombie detection, and recovery backoff that lived here were
 *         redundant with the inline implementations in StockfishNative — they
 *         duplicated state and could diverge. Only the two pieces of state
 *         that StockfishNative actually reads through this class remain:
 *         lastResponseTime and autoRecoveryCount.
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

import android.os.SystemClock;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * EngineHealthMonitor — engine health state holder (v1.2.1 slimmed).
 *
 * Responsibilities (v1.2.1):
 *   - Hold the last engine response timestamp (volatile long).
 *   - Hold the auto-recovery counter (AtomicInteger).
 *
 * The heartbeat thread, zombie-detection timeouts, and RecoveryCallback
 * interface that lived here in v1.2.0 were redundant with the inline
 * equivalents in StockfishNative. They are removed; this class is now a
 * minimal shared-state vessel so that the inline code has a single source
 * of truth for these two values.
 *
 * Thread safety: counter uses AtomicInteger; timestamp is volatile.
 *
 * v1.2.3 round-32: timestamp source switched from System.currentTimeMillis()
 *   to SystemClock.elapsedRealtime() (monotonic). Wall-clock jumps (user
 *   changes date/time, NTP sync) would otherwise make the heartbeat zombie
 *   detector in StockfishNative misfire — backward jumps cause false
 *   zombies (unnecessary recovery), forward jumps mask hung engines.
 *   Same fix class as round-31 HapticManager/StabilizationHelper.
 */
public class EngineHealthMonitor {
    // v1.2.3 round-32: elapsedRealtime() — monotonic since boot, immune to
    //   wall-clock changes. getLastResponseTime() consumers in StockfishNative
    //   must use the same clock for the delta (round-32 fixes that too).
    private volatile long lastResponseTime = SystemClock.elapsedRealtime();
    private final AtomicInteger autoRecoveryCount = new AtomicInteger(0);

    /** No-arg constructor — StockfishNative no longer wires a RecoveryCallback. */
    public EngineHealthMonitor() {
    }

    /** Update the last-response timestamp (called whenever the engine emits any output). */
    public void onResponseReceived() {
        lastResponseTime = SystemClock.elapsedRealtime();
    }

    /** @return the last engine response timestamp, in elapsedRealtime() millis
     *         (monotonic since boot — NOT wall-clock epoch millis). */
    public long getLastResponseTime() {
        return lastResponseTime;
    }

    /** Atomically increment the recovery counter and return the new value. */
    public int incrementRecoveryCount() {
        return autoRecoveryCount.incrementAndGet();
    }

    /** @return the current recovery count. */
    public int getRecoveryCount() {
        return autoRecoveryCount.get();
    }

    /** Reset the recovery counter to zero (called after the engine stabilises). */
    public void resetRecoveryCount() {
        autoRecoveryCount.set(0);
    }
}
