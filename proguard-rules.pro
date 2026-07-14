# ============================================================================
# Regalia ProGuard / R8 Rules
# ============================================================================
# Copyright (C) 2026 Regalia
# AI-GEN: AI assisted
#
# This file is consumed by build.gradle (release buildType) alongside Android
# SDK's default "proguard-android-optimize.txt". Rules here are ADDITIVE — the
# default file already handles most Android-specific keep rules.
#
# v1.2.1 round-1: created (previously missing — referenced by build.gradle
#   but absent, causing release builds to fall back to defaults only).
# ============================================================================

# ----------------------------------------------------------------------------
# 1. JavascriptInterface methods
# ----------------------------------------------------------------------------
# Every @JavascriptInterface-annotated method is invoked from the WebView's
# JavaScript by name. R8 must not rename or remove them. The @JavascriptInterface
# annotation itself triggers AGP to auto-emit keep rules, but we add an
# explicit belt-and-suspenders rule in case annotation processing changes.
-keepclassmembers class com.Regalia.** {
    @android.webkit.JavascriptInterface <methods>;
}

# ----------------------------------------------------------------------------
# 2. JS bridge entry points (StockfishNative and its public helpers)
# ----------------------------------------------------------------------------
# StockfishNative is the JS bridge facade. All public methods are reachable
# from JavaScript via @JavascriptInterface. Keep the class and all its public
# methods intact.
-keep class com.Regalia.StockfishNative { public *; }
-keep class com.Regalia.MainActivity { public *; }
-keep class com.Regalia.StatsActivity { public *; }

# ----------------------------------------------------------------------------
# 3. Native JNI methods
# ----------------------------------------------------------------------------
# Java calls StockfishNative.nativeChmod(String) : boolean (and the legacy
# nativeRenice), both implemented in C++ in engine_jni.cpp via JNI. R8 must
# not rename or remove the native method declarations (the JNI runtime looks
# them up by exact name+signature). The ChmodProvider callback interface is
# kept because engine_jni.cpp's JNI calls back into Java via it.
-keepclasseswithmembernames class * {
    native <methods>;
}
-keep class com.Regalia.EngineProcessManager$ChmodProvider { *; }
-keep class com.Regalia.EngineProcessManager { *; }

# ----------------------------------------------------------------------------
# 4. Application / Service / Receiver / Provider (declared in AndroidManifest)
# ----------------------------------------------------------------------------
# These are instantiated by the framework via reflection — AGP's default rules
# usually cover them, but we add explicit keeps for safety.
-keep public class com.Regalia.ChessApp {
    public <init>();
}
-keep public class com.Regalia.EngineService {
    public <init>();
}
-keep public class com.Regalia.MainActivity {
    public <init>();
}
-keep public class com.Regalia.StatsActivity {
    public <init>();
}

# ----------------------------------------------------------------------------
# 5. WebView client / ChromeClient subclasses
# ----------------------------------------------------------------------------
# Subclasses of WebViewClient and WebChromeClient are often referenced by name
# from layout XML or instantiated reflectively.
-keep class com.Regalia.ChessWebViewClient { *; }

# ----------------------------------------------------------------------------
# 6. JNI signature stability for engine_jni.cpp
# ----------------------------------------------------------------------------
# Java calls StockfishNative.nativeChmod(String) : boolean, which is
# implemented in C++ in engine_jni.cpp via JNI. The native method is
# already kept by rule #3 (native <methods>), and the enclosing class is
# kept by rule #2. No additional rule is needed — this section exists to
# document the JNI direction (Java → C++) to prevent future readers from
# inverting it. (ProGuard has no directive to keep a static initializer
# explicitly; keeping the class is sufficient for System.loadLibrary to run.)

# ----------------------------------------------------------------------------
# 7. Assets and resources
# ----------------------------------------------------------------------------
# chess.html, stats.html, and asset files are loaded by name from the WebView.
# These are not subject to ProGuard (assets are not bytecode), but we document
# here that no resource shrinking should remove the assets/ folder contents.
# AGP's shrinkResources handles this via the keep.xml in res/raw/.
# (No rule needed — documentation only.)

# ----------------------------------------------------------------------------
# 8. Optimization settings
# ----------------------------------------------------------------------------
# R8 full-mode (default in AGP 8.x) is aggressive. Allow it to inline and
# optimize, but never remove the entry points above.
-allowaccessmodification
-repackageclasses ''
-mergeinterfacesaggressively

# ----------------------------------------------------------------------------
# 9. Logging
# ----------------------------------------------------------------------------
# Strip android.util.Log.v() / Log.d() calls in release builds to reduce
# overhead and avoid leaking internal state. Keep w/i/e for diagnostics.
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
}
