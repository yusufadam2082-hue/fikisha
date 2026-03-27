package com.fikisha.customer.ui.screens.merchant

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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.fikisha.customer.data.model.ProfileUpdateRequest
import com.fikisha.customer.data.model.Store
import com.fikisha.customer.data.model.StoreUpdateRequest
import com.fikisha.customer.data.model.User
import com.fikisha.customer.data.repository.Repository
import com.fikisha.customer.ui.viewmodel.AuthViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class MerchantProfileViewModel : ViewModel() {
    private val repository = Repository()

    private val _store = MutableStateFlow<Store?>(null)
    val store: StateFlow<Store?> = _store.asStateFlow()

    private val _profile = MutableStateFlow<User?>(null)
    val profile: StateFlow<User?> = _profile.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun load(storeId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getStore(storeId)
                .onSuccess { _store.value = it }
                .onFailure { _message.value = it.message ?: "Failed to load store profile" }
            repository.getProfile()
                .onSuccess { _profile.value = it }
                .onFailure { _message.value = it.message ?: "Failed to load merchant account" }
            _isLoading.value = false
        }
    }

    fun saveStore(storeId: String, request: StoreUpdateRequest) {
        viewModelScope.launch {
            repository.updateStore(storeId, request)
                .onSuccess {
                    _store.value = it
                    _message.value = "Store profile updated."
                }
                .onFailure { _message.value = it.message ?: "Failed to update store profile" }
        }
    }

    fun saveAccount(request: ProfileUpdateRequest, onSuccess: (User) -> Unit) {
        viewModelScope.launch {
            repository.updateProfile(request)
                .onSuccess {
                    _profile.value = it
                    _message.value = "Merchant account updated."
                    onSuccess(it)
                }
                .onFailure { _message.value = it.message ?: "Failed to update merchant account" }
        }
    }

    fun clearMessage() {
        _message.value = null
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MerchantProfileScreen(
    user: User?,
    authViewModel: AuthViewModel,
    onOrdersClick: () -> Unit,
    onProductsClick: () -> Unit,
    onLogout: () -> Unit,
    viewModel: MerchantProfileViewModel = viewModel()
) {
    val storeId = user?.storeId
    val store by viewModel.store.collectAsState()
    val profile by viewModel.profile.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val message by viewModel.message.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    var selectedTab by remember { mutableIntStateOf(0) }

    LaunchedEffect(storeId) {
        if (storeId != null) {
            viewModel.load(storeId)
        }
    }

    LaunchedEffect(message) {
        message?.takeIf { it.isNotBlank() }?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearMessage()
        }
    }

    if (storeId == null) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Merchant account is missing a store assignment.")
        }
        return
    }

    var storeName by remember(store?.id) { mutableStateOf(store?.name.orEmpty()) }
    var storeCategory by remember(store?.id) { mutableStateOf(store?.category.orEmpty()) }
    var storeTime by remember(store?.id) { mutableStateOf(store?.time.orEmpty()) }
    var storeFee by remember(store?.id) { mutableStateOf(store?.deliveryFee?.toString().orEmpty()) }
    var storePhone by remember(store?.id) { mutableStateOf(store?.phone.orEmpty()) }
    var storeAddress by remember(store?.id) { mutableStateOf(store?.address.orEmpty()) }
    var storeImage by remember(store?.id) { mutableStateOf(store?.image.orEmpty()) }
    var storeDescription by remember(store?.id) { mutableStateOf(store?.description.orEmpty()) }

    var accountName by remember(profile?.id ?: user.id) { mutableStateOf(profile?.name ?: user.name) }
    var accountUsername by remember(profile?.id ?: user.id) { mutableStateOf(profile?.username ?: user.username) }
    var accountEmail by remember(profile?.id ?: user.id) { mutableStateOf(profile?.email.orEmpty()) }
    var accountPhone by remember(profile?.id ?: user.id) { mutableStateOf(profile?.phone.orEmpty()) }
    var accountPassword by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Merchant Profile", fontWeight = FontWeight.Bold)
                        Text(
                            text = store?.name ?: user.name,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = { MerchantLogoutAction(onLogout) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.background,
                    titleContentColor = MaterialTheme.colorScheme.onBackground
                )
            )
        },
        bottomBar = {
            MerchantBottomBar(
                currentTab = MerchantTab.Profile,
                onOrdersClick = onOrdersClick,
                onProductsClick = onProductsClick,
                onProfileClick = {}
            )
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { padding ->
        if (isLoading && store == null && profile == null) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(store?.name ?: "Merchant Dashboard", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                        Text(
                            text = "${store?.products?.size ?: 0} products · Rating ${store?.rating ?: 0f}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            item {
                TabRow(selectedTabIndex = selectedTab) {
                    Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("Store") })
                    Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("Account") })
                }
            }

            if (selectedTab == 0) {
                item {
                    Card(shape = RoundedCornerShape(20.dp)) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Store Profile", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            OutlinedTextField(value = storeName, onValueChange = { storeName = it }, label = { Text("Store Name") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = storeCategory, onValueChange = { storeCategory = it }, label = { Text("Category") }, modifier = Modifier.fillMaxWidth())
                            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                OutlinedTextField(value = storeFee, onValueChange = { storeFee = it }, label = { Text("Delivery Fee") }, modifier = Modifier.weight(1f))
                                OutlinedTextField(value = storeTime, onValueChange = { storeTime = it }, label = { Text("Delivery Time") }, modifier = Modifier.weight(1f))
                            }
                            OutlinedTextField(value = storePhone, onValueChange = { storePhone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = storeAddress, onValueChange = { storeAddress = it }, label = { Text("Address") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = storeImage, onValueChange = { storeImage = it }, label = { Text("Banner Image URL") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = storeDescription, onValueChange = { storeDescription = it }, label = { Text("Description") }, modifier = Modifier.fillMaxWidth(), minLines = 3)
                            Button(
                                onClick = {
                                    viewModel.saveStore(
                                        storeId = storeId,
                                        request = StoreUpdateRequest(
                                            name = storeName,
                                            category = storeCategory,
                                            deliveryFee = storeFee.toDoubleOrNull() ?: 0.0,
                                            time = storeTime,
                                            phone = storePhone.ifBlank { null },
                                            address = storeAddress.ifBlank { null },
                                            image = storeImage,
                                            description = storeDescription,
                                            rating = store?.rating,
                                            isOpen = store?.isOpen
                                        )
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = storeName.isNotBlank() && storeCategory.isNotBlank()
                            ) {
                                Text("Save Store Changes")
                            }
                        }
                    }
                }
            } else {
                item {
                    Card(shape = RoundedCornerShape(20.dp)) {
                        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Merchant Account", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            OutlinedTextField(value = accountName, onValueChange = { accountName = it }, label = { Text("Owner Name") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = accountUsername, onValueChange = { accountUsername = it }, label = { Text("Username") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = accountEmail, onValueChange = { accountEmail = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = accountPhone, onValueChange = { accountPhone = it }, label = { Text("Phone") }, modifier = Modifier.fillMaxWidth())
                            OutlinedTextField(value = accountPassword, onValueChange = { accountPassword = it }, label = { Text("New Password") }, modifier = Modifier.fillMaxWidth())
                            Text(
                                text = "Leave password blank to keep the current one.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Button(
                                onClick = {
                                    viewModel.saveAccount(
                                        request = ProfileUpdateRequest(
                                            name = accountName,
                                            username = accountUsername,
                                            email = accountEmail.ifBlank { null },
                                            phone = accountPhone.ifBlank { null },
                                            password = accountPassword.ifBlank { null }
                                        ),
                                        onSuccess = {
                                            authViewModel.updateStoredUser(it)
                                            accountPassword = ""
                                        }
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = accountName.isNotBlank() && accountUsername.isNotBlank()
                            ) {
                                Text("Save Account")
                            }
                        }
                    }
                }
            }
        }
    }
}