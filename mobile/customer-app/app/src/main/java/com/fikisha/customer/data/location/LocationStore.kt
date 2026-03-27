package com.fikisha.customer.data.location

import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.fikisha.customer.data.api.NetworkModule
import com.fikisha.customer.data.model.AppLocation
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.first

object LocationStore {
    private val gson = Gson()

    private val activeLocationKey = stringPreferencesKey("active_location")
    private val savedLocationsKey = stringPreferencesKey("saved_locations")

    suspend fun getActiveLocation(): AppLocation? {
        val prefs = NetworkModule.dataStore.data.first()
        val raw = prefs[activeLocationKey] ?: return null
        return runCatching { gson.fromJson(raw, AppLocation::class.java) }.getOrNull()
    }

    suspend fun setActiveLocation(location: AppLocation) {
        NetworkModule.dataStore.edit { prefs ->
            prefs[activeLocationKey] = gson.toJson(location)
        }
    }

    suspend fun getSavedLocations(): List<AppLocation> {
        val prefs = NetworkModule.dataStore.data.first()
        val raw = prefs[savedLocationsKey] ?: return emptyList()
        return runCatching {
            val type = object : TypeToken<List<AppLocation>>() {}.type
            gson.fromJson<List<AppLocation>>(raw, type)
        }.getOrNull().orEmpty()
    }

    suspend fun saveLocation(location: AppLocation) {
        val current = getSavedLocations().toMutableList()
        val existingIndex = current.indexOfFirst { it.id == location.id || it.address.equals(location.address, true) }
        val normalized = location.copy(isSaved = true, updatedAt = System.currentTimeMillis())

        if (existingIndex >= 0) {
            current[existingIndex] = normalized
        } else {
            current.add(0, normalized)
        }

        persistSaved(current)
    }

    suspend fun removeSavedLocation(locationId: String) {
        val current = getSavedLocations().filterNot { it.id == locationId }
        persistSaved(current)
    }

    private suspend fun persistSaved(locations: List<AppLocation>) {
        NetworkModule.dataStore.edit { prefs ->
            prefs[savedLocationsKey] = gson.toJson(locations.take(20))
        }
    }
}
