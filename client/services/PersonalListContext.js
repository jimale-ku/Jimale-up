import React, { createContext, useState } from 'react';

const PersonalListContext = createContext();

export const PersonalListProvider = ({ children }) => {
  const [personalList, setPersonalList] = useState([]); // Current list
  const [lastBought, setLastBought] = useState([]); // Last bought trip
  const [lastStore, setLastStore] = useState(null); // Last store info
  const [tripHistory, setTripHistory] = useState([]); // Personal trip history
  const [selectedTrip, setSelectedTrip] = useState(null); // Currently selected trip

  // Complete trip: move bought items to last bought, store store info, clear current list
  const completeTrip = (storeInfo, boughtProducts = null) => {
    // If boughtProducts is provided, only move those items
    // Otherwise, fall back to old behavior (move all items)
    const itemsToMove = boughtProducts && boughtProducts.length > 0 
      ? boughtProducts 
      : personalList;
    
    // Create trip metadata
    const tripData = {
      id: Date.now().toString(), // Simple ID for now
      store: storeInfo || null,
      items: itemsToMove,
      completedAt: new Date().toISOString(),
      tripNumber: tripHistory.length + 1
    };
    
    // Add to trip history
    setTripHistory(prev => [tripData, ...prev]);
    
    // Update last bought and store
    setLastBought(itemsToMove);
    setLastStore(storeInfo || null);
    
    // FIXED: Only remove bought items, keep "not found" items for future searches
    if (boughtProducts && boughtProducts.length > 0) {
      // Create a set of bought item IDs for efficient lookup
      const boughtItemIds = new Set(boughtProducts.map(item => item._id || item.id || item.productId));
      
      // Keep only items that were not bought (not found items)
      setPersonalList(prev => prev.filter(item => !boughtItemIds.has(item._id || item.id || item.productId)));
      
      console.log(`[DEBUG] Personal trip: Moved ${boughtProducts.length} bought items to last bought`);
      console.log(`[DEBUG] Personal trip: Kept ${personalList.length - boughtProducts.length} not-found items in list`);
    } else {
      // Fallback: clear entire list (old behavior)
      setPersonalList([]);
    }
  };

  // Select a specific trip from history
  const selectTrip = (tripId) => {
    const trip = tripHistory.find(t => t.id === tripId);
    if (trip) {
      setSelectedTrip(trip);
      setLastBought(trip.items);
      setLastStore(trip.store);
    }
  };

  // Clear selected trip (show most recent)
  const clearSelectedTrip = () => {
    setSelectedTrip(null);
    if (tripHistory.length > 0) {
      setLastBought(tripHistory[0].items);
      setLastStore(tripHistory[0].store);
    } else {
      setLastBought([]);
      setLastStore(null);
    }
  };

  return (
    <PersonalListContext.Provider value={{
      personalList,
      setPersonalList,
      lastBought,
      setLastBought,
      lastStore,
      setLastStore,
      tripHistory,
      setTripHistory,
      selectedTrip,
      setSelectedTrip,
      completeTrip,
      selectTrip,
      clearSelectedTrip,
    }}>
      {children}
    </PersonalListContext.Provider>
  );
};

export default PersonalListContext; 