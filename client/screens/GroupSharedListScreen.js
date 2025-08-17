import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, SafeAreaView, Image, StyleSheet, Alert, Animated, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import api from '../services/api';
import productsData from '../assets/products.json';
import { Swipeable } from 'react-native-gesture-handler';
import { registerListUpdates, joinRoom } from '../services/socketEvents';
import { formatPrice } from '../utils/priceFormatter';

const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
const DELETE_MSG_DURATION = 3000;
const ITEMS_PER_PAGE = 20; // Load 20 items at a time

const useProductJson = () => {
  const loadProducts = async () => productsData;
  return { loadProducts, loading: false, error: null };
};

export default function GroupSharedListScreen({ route, navigation }) {
  const { groupId, currentUserId, groupCreatorId, currentUserName } = route.params || {};
  const isFocused = useIsFocused();
  
  // NEW: Better state management with pagination
  const [summary, setSummary] = useState({ currentList: [], lastBought: [], tripCount: 0, currentTripNumber: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('current');
  const [deletedMessages, setDeletedMessages] = useState([]);
  const [showQuickNav, setShowQuickNav] = useState(false);
  
  // RESTORED: Missing state variables that existing code depends on
  const [showTripHistory, setShowTripHistory] = useState(false);
  const [tripHistory, setTripHistory] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const { loadProducts: loadProductJson } = useProductJson();
  
  // NEW: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [displayedItems, setDisplayedItems] = useState([]);
  
  // NEW: Socket connection state
  const [socketConnected, setSocketConnected] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  
  // NEW: Cache for better performance
  const cacheRef = useRef(new Map());
  const lastFetchTimeRef = useRef(0);
  const CACHE_DURATION = 30000; // 30 seconds cache

  // Set up smart navigation header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Group Shared List',
      headerTitleAlign: 'center',
      headerTitleStyle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2E7D32',
      },
      // NEW: Add smart navigation buttons
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 10 }}>
          <TouchableOpacity 
            style={{ marginRight: 15 }}
            onPress={() => navigation.navigate('SmartSuggestions', { groupId })}
          >
            <Ionicons name="bulb" size={24} color="#45B7D1" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('GroupDetail', { groupId })}
          >
            <Ionicons name="settings" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, groupId]);

  // NEW: Show quick navigation after trip completion
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Check if we just completed a trip (you can add a flag in route params)
      if (route.params?.tripCompleted) {
        setShowQuickNav(true);
        // Auto-hide after 5 seconds
        setTimeout(() => setShowQuickNav(false), 5000);
      }
    });

    return unsubscribe;
  }, [navigation, route.params?.tripCompleted]);

  useEffect(() => {
    if (!groupId) return;
    
    joinRoom(groupId);
    
    fetchSummary();
    
    const unsubscribe = registerListUpdates((data) => {
      fetchSummary(); // Silent refresh on list updates
    });
    
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [groupId, isFocused]);

  // NEW: Handle tab changes with pagination
  useEffect(() => {
    if (summary.currentList || summary.lastBought) {
      updateDisplayedItems(summary, activeTab, 1);
    }
  }, [activeTab, summary, updateDisplayedItems]);

  // NEW: Auto-refresh every 30 seconds to keep data fresh
  useEffect(() => {
    if (!isFocused || !groupId) return;
    
    const interval = setInterval(() => {
      fetchSummary(); // Silent refresh - no console log
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, [isFocused, groupId, fetchSummary]);



  // NEW: Optimized data fetching with caching and pagination
  const fetchSummary = useCallback(async (forceRefresh = false) => {
    try {
      const now = Date.now();
      const cacheKey = `summary_${groupId}`;
      const cached = cacheRef.current.get(cacheKey);
      
      // Use cache if available and not expired
      if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
        setSummary(cached.data);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      
      const response = await api.get(`/groups/${groupId}/list/summary`);
      const data = response.data;
      
      // Cache the result
      cacheRef.current.set(cacheKey, {
        data,
        timestamp: now
      });
      
      setSummary(data);
      setLastUpdateTime(now);
      setSocketConnected(true);
      
      // Update displayed items for current tab
      updateDisplayedItems(data, activeTab, 1);
      
    } catch (err) {
      console.error('❌ Error fetching group list summary:', err);
      setSocketConnected(false);
      
            // Try to use cached data if available
      const cacheKey = `summary_${groupId}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setSummary(cached.data);
      } else {
        Alert.alert('Connection Error', 'Failed to fetch group list. Please check your connection.');
        setSummary({ currentList: [], lastBought: [], tripCount: 0, currentTripNumber: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, activeTab]);

  // NEW: Update displayed items based on current tab and page
  const updateDisplayedItems = useCallback((data, tab, page = 1) => {
    // Safety check: ensure data exists
    if (!data || !data.currentList || !data.lastBought) {
      console.log('⚠️ Data not ready yet, skipping updateDisplayedItems');
      return;
    }
    
    const items = tab === 'current' ? data.currentList : data.lastBought;
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newItems = items.slice(startIndex, endIndex);
    
    if (page === 1) {
      setDisplayedItems(newItems);
    } else {
      setDisplayedItems(prev => [...prev, ...newItems]);
    }
    
    setHasMoreItems(endIndex < items.length);
    setCurrentPage(page);
  }, []);

  // NEW: Load more items for pagination
  const loadMoreItems = useCallback(async () => {
    if (loadingMore || !hasMoreItems) return;
    
    try {
      setLoadingMore(true);
      const nextPage = currentPage + 1;
      updateDisplayedItems(summary, activeTab, nextPage);
    } catch (err) {
      console.error('Error loading more items:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreItems, currentPage, summary, activeTab, updateDisplayedItems]);

  // NEW: Refresh data with pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSummary(true); // Force refresh
    setRefreshing(false);
  }, [fetchSummary]);

  const fetchTripHistory = async () => {
    try {
      const response = await api.get(`/groups/${groupId}/trips`);
      setTripHistory(response.data);
    } catch (err) {
      console.error('❌ Error fetching trip history:', err);
      Alert.alert('Error', 'Failed to fetch trip history');
    }
  };

  const fetchTripItems = async (tripId) => {
    try {
      const response = await api.get(`/groups/${groupId}/trips/${tripId}`);
      setSelectedTrip(response.data);
      setShowTripHistory(false);
    } catch (err) {
      console.error('❌ Error fetching trip items:', err);
      Alert.alert('Error', 'Failed to fetch trip items');
    }
  };

  const handleCompare = () => {
    const products = summary.currentList
      .filter(item => item && item.name) // Only filter for valid items with names
      .map(item => ({
        barcode: item.barcode || '', // Allow empty barcodes
        name: item.name,
        quantity: item.quantity || 1,
        image: item.img || item.icon // Add the image field
      }));
    
    console.log(`🛒 Compare: ${products.length} products for group ${groupId}`);
    
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
    // For purchase history (lastBought), show who purchased it
    // For current list, show who added it
    const isPurchaseHistory = activeTab === 'lastBought' || selectedTrip;
    
    let displayName = 'Unknown';
    let displayText = '';
    let displayTime = '';
    
    if (isPurchaseHistory) {
      // Purchase history - show who purchased
      displayName = item.user && (item.user.username || item.user.name) ? (item.user.username || item.user.name) : 'Unknown';
      displayText = `Purchased by ${displayName}`;
      displayTime = item.boughtAt ? new Date(item.boughtAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';
    } else {
      // Current list - show who added
      displayName = item.addedBy && (item.addedBy.username || item.addedBy.name) ? (item.addedBy.username || item.addedBy.name) : 'Unknown';
      displayText = `Added by ${displayName}`;
      displayTime = item.createdAt ? new Date(item.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '';
    }
    
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
            <Text style={styles.rowMeta} numberOfLines={1}>{displayText}{displayTime ? ` at ${displayTime}` : ''}</Text>
          </View>
        </View>
      </Swipeable>
    );
  };

  // NEW: Use displayedItems for pagination, fallback to full list for special cases
  const activeItems = selectedTrip ? (selectedTrip.items || []) : (displayedItems || []);
  const lastStore = selectedTrip ? (selectedTrip.trip?.store || null) : (summary.lastStore || null);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#2E7D32' }}>Group Shared List</Text>
          {/* NEW: Connection status indicator */}
          {!socketConnected && (
            <View style={styles.connectionStatus}>
              <Ionicons name="wifi-outline" size={16} color="#FF6B6B" />
              <Text style={styles.connectionStatusText}>Offline</Text>
            </View>
          )}
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'current' && styles.activeTab]}
            onPress={() => {
              setActiveTab('current');
              setSelectedTrip(null);
              setShowTripHistory(false);
            }}
          >
            <Text style={styles.tabTitle}>CURRENT LIST</Text>
            <Text style={styles.tabCount}>{summary.currentList.length}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabCard, activeTab === 'lastBought' && styles.activeTab]}
            onPress={() => {
              setActiveTab('lastBought');
              setSelectedTrip(null);
              setShowTripHistory(false);
            }}
          >
            <Text style={styles.tabTitle}>LAST BOUGHT</Text>
            <Text style={styles.tabCount}>
              {selectedTrip ? selectedTrip.trip.tripNumber : summary.lastBought?.length || 0}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ color: '#2E7D32', fontWeight: 'bold', marginBottom: 8, marginTop: 8 }}>
          Trips completed: {summary.tripCount}
        </Text>
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
            {activeTab === 'lastBought' && (
              <>
                {!showTripHistory && !selectedTrip && (
                  <TouchableOpacity 
                    style={styles.viewHistoryButton}
                    onPress={() => {
                      fetchTripHistory();
                      setShowTripHistory(true);
                    }}
                  >
                    <Text style={styles.viewHistoryButtonText}>View Trip History</Text>
                  </TouchableOpacity>
                )}
                
                {showTripHistory && (
                  <View style={styles.tripHistoryContainer}>
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => setShowTripHistory(false)}
                    >
                      <Text style={styles.backButtonText}>← Back to Current Trip</Text>
                    </TouchableOpacity>
                    
                    <FlatList
                      data={tripHistory}
                      renderItem={({ item }) => (
                        <TouchableOpacity 
                          style={styles.tripCard}
                          onPress={() => fetchTripItems(item._id)}
                        >
                          <Text style={styles.tripNumber}>Trip {item.tripNumber}</Text>
                          <Text style={styles.tripDate}>
                            {new Date(item.completedAt).toLocaleDateString()}
                          </Text>
                          <Text style={styles.tripStore}>{item.store?.branch || 'Unknown Store'}</Text>
                          <Text style={styles.tripItems}>{item.itemCount} items</Text>
                          {item.totalSpent > 0 && (
                            <Text style={styles.tripTotal}>{formatPrice(item.totalSpent)}</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      keyExtractor={(item) => item._id}
                      numColumns={2}
                      contentContainerStyle={{ paddingBottom: 60 }}
                    />
                  </View>
                )}
                
                {selectedTrip && (
                  <View style={styles.tripHistoryContainer}>
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={() => {
                        setSelectedTrip(null);
                        setShowTripHistory(true);
                      }}
                    >
                      <Text style={styles.backButtonText}>← Back to Trip History</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.tripInfo}>
                      <Text style={styles.tripTitle}>Trip {selectedTrip.trip.tripNumber}</Text>
                      <Text style={styles.tripDate}>
                        {new Date(selectedTrip.trip.completedAt).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    {lastStore && lastStore.branch && (
                      <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                        <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Store: {lastStore.branch}</Text>
                        <Text style={{ color: '#1976D2' }}>Address: {lastStore.address}</Text>
                        {lastStore.totalPrice && <Text style={{ color: '#1976D2' }}>Total Price: {formatPrice(lastStore.totalPrice)}</Text>}
                      </View>
                    )}
                    
                    <FlatList
                      data={activeItems}
                      renderItem={renderItemCard}
                      keyExtractor={(item, idx) => `${item._id || item.id || item.productId || item.product}_${idx}`}
                      numColumns={1}
                      contentContainerStyle={{ paddingBottom: 60 }}
                    />
                  </View>
                )}
                
                {!showTripHistory && !selectedTrip && lastStore && lastStore.branch && (
                  <View style={{ backgroundColor: '#E3F2FD', borderRadius: 10, padding: 12, marginBottom: 10 }}>
                    <Text style={{ color: '#1976D2', fontWeight: 'bold' }}>Store: {lastStore.branch}</Text>
                    <Text style={{ color: '#1976D2' }}>Address: {lastStore.address}</Text>
                    {lastStore.totalPrice && <Text style={{ color: '#1976D2' }}>Total Price: {formatPrice(lastStore.totalPrice)}</Text>}
                  </View>
                )}
                
                {!showTripHistory && !selectedTrip && (
                  <FlatList
                    data={activeItems}
                    renderItem={renderItemCard}
                    keyExtractor={(item, idx) => `${item._id || item.id || item.productId || item.product}_${idx}`}
                    numColumns={1}
                    contentContainerStyle={{ paddingBottom: 60 }}
                  />
                )}
              </>
            )}
            
            {activeTab === 'current' && (
              <FlatList
                data={activeItems}
                renderItem={renderItemCard}
                keyExtractor={(item, idx) => `${item._id || item.id || item.productId || item.product}_${idx}`}
                numColumns={1}
                contentContainerStyle={{ paddingBottom: 60 }}
                // NEW: Pull-to-refresh
                refreshing={refreshing}
                onRefresh={onRefresh}
                // NEW: Pagination
                onEndReached={loadMoreItems}
                onEndReachedThreshold={0.1}
                // NEW: Performance optimizations
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={10}
                // NEW: Loading footer
                ListFooterComponent={() => 
                  loadingMore ? (
                    <View style={styles.loadingFooter}>
                      <ActivityIndicator size="small" color="#2E7D32" />
                      <Text style={styles.loadingFooterText}>Loading more items...</Text>
                    </View>
                  ) : null
                }
              />
            )}
          </>
        )}
        {deletedMessages.map(msg => (
          <Animated.View key={msg.id} style={[styles.deletedMsg, { opacity: msg.fadeAnim, position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 }]}>
            <Text style={styles.deletedMsgText}>{msg.text}</Text>
          </Animated.View>
        ))}
        
        {/* NEW: Quick Navigation Banner */}
        {showQuickNav && (
          <View style={styles.quickNavBanner}>
            <Text style={styles.quickNavTitle}>Trip Completed! 🎉</Text>
            <Text style={styles.quickNavSubtitle}>Where would you like to go next?</Text>
            <View style={styles.quickNavButtons}>
              <TouchableOpacity 
                style={[styles.quickNavButton, { backgroundColor: '#45B7D1' }]}
                onPress={() => {
                  setShowQuickNav(false);
                  navigation.navigate('SmartSuggestions', { groupId });
                }}
              >
                <Ionicons name="bulb" size={20} color="#fff" />
                <Text style={styles.quickNavButtonText}>Smart Suggestions</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.quickNavButton, { backgroundColor: '#2E7D32' }]}
                onPress={() => {
                  setShowQuickNav(false);
                  navigation.navigate('GroupDetail', { groupId });
                }}
              >
                <Ionicons name="settings" size={20} color="#fff" />
                <Text style={styles.quickNavButtonText}>Group Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
      {currentUserId === groupCreatorId && summary.currentList.length > 0 && (
        <TouchableOpacity style={styles.compareButton} onPress={handleCompare}>
          <Text style={styles.compareButtonText}>Compare</Text>
        </TouchableOpacity>
      )}
      
      {/* NEW: Bottom Tab Navigation */}
      <View style={styles.bottomTabContainer}>
        <TouchableOpacity 
          style={[styles.bottomTab, { backgroundColor: '#E8F5E9' }]}
          onPress={() => navigation.navigate('SmartSuggestions', { groupId })}
        >
          <Ionicons name="bulb" size={20} color="#45B7D1" />
          <Text style={[styles.bottomTabText, { color: '#45B7D1' }]}>Smart Suggestions</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.bottomTab, { backgroundColor: '#E8F5E9' }]}
          onPress={() => navigation.navigate('GroupDetail', { groupId })}
        >
          <Ionicons name="settings" size={20} color="#2E7D32" />
          <Text style={[styles.bottomTabText, { color: '#2E7D32' }]}>Group Settings</Text>
        </TouchableOpacity>
      </View>
      
      {/* NEW: Floating Action Button for Quick Navigation */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => {
            Alert.alert(
              'Quick Navigation',
              'Where would you like to go?',
              [
                {
                  text: 'Smart Suggestions',
                  onPress: () => navigation.navigate('SmartSuggestions', { groupId }),
                  style: 'default'
                },
                {
                  text: 'Group Settings',
                  onPress: () => navigation.navigate('GroupDetail', { groupId }),
                  style: 'default'
                },
                {
                  text: 'Cancel',
                  style: 'cancel'
                }
              ]
            );
          }}
        >
          <Ionicons name="navigate" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
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
  viewHistoryButton: {
    backgroundColor: '#1976D2',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  viewHistoryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tripHistoryContainer: {
    flex: 1,
  },
  backButton: {
    padding: 12,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#1976D2',
    fontWeight: 'bold',
    fontSize: 16,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 6,
    flex: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tripNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  tripDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tripStore: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
  tripItems: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tripTotal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  tripInfo: {
    backgroundColor: '#E8F5E9',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  tripTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
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
  // NEW: Quick Navigation Styles
  quickNavBanner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  quickNavTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  quickNavSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  quickNavButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  quickNavButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    marginLeft: 6,
  },
  // NEW: Floating Action Button Styles
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 10,
  },
  fab: {
    backgroundColor: '#2E7D32',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  // NEW: Bottom Tab Navigation Styles
  bottomTabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomTab: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  bottomTabText: {
    fontSize: 12,
    marginTop: 4,
  },
  // NEW: Loading footer styles
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  loadingFooterText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  // NEW: Connection status styles
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionStatusText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginLeft: 4,
    fontWeight: '600',
  },
}); 