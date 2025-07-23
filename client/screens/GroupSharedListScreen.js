import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, StyleSheet, SafeAreaView, Alert, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import productsData from '../assets/products.json';
import { Swipeable } from 'react-native-gesture-handler';
import { registerListUpdates, joinRoom } from '../services/socketEvents';
import { useIsFocused } from '@react-navigation/native';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
const DELETE_MSG_DURATION = 4000;

const useProductJson = () => {
  const loadProducts = async () => productsData;
  return { loadProducts, loading: false, error: null };
};

export default function GroupSharedListScreen({ route, navigation }) {
  const { groupId, currentUserId, groupCreatorId, currentUserName } = route.params || {};
  const [summary, setSummary] = useState({ currentList: [], lastBought: [], tripCount: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('current'); // 'current' or 'lastBought'
  const isFocused = useIsFocused();
  const { loadProducts: loadProductJson } = useProductJson();
  const [deletedMessages, setDeletedMessages] = useState([]); // [{id, text, fadeAnim}]

  useEffect(() => {
    if (!groupId) return;
    joinRoom(groupId);
    fetchSummary();
    const unsubscribe = registerListUpdates(() => {
      fetchSummary();
    });
    return () => unsubscribe && unsubscribe();
  }, [groupId, isFocused]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/groups/${groupId}/list/summary`);
      setSummary(response.data);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch group list summary');
      setSummary({ currentList: [], lastBought: [], tripCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = () => {
    const products = summary.currentList
      .filter(item => item.barcode && /^[0-9A-Za-z]+$/.test(item.barcode))
      .map(item => ({
        barcode: item.barcode,
        name: item.name,
        quantity: item.quantity || 1
      }));
    console.log('Compare pressed, products:', products);
    navigation.navigate('WhereToBuy', {
      products,
      tripType: 'group',
      groupId,
    });
  };

  const removeItem = async (item) => {
    if (deletedMessages.some(m => m.id === (item._id || item.id || item.productId))) return;
    try {
      const res = await api.delete(`/groups/${groupId}/list/items/${item._id || item.id || item.productId}`);
      // Show deleted message
      const deletedBy = currentUserName || 'You';
      const deletedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const text = `${item.name} was deleted by ${deletedBy} at ${deletedAt}`;
      const fadeAnim = new Animated.Value(1);
      setDeletedMessages(msgs => [...msgs, { id: item._id || item.id || item.productId, text, fadeAnim }]);
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start(() => {
          setDeletedMessages(msgs => msgs.filter(m => m.id !== (item._id || item.id || item.productId)));
        });
      }, DELETE_MSG_DURATION);
      fetchSummary(); // Refresh list after delete
    } catch (err) {
      Alert.alert('Error', 'Failed to remove item');
    }
  };

  const renderRightActions = (item) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => removeItem(item)}>
      <Ionicons name="trash" size={28} color="#fff" />
    </TouchableOpacity>
  );

  const renderItemCard = ({ item }) => {
    const addedByName = item.addedBy && (item.addedBy.username || item.addedBy.name) ? (item.addedBy.username || item.addedBy.name) : 'Unknown';
    const addedAt = item.createdAt ? new Date(item.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';
    const imageSrc = item.img || item.icon;
    return (
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <View style={styles.rowCard}>
          <Image
            source={imageSrc && typeof imageSrc === 'string' && (imageSrc.startsWith('http') || imageSrc.startsWith('data:image/'))
              ? { uri: imageSrc }
              : { uri: PLACEHOLDER_IMAGE }}
            style={styles.rowImage}
            resizeMode="cover"
          />
          <View style={styles.rowContent}>
            <Text style={styles.rowProductName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowMeta} numberOfLines={1}>Added by {addedByName}{addedAt ? ` at ${addedAt}` : ''}</Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  const activeItems = activeTab === 'current' ? summary.currentList : summary.lastBought;
  const lastStore = summary.lastStore;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2E7D32', marginBottom: 16 }}>Group Shared List</Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'current' && styles.activeTab]}
            onPress={() => setActiveTab('current')}
          >
            <Text style={styles.tabTitle}>CURRENT LIST</Text>
            <Text style={styles.tabCount}>{summary.currentList.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'lastBought' && styles.activeTab]}
            onPress={() => setActiveTab('lastBought')}
          >
            <Text style={styles.tabTitle}>LAST BOUGHT</Text>
            <Text style={styles.tabCount}>{summary.lastBought.length}</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#2E7D32', fontWeight: 'bold', marginBottom: 8, marginTop: 8 }}>Trips completed: {summary.tripCount}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, paddingTop: 8 }}>
        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={{ marginTop: 16, color: '#888' }}>Loading...</Text>
          </View>
        ) : activeItems.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Ionicons name="cart-outline" size={80} color="#2E7D32" style={{ marginBottom: 20 }} />
            <Text style={{ fontSize: 18, color: '#888', marginBottom: 20 }}>
              {activeTab === 'current' ? 'No items in current list' : 'No last trip yet'}
            </Text>
          </View>
        ) : (
          <>
            {activeTab === 'lastBought' && lastStore && (
              <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Store: {lastStore.branch}</Text>
                <Text style={{ color: '#1976D2' }}>Address: {lastStore.address}</Text>
                {lastStore.totalPrice && <Text style={{ color: '#1976D2' }}>Total Price: ₪{lastStore.totalPrice}</Text>}
              </View>
            )}
            <FlatList
              data={activeItems}
              renderItem={renderItemCard}
              keyExtractor={item => item._id || item.id || item.productId || item.product}
              numColumns={1}
              contentContainerStyle={{ paddingBottom: 60 }}
            />
          </>
        )}
        {deletedMessages.map(msg => (
          <Animated.View key={msg.id} style={[styles.deletedMsg, { opacity: msg.fadeAnim, position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 }]}>
            <Text style={styles.deletedMsgText}>{msg.text}</Text>
          </Animated.View>
        ))}
      </View>
      {currentUserId === groupCreatorId && summary.currentList.length > 0 && (
        <TouchableOpacity style={styles.compareButton} onPress={handleCompare}>
          <Text style={styles.compareButtonText}>Compare</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
    margin: 6,
    padding: 12,
    flex: 1,
    minWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  itemQty: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
    marginTop: 4,
  },
  compareButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    margin: 20,
    marginBottom: 32,
  },
  compareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginVertical: 6,
    padding: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  rowImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
  },
  rowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  rowProductName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 13,
    color: '#888',
  },
  deleteAction: {
    backgroundColor: '#FF5252',
    width: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14,
  },
  deletedMsg: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  deletedMsgText: {
    color: '#D32F2F',
    fontSize: 14,
    textAlign: 'center',
  },
}); 