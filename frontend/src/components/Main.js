// src/components/Main.js
import React, { useState, useEffect  } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';



const Main = () => {
    const [file, setFile] = useState(null);
    const navigate = useNavigate();

    const [isLoggedIn, setIsLoggedIn] = useState('');

    useEffect(() => {
        // Check if token exists in localStorage to determine if the user is logged in
        const token = localStorage.getItem('token');
        setIsLoggedIn(!!token); // Set to true if token exists, otherwise false
        if(!token){
            navigate('/login');
        }
    }, []);



    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        
        const formData = new FormData();
        formData.append('video', file);

        try {
            await axios.post('http://localhost:5000/api/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert('File uploaded and transcoded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Error uploading file');
        }
    };

    return (
        <div>
            <Navbar />
            <h2>Main Screen</h2>
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleUpload}>Transcode Video</button>
        </div>
    );
};

export default Main;
