import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AppBar, Toolbar, Button, Link, Box } from '@mui/material';
//import jwt_decode from 'jwt-decode'; // Use this to decode JWT token
import { jwtDecode } from 'jwt-decode';


const Navbar = () => {
  const [userGroups, setUserGroups] = useState([]);

  useEffect(() => {
    // Check if token is present in localStorage
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Decode the token to extract the user groups
        const decodedToken = jwtDecode(token);
        const groups = decodedToken['cognito:groups'] || [];
        setUserGroups(groups);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Box sx={{ flexGrow: 1 }}>
          {userGroups.includes('Users') && (
            <>
            
              <Link component={RouterLink} to="/main" color="inherit" underline="none" sx={{ mr: 2 }}>
                <Button color="inherit">Main</Button>
              </Link>
              <Link component={RouterLink} to="/gallery" color="inherit" underline="none" sx={{ mr: 2 }}>
                <Button color="inherit">Gallery</Button>
              </Link>
            </>
          )}

          {userGroups.includes('Admins') && (
            <Link component={RouterLink} to="/dashboard" color="inherit" underline="none" sx={{ mr: 2 }}>
              <Button color="inherit">Dashboard</Button>
            </Link>
          )}
        </Box>
        <Button color="inherit" onClick={handleLogout}>
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
