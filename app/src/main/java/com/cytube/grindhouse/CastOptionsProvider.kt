package com.grindhouse.cytube

import android.content.Context
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider

/**
 * Sender-side (phone/tablet) Cast configuration, discovered by the Cast framework via the
 * OPTIONS_PROVIDER_CLASS_NAME meta-data in AndroidManifest.xml.
 *
 * Prototype: we cast a plain video stream to Google's built-in DEFAULT media receiver — the generic
 * player that ships on every Cast device, including Vizio SmartCast (Chromecast built-in). This needs
 * no registered App ID and no developer-console setup. The TV just plays the movie URL we hand it;
 * chat + overlays stay on the phone, which also keeps the TV in sync (see MainActivity conductor).
 */
class CastOptionsProvider : OptionsProvider {
    override fun getCastOptions(context: Context): CastOptions {
        return CastOptions.Builder()
            .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
            .build()
    }

    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? = null
}
