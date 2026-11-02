# SOSMesh app — R8/ProGuard (ADIM 51). Mapping: app/build/outputs/mapping/<variant>/mapping.txt

-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Hilt / Dagger (generated components)
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }
-keepclasseswithmembers class * {
    @dagger.* <methods>;
}
-keep class * extends dagger.hilt.internal.GeneratedComponent { *; }

# WorkManager + Hilt worker factory
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.ListenableWorker
-keepclassmembers class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context,androidx.work.WorkerParameters);
}

# Kotlin metadata for coroutines/reflection used by frameworks
-keepclassmembers class kotlin.Metadata { public *; }

# JNI / crypto providers used via standard APIs
-keep class org.bouncycastle.** { *; }

# Keep protocol constants referenced by reflection in tests only — production uses direct refs
-keepclassmembers class com.sosmesh.** {
    public static final ** Companion;
}

# Room (relay queue / local persistence)
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keepclassmembers class * {
    @androidx.room.* <methods>;
}

# kotlinx.serialization (wear companion + protocol JSON)
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class *$$serializer { *; }
-keep @kotlinx.serialization.Serializable class * { *; }

# BouncyCastle LDAP cert store references javax.naming.* (desktop JDK); Android runtime does not ship JNDI.
-dontwarn javax.naming.**
