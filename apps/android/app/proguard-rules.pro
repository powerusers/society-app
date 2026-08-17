# kotlinx.serialization keeps its serializers in companion objects that R8
# cannot see are used. Without these the release build parses nothing.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.prangan.society.core.model.** {
    *** Companion;
}
-keepclasseswithmembers class com.prangan.society.core.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.prangan.society.core.model.**$$serializer { *; }

# Retrofit interfaces are reflective.
-keep,allowobfuscation,allowshrinking interface retrofit2.Call
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
