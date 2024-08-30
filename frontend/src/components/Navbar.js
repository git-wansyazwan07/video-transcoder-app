// src/components/Navbar.js
import React from 'react';
import { Link } from 'react-router-dom';

const Navbar = () => {
    const handleLogout = () => {
        localStorage.removeItem('token');
        window.location.href = '/login';
    };

    return (
        <nav>
            <Link to="/">Main</Link>
            <Link to="/gallery">Gallery</Link>
            <button onClick={handleLogout}>Logout</button>
        </nav>
    );
};

export default Navbar;