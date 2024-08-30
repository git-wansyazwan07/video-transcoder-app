// src/components/Navbar.js
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { AppBar, Toolbar, Button, Link } from '@mui/material';

const Navbar = () => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Link component={RouterLink} to="/" color="inherit" underline="none" sx={{ mr: 2 }}>
          <Button color="inherit">Main</Button>
        </Link>
        <Link component={RouterLink} to="/gallery" color="inherit" underline="none" sx={{ mr: 2 }}>
          <Button color="inherit">Gallery</Button>
        </Link>
        <Button color="inherit" onClick={handleLogout}>
          Logout
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
