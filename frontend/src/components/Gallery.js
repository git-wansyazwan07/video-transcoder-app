// src/components/Gallery.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Navbar from './Navbar';
import { Container, Box, Typography, List, ListItem, Button } from '@mui/material';

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
    <Container maxWidth="md" sx={{ mt: 4 }}>
      {isLoggedIn && <Navbar />}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Gallery
        </Typography>
        <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
          {videos.map((video) => (
            <ListItem key={video.name} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body1">{video.name}</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={() => handleDownload(video)}
              >
                Download
              </Button>
            </ListItem>
          ))}
        </List>
      </Box>
    </Container>
  );
};

export default Gallery;
