package com.fikisha.customer.data.session

import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.fikisha.customer.data.model.User
import com.google.gson.Gson

object SessionStore {
    val userKey = stringPreferencesKey("user")
    val tokenKey = stringPreferencesKey("token")
    val rememberMeKey = booleanPreferencesKey("remember_me")

    private val gson = Gson()

    fun serializeUser(user: User): String = gson.toJson(user)

    fun deserializeUser(raw: String?): User? {
        if (raw.isNullOrBlank()) {
            return null
        }

        return try {
            gson.fromJson(raw, User::class.java)
        } catch (_: Exception) {
            val parts = raw.split("|")
            if (parts.size >= 4) {
                User(
                    id = parts.getOrElse(0) { "" },
                    name = parts.getOrElse(1) { "" },
                    username = parts.getOrElse(2) { "" },
                    role = parts.getOrElse(3) { "CUSTOMER" },
                    email = null,
                    phone = null,
                    country = null,
                    referralCode = null,
                    dateOfBirth = null,
                    gender = null,
                    address = null,
                    storeId = null
                )
            } else {
                null
            }
        }
    }
}