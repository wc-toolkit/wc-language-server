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

    // Create standalone language server installation with npm
    val installLanguageServerStandalone by registering(Exec::class) {
        val standaloneDir = file("build/language-server-standalone")
        val nodeModulesMarker = file("build/language-server-standalone/node_modules/.package-lock.json")
        
        // Only run if not already installed
        onlyIf { !nodeModulesMarker.exists() }
        
        doFirst {
            standaloneDir.mkdirs()
            copy {
                from("../language-server/package.json")
                into(standaloneDir)
            }
        }
        
        workingDir = standaloneDir
        commandLine("npm", "install", "--omit=dev")
    }

    // Copy language server files with standalone node_modules
    register<Sync>("copyLanguageServer") {
        dependsOn(installLanguageServerStandalone)
        
        // Copy bin and dist from original location
        from("../language-server") {
            include("bin/**")
            include("dist/**")
            include("package.json")
        }
        // Copy node_modules from standalone install
        from("build/language-server-standalone") {
            include("node_modules/**")
        }
        
        into("build/resources/main/language-server")
    }

    // Copy vscode extension files (for MCP server and utilities)
    register<Copy>("copyVSCodeExtension") {
        from("../vscode/dist")
        into("build/resources/main/vscode")
        include("**/*")
    }

    // Ensure language server is copied before building
    processResources {
        dependsOn("copyLanguageServer", "copyVSCodeExtension")
    }
    
    prepareSandbox {
        dependsOn("copyLanguageServer", "copyVSCodeExtension")
        
        // Copy language server to sandbox
        from("../language-server") {
            include("bin/**")
            include("dist/**")
            include("package.json")
            into("wc-language-server-jetbrains/language-server")
        }
        from("build/language-server-standalone") {
            include("node_modules/**")
            into("wc-language-server-jetbrains/language-server")
        }
        from("../vscode/dist") {
            into("wc-language-server-jetbrains/vscode")
        }
    }

    buildPlugin {
        dependsOn("copyLanguageServer", "copyVSCodeExtension")
    }
    
    runIde {
        // Force Java 17 for the sandbox IDE
        jbrVersion.set("17.0.11-b1207.24")
    }
}
