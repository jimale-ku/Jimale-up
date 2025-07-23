import React, { createContext, useState } from 'react';

const PersonalListContext = createContext();

export const PersonalListProvider = ({ children }) => {
  const [personalList, setPersonalList] = useState([]); // Current list
  const [lastBought, setLastBought] = useState([]); // Last bought trip
  const [lastStore, setLastStore] = useState(null); // Last store info

  // Complete trip: move all current items to last bought, store store info, clear current list
  const completeTrip = (storeInfo) => {
    setLastBought(personalList);
    setLastStore(storeInfo || null);
    setPersonalList([]);
  };

  return (
    <PersonalListContext.Provider value={{
      personalList,
      setPersonalList,
      lastBought,
      setLastBought,
      lastStore,
      setLastStore,
      completeTrip,
    }}>
      {children}
    </PersonalListContext.Provider>
  );
};

export default PersonalListContext; 