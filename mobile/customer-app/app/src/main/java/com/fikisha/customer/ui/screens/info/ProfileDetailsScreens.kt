package com.fikisha.customer.ui.screens.info

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.CreditCard
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Payment
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fikisha.customer.data.model.Address
import com.fikisha.customer.data.model.NotificationPreferences
import com.fikisha.customer.data.model.PaymentMethod
import com.fikisha.customer.ui.viewmodel.ProfileDetailsViewModel
import kotlinx.coroutines.delay
import android.widget.Toast

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditProfileScreen(onBackClick: () -> Unit) {
    val vm: ProfileDetailsViewModel = viewModel()
    val context = LocalContext.current
    val profileName by vm.profileName.collectAsState()
    val profileUsername by vm.profileUsername.collectAsState()
    val profilePhone by vm.profilePhone.collectAsState()
    val profileEmail by vm.profileEmail.collectAsState()
    val profilePassword by vm.profilePassword.collectAsState()
    val profilePasswordConfirm by vm.profilePasswordConfirm.collectAsState()
    val profileAvatarUri by vm.profileAvatarUri.collectAsState()
    val isLoading by vm.isLoading.collectAsState()
    val successMessage by vm.successMessage.collectAsState()
    val errorMessage by vm.errorMessage.collectAsState()
    var passwordVisible by remember { mutableStateOf(false) }
    var passwordConfirmVisible by remember { mutableStateOf(false) }
    val imagePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        vm.updateProfileAvatarUri(uri?.toString())
    }
    
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
                title = { Text("Personal Info", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
                .padding(bottom = 24.dp)
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

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(modifier = Modifier.size(104.dp), contentAlignment = Alignment.BottomEnd) {
                    Surface(
                        modifier = Modifier.size(96.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        onClick = { imagePicker.launch("image/*") }
                    ) {
                        if (!profileAvatarUri.isNullOrBlank()) {
                            AsyncImage(
                                model = profileAvatarUri,
                                contentDescription = "Profile picture",
                                modifier = Modifier.fillMaxSize(),
                                contentScale = ContentScale.Crop
                            )
                        } else {
                            Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                                Icon(
                                    Icons.Default.Person,
                                    contentDescription = null,
                                    modifier = Modifier.size(42.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                    }

                    Surface(
                        modifier = Modifier.size(30.dp),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary,
                        onClick = { imagePicker.launch("image/*") }
                    ) {
                        Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                            Icon(
                                Icons.Default.Add,
                                contentDescription = "Add profile photo",
                                tint = MaterialTheme.colorScheme.onPrimary,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Account Details", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

                    OutlinedTextField(
                        value = profileName,
                        onValueChange = { vm.updateProfileName(it) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Full Name") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = profileUsername,
                        onValueChange = { vm.updateProfileUsername(it) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Username") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = profileEmail,
                        onValueChange = { vm.updateProfileEmail(it) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Email Address") },
                        leadingIcon = { Icon(Icons.Default.Email, contentDescription = null) },
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = profilePhone,
                        onValueChange = { vm.updateProfilePhone(it) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Phone Number") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null) },
                        singleLine = true
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Security", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Text(
                        "Leave password fields empty if you do not want to change it.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    OutlinedTextField(
                        value = profilePassword,
                        onValueChange = { vm.updateProfilePassword(it) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("New Password") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            TextButton(onClick = { passwordVisible = !passwordVisible }) {
                                Text(if (passwordVisible) "Hide" else "Show")
                            }
                        },
                        singleLine = true
                    )

                    OutlinedTextField(
                        value = profilePasswordConfirm,
                        onValueChange = { vm.updateProfilePasswordConfirm(it) },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Confirm New Password") },
                        leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                        visualTransformation = if (passwordConfirmVisible) VisualTransformation.None else PasswordVisualTransformation(),
                        trailingIcon = {
                            TextButton(onClick = { passwordConfirmVisible = !passwordConfirmVisible }) {
                                Text(if (passwordConfirmVisible) "Hide" else "Show")
                            }
                        },
                        singleLine = true
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            Button(
                onClick = { vm.updateProfile(context) },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp),
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
fun SavedAddressesScreen(onBackClick: () -> Unit, onGoToCart: () -> Unit = {}) {
    val vm: ProfileDetailsViewModel = viewModel()
    val context = LocalContext.current
    val haptic = LocalHapticFeedback.current
    val listState = rememberLazyListState()
    val addresses by vm.addresses.collectAsState()
    val editingAddressId by vm.editingAddressId.collectAsState()
    val locationCandidates by vm.locationCandidates.collectAsState()
    val newLabel by vm.newAddressLabel.collectAsState()
    val newStreet by vm.newAddressStreet.collectAsState()
    val newCity by vm.newAddressCity.collectAsState()
    val successMessage by vm.successMessage.collectAsState()
    val errorMessage by vm.errorMessage.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    val filteredAddresses = remember(addresses, searchQuery) {
        val q = searchQuery.trim().lowercase()
        if (q.isBlank()) {
            addresses
        } else {
            addresses.filter { address ->
                address.label.lowercase().contains(q)
                    || address.street.lowercase().contains(q)
                    || address.city.lowercase().contains(q)
                    || (address.fullAddress?.lowercase()?.contains(q) == true)
            }
        }
    }
    val sortedAddresses = remember(filteredAddresses) {
        filteredAddresses.sortedWith(
            compareByDescending<Address> { it.isDefault }
                .thenBy { it.label.lowercase() }
        )
    }
    
    LaunchedEffect(Unit) {
        vm.loadProfileData()
    }

    LaunchedEffect(successMessage, errorMessage) {
        if (successMessage != null || errorMessage != null) {
            delay(2200)
            vm.clearMessages()
        }
    }

    LaunchedEffect(sortedAddresses, successMessage, errorMessage, searchQuery) {
        if (searchQuery.isNotBlank() || sortedAddresses.isEmpty()) return@LaunchedEffect
        val defaultIndex = sortedAddresses.indexOfFirst { it.isDefault }
        if (defaultIndex < 0) return@LaunchedEffect

        val topOffset =
            (if (successMessage != null) 1 else 0) +
            (if (errorMessage != null) 1 else 0) +
            1 + // search field
            1 + // quick add card
            1 // "Your Addresses" title

        listState.animateScrollToItem(topOffset + defaultIndex)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Saved Addresses", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
            state = listState,
            contentPadding = PaddingValues(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
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
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)
                    ) {
                        Text(
                            errorMessage ?: "",
                            modifier = Modifier.padding(12.dp),
                            color = MaterialTheme.colorScheme.onErrorContainer
                        )
                    }
                }
            }

            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp),
                    singleLine = true,
                    label = { Text("Search saved addresses") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) }
                )
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Quick Add", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)

                        Text(
                            "Import from your active or previously pinned map locations.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )

                        if (locationCandidates.isEmpty()) {
                            Text(
                                "No location candidates yet. Open Location Selector to pin a place first.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        } else {
                            locationCandidates.take(3).forEach { location ->
                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.35f),
                                    shape = RoundedCornerShape(12.dp),
                                    onClick = { vm.addFromLocationCandidate(location) }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(location.label, fontWeight = FontWeight.SemiBold)
                                            Text(
                                                location.address,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = 2
                                            )
                                        }
                                        Icon(Icons.Default.MyLocation, contentDescription = null)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (sortedAddresses.isNotEmpty()) {
                item {
                    Text(
                        "Your Addresses",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                
                items(sortedAddresses) { address ->
                    AddressCard(
                        address = address,
                        onEdit = { vm.editAddress(address) },
                        onDelete = { vm.removeAddress(address) },
                        onSetDefault = { vm.setDefaultAddress(address) },
                        onUseForOrder = {
                            vm.useAddressForOrders(address)
                            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                            Toast.makeText(context, "Address selected. Opening cart...", Toast.LENGTH_SHORT).show()
                            onGoToCart()
                        }
                    )
                }
            } else if (addresses.isNotEmpty()) {
                item {
                    Text(
                        "No address matches your search.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            item {
                Text(
                    if (editingAddressId != null) "Edit Address" else "Add New Address",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 6.dp, bottom = 8.dp)
                )

                val suggestedLabels = listOf("Home", "Work", "Other")
                Text(
                    "Quick Label",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 6.dp)
                )
                LazyRow(
                    modifier = Modifier.padding(bottom = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(suggestedLabels) { label ->
                        FilterChip(
                            selected = newLabel.equals(label, ignoreCase = true),
                            onClick = { vm.updateNewAddressLabel(label) },
                            label = { Text(label) }
                        )
                    }
                }

                OutlinedTextField(
                    value = newLabel,
                    onValueChange = { vm.updateNewAddressLabel(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    label = { Text("Label (Home, Work, etc.)") },
                    singleLine = true
                )

                OutlinedTextField(
                    value = newStreet,
                    onValueChange = { vm.updateNewAddressStreet(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 8.dp),
                    label = { Text("Street / Area") },
                    singleLine = true
                )

                OutlinedTextField(
                    value = newCity,
                    onValueChange = { vm.updateNewAddressCity(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp),
                    label = { Text("City") },
                    singleLine = true
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { vm.addAddress() },
                        modifier = Modifier
                            .weight(1f)
                            .height(48.dp),
                        enabled = newLabel.isNotBlank() && newStreet.isNotBlank() && newCity.isNotBlank()
                    ) {
                        Text(if (editingAddressId != null) "Update Address" else "Add Address")
                    }

                    if (editingAddressId != null) {
                        TextButton(
                            onClick = { vm.cancelEditAddress() },
                            modifier = Modifier.align(Alignment.CenterVertically)
                        ) {
                            Text("Cancel")
                        }
                    }
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
    val newPhone by vm.newPaymentPhone.collectAsState()
    val successMessage by vm.successMessage.collectAsState()
    val errorMessage by vm.errorMessage.collectAsState()
    val isMpesa = newPaymentType.equals("M-Pesa", ignoreCase = true)
    
    LaunchedEffect(Unit) {
        vm.loadProfileData()
    }

    LaunchedEffect(successMessage, errorMessage) {
        if (successMessage != null || errorMessage != null) {
            delay(2200)
            vm.clearMessages()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Payment", fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
            contentPadding = PaddingValues(bottom = 20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Surface(shape = CircleShape, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.16f)) {
                            Icon(
                                Icons.Default.Payment,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                modifier = Modifier
                                    .padding(8.dp)
                                    .size(18.dp)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "Manage Payment",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                            Text(
                                "Save your cards or M-Pesa number for faster checkout.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onPrimaryContainer
                            )
                        }
                    }
                }
            }

            if (successMessage != null) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 2.dp),
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
                            .padding(bottom = 2.dp),
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
                        "Saved Payment",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                
                items(paymentMethods) { method ->
                    PaymentMethodCard(
                        method = method,
                        onDelete = { vm.removePaymentMethod(method) },
                        onSetDefault = { vm.setDefaultPaymentMethod(method) }
                    )
                }
            } else {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                    ) {
                        Text(
                            "No payment option saved yet. Add one below.",
                            modifier = Modifier.padding(12.dp),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 3.dp)
                ) {
                    Column(modifier = Modifier.padding(14.dp)) {
                        Text(
                            "Add Payment",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )

                        val paymentOptions = listOf("Visa", "Mastercard", "M-Pesa")
                        LazyRow(
                            modifier = Modifier.padding(bottom = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(paymentOptions) { option ->
                                FilterChip(
                                    selected = newPaymentType == option,
                                    onClick = { vm.updateNewPaymentType(option) },
                                    label = { Text(option) }
                                )
                            }
                        }

                        if (isMpesa) {
                            OutlinedTextField(
                                value = newPhone,
                                onValueChange = { vm.updateNewPaymentPhone(it) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 8.dp),
                                singleLine = true,
                                label = { Text("M-Pesa Number") },
                                placeholder = { Text("2547XXXXXXXX") },
                                leadingIcon = { Icon(Icons.Default.Phone, contentDescription = null) }
                            )
                            Text(
                                "Use Kenyan format 2547XXXXXXXX.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(bottom = 12.dp)
                            )
                        } else {
                            OutlinedTextField(
                                value = newCardNumber,
                                onValueChange = { vm.updateNewPaymentCardNumber(it) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 8.dp),
                                singleLine = true,
                                label = { Text("Card Number") },
                                placeholder = { Text("1234 5678 9012 3456") },
                                leadingIcon = { Icon(Icons.Default.CreditCard, contentDescription = null) }
                            )

                            OutlinedTextField(
                                value = newExpiry,
                                onValueChange = { vm.updateNewPaymentExpiry(it) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 8.dp),
                                singleLine = true,
                                label = { Text("Expiry") },
                                placeholder = { Text("MM/YY") }
                            )

                            OutlinedTextField(
                                value = newCardholder,
                                onValueChange = { vm.updateNewPaymentCardholder(it) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 12.dp),
                                singleLine = true,
                                label = { Text("Cardholder Name") },
                                placeholder = { Text("Name on card") }
                            )
                        }

                        Button(
                            onClick = { vm.addPaymentMethod() },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp),
                            enabled = if (isMpesa) {
                                newPhone.startsWith("2547") && newPhone.length == 12
                            } else {
                                newCardNumber.replace(" ", "").length >= 16 &&
                                    newExpiry.length >= 5 &&
                                    newCardholder.isNotBlank()
                            }
                        ) {
                            Text(if (isMpesa) "Save M-Pesa" else "Save Card")
                        }
                    }
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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
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
                    Text("Email: help@mtaaexpress.com", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Phone: +254 712 XXX XXX", style = MaterialTheme.typography.bodySmall)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Response time: Usually within 2 hours", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddressCard(
    address: Address,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onSetDefault: () -> Unit,
    onUseForOrder: () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            when (value) {
                SwipeToDismissBoxValue.EndToStart -> {
                    onDelete()
                    false
                }
                SwipeToDismissBoxValue.StartToEnd -> {
                    if (!address.isDefault) {
                        onSetDefault()
                    }
                    false
                }
                SwipeToDismissBoxValue.Settled -> false
            }
        }
    )

    SwipeToDismissBox(
        state = dismissState,
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 2.dp),
        enableDismissFromStartToEnd = !address.isDefault,
        enableDismissFromEndToStart = true,
        backgroundContent = {
            val isStartToEnd = dismissState.dismissDirection == SwipeToDismissBoxValue.StartToEnd
            val bgColor = if (isStartToEnd) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.errorContainer
            }
            val fgColor = if (isStartToEnd) {
                MaterialTheme.colorScheme.onPrimaryContainer
            } else {
                MaterialTheme.colorScheme.onErrorContainer
            }
            val label = if (isStartToEnd) "Set Default" else "Delete"
            val icon = if (isStartToEnd) Icons.Default.Done else Icons.Default.Delete

            Surface(color = bgColor, shape = RoundedCornerShape(12.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 18.dp),
                    horizontalArrangement = if (isStartToEnd) Arrangement.Start else Arrangement.End,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(icon, contentDescription = null, tint = fgColor)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(label, color = fgColor, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    ) {
        Card(
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
                    Column(modifier = Modifier.weight(1f)) {
                        Text(address.label, fontWeight = FontWeight.Bold)
                        Text(
                            address.fullAddress ?: "${address.street}, ${address.city}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        if (address.isDefault) {
                            Surface(
                                modifier = Modifier.padding(top = 4.dp),
                                shape = RoundedCornerShape(4.dp),
                                color = MaterialTheme.colorScheme.primaryContainer
                            ) {
                                Text("Default", modifier = Modifier.padding(4.dp, 2.dp), style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }

                    Row {
                        IconButton(onClick = onEdit) { Icon(Icons.Default.Edit, contentDescription = "Edit") }
                        IconButton(onClick = onDelete) { Icon(Icons.Default.Delete, contentDescription = "Delete") }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (!address.isDefault) {
                        TextButton(onClick = onSetDefault) {
                            Text("Set as Default", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    TextButton(
                        onClick = onUseForOrder,
                        enabled = address.latitude != null && address.longitude != null
                    ) {
                        Text("Use & Open Cart", style = MaterialTheme.typography.labelSmall)
                    }
                }

                if (address.latitude == null || address.longitude == null) {
                    Text(
                        "Add a map-pinned location to enable one-tap checkout use.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun PaymentMethodCard(method: PaymentMethod, onDelete: () -> Unit, onSetDefault: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp),
        shape = RoundedCornerShape(14.dp),
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
                Column {
                    Text(
                        if (method.type.equals("M-Pesa", ignoreCase = true)) {
                            "M-Pesa ${method.phoneNumber ?: "**** ${method.last4}"}"
                        } else {
                            "${method.type} •••• ${method.last4}"
                        },
                        fontWeight = FontWeight.Bold
                    )
                    Text(method.cardholderName, style = MaterialTheme.typography.bodySmall)
                    if (!method.type.equals("M-Pesa", ignoreCase = true) && method.expiry.isNotBlank()) {
                        Text("Expires ${method.expiry}", style = MaterialTheme.typography.bodySmall)
                    }
                    if (method.isDefault) {
                        Surface(
                            modifier = Modifier.padding(top = 4.dp),
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.primaryContainer
                        ) {
                            Text("Default", modifier = Modifier.padding(4.dp, 2.dp), style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
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
