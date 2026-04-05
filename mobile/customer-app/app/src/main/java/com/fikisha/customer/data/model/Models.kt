package com.fikisha.customer.data.model

import com.google.gson.annotations.SerializedName

data class Store(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("rating") val rating: Float,
    @SerializedName("time") val time: String,
    @SerializedName("deliveryFee") val deliveryFee: Double,
    @SerializedName("category") val category: String,
    @SerializedName("image") val image: String,
    @SerializedName("description") val description: String,
    @SerializedName("address") val address: String?,
    @SerializedName("phone") val phone: String?,
    @SerializedName("isOpen") val isOpen: Boolean,
    @SerializedName("isActive") val isActive: Boolean = true,
    @SerializedName("products") val products: List<Product> = emptyList()
)

data class Product(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String,
    @SerializedName("price") val price: Double,
    @SerializedName("image") val image: String,
    @SerializedName("category") val category: String?,
    @SerializedName("available") val available: Boolean,
    @SerializedName("storeId") val storeId: String? = null
)

data class Promotion(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("subtitle") val subtitle: String,
    @SerializedName("ctaText") val ctaText: String,
    @SerializedName("ctaLink") val ctaLink: String?,
    @SerializedName("bgColor") val bgColor: String,
    @SerializedName("image") val image: String?
)

data class AiRecommendation(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("price") val price: Double,
    @SerializedName("image") val image: String,
    @SerializedName("storeId") val storeId: String,
    @SerializedName("storeName") val storeName: String,
    @SerializedName("reason") val reason: String
)

data class AiRecommendationsResponse(
    @SerializedName("recommendations") val recommendations: List<AiRecommendation> = emptyList()
)

data class CartItem(
    val id: String,
    val name: String,
    val price: Double,
    val quantity: Int,
    val image: String,
    val storeId: String
)

data class Order(
    @SerializedName("id") val id: String,
    @SerializedName("orderNumber") val orderNumber: String?,
    @SerializedName("storeId") val storeId: String,
    @SerializedName("store") val store: Store?,
    @SerializedName("customerId") val customerId: String,
    @SerializedName("status") val status: String,
    @SerializedName("total") val total: Double,
    @SerializedName("deliveryFee") val deliveryFee: Double,
    @SerializedName("deliveryOtp") val deliveryOtp: String? = null,
    @SerializedName("deliveryOtpVerified") val deliveryOtpVerified: Boolean = false,
    @SerializedName("customerInfo") val customerInfo: CustomerInfo? = null,
    @SerializedName("deliveryAddress") val deliveryAddress: DeliveryAddress? = null,
    @SerializedName("items") val items: List<OrderItem>?,
    @SerializedName("createdAt") val createdAt: String?
)

data class CustomerInfo(
    @SerializedName("name") val name: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("paymentMethod") val paymentMethod: String? = null
)

data class DeliveryAddress(
    @SerializedName("label") val label: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("street") val street: String? = null,
    @SerializedName("city") val city: String? = null,
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null,
    @SerializedName("source") val source: String? = null
)

data class OrderItem(
    @SerializedName("id") val id: String?,
    @SerializedName("productId") val productId: String?,
    @SerializedName("product") val product: Product?,
    @SerializedName("quantity") val quantity: Int,
    @SerializedName("price") val price: Double,
    @SerializedName("name") val name: String?
)

data class User(
    @SerializedName("id") val id: String,
    @SerializedName("username") val username: String,
    @SerializedName("name") val name: String,
    @SerializedName("email") val email: String?,
    @SerializedName("phone") val phone: String?,
    @SerializedName("country") val country: String? = null,
    @SerializedName("referralCode") val referralCode: String? = null,
    @SerializedName("dateOfBirth") val dateOfBirth: String? = null,
    @SerializedName("gender") val gender: String? = null,
    @SerializedName("address") val address: String? = null,
    @SerializedName("role") val role: String,
    @SerializedName("storeId") val storeId: String? = null
)

data class LoginRequest(
    val username: String,
    val password: String
)

data class RegisterRequest(
    val fullName: String,
    val email: String,
    val phone: String,
    val username: String,
    val password: String,
    val confirmPassword: String,
    val country: String? = null,
    val referralCode: String? = null,
    val dateOfBirth: String? = null,
    val gender: String? = null,
    val address: String? = null,
    val role: String = "CUSTOMER"
)

data class LoginResponse(
    val token: String,
    val user: User
)

data class CreateOrderRequest(
    val storeId: String,
    val items: List<CartItemRequest>,
    val deliveryAddress: CreateOrderDeliveryAddress? = null,
    val customerInfo: CreateOrderCustomerInfo,
    val notes: String? = null
)

data class CreateOrderCustomerInfo(
    val name: String,
    val phone: String? = null,
    val address: String? = null,
    val paymentMethod: String? = null
)

data class CreateOrderDeliveryAddress(
    val address: String,
    val label: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val source: String? = null
)

data class CartItemRequest(
    val productId: String,
    val quantity: Int
)

data class ApiResponse<T>(
    val success: Boolean? = null,
    val data: T? = null,
    val message: String? = null
)

data class StoreUpdateRequest(
    val name: String? = null,
    val rating: Float? = null,
    val time: String? = null,
    val deliveryFee: Double? = null,
    val category: String? = null,
    val image: String? = null,
    val description: String? = null,
    val address: String? = null,
    val phone: String? = null,
    val isOpen: Boolean? = null,
    val isActive: Boolean? = null
)

data class ProductUpsertRequest(
    val name: String,
    val description: String = "",
    val price: Double,
    val image: String = "",
    val category: String? = null,
    val available: Boolean? = null
)

// ─── AI Chat ───────────────────────────────────────────────────────────────────

data class AiChatMessage(
    val id: String,
    val role: String, // "user" or "assistant"
    val text: String
)

data class AiChatRequest(
    @SerializedName("message") val message: String,
    @SerializedName("context") val context: List<Map<String, String>> = emptyList()
)

data class AiChatResponse(
    @SerializedName("reply") val reply: String? = null,
    @SerializedName("suggestions") val suggestions: List<String> = emptyList()
)

// ─── Payments ──────────────────────────────────────────────────────────────────

data class PaymentIntentRequest(
    @SerializedName("amount") val amount: Double,
    @SerializedName("currency") val currency: String = "KES",
    @SerializedName("provider") val provider: String,
    @SerializedName("phoneNumber") val phoneNumber: String? = null,
    @SerializedName("description") val description: String? = null
)

data class PaymentIntent(
    @SerializedName("id") val id: String,
    @SerializedName("status") val status: String,
    @SerializedName("amount") val amount: Double,
    @SerializedName("currency") val currency: String,
    @SerializedName("provider") val provider: String
)

data class PaymentAction(
    @SerializedName("type") val type: String? = null,
    @SerializedName("checkoutUrl") val checkoutUrl: String? = null
)

data class PaymentIntentResponse(
    @SerializedName("intent") val intent: PaymentIntent,
    @SerializedName("action") val action: PaymentAction? = null
)
