package com.hertzlabs.binauralbeats

import android.app.Application
import android.preference.PreferenceManager
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.hertzlabs.binauralbeats.audio.HertzAudioPackage

class MainApplication : Application(), ReactApplication {

    override val reactHost: ReactHost by lazy {
        getDefaultReactHost(
            context = applicationContext,
            packageList =
                PackageList(this).packages.apply {
                    add(HertzAudioPackage())
                },
        )
    }

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            // Some emulator images cannot reach the host at 10.0.2.2; adb reverse + localhost works.
            PreferenceManager.getDefaultSharedPreferences(this)
                .edit()
                .putString("debug_http_host", "localhost:8081")
                .apply()
        }
        loadReactNative(this)
    }
}
