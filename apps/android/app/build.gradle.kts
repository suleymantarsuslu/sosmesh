plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
    kotlin("kapt")
}

android {
    namespace = "com.sosmesh.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sosmesh.android"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val storePath =
                System.getenv("SOSMESH_RELEASE_STORE_FILE")
                    ?: (findProperty("sosmesh.release.storeFile") as String?)
            if (!storePath.isNullOrBlank()) {
                storeFile = file(storePath)
                storePassword =
                    System.getenv("SOSMESH_RELEASE_STORE_PASSWORD")
                        ?: (findProperty("sosmesh.release.storePassword") as String?)
                keyAlias =
                    System.getenv("SOSMESH_RELEASE_KEY_ALIAS")
                        ?: (findProperty("sosmesh.release.keyAlias") as String?)
                keyPassword =
                    System.getenv("SOSMESH_RELEASE_KEY_PASSWORD")
                        ?: (findProperty("sosmesh.release.keyPassword") as String?)
            }
        }
    }

    flavorDimensions += "environment"
    productFlavors {
        create("demo") {
            dimension = "environment"
            applicationIdSuffix = ".demo"
            versionNameSuffix = "-demo"
            buildConfigField("String", "SOSMESH_ENV", "\"demo\"")
            buildConfigField("String", "INGEST_BASE_URL", "\"https://api.demo.sosmesh.local\"")
            buildConfigField("boolean", "SHOW_DEMO_MODE_LABEL", "true")
            buildConfigField("boolean", "REQUIRE_HTTPS_INGEST", "true")
        }
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            buildConfigField("String", "SOSMESH_ENV", "\"staging\"")
            buildConfigField("String", "INGEST_BASE_URL", "\"https://sosmesh.antiosoft.com\"")
            buildConfigField("boolean", "SHOW_DEMO_MODE_LABEL", "false")
            buildConfigField("boolean", "REQUIRE_HTTPS_INGEST", "true")
        }
        create("prod") {
            dimension = "environment"
            isDefault = true
            buildConfigField("String", "SOSMESH_ENV", "\"prod\"")
            buildConfigField(
                "String",
                "INGEST_BASE_URL",
                "\"https://sosmesh.antiosoft.com\"",
            )
            buildConfigField("boolean", "SHOW_DEMO_MODE_LABEL", "false")
            buildConfigField("boolean", "REQUIRE_HTTPS_INGEST", "true")
        }
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            val releaseSigning = signingConfigs.getByName("release")
            val allowDebugSignedRelease =
                (findProperty("sosmesh.allowDebugSignedRelease") as String?) == "true"
            signingConfig =
                when {
                    releaseSigning.storeFile != null && releaseSigning.storeFile!!.exists() -> {
                        releaseSigning
                    }
                    allowDebugSignedRelease -> {
                        signingConfigs.getByName("debug")
                    }
                    else -> {
                        null
                    }
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
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.8"
    }

    lint {
        abortOnError = true
        warningsAsErrors = false
        checkReleaseBuilds = true
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation(project(":contracts-kotlin"))

    implementation(project(":core:design"))
    implementation(project(":core:model"))
    implementation(project(":core:data"))
    implementation(project(":core:permissions"))
    implementation(project(":core:ble"))
    implementation(project(":core:platform"))
    implementation(project(":core:protocol"))
    implementation(project(":feature-relay"))
    implementation(project(":mesh-v2"))
    // Tink (security-crypto) references errorprone annotations; needed on the classpath for R8 (no -dontwarn).
    implementation("com.google.errorprone:error_prone_annotations:2.23.0")
    implementation(project(":feature-sos"))
    implementation(project(":feature-status"))
    implementation(project(":core:wear-companion"))

    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(platform("androidx.compose:compose-bom:2024.02.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("com.google.dagger:hilt-android:2.50")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("androidx.hilt:hilt-work:1.1.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("com.google.android.gms:play-services-wearable:18.1.0")
    kapt("com.google.dagger:hilt-compiler:2.50")
    kapt("androidx.hilt:hilt-compiler:1.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core:1.5.0")
    testImplementation(platform("androidx.compose:compose-bom:2024.02.00"))
    testImplementation("androidx.compose.ui:ui-test-junit4")
    testImplementation("androidx.activity:activity-compose:1.8.2")
}

kapt {
    correctErrorTypes = true
}

configurations.configureEach {
    exclude(group = "org.xerial", module = "sqlite-jdbc")
}

tasks.register("assembleAllReleaseApks") {
    group = "release"
    description = "Build demo, staging, and prod release APKs (unsigned or env-signed)."
    dependsOn("assembleDemoRelease", "assembleStagingRelease", "assembleProdRelease")
}

tasks.register("bundleAllReleaseAabs") {
    group = "release"
    description = "Build release App Bundles for all product flavors."
    dependsOn("bundleDemoRelease", "bundleStagingRelease", "bundleProdRelease")
}

tasks.register("releaseProdArtifacts") {
    group = "release"
    description = "Primary Play-track artifacts: prod release APK + AAB."
    dependsOn("assembleProdRelease", "bundleProdRelease")
}
