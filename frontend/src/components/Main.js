// src/components/Main.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { Container, Box, Typography, Button, Input, LinearProgress } from '@mui/material';

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
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
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
            Authorization: `Bearer ${localStorage.getItem('token')}`,
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
        <Typography variant="h4" component="h1" gutterBottom>
          Main Screen
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
        {isTranscoding && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6">Transcoding Progress</Typography>
            <LinearProgress
              variant="determinate"
              value={transcodingProgress}
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
