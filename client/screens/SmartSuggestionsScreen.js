import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Dimensions,
  Modal,
  BackHandler,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const { width } = Dimensions.get('window');

const CATEGORY_CARDS = [
  { key: 'all', name: 'ALL', icon: 'grid', color: '#4ECDC4' },
  { key: 'recent', name: 'RECENT', icon: 'time', color: '#45B7D1' },
  { key: 'favorite', name: 'FAVORITE', icon: 'heart', color: '#FFEAA7' },
  { key: 'frequent', name: 'FREQUENT', icon: 'repeat', color: '#FF6B6B' },
];

// Helper to fetch and cache product.json
const useProductJson = () => {
  const cache = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadProducts = async () => {
    if (cache.current) return cache.current;
    setLoading(true);
    try {
      const response = await fetch(require('../assets/product.json'));
      const data = await response.json();
      cache.current = data;
      setLoading(false);
      return data;
    } catch (err) {
      setError(err);
      setLoading(false);
      return [];
    }
  };

  return { loadProducts, loading, error };
};

const SmartSuggestionsScreen = ({ navigation, route }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favorites, setFavorites] = useState(new Set());
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [favoriteItems, setFavoriteItems] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [addedItemsCount, setAddedItemsCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [loadedProductIds, setLoadedProductIds] = useState(new Set());

  const groupId = route?.params?.groupId || null;

  const { loadProducts: loadProductJson, loading: loadingProducts } = useProductJson();

  useEffect(() => {
    if (selectedCategory === 'all') {
      setSuggestions([]);
      setFilteredSuggestions([]);
      setOffset(0);
      setHasMore(true);
      setLoadedProductIds(new Set());
      setSearchTerm('');
      fetchSmartSuggestions('all', 0, true);
    } else {
      fetchSmartSuggestions(selectedCategory);
    }
  }, [groupId, selectedCategory]); // re-fetch if groupId or tab changes

  // Handle search filtering
  useEffect(() => {
    if (selectedCategory === 'all') {
      if (searchTerm.trim()) {
        const filtered = suggestions.filter(item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredSuggestions(filtered);
      } else {
        setFilteredSuggestions(suggestions);
      }
    }
  }, [searchTerm, suggestions, selectedCategory]);

  // Handle back button press
  useEffect(() => {
    const backAction = () => {
      // If we're viewing a specific category (not 'all'), go back to main view
      if (selectedCategory !== 'all') {
        setSelectedCategory('all');
        setSuggestions([]);
        setOffset(0);
        setHasMore(true);
        fetchSmartSuggestions('all', 0, true);
        return true; // Prevent default back action
      }
      return false; // Allow default back action (go to Group Detail)
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [selectedCategory]);

  const fetchSmartSuggestions = async (category = 'all', customOffset = 0, reset = false) => {
    try {
      setLoading(true);
      // For ALL, fetch paginated products from /api/products like homepage
      if (category === 'all') {
        const response = await api.get(`/products?limit=50&offset=${customOffset}`);
        const newProducts = response.data || [];
        
        // Filter out already loaded products to prevent duplicates
        const uniqueProducts = newProducts.filter(product => 
          !loadedProductIds.has(product._id || product.productId)
        );
        
        if (reset) {
          setSuggestions(uniqueProducts);
          setLoadedProductIds(new Set(uniqueProducts.map(p => p._id || p.productId)));
          setOffset(50);
          setHasMore(uniqueProducts.length === 50);
        } else {
          setSuggestions(prev => [...prev, ...uniqueProducts]);
          setLoadedProductIds(prev => new Set([...prev, ...uniqueProducts.map(p => p._id || p.productId)]));
          setOffset(prev => prev + 50);
          setHasMore(uniqueProducts.length === 50);
        }
        
        setLoading(false);
        return;
      }
      // For smart cards, fetch only product IDs and then fetch details from backend
      let type = category;
      if (["recent", "favorite", "frequent"].includes(type)) {
        const url = `/suggestions/smart?groupId=${groupId}&type=${type}&limit=50`;
        const response = await api.get(url);
        const suggestionsList = response.data.suggestions || [];
        // Fetch product details for each productId
        const productDetails = await Promise.all(
          suggestionsList.map(async (s) => {
            try {
              const prodRes = await api.get(`/products/${s.productId}`);
              return { ...prodRes.data, ...s };
            } catch (err) {
              return { productId: s.productId, name: 'Unknown Product', img: '', ...s };
            }
          })
        );
        setSuggestions(productDetails);
        if (type === 'favorite') {
          const favoriteIds = new Set(productDetails.map(f => f.productId));
          setFavorites(favoriteIds);
        } else {
          await loadFavoritesStatus(productDetails);
        }
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error('Error fetching smart suggestions:', error);
      showToast('Failed to load smart suggestions');
    } finally {
      setLoading(false);
    }
  };

  // Load favorites status for all suggestions
  const loadFavoritesStatus = async (suggestions) => {
    try {
      const favoriteIds = new Set();
      for (const item of suggestions) {
        if (item.productId) {
          const response = await api.get(`/suggestions/favorites/check/${item.productId}?groupId=${groupId}`);
          if (response.data.isFavorited) {
            favoriteIds.add(item.productId);
          }
        }
      }
      setFavorites(favoriteIds);
    } catch (error) {
      console.error('Error loading favorites status:', error);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (productId) => {
    try {
      const isFavorited = favorites.has(productId);
      if (isFavorited) {
        await api.post('/suggestions/favorites/remove', { productId, groupId });
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
        showToast('Removed from favorites');
      } else {
        await api.post('/suggestions/favorites/add', { productId, groupId });
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
        showToast('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      showToast('Failed to update favorite status');
    }
  };

  // Toast notification system
  const [toast, setToast] = useState({ visible: false, message: '' });
  
  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 2000);
  };

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'frequent':
        return 'repeat';
      case 'recent':
        return 'time';
      case 'popular':
        return 'trending-up';
      case 'seasonal':
        return 'leaf';
      case 'favorite':
        return 'heart';
      default:
        return 'bulb';
    }
  };

  const getCategoryColor = (type) => {
    switch (type) {
      case 'frequent':
        return '#FF6B6B';
      case 'recent':
        return '#4ECDC4';
      case 'popular':
        return '#45B7D1';
      case 'seasonal':
        return '#96CEB4';
      case 'favorite':
        return '#FFEAA7';
      default:
        return '#DDA0DD';
    }
  };

  const getCategoryName = (type) => {
    switch (type) {
      case 'frequent':
        return 'Frequently Added';
      case 'recent':
        return 'Recently Added';
      case 'popular':
        return 'Popular';
      case 'seasonal':
        return 'Seasonal';
      case 'favorite':
        return 'Your Favorites';
      default:
        return 'Smart Pick';
    }
  };

  const renderSuggestion = ({ item, index }) => (
    <TouchableOpacity 
      style={styles.suggestionItem}
      onPress={() => handleAddToCart(item)}
    >
      <View style={styles.productImageContainer}>
        <Image 
          source={{ uri: item.img || 'https://via.placeholder.com/60' }} 
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.type) }]}> 
          <Ionicons name={getCategoryIcon(item.type)} size={12} color="#fff" />
        </View>
        {/* Cart indicator for favorites */}
        {item.type === 'favorite' && item.isInCart && (
          <View style={[styles.intelligentBadge, { backgroundColor: '#4CAF50' }]}> 
            <Ionicons name="checkmark-circle" size={10} color="#fff" />
          </View>
        )}
        {/* Intelligent indicators for frequent products */}
        {item.type === 'frequent' && (
          <>
            {item.isOverdue && (
              <View style={[styles.intelligentBadge, { backgroundColor: '#FF4444' }]}> 
                <Ionicons name="alert-circle" size={10} color="#fff" />
              </View>
            )}
            {item.isDueSoon && !item.isOverdue && (
              <View style={[styles.intelligentBadge, { backgroundColor: '#FFA500' }]}> 
                <Ionicons name="time" size={10} color="#fff" />
              </View>
            )}
            {item.confidence && item.confidence > 0.7 && (
              <View style={[styles.intelligentBadge, { backgroundColor: '#4CAF50' }]}> 
                <Ionicons name="checkmark-circle" size={10} color="#fff" />
              </View>
            )}
          </>
        )}
      </View>
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName}>{item.name}</Text>
        {/* Show interaction details for favorites */}
        {item.type === 'favorite' && (
          <Text style={styles.suggestionReason}>
            {item.isFavorited && '❤️ Favorited '}
            {item.isPurchased && '🛒 Purchased '}
            {item.isAdded && '📝 Added to list '}
            {item.isInCart && `• In Cart: ${item.cartQuantity || 0}`}
            {item.totalInteractions > 1 && ` (${item.totalInteractions} interactions)`}
          </Text>
        )}
        {/* Show smart reason for recent */}
        {item.type === 'recent' && (
          <>
            <Text style={styles.suggestionReason}>
              Bought on {item.tripDate || 'Recent trip'}
            </Text>
            {item.quantity > 1 && (
              <Text style={styles.suggestionReason}>
                Quantity: {item.quantity}
              </Text>
            )}
          </>
        )}
        {/* Show smart reason for frequent */}
        {item.type === 'frequent' && (
          <>
            <Text style={styles.suggestionReason}>
              Bought {item.frequency} time{item.frequency > 1 ? 's' : ''} in last 5 trips
            </Text>
            {item.favoriteCount > 0 && (
              <Text style={[styles.suggestionReason, { color: '#FF6B6B', fontWeight: 'bold' }]}>★ Favorited by group</Text>
            )}
          </>
        )}
      </View>
      {/* ... existing action buttons ... */}
      <View style={styles.actionButtons}>
        {/* Heart Icon for Favorites */}
        <TouchableOpacity 
          style={styles.heartButton}
          onPress={() => toggleFavorite(item.productId || item._id)}
        >
          <Ionicons 
            name={favorites.has(item.productId || item._id) ? "heart" : "heart-outline"} 
            size={20} 
            color={favorites.has(item.productId || item._id) ? "#FF6B6B" : "#999"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.rejectButton}
          onPress={() => handleRejectSuggestion(item)}
        >
          <Ionicons name="close" size={16} color="#FF6B6B" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => handleAddToCart(item)}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
    </View>
    </TouchableOpacity>
  );

  // Add to group shared list only if groupId is present
  const handleAddToCart = async (item) => {
    if (!groupId) {
      showToast('You must be in a group to add to the shared list!');
      return;
    }
    try {
      // console.log('Adding to group shared list:', item);
      await api.post(`/groups/${groupId}/list/items`, {
        name: item.name,
        icon: item.img,
        productId: item.productId || item._id,
        barcode: item.barcode || '',
      });
      showToast(`${item.name} added to shared list!`);
      setAddedItemsCount(prev => prev + 1);
    } catch (error) {
      console.error('Error adding to shared list:', error);
      showToast('Failed to add item to shared list');
    }
  };

  const handleRejectSuggestion = async (item) => {
    try {
      // Track the rejection for ML training
      await api.post('/rejections', {
        productId: item.productId,
        groupId: null // TODO: Get current group ID
      });
      
      // Remove from suggestions list
      setSuggestions(prev => prev.filter(s => s.productId !== item.productId));
      showToast(`${item.name} removed from suggestions`);
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      showToast('Failed to reject suggestion');
    }
  };

  const handleCardPress = (category) => {
    if (category === 'favorite') {
      navigation.navigate('Favorites');
      return;
    }
    if (category === 'seasonal' || category === 'popular') {
      showToast('Feature coming soon!');
      return;
    }
    // Just set the selected category and fetch data - stay within this screen
    setSelectedCategory(category);
    fetchSmartSuggestions(category, 0, true);
  };

  const renderSearchBar = () => {
    if (selectedCategory !== 'all') return null;
    
    return (
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#999"
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchTerm('')}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderCategoryFilter = () => {
    const categories = CATEGORY_CARDS;
    return (
      <View style={styles.tabBarContainer}>
        <FlatList
          horizontal
          data={categories}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tabCard,
                selectedCategory === item.key && styles.tabCardActive
              ]}
              onPress={() => {
                setSelectedCategory(item.key);
                fetchSmartSuggestions(item.key);
              }}
              activeOpacity={0.85}
            >
              <Ionicons name={item.icon} size={22} color={selectedCategory === item.key ? '#fff' : item.color} style={{ marginRight: 8 }} />
              <Text style={[styles.tabCardText, selectedCategory === item.key && { color: '#fff' }]}>{item.name}</Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarList}
        />
      </View>
    );
  };

  // Infinite scroll for ALL card
  const handleEndReached = () => {
    if (selectedCategory === 'all' && hasMore && !loading) {
      const nextOffset = offset + 50;
      setOffset(nextOffset);
      fetchSmartSuggestions('all', nextOffset, false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading smart suggestions...</Text>
      </View>
    );
  }

  // Show empty state if no suggestions
  if (!loading && suggestions.length === 0) {
    if (selectedCategory === 'frequent') {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="construct-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
          <Text style={styles.loadingText}>No frequent items yet!</Text>
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
            Try adding more items to your shopping list to see frequent ones here.
          </Text>
        </View>
      );
    }
    if (selectedCategory === 'recent') {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="time-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
          <Text style={styles.loadingText}>No recent trips yet!</Text>
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
            Complete your first shopping trip to see recent items here.
          </Text>
        </View>
      );
    }
    if (selectedCategory === 'favorite') {
      return (
        <View style={styles.loadingContainer}>
          <Ionicons name="heart-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
          <Text style={styles.loadingText}>No favorites yet!</Text>
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
            Favorite items from the ALL card to see them here.
          </Text>
        </View>
      );
    }
    // Default empty state for ALL
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="bulb-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
        <Text style={styles.loadingText}>No products to show!</Text>
        <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
          Try again later.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Smart Suggestions</Text>
            <Text style={styles.subtitle}>Personalized recommendations just for you</Text>
          </View>
          <TouchableOpacity 
            style={styles.cartIconContainer}
            onPress={() => navigation.navigate('GroupSharedList', { groupId })}
          >
            <Ionicons name="list" size={24} color="#2E7D32" />
            {addedItemsCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{addedItemsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {/* Render the horizontal tabbed category filter */}
      {renderCategoryFilter()}
      {/* Render search bar for ALL category */}
      {renderSearchBar()}
      {/* Product suggestions list below the tabs */}
      <FlatList
        data={selectedCategory === 'all' ? filteredSuggestions : suggestions}
        keyExtractor={(item, index) => `${item._id || item.productId}_${index}`}
        renderItem={renderSuggestion}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        ListEmptyComponent={
          !loading && (
            <View style={styles.loadingContainer}>
              {selectedCategory === 'recent' ? (
                <>
                  <Ionicons name="time-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No recent trips yet!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Complete your first shopping trip to see recent items here.
                  </Text>
                </>
              ) : selectedCategory === 'favorite' ? (
                <>
                  <Ionicons name="heart-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No favorites yet!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Favorite items from the ALL card to see them here.
                  </Text>
                </>
              ) : selectedCategory === 'frequent' ? (
                <>
                  <Ionicons name="construct-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No frequent items yet!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Try adding more items to your shopping list to see frequent ones here.
                  </Text>
                </>
              ) : selectedCategory === 'all' && searchTerm.trim() ? (
                <>
                  <Ionicons name="search-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No products found</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Try a different search term.
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons name="bulb-outline" size={48} color="#bbb" style={{ marginBottom: 12 }} />
                  <Text style={styles.loadingText}>No products to show!</Text>
                  <Text style={{ color: '#888', textAlign: 'center', marginTop: 8 }}>
                    Try again later.
                  </Text>
                </>
              )}
            </View>
          )
        }
        refreshing={loading && suggestions.length === 0}
        onRefresh={() => {
          setLoadedProductIds(new Set());
          fetchSmartSuggestions(selectedCategory, 0, true);
        }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loading && suggestions.length > 0 ? (
          <ActivityIndicator size="small" color="#2E7D32" style={{ padding: 20 }} />
        ) : null}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />
      {toast.visible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  cartIconContainer: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    letterSpacing: 0.5,
  },
  categoryFilterContainer: {
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  categoryCard: {
    width: (width - 60) / 2,
    height: 120,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  categoryCardActive: {
    transform: [{ scale: 1.05 }],
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  categoryCardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  categoryCardText: {
    marginTop: 8,
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  listContainer: {
    padding: 15,
  },
  suggestionItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  productImageContainer: {
    position: 'relative',
    marginRight: 15,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  categoryBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  scoreText: {
    fontSize: 11,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  addButton: {
    backgroundColor: '#2E7D32',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartButton: {
    padding: 5,
  },
  intelligentBadge: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  intelligentInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  intelligentText: {
    fontSize: 10,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 1000,
  },
  toastText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bigCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    marginVertical: 10,
    marginHorizontal: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingLeft: 32,
  },
  cardText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  suggestionInfo: {
    flex: 1,
    marginRight: 10,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  suggestionReason: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  tabBarContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabBarList: {
    paddingHorizontal: 16,
  },
  tabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabCardActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },
  tabCardText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },

});

export default SmartSuggestionsScreen; 