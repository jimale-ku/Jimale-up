import React, { useState, useContext, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, StyleSheet, Keyboard, Alert, Image, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import PersonalListContext from '../services/PersonalListContext';

const WhereToBuyScreen = ({ route, navigation }) => {
  const { products, source, tripType, groupId, currentUserId, groupCreatorId } = route.params || {};
  console.log('WhereToBuyScreen params:', route.params);
  const [locationMethod, setLocationMethod] = useState(null); // 'gps' or 'manual'
  const [city, setCity] = useState('');
  const [cityInputVisible, setCityInputVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stores, setStores] = useState([]);
  const [error, setError] = useState('');

  const [showCelebration, setShowCelebration] = useState(false);
  const { completeTrip } = useContext(PersonalListContext);

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
      // Replace with your actual backend endpoint
      const response = await fetch('http://192.168.100.34:5000/api/compare/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          products: products.map(p => ({
            barcode: p.barcode,
            name: p.name,
            quantity: p.quantity || 1,
            image: p.image // Add the image field
          })),
          source,
        }),
      });
      if (!response.ok) throw new Error('Failed to fetch stores');
      const data = await response.json();
      console.log('Store data:', data);
      console.log('Products with images:', products.map(p => ({ barcode: p.barcode, name: p.name, hasImage: !!p.image })));
      setStores(Array.isArray(data) ? data.slice(0, 5) : (data.stores?.slice(0, 5) || []));
    } catch (e) {
      setError('Could not fetch store data.');
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (selectedStore) => {
    console.log('Buy button pressed', { tripType, selectedStore });
    if (tripType === 'group' && groupId) {
      console.log('Entering group trip buy logic');
      try {
        console.log('About to call API for group complete-trip');
        await api.post(`/groups/${groupId}/list/complete-trip`, {
          store: {
            branch: selectedStore.branch,
            address: selectedStore.address,
            totalPrice: selectedStore.totalPrice ?? selectedStore.price ?? null,
          }
        });
        console.log('API call successful, setting showCelebration to true');
        setShowCelebration(true);
        setTimeout(() => {
          console.log('Timeout done, hiding celebration and navigating to GroupSharedList');
          setShowCelebration(false);
          navigation.navigate('GroupSharedList', { groupId });
        }, 3000);
      } catch (err) {
        console.log('Error in group trip buy logic:', err);
        Alert.alert('Error', 'Failed to complete group trip');
      }
    } else if (tripType === 'personal') {
      console.log('Entering personal trip buy logic');
      try {
        completeTrip({
          branch: selectedStore.branch || selectedStore.storeName,
          address: selectedStore.address,
          totalPrice: selectedStore.totalPrice ?? selectedStore.price ?? null,
        });
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
            <Text style={styles.storeDetail}>מחיר כולל: ₪{item.totalPrice ?? item.price ?? 'N/A'}</Text>
            <Text style={styles.storeDetail}>מוצרים שנמצאו: {item.itemsFound}</Text>
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
      <Text style={styles.header}>איפה כדאי לקנות?</Text>
      <View style={styles.cardRow}>
        <TouchableOpacity style={styles.smartCard} onPress={handleUseGPS}>
          <Text style={styles.cardIcon}>📍</Text>
          <Text style={styles.cardText}>השתמש במיקום שלי</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smartCard} onPress={handleManualEntry}>
          <Text style={styles.cardIcon}>🏙️</Text>
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
      {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 30 }} />}
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
      {tripType === 'group' && groupId && (
        <TouchableOpacity style={{ backgroundColor: '#1976D2', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 24 }} onPress={handleBuy}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Buy (Complete Group Trip)</Text>
        </TouchableOpacity>
      )}
      {/* Celebration animation */}
      {showCelebration && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          {console.log('Celebration animation should be visible:', showCelebration)}
          <LottieView
            source={require('../assets/animations/beforeShopping.json')}
            autoPlay
            loop={false}
            style={{ width: 300, height: 300 }}
          />
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#1976D2', marginTop: 24 }}>Hurray! Trip Complete!</Text>
        </View>
      )}
      {!loading && stores.length === 0 && locationMethod && !error && (
        <Text style={styles.noResults}>לא נמצאו חנויות מתאימות.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, alignSelf: 'center' },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  smartCard: {
    flex: 1,
    backgroundColor: '#f2f2f2',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 5,
    alignItems: 'center',
    elevation: 2,
  },
  cardIcon: { fontSize: 32, marginBottom: 8 },
  cardText: { fontSize: 16, fontWeight: '500' },
  cityInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginRight: 10,
  },
  citySubmitBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  citySubmitText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  storeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#222',
  },
  storeDetail: {
    fontSize: 14,
    color: '#444',
    marginBottom: 2,
  },
  buyButton: {
    backgroundColor: '#1976D2',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  error: { color: 'red', marginTop: 20, textAlign: 'center' },
  noResults: { color: '#888', marginTop: 30, textAlign: 'center', fontSize: 16 },
});

export default WhereToBuyScreen; 