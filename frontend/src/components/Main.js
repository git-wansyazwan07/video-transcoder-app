import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { Container, Box, Typography, Button, Input, LinearProgress } from '@mui/material';
import { ApiUrlContext } from './ApiUrlContext'; // Import the context


const Main = () => {
  const [file, setFile] = useState(null);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodingProgress, setTranscodingProgress] = useState(0);
  const navigate = useNavigate();

  const [isLoggedIn, setIsLoggedIn] = useState(false);

    // Access the apiUrl from the context
    const apiUrl = useContext(ApiUrlContext);

  useEffect(() => {
    // Check if token exists in localStorage to determine if the user is logged in
    const token = localStorage.getItem('token');
    //console.log('here is the token: ',token);
    setIsLoggedIn(!!token); // Set to true if token exists, otherwise false
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
      pollTranscodingProgress(); // Start polling for progress immediately

      // Initiate upload request
      const response = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Error uploading file');
      setIsTranscoding(false);
    }
  };

  const pollTranscodingProgress = async () => {
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${apiUrl}/api/progress`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch progress');

        const data = await response.json();
        const progress = data.progress;
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
    }, 1000); // Poll every second
  };

  return (
    <Container maxWidth="md">
      <Navbar />
      <Box
        sx={{
          mt: 4,
          p: 3,
          boxShadow: 3,
          borderRadius: 2,
          backgroundColor: 'background.paper',
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom sx={{ textAlign: 'center' }}>
          Video Transcoder App
        </Typography>
        <Box sx={{ mb: 2 }}>
          <Input
            type="file"
            onChange={handleFileChange}
            sx={{ mt: 2 }}
            fullWidth
          />
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={handleUpload}
          disabled={!file || isTranscoding}
          sx={{ mt: 2 }}
        >
          Upload and Transcode
        </Button>
        <Typography variant="body1">Transcoded video will be available to download from the Gallery page</Typography>
        {isTranscoding && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6">Transcoding Progress</Typography>
            <LinearProgress
              variant="determinate"
              value={Number(transcodingProgress)}
              sx={{ mt: 2, mb: 1 }}
            />
            <Typography variant="body1">{transcodingProgress}%</Typography>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Main;
