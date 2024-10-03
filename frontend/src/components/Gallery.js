// src/components/Gallery.js
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { ApiUrlContext } from './ApiUrlContext'; // Import the context

import { Container, Box, Typography, List, ListItem, Button } from '@mui/material';

const Gallery = () => {
  const [videos, setVideos] = useState([]);
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Access the apiUrl from the context
  const apiUrl = useContext(ApiUrlContext);

  useEffect(() => {
    // Check if token exists in localStorage to determine if the user is logged in
    const token = localStorage.getItem('token');
    
    setIsLoggedIn(!!token); // Set to true if token exists, otherwise false
    console.log(token);
    if (!token) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        console.log('trying to fetch');
        const response = await fetch(`${apiUrl}/api/videos`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch videos');
        }
        
        const data = await response.json();
        setVideos(data);
      } catch (error) {
        console.error('Failed to fetch videos:', error);
      }
    };

    fetchVideos();
  }, []);

  const handleDownload = async (video) => {
    try {
        const response = await fetch(`${apiUrl}/api/download/${video.name}`, {
            headers: {
                Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            method: 'GET'
        });

        if (!response.ok) {
            const errorText = await response.text(); // Read the error message for debugging
            throw new Error(`Error generating download link: ${errorText}`);
        }

        // Get the signed URL from the JSON response
        const { url } = await response.json(); // Extract the signed URL from the response

        // Fetch the video file using the signed URL
        const videoResponse = await fetch(url);
        
        if (!videoResponse.ok) {
            throw new Error('Error fetching the video file');
        }

        const blob = await videoResponse.blob(); // Convert the video response to a Blob
        const downloadUrl = window.URL.createObjectURL(blob); // Create a URL for the Blob

        // Create a link element to trigger the download
        const link = document.createElement('a');
        link.href = downloadUrl; // Set the href to the Blob URL
        link.setAttribute('download', video.name); // Specify the name for the downloaded file
        document.body.appendChild(link); // Append the link to the body
        link.click(); // Trigger the download
        document.body.removeChild(link); // Remove the link after triggering the download
        window.URL.revokeObjectURL(downloadUrl); // Clean up the Blob URL
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
