pluginManagement {
    repositories {
        google()
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
        mavenCentral()
    }
}

rootProject.name = "SOSMeshAndroid"

include(":app")
include(":core:model")
include(":core:data")
include(":core:permissions")
include(":core:ble")

include(":contracts-kotlin")
project(":contracts-kotlin").projectDir = file("../../packages/contracts-kotlin")
