import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

// Load signing config from keystore.properties (kept out of git). Release builds
// are signed with it when present; otherwise release falls back to unsigned.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

android {
    namespace = "com.grindhouse.cytube"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.grindhouse.cytube"
        minSdk = 29
        targetSdk = 35
        versionCode = 15
        versionName = "2.4"
    }

    signingConfigs {
        if (keystorePropsFile.exists()) {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // Separate package + label so the dev build installs alongside the
            // release build — no uninstalling to switch between them.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
            resValue("string", "app_name", "Grindhouse Dev")
        }
        release {
            isMinifyEnabled = false
            resValue("string", "app_name", "Grindhouse")
            if (keystorePropsFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
    buildFeatures {
        buildConfig = true
        resValues = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    implementation("androidx.core:core-splashscreen:1.0.1")
    implementation("androidx.webkit:webkit:1.11.0")
}
