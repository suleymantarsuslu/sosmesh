pluginManagement {
    repositories {
        google()
        maven {
            name = "GoogleMavenCentralMirror"
            url = uri("https://maven-central.storage-download.googleapis.com/maven2/")
        }
        mavenCentral()
        gradlePluginPortal()
    }
    plugins {
        id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention")
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.PREFER_PROJECT)
    repositories {
        google()
        maven {
            name = "GoogleMavenCentralMirror"
            url = uri("https://maven-central.storage-download.googleapis.com/maven2/")
        }
        mavenCentral()
    }
}

rootProject.name = "SOSMeshAndroid"

include(":app")
include(":core:model")
include(":core:data")
include(":core:permissions")
include(":core:ble")
include(":core:protocol")
include(":core:platform")
include(":core:wear-companion")
include(":feature-sos")
include(":feature-status")
include(":feature-relay")
include(":mesh-v2")
include(":wear")

include(":contracts-kotlin")
project(":contracts-kotlin").projectDir = file("../../packages/contracts-kotlin")
