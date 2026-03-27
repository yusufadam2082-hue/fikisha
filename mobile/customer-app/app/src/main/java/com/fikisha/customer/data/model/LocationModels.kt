package com.fikisha.customer.data.model

import com.google.gson.annotations.SerializedName

data class AppLocation(
    @SerializedName("id") val id: String,
    @SerializedName("label") val label: String,
    @SerializedName("address") val address: String,
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("source") val source: String = "MANUAL",
    @SerializedName("isSaved") val isSaved: Boolean = false,
    @SerializedName("isDefault") val isDefault: Boolean = false,
    @SerializedName("updatedAt") val updatedAt: Long = System.currentTimeMillis()
)

data class DeliveryQuote(
    @SerializedName("serviceable") val serviceable: Boolean,
    @SerializedName("reason") val reason: String? = null,
    @SerializedName("storeId") val storeId: String,
    @SerializedName("zoneId") val zoneId: String? = null,
    @SerializedName("zoneName") val zoneName: String? = null,
    @SerializedName("deliveryFee") val deliveryFee: Double,
    @SerializedName("etaMinutes") val etaMinutes: Int,
    @SerializedName("etaMinMinutes") val etaMinMinutes: Int,
    @SerializedName("etaMaxMinutes") val etaMaxMinutes: Int,
    @SerializedName("distanceKm") val distanceKm: Double? = null,
    @SerializedName("withinRadius") val withinRadius: Boolean? = null,
    @SerializedName("withinPolygon") val withinPolygon: Boolean? = null,
    @SerializedName("minOrderValue") val minOrderValue: Double? = null,
    @SerializedName("orderValueValid") val orderValueValid: Boolean = true
)

data class AddressSearchResult(
    val label: String,
    val address: String,
    val latitude: Double,
    val longitude: Double
)
