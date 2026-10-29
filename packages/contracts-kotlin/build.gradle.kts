plugins {
    kotlin("jvm") version "1.9.22"
    kotlin("plugin.serialization") version "1.9.22"
}

group = "com.sosmesh"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.2")
    testImplementation(kotlin("test"))
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
}

tasks.test {
    useJUnitPlatform()
    testLogging {
        events("passed", "skipped", "failed")
        showStandardStreams = true
    }
}

tasks.register("writeCanonicalJson") {
    group = "verification"
    description = "Write canonical JSON output for cross-language comparison"
    doLast {
        val outputDir = file("build/canonical-json")
        outputDir.mkdirs()
        println("Canonical JSON output will be generated during tests")
    }
}

kotlin {
    jvmToolchain(21)
}
