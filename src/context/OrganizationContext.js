import React, { createContext, useState, useContext } from 'react';

// Create context
const OrganizationContext = createContext();

// Provider component
export const OrganizationProvider = ({ children }) => {
  const [isOrganization, setIsOrganization] = useState(false);
  
  // Function to update the organization status
  const toggleOrganizationStatus = () => {
    setIsOrganization(prevState => !prevState);
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