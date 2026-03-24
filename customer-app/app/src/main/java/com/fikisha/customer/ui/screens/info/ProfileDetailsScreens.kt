package com.fikisha.customer.ui.screens.info

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fikisha.customer.data.model.Address
import com.fikisha.customer.data.model.NotificationPreferences
import com.fikisha.customer.data.model.PaymentMethod
import com.fikisha.customer.ui.viewmodel.ProfileDetailsViewModel
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(onBackClick: () -> Unit) {
    val vm: ProfileDetailsViewModel = viewModel()
    val context = LocalContext.current
    val profileName by vm.profileName.collectAsState()
    val profilePhone by vm.profilePhone.collectAsState()
    val profileEmail by vm.profileEmail.collectAsState()
    val isLoading by vm.isLoading.collectAsState()
    val successMessage by vm.successMessage.collectAsState()
    val errorMessage by vm.errorMessage.collectAsState()
    
    LaunchedEffect(Unit) {
        vm.loadProfileData()
    }
    
    LaunchedEffect(successMessage, errorMessage) {
        if (successMessage != null || errorMessage != null) {
            delay(2000)
            vm.clearMessages()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Edit Profile", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            if (successMessage != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer
                    )
                ) {
                    Text(
                        successMessage ?: "",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            
            if (errorMessage != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.errorContainer
                    )
                ) {
                    Text(
                        errorMessage ?: "",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            Text("Full Name", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(
                value = profileName,
                onValueChange = { vm.updateProfileName(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                singleLine = true
            )

            Text("Phone Number", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(
                value = profilePhone,
                onValueChange = { vm.updateProfilePhone(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 16.dp),
                singleLine = true
            )

            Text("Email Address", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
            OutlinedTextField(
                value = profileEmail,
                onValueChange = { vm.updateProfileEmail(it) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 24.dp),
                singleLine = true
            )

            Button(
                onClick = { vm.updateProfile(context) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp),
                enabled = !isLoading && profileName.isNotBlank()
            ) {
                Text(if (isLoading) "Saving..." else "Save Changes")
            }
            
            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedAddressesScreen(onBackClick: () -> Unit) {
    val vm: ProfileDetailsViewModel = viewModel()
    val addresses by vm.addresses.collectAsState()
    val newLabel by vm.newAddressLabel.collectAsState()
    val newStreet by vm.newAddressStreet.collectAsState()
    val newCity by vm.newAddressCity.collectAsState()
    val successMessage by vm.successMessage.collectAsState()
    
    LaunchedEffect(Unit) {
        vm.loadProfileData()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Saved Addresses", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            contentPadding = PaddingValues(bottom = 16.dp)
        ) {
            if (successMessage != null) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Text(
                            successMessage ?: "",
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            if (addresses.isNotEmpty()) {
                item {
                    Text(
                        "Your Addresses",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }
                
                items(addresses) { address ->
                    AddressCard(
                        address = address,
                        onDelete = { vm.removeAddress(address) },
                        onSetDefault = { vm.setDefaultAddress(address) }
                    )
                }
            }

            item {
                Text(
                    "Add New Address",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 16.dp, bottom = 8.dp)
                )

                OutlinedTextField(
                    value = newLabel,
                    onValueChange = { vm.updateNewAddressLabel(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    singleLine = true
                )

                OutlinedTextField(
                    value = newStreet,
                    onValueChange = { vm.updateNewAddressStreet(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    singleLine = true
                )

                OutlinedTextField(
                    value = newCity,
                    onValueChange = { vm.updateNewAddressCity(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    singleLine = true
                )

                Button(
                    onClick = { vm.addAddress() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    enabled = newLabel.isNotBlank() && newStreet.isNotBlank() && newCity.isNotBlank()
                ) {
                    Text("Add Address")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentMethodsScreen(onBackClick: () -> Unit) {
    val vm: ProfileDetailsViewModel = viewModel()
    val paymentMethods by vm.paymentMethods.collectAsState()
    val newPaymentType by vm.newPaymentType.collectAsState()
    val newCardNumber by vm.newPaymentCardNumber.collectAsState()
    val newExpiry by vm.newPaymentExpiry.collectAsState()
    val newCardholder by vm.newPaymentCardholder.collectAsState()
    val successMessage by vm.successMessage.collectAsState()
    val errorMessage by vm.errorMessage.collectAsState()
    
    LaunchedEffect(Unit) {
        vm.loadProfileData()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payment Methods", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            contentPadding = PaddingValues(bottom = 16.dp)
        ) {
            if (successMessage != null) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Text(
                            successMessage ?: "",
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }
            
            if (errorMessage != null) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        )
                    ) {
                        Text(
                            errorMessage ?: "",
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            if (paymentMethods.isNotEmpty()) {
                item {
                    Text(
                        "Saved Cards",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(bottom = 8.dp)
                    )
                }
                
                items(paymentMethods) { method ->
                    PaymentMethodCard(
                        method = method,
                        onDelete = { vm.removePaymentMethod(method) },
                        onSetDefault = { vm.setDefaultPaymentMethod(method) }
                    )
                }
            }

            item {
                Text(
                    "Add New Card",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 16.dp, bottom = 8.dp)
                )

                Column(modifier = Modifier.padding(bottom = 12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = newPaymentType == "Visa", onClick = { vm.updateNewPaymentType("Visa") })
                        Text("Visa")
                        RadioButton(selected = newPaymentType == "Mastercard", onClick = { vm.updateNewPaymentType("Mastercard") })
                        Text("Mastercard")
                    }
                }

                OutlinedTextField(
                    value = newCardNumber,
                    onValueChange = { vm.updateNewPaymentCardNumber(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    singleLine = true
                )

                OutlinedTextField(
                    value = newExpiry,
                    onValueChange = { vm.updateNewPaymentExpiry(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    singleLine = true
                )

                OutlinedTextField(
                    value = newCardholder,
                    onValueChange = { vm.updateNewPaymentCardholder(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    singleLine = true
                )

                Button(
                    onClick = { vm.addPaymentMethod() },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    enabled = newCardNumber.replace(" ", "").length >= 16 && 
                             newExpiry.length >= 5 && 
                             newCardholder.isNotBlank()
                ) {
                    Text("Add Card")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationSettingsScreen(onBackClick: () -> Unit) {
    val vm: ProfileDetailsViewModel = viewModel()
    val prefs by vm.notificationPrefs.collectAsState()
    val successMessage by vm.successMessage.collectAsState()
    
    LaunchedEffect(Unit) {
        vm.loadProfileData()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Notifications", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            if (successMessage != null) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    ) {
                        Text(
                            successMessage ?: "",
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            item { NotificationToggle("Order Confirmation", "Notify when order is confirmed", prefs.orderConfirmation, { vm.updateNotificationPreference(prefs.copy(orderConfirmation = it)) }) }
            item { NotificationToggle("Order Preparation", "Notify when being prepared", prefs.orderPreparation, { vm.updateNotificationPreference(prefs.copy(orderPreparation = it)) }) }
            item { NotificationToggle("Order Dispatch", "Notify when dispatched", prefs.orderDispatch, { vm.updateNotificationPreference(prefs.copy(orderDispatch = it)) }) }
            item { NotificationToggle("Delivery Updates", "Notify about delivery and OTP",prefs.deliveryUpdates, { vm.updateNotificationPreference(prefs.copy(deliveryUpdates = it)) }) }
            item { NotificationToggle("Promo Offers", "Receive promotional offers", prefs.promoOffers, { vm.updateNotificationPreference(prefs.copy(promoOffers = it)) }) }
            item { NotificationToggle("Reminders", "Remind about incomplete orders", prefs.reminderNotifications, { vm.updateNotificationPreference(prefs.copy(reminderNotifications = it)) }) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HelpSupportScreen(onBackClick: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Help & Support", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Need help? Our support team is here to assist.", style = MaterialTheme.typography.bodyMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Email: help@fikisha.com", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Phone: +254 712 XXX XXX", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Response time: Usually within 2 hours", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun AddressCard(address: Address, onDelete: () -> Unit, onSetDefault: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column { Text(address.label, fontWeight = FontWeight.Bold); Text("${address.street}, ${address.city}", style = MaterialTheme.typography.bodySmall); if (address.isDefault) { Surface(modifier = Modifier.padding(top = 4.dp), shape = RoundedCornerShape(4.dp), color = MaterialTheme.colorScheme.primaryContainer) { Text("Default", modifier = Modifier.padding(4.dp, 2.dp), style = MaterialTheme.typography.labelSmall) } } }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = "Delete") }
            }
            if (!address.isDefault) TextButton(onClick = onSetDefault) { Text("Set as Default", style = MaterialTheme.typography.labelSmall) }
        }
    }
}

@Composable
private fun PaymentMethodCard(method: PaymentMethod, onDelete: () -> Unit, onSetDefault: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column { Text("${method.type} •••• ${method.last4}", fontWeight = FontWeight.Bold); Text(method.cardholderName, style = MaterialTheme.typography.bodySmall); Text("Expires ${method.expiry}", style = MaterialTheme.typography.bodySmall); if (method.isDefault) { Surface(modifier = Modifier.padding(top = 4.dp), shape = RoundedCornerShape(4.dp), color = MaterialTheme.colorScheme.primaryContainer) { Text("Default", modifier = Modifier.padding(4.dp, 2.dp), style = MaterialTheme.typography.labelSmall) } } }
                IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = "Delete") }
            }
            if (!method.isDefault) TextButton(onClick = onSetDefault) { Text("Set as Default", style = MaterialTheme.typography.labelSmall) }
        }
    }
}

@Composable
private fun NotificationToggle(label: String, description: String, value: Boolean, onToggle: (Boolean) -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) { Text(label, fontWeight = FontWeight.SemiBold); Text(description, style = MaterialTheme.typography.bodySmall) }
            Switch(checked = value, onCheckedChange = onToggle)
        }
    }
}
