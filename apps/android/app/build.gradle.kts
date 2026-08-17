import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

/*
 * Where the app talks to.
 *
 * Read from local.properties (not committed) so a debug build points at a
 * laptop and a release build points at the deployed API, without either being
 * hard-coded into a file someone edits by accident before a release.
 */
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
val debugApi: String = localProps.getProperty("API_URL_DEBUG")
    // 10.0.2.2 is the host machine as seen from the Android emulator.
    ?: "http://10.0.2.2:4000"
val releaseApi: String = localProps.getProperty("API_URL_RELEASE")
    ?: "https://society-app-api-production.up.railway.app"

android {
    namespace = "com.prangan.society"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.prangan.society"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_URL", "\"$debugApi\"")
            /* Cleartext is allowed only here, so a debug build can reach an API
               on the laptop over plain HTTP. Release cannot: see the manifest. */
            isMinifyEnabled = false
        }
        release {
            buildConfigField("String", "API_URL", "\"$releaseApi\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
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
    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    debugImplementation(libs.androidx.ui.tooling)

    implementation(libs.retrofit)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.androidx.datastore.preferences)
}
