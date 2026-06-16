package com.Regalia;

/*
 * Regalia - Root Detection Utility
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
 */

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;

import java.io.File;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * RootDetector — lightweight, non-blocking root detection (MobSF #9).
 *
 * Design rationale (first-principles):
 * Regalia is an offline chess app with no sensitive user data, no authentication,
 * and no backend server. Hard-blocking rooted devices would be hostile to the
 * many power users who run chess engines on rooted phones. Instead, this utility
 * performs a best-effort check and records the result so it is available for
 * security-conscious auditing, without ever refusing to run.
 *
 * The check looks for three independent signals:
 *   1. Well-known su / Superuser / Magisk app packages installed.
 *   2. Well-known root binary paths present on the filesystem.
 *   3. Build tag "test-keys" (custom ROM indicator).
 *
 * Any one signal is enough to flag the device. The result is cached so the
 * filesystem is only scanned once per process.
 */
public final class RootDetector {

    private static volatile Boolean cachedResult = null;

    private RootDetector() { /* utility class */ }

    /** Packages commonly installed only on rooted devices. */
    private static final Set<String> ROOT_PACKAGES = new HashSet<>(Arrays.asList(
            "com.topjohnwu.magisk",
            "eu.chainfire.supersu",
            "com.koushikdutta.superuser",
            "com.thirdparty.superuser",
            "com.kingouser.com",
            "com.kingroot.kingroot",
            "com.noshufou.android.su",
            "com.noshufou.android.su.elite",
            "com.yellowes.su",
            "com.koushikdutta.rommanager",
            "com.dimonvideo.luckypatcher",
            "com.chelpus.lackypatch"
    ));

    /** Filesystem paths where the su binary is typically found on a rooted device. */
    private static final String[] ROOT_PATHS = {
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su"
    };

    /**
     * Returns true if the device shows signs of being rooted.
     * The result is cached for the lifetime of the process.
     * This method is safe to call from any thread; it performs only
     * read-only filesystem and PackageManager queries.
     */
    public static boolean isDeviceRooted(Context context) {
        if (cachedResult != null) return cachedResult;
        boolean rooted = checkRootFiles() || checkRootPackages(context) || checkBuildTags();
        cachedResult = rooted;
        return rooted;
    }

    /** Signal 1: check for known su binary paths. */
    private static boolean checkRootFiles() {
        for (String path : ROOT_PATHS) {
            try {
                if (new File(path).exists()) return true;
            } catch (Throwable ignored) { /* security manager / sandbox */ }
        }
        return false;
    }

    /** Signal 2: check for known root-management app packages. */
    private static boolean checkRootPackages(Context context) {
        if (context == null) return false;
        try {
            PackageManager pm = context.getPackageManager();
            if (pm == null) return false;
            for (String pkg : ROOT_PACKAGES) {
                try {
                    pm.getPackageInfo(pkg, 0);
                    return true;
                } catch (PackageManager.NameNotFoundException ignored) {
                    /* not installed — continue */
                }
            }
        } catch (Throwable ignored) { /* fail open */ }
        return false;
    }

    /** Signal 3: check for "test-keys" build tag (custom / developer ROM). */
    private static boolean checkBuildTags() {
        try {
            String tags = Build.TAGS;
            return tags != null && tags.contains("test-keys");
        } catch (Throwable ignored) {
            return false;
        }
    }
}
