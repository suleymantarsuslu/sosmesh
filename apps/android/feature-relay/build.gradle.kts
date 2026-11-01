plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    kotlin("kapt")
    kotlin("plugin.serialization") version "1.9.22"
}

android {
    namespace = "com.sosmesh.android.feature.relay"
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

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }

    sourceSets {
        getByName("test") {
            resources.srcDir("${rootProject.projectDir}/../../packages/fixtures/transport")
            resources.srcDir("${rootProject.projectDir}/../../packages/fixtures/protocol-v1")
        }
    }
}

dependencies {
    implementation(project(":core:protocol"))
    implementation(project(":core:data"))
    implementation(project(":core:ble"))
    implementation(project(":core:platform"))
    implementation(project(":mesh-v2"))
    implementation(project(":contracts-kotlin"))
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
    implementation("com.google.dagger:hilt-android:2.50")
    kapt("com.google.dagger:hilt-compiler:2.50")

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.hilt:hilt-work:1.1.0")
    kapt("androidx.hilt:hilt-compiler:1.1.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation(project(":core:data"))
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core:1.5.0")
    testImplementation("androidx.room:room-runtime:2.6.1")
    testImplementation("androidx.work:work-testing:2.9.0")
}

kapt {
    correctErrorTypes = true
}

configurations.configureEach {
    exclude(group = "org.xerial", module = "sqlite-jdbc")
}
