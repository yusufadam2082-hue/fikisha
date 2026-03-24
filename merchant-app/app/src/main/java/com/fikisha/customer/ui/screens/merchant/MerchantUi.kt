package com.fikisha.customer.ui.screens.merchant

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import java.text.NumberFormat
import java.util.Locale

enum class MerchantTab {
    Orders,
    Products,
    Profile
}

fun formatKes(value: Double): String {
    return try {
        NumberFormat.getCurrencyInstance(Locale("en", "KE")).format(value)
    } catch (_: Exception) {
        "KSh ${"%.2f".format(value)}"
    }
}

fun normalizeMerchantOrderStatus(status: String): String {
    val key = status.trim().uppercase().replace(Regex("[^A-Z0-9_]"), "")
    return when (key) {
        "READYFORPICKUP" -> "READY_FOR_PICKUP"
        "OUTFORDELIVERY", "INTRANSIT", "ONTHEWAY" -> "OUT_FOR_DELIVERY"
        else -> key
    }
}

@Composable
fun MerchantBottomBar(
    currentTab: MerchantTab,
    onOrdersClick: () -> Unit,
    onProductsClick: () -> Unit,
    onProfileClick: () -> Unit
) {
    val itemColors = NavigationBarItemDefaults.colors(
        selectedIconColor = MaterialTheme.colorScheme.primary,
        selectedTextColor = MaterialTheme.colorScheme.primary,
        indicatorColor = MaterialTheme.colorScheme.primaryContainer,
        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
    )

    NavigationBar(containerColor = MaterialTheme.colorScheme.surface, tonalElevation = 0.dp) {
        NavigationBarItem(
            selected = currentTab == MerchantTab.Orders,
            onClick = onOrdersClick,
            icon = { Icon(Icons.Default.ReceiptLong, contentDescription = "Orders") },
            label = { Text("Orders") },
            colors = itemColors
        )
        NavigationBarItem(
            selected = currentTab == MerchantTab.Products,
            onClick = onProductsClick,
            icon = { Icon(Icons.Default.Inventory2, contentDescription = "Products") },
            label = { Text("Products") },
            colors = itemColors
        )
        NavigationBarItem(
            selected = currentTab == MerchantTab.Profile,
            onClick = onProfileClick,
            icon = { Icon(Icons.Default.Person, contentDescription = "Profile") },
            label = { Text("Profile") },
            colors = itemColors
        )
    }
}

@Composable
fun MerchantLogoutAction(onLogout: () -> Unit) {
    IconButton(onClick = onLogout) {
        Icon(Icons.Default.Logout, contentDescription = "Log out", tint = MaterialTheme.colorScheme.error)
    }
}