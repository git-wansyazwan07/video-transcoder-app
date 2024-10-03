// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Main from './components/Main';
import Gallery from './components/Gallery';
import Dashboard from './components/Dashboard';
import Transit from './components/Transit';
import { ApiUrlProvider } from './components/ApiUrlContext';

const App = () => {
    return (
        <ApiUrlProvider>
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Transit />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/main" element={<Main />} />
                <Route path="/gallery" element={<Gallery />} />
            </Routes>
        </Router>

        </ApiUrlProvider>
    );
};

export default App;
