import React, { createContext, useState, useEffect } from 'react';

// Create the ApiUrlContext
export const ApiUrlContext = createContext();

// ApiUrlProvider component to fetch and provide the apiUrl globally
export const ApiUrlProvider = ({ children }) => {
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    const fetchApiUrl = async () => {
      try {
        // Fetch the apiUrl from the backend
        const response = await fetch('http://localhost:5000/api/get-api-url');
        if (!response.ok) {
          throw new Error('Failed to fetch API URL');
        }
        const data = await response.json();
        setApiUrl(data.apiUrl); // Store the apiUrl in state
        console.log(apiUrl);
      } catch (error) {
        console.error('Error fetching API URL:', error);
      }
    };

    fetchApiUrl(); // Fetch the apiUrl when the component mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once

  return (
    <ApiUrlContext.Provider value={apiUrl}>
      {children}
    </ApiUrlContext.Provider>
  );
};
