package com.Regalia;

/*
 * Regalia - JS Bridge Gateway
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
 *         Provides sandbox-safe path validation and UCI command whitelisting
 *         for all JavaScript → Java bridge calls.
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
import android.util.Log;

import java.io.File;
import java.io.IOException;
import java.util.HashSet;
import java.util.Set;

/**
 * JsBridgeGateway — JS 桥接网关 (v1.2.0 Phase 73)
 *
 * 职责:
 *   - 沙箱路径验证（防止目录穿越攻击）
 *   - UCI 命令白名单过滤（防止恶意命令注入）
 *   - 输入参数校验
 *   - 资源访问权限检查
 *
 * 安全设计:
 *   - 所有文件操作必须先通过 isPathInSandbox() 验证
 *   - 所有 sendToEngine() 调用必须通过 isUciCommandAllowed() 白名单检查
 *   - 路径规范化使用 getCanonicalFile() 防止符号链接绕过
 */
public class JsBridgeGateway {
    private static final String TAG = "JsBridgeGateway";

    private final Context context;

    /** UCI 命令白名单前缀（防止恶意命令注入） */
    private static final Set<String> UCI_COMMAND_WHITELIST = new HashSet<>();
    static {
        UCI_COMMAND_WHITELIST.add("uci");
        UCI_COMMAND_WHITELIST.add("isready");
        UCI_COMMAND_WHITELIST.add("setoption");
        UCI_COMMAND_WHITELIST.add("ucinewgame");
        UCI_COMMAND_WHITELIST.add("position");
        UCI_COMMAND_WHITELIST.add("go");
        UCI_COMMAND_WHITELIST.add("stop");
        UCI_COMMAND_WHITELIST.add("ponderhit");
        UCI_COMMAND_WHITELIST.add("quit");
        UCI_COMMAND_WHITELIST.add("d");
        UCI_COMMAND_WHITELIST.add("flip");
        UCI_COMMAND_WHITELIST.add("compiler");
        UCI_COMMAND_WHITELIST.add("eval");
        UCI_COMMAND_WHITELIST.add("perft");
        UCI_COMMAND_WHITELIST.add("bench");
        UCI_COMMAND_WHITELIST.add("stockfish");
    }

    public JsBridgeGateway(Context context) {
        this.context = context.getApplicationContext();
    }

    /**
     * 验证路径是否在应用沙箱内（filesDir 或 cacheDir）。
     * 使用 getCanonicalFile() 解析符号链接，防止目录穿越攻击。
     *
     * @param path 待验证的路径
     * @return true 表示路径安全（在沙箱内）
     */
    public boolean isPathInSandbox(String path) {
        if (path == null || path.isEmpty()) return false;
        try {
            File target = new File(path).getCanonicalFile();
            File filesDir = context.getFilesDir().getCanonicalFile();
            File cacheDir = context.getCacheDir().getCanonicalFile();
            String targetPath = target.getPath();
            String filesPath = filesDir.getPath();
            String cachePath = cacheDir.getPath();
            // v1.2.0 Phase 82+++++ rev 8: Tightened prefix check to require a path
            // separator after the sandbox root. Previously, String.startsWith would
            // falsely accept "/data/data/com.Regalia/files_evil" as inside filesDir.
            String sep = java.io.File.separator;
            return targetPath.equals(filesPath) || targetPath.startsWith(filesPath + sep)
                || targetPath.equals(cachePath) || targetPath.startsWith(cachePath + sep);
        } catch (IOException e) {
            Log.w(TAG, "Path canonicalization failed: " + path, e);
            return false;
        } catch (SecurityException e) {
            Log.w(TAG, "Security manager denied access: " + path, e);
            return false;
        }
    }

    /**
     * 验证 UCI 命令是否在白名单内。
     * 提取命令的第一个 token，检查是否在白名单中。
     *
     * @param command 待验证的 UCI 命令
     * @return true 表示命令允许
     */
    public boolean isUciCommandAllowed(String command) {
        if (command == null || command.trim().isEmpty()) return false;
        String trimmed = command.trim();
        // 提取第一个 token（命令名）
        int spaceIdx = trimmed.indexOf(' ');
        String cmdName = spaceIdx > 0 ? trimmed.substring(0, spaceIdx) : trimmed;
        cmdName = cmdName.toLowerCase();
        boolean allowed = UCI_COMMAND_WHITELIST.contains(cmdName);
        if (!allowed) {
            Log.w(TAG, "Blocked non-whitelisted UCI command: " + cmdName);
        }
        return allowed;
    }

    /**
     * 验证文件名是否安全（不含路径分隔符、控制字符）。
     * 用于 savePGNCache / setPGNCacheTags 等接受文件名的接口。
     *
     * @param name 待验证的文件名
     * @return true 表示文件名安全
     */
    public boolean isSafeFileName(String name) {
        if (name == null || name.isEmpty()) return false;
        // 禁止路径分隔符
        if (name.contains("/") || name.contains("\\")) return false;
        // 禁止 .. 目录穿越
        if (name.contains("..")) return false;
        // 禁止控制字符
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c < 0x20 || c == 0x7F) return false;
        }
        // 限制长度
        return name.length() <= 200;
    }

    /**
     * 验证 URL 是否使用允许的协议（http/https/mailto）。
     * 用于 openUrlInBrowser 接口。
     *
     * @param url 待验证的 URL
     * @return true 表示 URL 安全
     */
    public boolean isUrlSafe(String url) {
        if (url == null || url.isEmpty()) return false;
        String lower = url.toLowerCase();
        return lower.startsWith("http://")
                || lower.startsWith("https://")
                || lower.startsWith("mailto:")
                || lower.startsWith("intent:");
    }

    /**
     * 验证 FEN 字符串格式是否合法。
     * 简单检查：6 段空格分隔，非空。
     *
     * @param fen 待验证的 FEN
     * @return true 表示格式基本合法
     */
    public boolean isValidFen(String fen) {
        if (fen == null || fen.trim().isEmpty()) return false;
        String[] parts = fen.trim().split("\\s+");
        // 标准 FEN 有 6 段，Chess960 FEN 也可能有 6 段
        return parts.length >= 4 && parts.length <= 6;
    }

    /**
     * 验证 JSON 字符串是否合法。
     *
     * @param json 待验证的 JSON
     * @return true 表示 JSON 合法
     */
    public boolean isValidJson(String json) {
        if (json == null || json.trim().isEmpty()) return false;
        try {
            new org.json.JSONObject(json);
            return true;
        } catch (Throwable notObj) {
            try {
                new org.json.JSONArray(json);
                return true;
            } catch (Throwable notArr) {
                return false;
            }
        }
    }

    /** 获取沙箱根目录（filesDir） */
    public File getSandboxRoot() {
        return context.getFilesDir();
    }

    /** 获取缓存目录 */
    public File getCacheRoot() {
        return context.getCacheDir();
    }
}
