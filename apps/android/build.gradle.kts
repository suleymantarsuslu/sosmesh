plugins {
    id("com.android.application") version "8.2.2" apply false
    id("com.android.library") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
    id("org.jetbrains.kotlin.jvm") version "1.9.22" apply false
    id("com.google.dagger.hilt.android") version "2.50" apply false
    id("org.jlleitschuh.gradle.ktlint") version "12.1.0" apply false
}

subprojects {
    if (project.name != "contracts-kotlin") {
        apply(plugin = "org.jlleitschuh.gradle.ktlint")
        configure<org.jlleitschuh.gradle.ktlint.KtlintExtension> {
            android.set(true)
            ignoreFailures.set(false)
        }
    }
}

tasks.register("detekt") {
    group = "verification"
    description = "Placeholder detekt hook for README; static analysis via Android lint in CI."
    doLast {
        logger.lifecycle("detekt: use ./gradlew lintDebug on app module (ADIM 12).")
    }
}
