package com.fikisha.customer.data.api

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import com.fikisha.customer.BuildConfig
import com.fikisha.customer.FikishaApplication
import com.fikisha.customer.dataStore
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object NetworkModule {
    private val BASE_URL: String
        get() = BuildConfig.API_BASE_URL.ensureTrailingSlash()

    private var authToken: String? = null

    val dataStore: DataStore<Preferences>
        get() = FikishaApplication.instance.dataStore

    fun setAuthToken(token: String?) {
        authToken = token
    }

    fun hasAuthToken(): Boolean {
        return !authToken.isNullOrBlank()
    }

    private val authInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
        authToken?.let {
            request.addHeader("Authorization", "Bearer $it")
        }
        chain.proceed(request.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        // Keep verbose logs in debug only and always redact auth tokens.
        level = if (BuildConfig.DEBUG) {
            HttpLoggingInterceptor.Level.BODY
        } else {
            HttpLoggingInterceptor.Level.NONE
        }
        redactHeader("Authorization")
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    val apiService: ApiService by lazy {
        retrofit.create(ApiService::class.java)
    }
}

private fun String.ensureTrailingSlash(): String {
    return if (endsWith('/')) this else "$this/"
}
