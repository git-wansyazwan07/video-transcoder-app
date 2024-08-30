// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Main from './components/Main';
import Gallery from './components/Gallery';

const App = () => {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Main />} />
                <Route path="/gallery" element={<Gallery />} />
            </Routes>
        </Router>
    );
};

export default App;
