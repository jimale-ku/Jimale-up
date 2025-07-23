// client/screens/MyListScreen.js
import React, { useContext, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PersonalListContext from '../services/PersonalListContext';
import { PersonalListProvider } from '../services/PersonalListContext';

const CARD_MARGIN = 12;

export default function MyListScreen({ navigation }) {
  const { personalList, setPersonalList, lastBought, lastStore } = useContext(PersonalListProvider._context || require('../services/PersonalListContext').default);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'lastBought'
  const items = personalList || [];
  const lastBoughtItems = lastBought || [];
  const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

  // Handler for Compare Prices button
  const handleComparePrices = () => {
    const products = items.map(item => ({
      barcode: item.barcode || '',
      name: item.name,
      quantity: item.quantity || 1
    }));
    navigation.navigate('WhereToBuy', {
      source: 'personal',
      products,
      tripType: 'personal',
    });
  };

  // Increase quantity
  const increaseQty = (item) => {
    setPersonalList(list => list.map(p =>
      (p._id === item._id || p.name === item.name)
        ? { ...p, quantity: (p.quantity || 1) + 1 }
        : p
    ));
  };

  // Decrease quantity (remove if 0)
  const decreaseQty = (item) => {
    setPersonalList(list => {
      return list
        .map(p =>
          (p._id === item._id || p.name === item.name)
            ? { ...p, quantity: (p.quantity || 1) - 1 }
            : p
        )
        .filter(p => (p.quantity || 1) > 0);
    });
  };

  // Remove item
  const removeItem = (item) => {
    setPersonalList(list => list.filter(p => !(p._id === item._id || p.name === item.name)));
  };

  // Render each item in the personal list as a card
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => removeItem(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="trash" size={22} color="#FF6B6B" />
      </TouchableOpacity>
      <Image
        source={{ uri: item.img && (item.img.startsWith('http') || item.img.startsWith('data:image/')) ? item.img : PLACEHOLDER_IMAGE }}
        style={styles.image}
        resizeMode="cover"
      />
      <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
      <View style={styles.qtyRow}>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => decreaseQty(item)}
        >
          <Ionicons name="remove" size={22} color="#2E7D32" />
        </TouchableOpacity>
        <Text style={styles.qtyText}>x{item.quantity || 1}</Text>
        <TouchableOpacity
          style={styles.qtyButton}
          onPress={() => increaseQty(item)}
        >
          <Ionicons name="add" size={22} color="#2E7D32" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Empty state UI
  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 }}>
      <Ionicons name="cart-outline" size={80} color="#2E7D32" style={{ marginBottom: 20 }} />
      <Text style={{ fontSize: 18, color: '#888', marginBottom: 20 }}>Your personal list is empty!</Text>
      <TouchableOpacity
        style={{
          backgroundColor: '#B2F2D7', // light green
          paddingVertical: 16,
          paddingHorizontal: 32,
          borderRadius: 8,
          opacity: 0.6,
        }}
        disabled={true}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Compare Prices</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 16 }}>My List</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'current' && styles.activeTab]}
            onPress={() => setActiveTab('current')}
          >
            <Text style={styles.tabTitle}>CURRENT LIST</Text>
            <Text style={styles.tabCount}>{items.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'lastBought' && styles.activeTab]}
            onPress={() => setActiveTab('lastBought')}
          >
            <Text style={styles.tabTitle}>LAST BOUGHT</Text>
            <Text style={styles.tabCount}>{lastBoughtItems.length}</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
        {activeTab === 'current' ? (
          items.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <FlatList
                key={'grid-3'}
                data={items}
                renderItem={renderItem}
                keyExtractor={item => item._id || item.id || item.name}
                numColumns={3}
                contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: CARD_MARGIN }}
              />
              <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 16 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#2E7D32',
                    paddingVertical: 16,
                    paddingHorizontal: 32,
                    borderRadius: 8,
                  }}
                  onPress={handleComparePrices}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Compare Prices</Text>
                </TouchableOpacity>
              </View>
            </>
          )
        ) : (
          lastBoughtItems.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="cart-outline" size={80} color="#2E7D32" style={{ marginBottom: 20 }} />
              <Text style={{ fontSize: 18, color: '#888', marginBottom: 20 }}>No last trip yet</Text>
            </View>
          ) : (
            <>
              {lastStore && (
                <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                  <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Store: {lastStore.branch || lastStore.storeName}</Text>
                  <Text style={{ color: '#1976D2' }}>Address: {lastStore.address}</Text>
                  {lastStore.totalPrice && <Text style={{ color: '#1976D2' }}>Total Price:  {lastStore.totalPrice}</Text>}
                </View>
              )}
              <FlatList
                key={'last-bought'}
                data={lastBoughtItems}
                renderItem={renderItem}
                keyExtractor={item => item._id || item.id || item.name}
                numColumns={3}
                contentContainerStyle={{ paddingBottom: 60, paddingHorizontal: CARD_MARGIN }}
              />
            </>
          )
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
    margin: CARD_MARGIN / 2,
    padding: 16,
    flex: 1,
    minWidth: 0,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    position: 'relative',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 2,
    backgroundColor: '#F9EAEA',
    borderRadius: 16,
    padding: 4,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#E8F5E9',
    marginHorizontal: 4,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    minWidth: 28,
    textAlign: 'center',
  },
  tabCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeTab: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  tabTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#2E7D32',
    marginBottom: 4,
  },
  tabCount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976D2',
  },
});
