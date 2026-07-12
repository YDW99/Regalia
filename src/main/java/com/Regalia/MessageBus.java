package com.Regalia;

/*
 * Regalia - JS ↔ Java Message Bus
 * Copyright (C) 2026 Regalia
 *
 * AI-GEN: AI assisted
 * This code was AI-assisted and has been reviewed for AGPL v3 compliance.
 *
 * v1.2.0: New class (Phase 75 — JS↔Java 消息总线).
 *         Provides a unified communication channel between JavaScript and Java,
 *         replacing direct method calls with a typed message dispatch pattern.
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

import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * MessageBus — JS ↔ Java 消息总线 (v1.2.0 Phase 75)
 *
 * 职责:
 *   - 统一 JS → Java 的方法调用通道（通过 dispatch 接口）
 *   - 统一 Java → JS 的事件发送通道（通过 emit/postJsCallback）
 *   - 消息类型注册与分发
 *   - 同步/异步消息区分
 *
 * 设计:
 *   - JS → Java: window.MessageBus.dispatch(action, jsonPayload) → 同步返回结果
 *   - Java → JS: messageBus.emit(event, jsonPayload) → 异步通过 evaluateJavascript
 *
 * 线程安全: 处理器映射使用 ConcurrentHashMap，支持多线程注册和调用。
 */
public class MessageBus {
    private static final String TAG = "MessageBus";

    /** 消息处理器接口 */
    public interface Handler {
        /**
         * 处理 JS → Java 的消息。
         * @param payload JSON 负载
         * @return 返回结果（JSON 字符串，或 null 表示无返回值）
         */
        String handle(String payload);
    }

    // v1.2.0 Phase 82+++++ rev 8: Removed `final` so setWebView() can update it.
    // Previously, StockfishNative.setMessageBusWebView() used reflection to set this
    // field, but R8 (minifyEnabled=true in release builds) renames private fields,
    // causing NoSuchFieldException. The public setter replaces the reflection.
    private WebView webView;
    private final Map<String, Handler> handlers = new ConcurrentHashMap<>();

    public MessageBus(WebView webView) {
        this.webView = webView;
    }

    /** v1.2.0 Phase 82+++++ rev 8: Public setter — replaces fragile reflection. */
    public void setWebView(WebView webView) {
        this.webView = webView;
    }

    /** 注册消息处理器 */
    public void register(String action, Handler handler) {
        if (action == null || action.isEmpty()) {
            throw new IllegalArgumentException("action cannot be null or empty");
        }
        handlers.put(action, handler);
        Log.d(TAG, "Registered handler for action: " + action);
    }

    /** 注销消息处理器 */
    public void unregister(String action) {
        handlers.remove(action);
    }

    /**
     * JS → Java 的统一分发接口（同步调用）。
     * 由 JavaScript 通过 MessageBus.dispatch(action, payload) 调用。
     *
     * @param action 消息类型
     * @param payload JSON 负载
     * @return 处理结果（JSON 字符串，或 null）
     */
    @JavascriptInterface
    public String dispatch(String action, String payload) {
        if (action == null || action.isEmpty()) {
            Log.w(TAG, "dispatch: empty action");
            return errorResult("empty action");
        }
        Handler handler = handlers.get(action);
        if (handler == null) {
            Log.w(TAG, "dispatch: no handler for action: " + action);
            return errorResult("no handler for " + action);
        }
        try {
            String result = handler.handle(payload);
            return result != null ? result : successResult();
        } catch (Throwable e) {
            Log.e(TAG, "dispatch: handler error for " + action, e);
            return errorResult(e.getMessage());
        }
    }

    /**
     * Java → JS 的事件发送（异步）。
     * 通过 evaluateJavascript 在 WebView 主线程执行 JS 回调。
     *
     * @param event 事件名
     * @param jsonPayload JSON 负载（字符串）
     */
    public void emit(String event, String jsonPayload) {
        if (event == null || event.isEmpty()) {
            Log.w(TAG, "emit: empty event");
            return;
        }
        if (webView == null) {
            Log.w(TAG, "emit: webView is null for event: " + event);
            return;
        }
        try {
            // v1.2.0 Phase 82+++++ rev 7: Call window._messageBusJs._onEvent (not
            // window.MessageBus._onEvent) because the Java @JavascriptInterface
            // registered as "MessageBus" would shadow a JS object of the same name.
            // The JS-side receiver is defined in state-store.js.
            String safePayload = jsonPayload != null ? jsonPayload : "null";
            String js = "window._messageBusJs && window._messageBusJs._onEvent("
                    + escapeJsString(event) + ", " + safePayload + ");";
            webView.post(() -> {
                try {
                    webView.evaluateJavascript(js, null);
                } catch (Throwable e) {
                    Log.w(TAG, "emit: evaluateJavascript failed for " + event, e);
                }
            });
        } catch (Throwable e) {
            Log.e(TAG, "emit: failed for event " + event, e);
        }
    }

    /** 简便方法：发送事件（无负载） */
    public void emit(String event) {
        emit(event, (String) null);
    }

    /** 简便方法：发送事件（JSONObject 负载） */
    public void emit(String event, JSONObject payload) {
        emit(event, payload != null ? payload.toString() : null);
    }

    /** 构造成功结果 JSON */
    private String successResult() {
        try {
            JSONObject obj = new JSONObject();
            obj.put("ok", true);
            return obj.toString();
        } catch (Throwable e) {
            return "{\"ok\":true}";
        }
    }

    /** 构造错误结果 JSON */
    private String errorResult(String message) {
        try {
            JSONObject obj = new JSONObject();
            obj.put("ok", false);
            obj.put("error", message != null ? message : "unknown error");
            return obj.toString();
        } catch (Throwable e) {
            return "{\"ok\":false,\"error\":\"unknown\"}";
        }
    }

    /** 转义 JS 字符串字面量 */
    private static String escapeJsString(String s) {
        if (s == null) return "''";
        StringBuilder sb = new StringBuilder("'");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\'': sb.append("\\'"); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append("'");
        return sb.toString();
    }

    /** 获取已注册的所有 action 名称 */
    public java.util.Set<String> getRegisteredActions() {
        return new java.util.HashSet<>(handlers.keySet());
    }
}
