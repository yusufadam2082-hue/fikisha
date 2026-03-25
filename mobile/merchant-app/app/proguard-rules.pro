# Add project specific ProGuard rules here.
-keepattributes Signature
-keepattributes *Annotation*

# Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Gson
-keep class com.fikisha.customer.data.model.** { *; }
-keepclassmembers class com.fikisha.customer.data.model.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
