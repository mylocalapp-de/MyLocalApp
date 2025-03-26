import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create context
const OrganizationContext = createContext();

// Provider component
export const OrganizationProvider = ({ children }) => {
  const [isOrganization, setIsOrganization] = useState(false);
  
  // Load the organization status from AsyncStorage on mount
  useEffect(() => {
    const loadOrgStatus = async () => {
      try {
        const storedValue = await AsyncStorage.getItem('isOrganization');
        if (storedValue !== null) {
          setIsOrganization(JSON.parse(storedValue));
        }
      } catch (error) {
        console.error('Failed to load organization status', error);
      }
    };
    
    loadOrgStatus();
  }, []);
  
  // Function to update the organization status
  const toggleOrganizationStatus = async (value) => {
    try {
      const newValue = value !== undefined ? value : !isOrganization;
      await AsyncStorage.setItem('isOrganization', JSON.stringify(newValue));
      setIsOrganization(newValue);
    } catch (error) {
      console.error('Failed to save organization status', error);
    }
  };
  
  return (
    <OrganizationContext.Provider value={{ isOrganization, toggleOrganizationStatus }}>
      {children}
    </OrganizationContext.Provider>
  );
};

// Custom hook to use the context
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

export default OrganizationContext; 