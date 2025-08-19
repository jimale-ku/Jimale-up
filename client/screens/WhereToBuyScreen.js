import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, StyleSheet, Keyboard, Alert, Image, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';

import api from '../services/api';
import PersonalListContext from '../services/PersonalListContext';

const WhereToBuyScreen = ({ route, navigation }) => {
  const { products: routeProducts, source, tripType, groupId, currentUserId, groupCreatorId } = route.params || {};
  const [products, setProducts] = useState(routeProducts || []);
  console.log('WhereToBuyScreen params:', route.params);
  const [locationMethod, setLocationMethod] = useState(null); // 'gps' or 'manual'
  const [city, setCity] = useState('');
  const [cityInputVisible, setCityInputVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState('');

  const [showCelebration, setShowCelebration] = useState(false);
  const { completeTrip } = useContext(PersonalListContext);

  // Hide the default navigation header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // NEW: Add smart back button
  const handleSmartBack = () => {
    if (tripType === 'group' && groupId) {
      Alert.alert(
        'Navigation Options',
        'Where would you like to go?',
        [
          {
            text: 'Back to Group List',
            onPress: () => navigation.goBack(),
            style: 'default'
          },
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
    } else {
      navigation.goBack();
    }
  };

  // Format price to avoid floating point precision issues
  const formatPrice = (price) => {
    if (price === null || price === undefined || price === 'N/A') {
      return 'N/A';
    }
    // Convert to number and fix floating point precision
    const numPrice = parseFloat(price);
    if (isNaN(numPrice)) {
      return 'N/A';
    }
    // Round to 2 decimal places and format
    return numPrice.toFixed(2);
  };

  useEffect(() => {
    return () => {
      console.log('WhereToBuyScreen unmounted!');
    };
  }, []);

  // Helper to get product details from barcode from the selected products only
  const getProductByBarcode = (barcode) => {
    return products.find(p => p.barcode === barcode);
  };

  const handleUseGPS = async () => {
    setError('');
    setLoading(true);
    setLocationMethod('gps');
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access location was denied');
        setLoading(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      let geocode = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      console.log('Geocode result:', geocode);
      let cityName = geocode[0]?.city || geocode[0]?.region || geocode[0]?.district || geocode[0]?.subregion;
      if (!cityName) {
        setError('Could not determine your city from GPS.');
        setLoading(false);
        return;
      }
      setCity(cityName); // Fix: Update the city state
      fetchStores({ city: cityName });
    } catch (e) {
      setError('Failed to get location.');
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    setLocationMethod('manual');
    setCityInputVisible(true);
  };

  const handleCitySubmit = () => {
    if (!city.trim()) {
      setError('Please enter a city name in Hebrew.');
      return;
    }
    setError('');
    setLoading(true);
    setCityInputVisible(false);
    Keyboard.dismiss();
    fetchStores({ city: city.trim() });
  };

  const fetchStores = async (locationData) => {
    setError('');
    setLoading(true);
    setStores([]);
    try {
      // NEW: Use streaming for large lists (50+ items)
      if (products.length >= 50) {
        await fetchStoresStreaming(locationData);
        return;
      }
      
      // Try full search first, fallback to quick search if it fails
      let endpoint = '/compare/price';
      let isQuickSearch = false;
      
      if (products.length > 25) {
        endpoint = '/compare/price/quick';
        isQuickSearch = true;
      }
      
      console.log(`🔍 Using ${isQuickSearch ? 'quick' : 'full'} search for ${products.length} items`);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 30000) // 30 second timeout
      );
      
      const fetchPromise = fetch(`http://192.168.201.100:5000/api${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: locationData.city, // Fix: Use the parameter instead of state
          products: products.map(p => ({
            barcode: p.barcode,
            name: p.name,
            quantity: p.quantity || 1,
            image: p.image // Keep image data for display
          })),
          source,
        }),
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      if (!response.ok) throw new Error('Failed to fetch stores');
      const data = await response.json();
      
      if (data.isPartial) {
        console.log(`⚡ Quick results: ${data.processedItems}/${data.totalItems} items processed`);
        // Show partial results message
        setError(`Quick results: ${data.processedItems}/${data.totalItems} items processed. More results loading...`);
        setTimeout(() => setError(''), 3000); // Clear message after 3 seconds
      }
      
      console.log('Store data received:', Array.isArray(data) ? `${data.length} stores` : `${data.stores?.length || 0} stores`);
      
      setStores(Array.isArray(data) ? data.slice(0, 5) : (data.stores?.slice(0, 5) || []));
    } catch (e) {
      console.error('Search error:', e);
      
      // If full search failed and we have many items, try quick search as fallback
      if (!isQuickSearch && products.length > 25) {
        console.log('🔄 Full search failed, trying quick search as fallback...');
        try {
          const quickResponse = await fetch(`http://192.168.201.100:5000/api/compare/price/quick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              city: locationData.city,
              products: products.map(p => ({
                barcode: p.barcode,
                name: p.name,
                quantity: p.quantity || 1,
                image: p.image
              })),
              source,
            }),
          });
          
          if (quickResponse.ok) {
            const quickData = await quickResponse.json();
            console.log('✅ Quick search fallback successful');
            setStores(quickData.stores?.slice(0, 5) || []);
            setError(`Quick results: ${quickData.processedItems}/${quickData.totalItems} items processed`);
            setTimeout(() => setError(''), 3000);
            return;
          }
        } catch (fallbackError) {
          console.error('Quick search fallback also failed:', fallbackError);
        }
      }
      
      if (e.message === 'Request timeout') {
        setError('Search is taking too long. Try with fewer items or try again.');
      } else {
        setError('Could not fetch store data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // NEW: Streaming fetch for large lists
  const fetchStoresStreaming = async (locationData) => {
    try {
      console.log(`🚀 Starting streaming search for ${products.length} items`);
      
      const response = await fetch(`http://192.168.201.100:5000/api/compare/price/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: locationData.city,
          products: products.map(p => ({
            barcode: p.barcode,
            name: p.name,
            quantity: p.quantity || 1,
            image: p.image
          })),
          source,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to start streaming search');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'progress') {
                // Update progress
                setError(`Processing: ${data.processed}/${data.total} items (${data.percentage}%)`);
                console.log(`📊 Progress: ${data.processed}/${data.total} items (${data.percentage}%)`);
              } else if (data.type === 'complete') {
                // Final results
                console.log(`✅ Streaming completed: ${data.processedItems}/${data.totalItems} items in ${data.processingTime}ms`);
                setStores(data.stores || []);
                setError(`Found ${data.stores?.length || 0} stores for ${data.processedItems} items`);
                setTimeout(() => setError(''), 3000);
                return;
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Streaming search failed');
              }
            } catch (parseError) {
              console.error('Error parsing streaming data:', parseError);
            }
          }
        }
      }
      
    } catch (e) {
      console.error('Streaming search error:', e);
      setError('Streaming search failed. Please try again.');
    }
  };

  const handleBuy = async (selectedStore) => {
    console.log('Buy button pressed', { tripType, selectedStore });
    if (tripType === 'group' && groupId) {
      try {
        // Get the products that were actually found/bought from this store
        const foundBarcodes = selectedStore.foundBarcodes || [];
        console.log('🔍 Found barcodes from store:', foundBarcodes);
        console.log('🔍 All product barcodes:', products.map(p => p.barcode));
        
        // More flexible matching - check both barcode and name
        const boughtProducts = products.filter(p => {
          const foundByBarcode = foundBarcodes.includes(p.barcode);
          const foundByName = selectedStore.productDetails && 
            Object.keys(selectedStore.productDetails).some(key => 
              selectedStore.productDetails[key].name === p.name
            );
          return foundByBarcode || foundByName;
        });
        
        console.log('Products to mark as bought:', boughtProducts.map(p => p.name));
        console.log('Products that will be kept (not found):', products.filter(p => !boughtProducts.includes(p)).map(p => p.name));
        
        // Get the scraped product details (including images) from the store data
        const boughtProductsWithDetails = boughtProducts.map(p => {
          const scrapedDetails = selectedStore.productDetails?.[p.barcode];
          return {
            _id: p._id,
            barcode: p.barcode,
            name: scrapedDetails?.name || p.name,
            quantity: p.quantity || 1,
            img: scrapedDetails?.img || p.img,
            icon: scrapedDetails?.icon || p.icon,
            productId: p.productId || p.product || null
          };
        });
        
        await api.post(`/groups/${groupId}/list/complete-trip`, {
          store: {
            branch: selectedStore.branch,
            address: selectedStore.address,
            totalPrice: selectedStore.totalPrice ?? selectedStore.price ?? null,
          },
          boughtProducts: boughtProductsWithDetails
        });
        console.log('Setting showCelebration to true');
        setShowCelebration(true);
        setTimeout(() => {
          console.log('Timeout done, hiding celebration and navigating to GroupSharedList');
          setShowCelebration(false);
          navigation.navigate('GroupSharedList', { 
            groupId,
            tripCompleted: true // NEW: Flag to show quick navigation
          });
        }, 3000);
      } catch (err) {
        Alert.alert('Error', 'Failed to complete group trip');
      }
    } else if (tripType === 'personal') {
      console.log('Personal trip buy logic triggered');
      try {
        // Get the products that were actually found/bought from this store
        const foundBarcodes = selectedStore.foundBarcodes || [];
        
        // More flexible matching - check both barcode and name
        const boughtProducts = products.filter(p => {
          const foundByBarcode = foundBarcodes.includes(p.barcode);
          const foundByName = selectedStore.productDetails && 
            Object.keys(selectedStore.productDetails).some(key => 
              selectedStore.productDetails[key].name === p.name
            );
          return foundByBarcode || foundByName;
        });
        
        // Ensure bought products have image data
        const boughtProductsWithImages = boughtProducts.map(product => ({
          ...product,
          img: product.image || product.img || product.icon, // Preserve image data
          icon: product.image || product.img || product.icon, // Backup image field
        }));
        
        console.log('Personal trip - Products to mark as bought:', boughtProductsWithImages.map(p => p.name));
        console.log('Personal trip - Products that will be lost:', products.filter(p => !foundBarcodes.includes(p.barcode)).map(p => p.name));
        
        completeTrip({
          branch: selectedStore.branch || selectedStore.storeName,
          address: selectedStore.address,
          totalPrice: selectedStore.totalPrice ?? selectedStore.price ?? null,
        }, boughtProductsWithImages);
        console.log('Navigating to TransitionScreenPersonal');
        navigation.replace('TransitionScreenPersonal');
      } catch (err) {
        console.log('Error in personal trip buy logic:', err);
        Alert.alert('Error', 'Failed to complete personal trip');
      }
    } else {
      console.log('Unknown or missing tripType:', tripType);
      Alert.alert('Error', 'Unknown or missing trip type.');
    }
  };

  // Get store icon based on store name
  const getStoreIcon = (storeName) => {
    const name = storeName?.toLowerCase() || '';
    if (name.includes('shufersal') || name.includes('שופרסל')) return 'storefront';
    if (name.includes('rami') || name.includes('רמי')) return 'business';
    if (name.includes('coop') || name.includes('קואופ')) return 'home';
    if (name.includes('victory') || name.includes('ויקטורי')) return 'star';
    if (name.includes('yohananof') || name.includes('יוחננוף')) return 'leaf';
    return 'storefront'; // default icon
  };

  const renderStore = ({ item, index }) => {
    // Find products found and not found in this store
    const foundBarcodes = item.foundBarcodes || (item.foundProducts ? item.foundProducts.map(p => p.barcode) : []);
    const foundProducts = products.filter(p => foundBarcodes.includes(p.barcode));
    const notFoundProducts = products.filter(p => !foundBarcodes.includes(p.barcode));
    
    return (
      <View style={styles.storeCard}>
        {/* Store Header with Icon */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('StoreDetail', { 
            store: item, 
            products, 
            tripType, 
            groupId, 
            currentUserId, 
            groupCreatorId 
          })} 
          activeOpacity={0.8}
          style={styles.storeHeader}
        >
          <View style={styles.storeIconContainer}>
            <Ionicons 
              name={getStoreIcon(item.branch)} 
              size={32} 
              color="#1976D2" 
            />
          </View>
          <View style={styles.storeInfo}>
            <Text style={styles.storeName}>{item.branch}</Text>
            <Text style={styles.storeDetail}>כתובת: {item.address}</Text>
            <Text style={styles.storeDetail}>מחיר כולל: ₪{formatPrice(item.totalPrice ?? item.price ?? 'N/A')}</Text>
            <Text style={styles.storeDetail}>מוצרים עם מחירים: {item.productsWithPrices || item.itemsFound || 0}</Text>
            <Text style={styles.storeDetail}>מוצרים שנמצאו: {item.productsScraped || item.totalProductsScraped || 0}</Text>
            <Text style={styles.storeScore}>Score: {item.scorePercentage || item.score || 'N/A'}</Text>
            {item.availability && (
              <Text style={styles.availabilityText}>{item.availability}</Text>
            )}
            {item.distance !== null && item.distance !== undefined && (
              <Text style={styles.storeDetail}>מרחק: {item.distance} ק"מ</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>
        
        {/* Buy Button */}
        {(tripType === 'group' && groupId) || tripType === 'personal' ? (
          <TouchableOpacity style={styles.buyButton} onPress={() => handleBuy(item)}>
            <Text style={styles.buyButtonText}>Buy from this Store</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Clean Professional Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleSmartBack}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Where to Buy?</Text>
        <View style={styles.headerRight} />
      </View>

      <Text style={styles.mainTitle}>איפה כדאי לקנות?</Text>
      <View style={styles.cardRow}>
        <TouchableOpacity style={styles.smartCard} onPress={handleUseGPS}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="location" size={32} color="#FF6B6B" />
          </View>
          <Text style={styles.cardText}>השתמש במיקום שלי</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smartCard} onPress={handleManualEntry}>
          <View style={styles.cardIconContainer}>
            <Ionicons name="business" size={32} color="#4ECDC4" />
          </View>
          <Text style={styles.cardText}>הזן עיר ידנית</Text>
        </TouchableOpacity>
      </View>
      {cityInputVisible && (
        <View style={styles.cityInputContainer}>
          <TextInput
            style={styles.cityInput}
            placeholder="הכנס שם עיר בעברית"
            value={city}
            onChangeText={setCity}
            onSubmitEditing={handleCitySubmit}
            returnKeyType="done"
            autoFocus
          />
          <TouchableOpacity style={styles.citySubmitBtn} onPress={handleCitySubmit}>
            <Text style={styles.citySubmitText}>חפש</Text>
          </TouchableOpacity>
        </View>
      )}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={styles.loadingText}>מחפש חנויות...</Text>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && stores.length > 0 && (
        <FlatList
          data={stores}
          keyExtractor={(item, idx) => item.address + idx}
          renderItem={renderStore}
          style={{ marginTop: 20 }}
        />
      )}
      {/* Buy button for group trip */}
      {tripType === 'group' && groupId && stores.length > 0 && (
        <TouchableOpacity style={styles.completeTripButton} onPress={() => handleBuy(stores[0])}>
          <Text style={styles.completeTripButtonText}>Buy (Complete Group Trip)</Text>
        </TouchableOpacity>
      )}
      {/* Celebration animation */}
      {showCelebration && (
        <View style={styles.celebrationOverlay}>
          {console.log('Celebration animation should be visible:', showCelebration)}
          <LottieView
            source={require('../assets/animations/beforeShopping.json')}
            autoPlay
            loop={false}
            style={{ width: 300, height: 300 }}
          />
          <Text style={styles.celebrationText}>Hurray! Trip Complete!</Text>
        </View>
      )}
      {!loading && stores.length === 0 && locationMethod && !error && (
        <Text style={styles.noResults}>לא נמצאו חנויות מתאימות.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    flex: 1,
  },
  headerRight: {
    width: 40,
  },
  mainTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    alignSelf: 'center',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  cardRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 20,
    gap: 15,
    paddingHorizontal: 20,
  },
  smartCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardText: { 
    fontSize: 16, 
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
  cityInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginHorizontal: 20,
  },
  cityInput: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
  },
  citySubmitBtn: {
    backgroundColor: '#1976D2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  citySubmitText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: 'bold',
  },
  error: { 
    color: '#FF6B6B', 
    marginTop: 20, 
    textAlign: 'center',
    fontSize: 16,
    paddingHorizontal: 20,
  },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  storeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  storeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  storeDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    lineHeight: 20,
  },
  storeScore: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 8,
  },
  availabilityText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
    marginTop: 4,
    fontStyle: 'italic',
  },
  buyButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  completeTripButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  completeTripButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  noResults: { 
    color: '#888', 
    marginTop: 30, 
    textAlign: 'center', 
    fontSize: 16,
    paddingHorizontal: 20,
  },
  celebrationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  celebrationText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
});

export default WhereToBuyScreen; 