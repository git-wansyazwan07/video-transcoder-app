// src/components/Gallery.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';

const Gallery = () => {
    const [videos, setVideos] = useState([]);
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // Check if token exists in localStorage to determine if the user is logged in
        const token = localStorage.getItem('token');
        setIsLoggedIn(!!token); // Set to true if token exists, otherwise false
        if (!token) {
            navigate('/login');
        }
    }, [navigate]);

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/videos', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                });
                setVideos(response.data);
            } catch (error) {
                console.error('Failed to fetch videos:', error);
            }
        };

        fetchVideos();
    }, []);

    const handleDownload = async (video) => {
        try {
            const response = await axios.get(`http://localhost:5000/api/download/${video.name}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                responseType: 'blob', // Important for downloading files
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', video.name); // Name of the file to be downloaded
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading video:', error);
        }
    };

    return (
        <div>
            {isLoggedIn && <Navbar />}
            <h2>Gallery</h2>
            <ul>
                {videos.map((video) => (
                    <li key={video.name}>
                        {video.name}
                        <button onClick={() => handleDownload(video)}>Download</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default Gallery;
