package com.fikisha.customer.data.model

import com.google.gson.annotations.SerializedName

// Edit Profile data
data class ProfileUpdateRequest(
    val name: String,
    val email: String? = null,
    val phone: String? = null,
    val username: String? = null,
    val password: String? = null
)

// Saved Addresses
data class Address(
    val id: String = "",
    val label: String = "", // "Home", "Work", "Other"
    val street: String = "",
    val city: String = "",
    val postalCode: String? = null,
    val isDefault: Boolean = false
)

// Payment Methods
data class PaymentMethod(
    val id: String = "",
    val type: String = "", // "Visa", "Mastercard", "Amex"
    val last4: String = "",
    val expiry: String = "",
    val cardholderName: String = "",
    val isDefault: Boolean = false
)

// Notification Preferences
data class NotificationPreferences(
    val orderConfirmation: Boolean = true,
    val orderPreparation: Boolean = true,
    val orderDispatch: Boolean = true,
    val deliveryUpdates: Boolean = true,
    val promoOffers: Boolean = false,
    val reminderNotifications: Boolean = true
)
