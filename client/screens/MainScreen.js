import React, { useEffect, useState, useCallback, useContext, createContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  SafeAreaView,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { joinRoom, registerGroupUpdates } from '../services/socketEvents';
import { useFocusEffect } from '@react-navigation/native';
import { apiEventEmitter } from '../services/api';
import jwt_decode from 'jwt-decode';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import PersonalListContext from '../services/PersonalListContext';

const { width, height } = Dimensions.get('window');

export default function MainScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState([]);
  const [locationName, setLocationName] = useState(null);
  const [editLocationVisible, setEditLocationVisible] = useState(false);
  const [manualLocation, setManualLocation] = useState('');
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [userNameLoading, setUserNameLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [userLists, setUserLists] = useState([]);
  const [welcomeType, setWelcomeType] = useState('back'); // 'back' or 'new'
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [favorites, setFavorites] = useState(new Set());
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [compareResults, setCompareResults] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareCity, setCompareCity] = useState('');
  const { personalList, setPersonalList } = useContext(PersonalListContext);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
  });

  useEffect(() => {
    const fetchLocationName = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is required.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (place) {
        const city = place.city || place.region || place.name;
        const country = place.country || '';
        const fullLocation = `${city}, ${country}`;
        setLocationName(fullLocation);
        await AsyncStorage.setItem('locationName', city);
      }
    };
    fetchLocationName();
  }, []);

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
  };

  const fetchGroups = async () => {
    // Group fetching logic for future milestones
  };

  useEffect(() => {
    const checkSession = async () => {
      const token = await AsyncStorage.getItem('token');
      if (!token) navigation.replace('Login');
      else fetchGroups();
    };
    checkSession();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchGroups);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Logout', 'Are you sure you want to logout?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: logout,
              },
            ]);
          }}
          style={styles.logoutButton}
        >
          <Ionicons name="log-out-outline" size={24} color="#2E7D32" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    groups.forEach((group) => joinRoom(group._id));
  }, [groups]);

  useEffect(() => {
    const unsubscribe = registerGroupUpdates(fetchGroups);
    return unsubscribe;
  }, []);

  // Fetch user name for welcome message
  useEffect(() => {
    const getUserName = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          const decoded = jwt_decode(token);
          setUserName(decoded.username || 'User');
        } catch (e) {
          setUserName('User');
        }
      } else {
        setUserName('User');
      }
      setUserNameLoading(false);
    };
    getUserName();
  }, []);

  // Filter products based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  // Fetch products from /api/products on mount - optimized for performance
  const fetchProducts = useCallback(async (reset = false) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/products?limit=50&offset=${reset ? 0 : offset}`);
      const products = res.data || [];
      if (reset) {
        setProducts(products);
        setFilteredProducts(products);
        setOffset(50);
        setHasMore(products.length === 50);
      } else {
        setProducts(prev => [...prev, ...products]);
        setFilteredProducts(prev => [...prev, ...products]);
        setOffset(prev => prev + 50);
        setHasMore(products.length === 50);
      }
    } catch (err) {
      setHasMore(false);
    }
    setIsLoading(false);
  }, [offset]);

  // On mount, fetch first 20 products
  useEffect(() => {
    fetchProducts(true);
  }, []);

  // On scroll to end, fetch more products
  const handleEndReached = () => {
    if (!isLoading && hasMore) {
      fetchProducts();
    }
  };

  // Heart icon toggle
  const toggleFavorite = async (productId) => {
    try {
      const isFavorited = favorites.has(productId);
      if (isFavorited) {
        await api.delete(`/favorites/${productId}`);
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(productId);
          return newSet;
        });
      } else {
        await api.post('/favorites', { productId });
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.add(productId);
          return newSet;
        });
      }
    } catch (error) {
      console.log('Favorite error:', error?.response?.data || error.message || error);
      // Removed alert to user
    }
  };

  const handleAddToCart = async (product) => {
    try {
      let targetListId = null;
      
      if (userLists.length > 0) {
        targetListId = userLists[0]._id;
      } else {
        // Create a default list if none exists
        const response = await api.post('/lists', { name: 'My Shopping List' });
        targetListId = response.data._id;
        // Refresh user lists
        const res = await api.get('/lists');
        setUserLists(res.data || []);
      }
      
      await addProductToList(product, targetListId);
      showToast(`${product.name} added!`);
      navigation.navigate('MyList', { listId: targetListId });
    } catch (err) {
      console.error('Error adding product:', err);
      Alert.alert('Error', 'Failed to add product. Please try again.');
    }
  };

  const addProductToList = async (product, listId) => {
    try {
      await api.post(`/lists/${listId}/items`, {
        name: product.name,
        icon: product.img,
        productId: product._id,
      });
      
      // Show a quick success feedback instead of alert
      // showToast(`${product.name} added!`); // This is now handled in handleAddToCart

    } catch (err) {
      console.error('Error adding product to list:', err);
      showToast('Failed to add product');
    }
  };

  // Toast notification system
  const [toast, setToast] = useState({ visible: false, message: '' });
  
  const showToast = (message) => {
    setToast({ visible: true, message });
    setTimeout(() => setToast({ visible: false, message: '' }), 2000);
  };

  // Add product to personal list
  const addToPersonalList = (product) => {
    setPersonalList(prev => {
      // Check if product already exists (by _id or name)
      const exists = prev.some(item => item._id === product._id || item.name === product.name);
      if (exists) {
        // If exists, increment quantity
        return prev.map(item =>
          (item._id === product._id || item.name === product.name)
            ? { ...item, quantity: (item.quantity || 1) + 1 }
            : item
        );
      } else {
        // If not, add new product with quantity 1
        return [...prev, { ...product, quantity: 1 }];
      }
    });
    showToast(`${product.name} added to My List!`);
  };

  const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/100?text=No+Image';
  const renderProductCard = ({ item }) => (
    <View style={styles.productCard}>
      <TouchableOpacity onPress={() => toggleFavorite(item._id)} style={styles.heartIcon}>
        <Ionicons name={favorites.has(item._id) ? 'heart' : 'heart-outline'} size={24} color={favorites.has(item._id) ? '#FF6B6B' : '#999'} />
      </TouchableOpacity>
      <Image 
        source={{ uri: item.img && (item.img.startsWith('http') || item.img.startsWith('data:image/')) ? item.img : PLACEHOLDER_IMAGE }} 
        style={styles.productImage}
        resizeMode="cover"
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.productPrice}>{item.price || '\u20aa--'}</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => addToPersonalList(item)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  useEffect(() => {
    // Listen for global logout event
    const handleLogout = () => logout();
    apiEventEmitter.on('logout', handleLogout);
    return () => {
      apiEventEmitter.off('logout', handleLogout);
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (navigation && navigation.getParam) {
        const type = navigation.getParam('loginType', 'back');
        setWelcomeType(type);
      } else if (navigation && navigation.route && navigation.route.params) {
        setWelcomeType(navigation.route.params.loginType || 'back');
      }
    }, [navigation])
  );

  if (!fontsLoaded) {
    return null; // Or a loading spinner
  }

  const handleComparePrices = async () => {
    setCompareModalVisible(true);
    setCompareLoading(true);
    try {
      let city = compareCity;
      if (!city) {
        // Try to get from locationName or prompt user
        city = locationName ? locationName.split(',')[0] : '';
        if (!city) {
          city = await new Promise(resolve => {
            Alert.prompt('Enter City', 'Enter your city (Hebrew supported):', resolve);
          });
        }
      }
      const barcodes = products.map(p => p.barcode).filter(Boolean);
      const res = await api.post('/compare', { city, barcodes });
      setCompareResults(res.data.slice(0, 5));
    } catch (err) {
      setCompareResults([]);
    }
    setCompareLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#2E7D32" barStyle="light-content" />
      
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <Text style={[styles.welcomeText, { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 38, color: '#4B2E83', letterSpacing: 1 }]}>Welcome</Text>
          {locationName && (
            <View style={styles.locationContainer}>
              <Ionicons name="location" size={16} color="#666" />
              <Text style={styles.locationText}>{locationName}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#999"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Products Section */}
      <View style={styles.productsSection}>
        <Text style={styles.sectionTitle}>🛒 Suggested Products</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            keyExtractor={(item, index) => item._id || index.toString()}
            renderItem={renderProductCard}
            numColumns={2}
            columnWrapperStyle={styles.productRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color="#CCC" />
                <Text style={styles.emptyText}>No products found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your search</Text>
              </View>
            }
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshing={isLoading}
            onRefresh={() => fetchProducts(true)}
          />
        )}
      </View>

      {/* Toast Notification */}
      {toast.visible && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 10 }]}> 
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('MyList')}
        >
          <Ionicons name="list" size={24} color="#2E7D32" />
          <Text style={styles.navButtonText}>My List</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('GroupList')}
        >
          <Ionicons name="people" size={24} color="#2E7D32" />
          <Text style={styles.navButtonText}>Groups</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={() => {
            // Prompt user to select a group before opening Smart Suggestions
            if (groups && groups.length > 0) {
              // For now, use the first group as default (or show a group picker for better UX)
              navigation.navigate('SmartSuggestions', { groupId: groups[0]._id });
            } else {
              Alert.alert('No Groups', 'Please join or create a group to use Smart Suggestions.');
            }
          }}
        >
          <Ionicons name="bulb" size={24} color="#2E7D32" />
          <Text style={styles.navButtonText}>Smart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          onPress={async () => {
            let listIdToUse = null;
            try {
              const res = await api.get('/lists');
              if (res.data && res.data.length > 0) {
                listIdToUse = res.data[0]._id;
              }
            } catch (err) {
              console.error('Error fetching lists for WhereToBuy navigation:', err);
            }
            navigation.navigate('WhereToBuy', { listId: listIdToUse });
          }}
        >
          <Ionicons name="storefront" size={24} color="#2E7D32" />
          <Text style={styles.navButtonText}>Stores</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={{ backgroundColor: '#2E7D32', borderRadius: 8, padding: 16, alignItems: 'center', marginVertical: 12 }}
        onPress={() => {
          if (groups && groups.length > 0) {
            navigation.navigate('SmartSuggestions', { groupId: groups[0]._id });
          } else {
            Alert.alert('No Groups', 'Please join or create a group to use Smart Suggestions.');
          }
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Smart Suggestions</Text>
      </TouchableOpacity>

      {/* Removed Compare Prices button from home page as per user request */}

      {/* Modal for Compare Prices (if needed elsewhere) */}
      {/*
      <Modal visible={compareModalVisible} animationType="slide" onRequestClose={() => setCompareModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Top 5 Stores</Text>
          {compareLoading ? (
            <ActivityIndicator size="large" color="#2E7D32" />
          ) : (
            compareResults.length > 0 ? compareResults.map((store, idx) => {
              return (
                <View key={idx} style={styles.resultCard}>
                  <Text style={styles.storeName}>{store.branch}</Text>
                  <Text style={styles.storeAddress}>{store.address}</Text>
                  {store.distance !== undefined && store.distance !== null && (
                    <Text style={styles.storeDistance}>
                      Distance: {store.distance.toFixed(2)} km
                    </Text>
                  )}
                  <Text style={styles.totalPrice}>₪{store.totalPrice}</Text>
                </View>
              );
            }) : <Text>No results found.</Text>
          )}
          <TouchableOpacity onPress={() => setCompareModalVisible(false)} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
      */}


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    width: '100%',
  },
  header: {
    backgroundColor: '#2E7D32',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: '5%',
    width: '100%',
  },
  welcomeSection: {
    alignItems: 'center',
    width: '100%',
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#E8F5E8',
    marginLeft: 4,
  },
  logoutButton: {
    padding: 8,
    marginRight: 16,
  },
  searchContainer: {
    paddingHorizontal: '5%',
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    width: '100%',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  productsSection: {
    flex: 1,
    paddingHorizontal: '5%',
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginVertical: 15,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  productsList: {
    paddingBottom: 20,
    width: '100%',
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    // width: '100%', // Remove if causing layout issues
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    flex: 1,
    marginHorizontal: 4,
    marginVertical: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    alignItems: 'center',
    padding: 12,
    position: 'relative',
    height: 220, // Fixed height for alignment
  },
  heartIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    marginBottom: 10,
  },
  productInfo: {
    alignItems: 'center',
    width: '100%',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  productPrice: {
    fontSize: 14,
    color: '#2E7D32',
    marginBottom: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
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
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
    paddingVertical: 10,
    width: '100%',
  },
  navButton: {
    alignItems: 'center',
    flex: 1,
  },
  navButtonText: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
  },
  createButton: {
    backgroundColor: '#2E7D32',
  },
  cancelButtonText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
  createButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
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
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 10,
    marginHorizontal: '5%',
    alignSelf: 'center',
  },
  compareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    padding: 20,
    alignItems: 'center',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  storeDistance: {
    fontSize: 14,
    color: '#1976D2',
    marginBottom: 4,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  closeButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
