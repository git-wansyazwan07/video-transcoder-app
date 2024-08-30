// src/components/Main.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';

const Main = () => {
    const [file, setFile] = useState(null);
    const [isTranscoding, setIsTranscoding] = useState(false);
    const [transcodingProgress, setTranscodingProgress] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
        }
    }, [navigate]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!file) return;
        
        const formData = new FormData();
        formData.append('video', file);

        try {
            setIsTranscoding(true);

            // Start polling for progress immediately
            pollTranscodingProgress();

            // Initiate upload request
            await axios.post('http://localhost:5000/api/upload', formData, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            // Optionally handle upload completion here, if necessary
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Error uploading file');
            setIsTranscoding(false);
        }
    };

    const pollTranscodingProgress = async () => {
        const intervalId = setInterval(async () => {
            try {
                const response = await axios.get('http://localhost:5000/api/progress', {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    },
                });
                
                const progress = response.data.progress;
                console.log(`Fetched progress: ${progress}%`); // Debugging line

                setTranscodingProgress(progress);

                if (progress >= 100) {
                    clearInterval(intervalId);
                    setIsTranscoding(false);
                    alert('Transcoding completed successfully!');
                }
            } catch (error) {
                console.error('Error fetching transcoding progress:', error);
                clearInterval(intervalId);
                setIsTranscoding(false);
            }
        }, 1000); // Poll every 2 seconds
    };

    return (
        <div>
            <Navbar />
            <h1>Main Screen</h1>
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleUpload}>Upload and Transcode</button>
            {isTranscoding && (
                <div>
                    <h2>Transcoding Progress</h2>
                    <progress value={transcodingProgress} max={100} />
                    <span>{transcodingProgress}%</span>
                </div>
            )}
        </div>
    );
};

export default Main;
