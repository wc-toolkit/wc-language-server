plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.0.21"
    id("org.jetbrains.intellij") version "1.17.4"
}

group = "com.wc-toolkit"

// Read version from package.json
val packageJson = file("package.json").readText()
val versionRegex = """"version"\s*:\s*"([^"]+)"""".toRegex()
val packageVersion = versionRegex.find(packageJson)?.groupValues?.get(1) ?: "0.0.1"
version = packageVersion

repositories {
    mavenCentral()
}

// Configure Gradle IntelliJ Plugin
// Read more: https://plugins.jetbrains.com/docs/intellij/tools-gradle-intellij-plugin.html
intellij {
    version.set("2024.2")
    type.set("IU") // Target IntelliJ IDEA Ultimate (includes JavaScript support)
    plugins.set(listOf(
        "JavaScript"
        // HTML and CSS support are bundled in IntelliJ IDEA
    ))
}

dependencies {
    implementation("org.jetbrains.kotlin:kotlin-stdlib")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
        vendor = JvmVendorSpec.ADOPTIUM
    }
}

tasks {
    // Set the JVM compatibility versions
    withType<JavaCompile> {
        sourceCompatibility = "17"
        targetCompatibility = "17"
    }
    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions.jvmTarget = "17"
    }

    patchPluginXml {
        sinceBuild.set("242")
        untilBuild.set("") // Empty means "all future versions"
    }

    signPlugin {
        certificateChain.set(System.getenv("CERTIFICATE_CHAIN"))
        privateKey.set(System.getenv("PRIVATE_KEY"))
        password.set(System.getenv("PRIVATE_KEY_PASSWORD"))
    }

    publishPlugin {
        token.set(System.getenv("PUBLISH_TOKEN"))
    }

    val repoRoot = projectDir.parentFile!!.parentFile!!
    val pnpmCommand = if (System.getProperty("os.name").lowercase().contains("win")) "pnpm.cmd" else "pnpm"
    val typescriptDir = repoRoot.resolve("node_modules/typescript")

    val buildLanguageServerBundle by registering(Exec::class) {
        workingDir = repoRoot
        commandLine(pnpmCommand, "--filter", "@wc-toolkit/language-server", "run", "build")
    }

    val copyLanguageServerBundle by registering(Sync::class) {
        dependsOn(buildLanguageServerBundle)
        into(layout.buildDirectory.dir("resources/main").get())
        from("../language-server/bin") {
            include("wc-language-server.js")
            into("language-server/bin")
        }
        from("../language-server/dist") {
            include("wc-language-server.bundle.cjs")
            into("language-server/dist")
        }
        from("../language-server") {
            include("package.json")
            into("language-server")
        }
        if (typescriptDir.exists()) {
            from(typescriptDir) {
                into("language-server/node_modules/typescript")
            }
        } else {
            doFirst {
                logger.warn("[jetbrains] TypeScript runtime not found at ${typescriptDir}. Skipping copy.")
            }
        }
    }

    // Copy vscode extension files (for MCP server and utilities)
    register<Copy>("copyVSCodeExtension") {
        from("../vscode/dist")
        into("build/resources/main/vscode")
        include("**/*")
    }

    // Ensure language server is copied before building
    processResources {
        dependsOn(copyLanguageServerBundle, "copyVSCodeExtension")
    }
    
    prepareSandbox {
        dependsOn(copyLanguageServerBundle, "copyVSCodeExtension")
		
        // Copy language server bundle to sandbox
        from("../language-server/bin") {
            include("wc-language-server.js")
            into("wc-language-server-jetbrains/language-server/bin")
        }
        from("../language-server/dist") {
            include("wc-language-server.bundle.cjs")
            into("wc-language-server-jetbrains/language-server/dist")
        }
        from("../language-server") {
            include("package.json")
            into("wc-language-server-jetbrains/language-server")
        }
        if (typescriptDir.exists()) {
            from(typescriptDir) {
                into("wc-language-server-jetbrains/language-server/node_modules/typescript")
            }
        } else {
            doFirst {
                logger.warn("[jetbrains] TypeScript runtime not found at ${typescriptDir}. Skipping sandbox copy.")
            }
        }
        from("../vscode/dist") {
            into("wc-language-server-jetbrains/vscode")
        }
    }

    buildPlugin {
        dependsOn(copyLanguageServerBundle, "copyVSCodeExtension")
    }
    
    runIde {
        // Force Java 17 for the sandbox IDE
        jbrVersion.set("17.0.11-b1207.24")
    }
}
