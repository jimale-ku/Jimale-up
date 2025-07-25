import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, ActivityIndicator, StyleSheet, Keyboard, Alert, Image, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import LottieView from 'lottie-react-native';
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
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const { completeTrip } = useContext(PersonalListContext);

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
            quantity: p.quantity || 1
          })),
          source,
        }),
      });
      if (!response.ok) throw new Error('Failed to fetch stores');
      const data = await response.json();
      console.log('Store data:', data);
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
      try {
        await api.post(`/groups/${groupId}/list/complete-trip`, {
          store: {
            branch: selectedStore.branch,
            address: selectedStore.address,
            totalPrice: selectedStore.totalPrice ?? selectedStore.price ?? null,
          }
        });
        setShowCelebration(true);
        setTimeout(() => {
          setShowCelebration(false);
          navigation.navigate('GroupSharedList', { groupId });
        }, 3000);
      } catch (err) {
        Alert.alert('Error', 'Failed to complete group trip');
      }
    } else if (tripType === 'personal') {
      console.log('Personal trip buy logic triggered');
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

  const renderStore = ({ item, index }) => {
    const isExpanded = expandedIdx === index;
    // Find products found and not found in this store
    const foundBarcodes = item.foundBarcodes || (item.foundProducts ? item.foundProducts.map(p => p.barcode) : []);
    const foundProducts = products.filter(p => foundBarcodes.includes(p.barcode));
    const notFoundProducts = products.filter(p => !foundBarcodes.includes(p.barcode));
    return (
      <TouchableOpacity onPress={() => setExpandedIdx(isExpanded ? null : index)} activeOpacity={0.8}>
        <View style={[styles.storeCard, isExpanded && styles.expandedCard]}>
          <Text style={styles.storeName}>{item.branch}</Text>
          <Text style={styles.storeDetail}>כתובת: {item.address}</Text>
          <Text style={styles.storeDetail}>מחיר כולל: ₪{item.totalPrice ?? item.price ?? 'N/A'}</Text>
          <Text style={styles.storeDetail}>מוצרים שנמצאו: {item.itemsFound}</Text>
          {item.distance !== null && item.distance !== undefined && (
            <Text style={styles.storeDetail}>מרחק: {item.distance} ק"מ</Text>
          )}
          {isExpanded && (
            <View style={styles.expandedSection}>
              <Text style={styles.sectionHeader}>מוצרים שנמצאו בחנות:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 8}}>
                {foundProducts.length === 0 && <Text style={styles.notFoundText}>לא נמצאו מוצרים</Text>}
                {foundProducts.map((prod, idx) => (
                  <View key={prod.barcode + idx} style={styles.productCard}>
                    <Image source={prod.img ? { uri: prod.img } : require('../assets/favicon.png')} style={styles.productImg} />
                    <Text style={styles.productName}>{prod.name}</Text>
                    {/* If you have per-product price, show here. Otherwise, show only total above. */}
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.sectionHeader}>מוצרים שלא נמצאו:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {notFoundProducts.length === 0 && <Text style={styles.foundText}>כל המוצרים נמצאו</Text>}
                {notFoundProducts.map((prod, idx) => (
                  <View key={prod.barcode + idx} style={[styles.productCard, styles.notFoundCard]}>
                    <Image source={prod.img ? { uri: prod.img } : require('../assets/favicon.png')} style={[styles.productImg, {opacity: 0.4}]} />
                    <Text style={[styles.productName, {color: '#aaa'}]}>{prod.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
          {/* Buy button for each store */}
          {(tripType === 'group' && groupId) || tripType === 'personal' ? (
            <TouchableOpacity style={{ backgroundColor: '#1976D2', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 }} onPress={() => handleBuy(item)}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Buy from this Store</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
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
  expandedCard: {
    backgroundColor: '#f0f8ff',
    borderColor: '#2196f3',
    borderWidth: 1,
  },
  storeName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#222',
  },
  storeDetail: {
    fontSize: 15,
    color: '#444',
    marginBottom: 2,
  },
  expandedSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
  },
  sectionHeader: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
    color: '#1976d2',
  },
  productCard: {
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 8,
    width: 90,
  },
  notFoundCard: {
    backgroundColor: '#f3f3f3',
    borderColor: '#eee',
    borderWidth: 1,
  },
  productImg: {
    width: 48,
    height: 48,
    borderRadius: 6,
    marginBottom: 4,
    backgroundColor: '#eee',
  },
  productName: {
    fontSize: 13,
    textAlign: 'center',
    color: '#333',
  },
  notFoundText: {
    color: '#b71c1c',
    fontSize: 14,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  foundText: {
    color: '#388e3c',
    fontSize: 14,
    marginHorizontal: 8,
    alignSelf: 'center',
  },
  error: { color: 'red', marginTop: 20, textAlign: 'center' },
  noResults: { color: '#888', marginTop: 30, textAlign: 'center', fontSize: 16 },
});

export default WhereToBuyScreen; 