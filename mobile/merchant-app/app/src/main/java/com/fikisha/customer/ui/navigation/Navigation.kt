package com.fikisha.customer.ui.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.fikisha.customer.ui.screens.login.LoginScreen
import com.fikisha.customer.ui.screens.merchant.MerchantOrdersScreen
import com.fikisha.customer.ui.screens.merchant.MerchantProductsScreen
import com.fikisha.customer.ui.screens.merchant.MerchantProfileScreen
import com.fikisha.customer.ui.viewmodel.AuthViewModel

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object MerchantOrders : Screen("merchant/orders")
    object MerchantProducts : Screen("merchant/products")
    object MerchantProfile : Screen("merchant/profile")
}

@Composable
fun FikishaNavigation() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = viewModel()
    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()
    val isCheckingAuth by authViewModel.isCheckingAuth.collectAsState()
    val user by authViewModel.user.collectAsState()

    if (isCheckingAuth) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    LaunchedEffect(isLoggedIn) {
        if (isLoggedIn && navController.currentDestination?.route == Screen.Login.route) {
            navController.navigate(Screen.MerchantOrders.route) {
                popUpTo(Screen.Login.route) { inclusive = true }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = if (isLoggedIn) Screen.MerchantOrders.route else Screen.Login.route
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                defaultPortalMode = AuthViewModel.PortalMode.MERCHANT,
                allowPortalSwitch = false,
                onLoginSuccess = {
                    navController.navigate(Screen.MerchantOrders.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.MerchantOrders.route) {
            MerchantOrdersScreen(
                user = user,
                onProductsClick = { navController.navigate(Screen.MerchantProducts.route) },
                onProfileClick = { navController.navigate(Screen.MerchantProfile.route) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.MerchantProducts.route) {
            MerchantProductsScreen(
                user = user,
                onOrdersClick = {
                    navController.navigate(Screen.MerchantOrders.route) {
                        launchSingleTop = true
                    }
                },
                onProfileClick = { navController.navigate(Screen.MerchantProfile.route) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(Screen.MerchantProfile.route) {
            MerchantProfileScreen(
                user = user,
                authViewModel = authViewModel,
                onOrdersClick = {
                    navController.navigate(Screen.MerchantOrders.route) {
                        launchSingleTop = true
                    }
                },
                onProductsClick = { navController.navigate(Screen.MerchantProducts.route) },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

    }
}
