import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Firebase (push bildirimleri): google-services.json yalnızca bu bilgisayarda/derleme ortamında (Git'e girmez).
// Dosya yoksa uygulama yine derlenir; bildirimler kapalı olur.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
}

// Mağaza imzası: android/key.properties varsa onunla imzalanır (dosya ve anahtar Git'e eklenmez).
// Yoksa sürüm derlemesi hata ayıklama anahtarıyla imzalanır (yalnızca test APK'sı için).
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

android {
    namespace = "com.pikampus.pikoc"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // flutter_local_notifications java.time kullanır
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // Tek uygulama: Pi Kampüs (namespace eski paket adında kalır; mağaza kimliği applicationId)
        applicationId = "com.pikampus.app"
        // LiveKit / WebRTC en az Android 7 (API 24)
        minSdk = maxOf(24, flutter.minSdkVersion)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        release {
            // Mağaza imzası android/key.properties ile; yoksa test için hata ayıklama anahtarı
            signingConfig = if (keystorePropertiesFile.exists()) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

flutter {
    source = "../.."
}
