# JetBrains Plugin Build Error - Java Version Issue

## Problem

You're getting this error when trying to build:
```
FAILURE: Build failed with an exception.
* What went wrong:
25.0.1
```

This happens because:
- You have Java 25 installed
- The Kotlin compiler and IntelliJ Gradle plugin don't support Java 25 yet
- They require Java 17 or Java 21

## Solution: Install JDK 17

### Option 1: Using Homebrew (Recommended for Mac)

```bash
# Install Java 17
brew install --cask temurin17

# Verify installation
/usr/libexec/java_home -V

# You should now see both Java 25 and Java 17 listed
```

### Option 2: Manual Download

1. Download JDK 17 from: https://adoptium.net/temurin/releases/?version=17
2. Choose your OS and architecture
3. Install the downloaded package
4. Verify with `/usr/libexec/java_home -V`

### After Installing JDK 17

The project is already configured to use Java 17 via Gradle's Java toolchain feature. Just run:

```bash
cd packages/jetbrains
./gradlew buildPlugin
```

Gradle will automatically use JDK 17 for compilation even though your JAVA_HOME points to Java 25.

## Alternative: Set JAVA_HOME temporarily

If you want to use Java 17 for everything:

```bash
# Find Java 17 path
/usr/libexec/java_home -v 17

# Set JAVA_HOME for this session
export JAVA_HOME=$(/usr/libexec/java_home -v 17)

# Then build
./gradlew buildPlugin
```

## Quick Install & Build

```bash
# 1. Install JDK 17
brew install --cask temurin17

# 2. Build the plugin
cd /Users/burtonsmith/Documents/Projects/wc-toolkit/wc-language-server2/packages/jetbrains
./gradlew buildPlugin

# 3. Run in sandbox (after build succeeds)
./gradlew runIde
```

## Why Not Java 25?

- Kotlin 2.0.21 doesn't fully support Java 25 yet
- IntelliJ Gradle Plugin 1.17.4 requires Java 17 or 21
- Java 17 is the current LTS (Long Term Support) version

## What Gets Installed

When you run `brew install --cask temurin17`, it installs:
- Eclipse Temurin JDK 17 (OpenJDK)
- Location: `/Library/Java/JavaVirtualMachines/temurin-17.jdk/`
- It won't affect your existing Java 25 installation
- Both versions can coexist

## Still Having Issues?

After installing JDK 17, if you still get errors:

```bash
# Clear Gradle cache
cd packages/jetbrains
./gradlew clean --no-daemon

# Remove Gradle daemon completely
rm -rf ~/.gradle/daemon

# Try build again
./gradlew buildPlugin
```

## Summary

**Quickest solution:**
```bash
brew install --cask temurin17
cd packages/jetbrains
./gradlew buildPlugin
```

That's it! The toolchain configuration in `build.gradle.kts` will handle the rest.
