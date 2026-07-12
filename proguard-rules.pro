# Regalia ProGuard / R8 rules
#
# v1.2.0 Phase 82+++++ rev 8: Created this file (was missing despite being
# referenced by build.gradle line 113). R8 with minifyEnabled=true renames
# non-kept private fields, which previously broke StockfishNative's reflection-
# based setMessageBusWebView(). The reflection has been replaced with a public
# setter (MessageBus.setWebView), so this file is now primarily for documentation
# and defense-in-depth.

# Keep all @JavascriptInterface methods (R8 default rule, explicitly stated for clarity)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep MessageBus class — its dispatch() method is called from JS via @JavascriptInterface
# and its emit() method is called from Java. The webView field is now set via public setter.
-keep class com.Regalia.MessageBus { *; }

# Keep native method signatures (JNI)
-keepclasseswithmembernames class * {
    native <methods>;
}
