# Regalia ProGuard Rules
# v18.3.0: Minification enabled for release builds

# Keep WebView JS interface
-keepclassmembers class com.Regalia.StockfishNative {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep MainActivity for manifest reference
-keep public class com.Regalia.MainActivity
-keep public class com.Regalia.ChessWebViewClient
-keep public class com.Regalia.StockfishNative

# Keep WebViewClient
-keepclassmembers class com.Regalia.ChessWebViewClient {
    <methods>;
}

# Don't warn about missing Android classes
-dontwarn android.**
-dontwarn androidx.**

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Optimization
-optimizationpasses 3
-allowaccessmodification
-mergeinterfacesaggressively
