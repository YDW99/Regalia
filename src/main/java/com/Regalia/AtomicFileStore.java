package com.Regalia;

/*
 * Regalia - Atomic UTF-8 file writer
 * Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted
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

import android.system.ErrnoException;
import android.system.Os;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;

/** Small API-23-compatible atomic writer for app-private text payloads. */
final class AtomicFileStore {
    private static final String TAG = "AtomicFileStore";

    private AtomicFileStore() {
    }

    static void writeUtf8(File target, String value) throws IOException {
        if (target == null || value == null) {
            throw new NullPointerException("target and value must be non-null");
        }
        File parent = target.getParentFile();
        if (parent == null || !parent.isDirectory()) {
            throw new IOException("Target directory is unavailable");
        }

        File temp = File.createTempFile(target.getName() + ".", ".tmp", parent);
        boolean replaced = false;
        try {
            try (FileOutputStream stream = new FileOutputStream(temp);
                 OutputStreamWriter writer =
                     new OutputStreamWriter(stream, StandardCharsets.UTF_8)) {
                writer.write(value);
                writer.flush();
                stream.getFD().sync();
            }
            try {
                Os.rename(temp.getAbsolutePath(), target.getAbsolutePath());
            } catch (ErrnoException e) {
                throw new IOException("Atomic file replacement failed", e);
            }
            replaced = true;
        } finally {
            if (!replaced) {
                try {
                    if (temp.exists()) {
                        // v1.2.3 round-79 (SonarCloud S899): best-effort 清理的删除结果
                        //   被记录而非静默丢弃 —— 清理失败（fd 占用等）时残留的临时
                        //   文件可被人工排查；原始写入/替换失败仍然优先上抛，
                        //   这里的日志不影响异常传播。
                        boolean deleted = temp.delete();
                        if (!deleted) {
                            Log.w(TAG, "Failed to clean up temporary file: " + temp.getName()); // mobsf-ignore: android_logging
                        } // mobsf-ignore: android_logging
                    }
                } catch (SecurityException ignored) {
                    // Preserve the original write/rename failure.
                }
            }
        }
    }
}
