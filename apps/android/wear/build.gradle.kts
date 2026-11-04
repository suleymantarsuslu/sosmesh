plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.sosmesh.android.wear"
    compileSdk = 35

    defaultConfig {
        // Must equal the phone app id + signing for Wearable Data Layer delivery.
        applicationId = "com.sosmesh.android"
        minSdk = 30
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("wearRelease") {
            val storePath =
                System.getenv("SOSMESH_WEAR_RELEASE_STORE_FILE")
                    ?: (project.findProperty("SOSMESH_WEAR_RELEASE_STORE_FILE") as String?)
            if (!storePath.isNullOrBlank()) {
                storeFile = file(storePath)
                storePassword =
                    System.getenv("SOSMESH_WEAR_RELEASE_STORE_PASSWORD")
                        ?: (project.findProperty("SOSMESH_WEAR_RELEASE_STORE_PASSWORD") as String?)
                keyAlias =
                    System.getenv("SOSMESH_WEAR_RELEASE_KEY_ALIAS")
                        ?: (project.findProperty("SOSMESH_WEAR_RELEASE_KEY_ALIAS") as String?)
                keyPassword =
                    System.getenv("SOSMESH_WEAR_RELEASE_KEY_PASSWORD")
                        ?: (project.findProperty("SOSMESH_WEAR_RELEASE_KEY_PASSWORD") as String?)
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            val wearSigning = signingConfigs.getByName("wearRelease")
            val allowDebugSignedRelease =
                (findProperty("sosmesh.allowDebugSignedRelease") as String?) == "true"
            signingConfig =
                when {
                    wearSigning.storeFile != null -> wearSigning
                    allowDebugSignedRelease -> signingConfigs.getByName("debug")
                    else -> null
                }
        }
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

    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation(project(":core:design"))
    implementation(project(":core:wear-companion"))
    implementation(project(":core:ble"))
    implementation(project(":core:protocol"))
    implementation(project(":core:permissions"))
    implementation(project(":core:data"))
    implementation(project(":core:model"))
    implementation(project(":mesh-v2"))
    implementation(project(":contracts-kotlin"))

    implementation("androidx.core:core-splashscreen:1.0.1")

    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.wear.compose:compose-foundation:1.2.1")
    implementation("androidx.wear.compose:compose-material:1.2.1")
    implementation("androidx.wear:wear:1.3.0")
    implementation("androidx.wear:wear-tooling-preview:1.0.0")
    implementation("com.google.android.gms:play-services-wearable:18.1.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")

    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core:1.5.0")
    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("androidx.compose.ui:ui-test-manifest")
}
