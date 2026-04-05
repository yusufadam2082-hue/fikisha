package com.fikisha.customer.data.repository

import com.fikisha.customer.data.model.CartItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

object CartStore {
    private val _items = MutableStateFlow<List<CartItem>>(emptyList())
    val items: StateFlow<List<CartItem>> = _items.asStateFlow()

    fun addItem(item: CartItem) {
        val current = _items.value.toMutableList()
        val existing = current.find { it.id == item.id }

        if (existing != null) {
            val index = current.indexOf(existing)
            current[index] = existing.copy(quantity = existing.quantity + item.quantity)
        } else {
            current.add(item)
        }

        _items.value = current
    }

    fun updateQuantity(itemId: String, newQuantity: Int) {
        val current = _items.value.toMutableList()
        val index = current.indexOfFirst { it.id == itemId }
        if (index == -1) return

        if (newQuantity <= 0) {
            current.removeAt(index)
        } else {
            current[index] = current[index].copy(quantity = newQuantity)
        }

        _items.value = current
    }

    fun removeOne(itemId: String) {
        val existing = _items.value.find { it.id == itemId } ?: return
        updateQuantity(itemId, existing.quantity - 1)
    }

    fun clear() {
        _items.value = emptyList()
    }
}
