plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    kotlin("kapt")
    kotlin("plugin.serialization") version "1.9.22"
}

android {
    namespace = "com.sosmesh.android.core.protocol"
    compileSdk = 35

    defaultConfig {
        minSdk = 26
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("test") {
            resources.srcDir("${rootProject.projectDir}/../../packages/fixtures/ble")
            resources.srcDir("${rootProject.projectDir}/app/src/main/assets/transport")
        }
    }
}

dependencies {
    implementation(project(":core:ble"))
    implementation(project(":core:data"))
    implementation(project(":core:permissions"))
    implementation(project(":contracts-kotlin"))
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("com.google.dagger:hilt-android:2.50")
    kapt("com.google.dagger:hilt-compiler:2.50")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core:1.5.0")
    testImplementation("androidx.room:room-runtime:2.6.1")
    testImplementation(project(":core:data"))
}

kapt {
    correctErrorTypes = true
}
