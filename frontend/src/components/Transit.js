import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Typography} from '@mui/material';
import { jwtDecode } from 'jwt-decode'; // Correct import, no named import needed for jwtDecode

const Transit = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code'); // Get the authorization code from the URL
    const error = params.get('error'); // Check for errors
    console.log('this is the code: ',code);

    // If there's an error (login failure), handle it
    if (error) {
      console.error('Login failed:', error);
      return;
    }
  
    if (code) {
      // Exchange the authorization code for tokens
      const clientId = '4v3dmnjicjlkjka7jft85bgsqf';
      const redirectUri = 'http://localhost:3000/';
      const tokenUrl = `https://n11725575-transcoder.auth.ap-southeast-2.amazoncognito.com/oauth2/token`;
  
      const fetchToken = async () => {
        try {
          console.log('fetching token in transit');
          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              client_id: clientId,
              redirect_uri: redirectUri,
              code: code,
            }),
          });                
          
  
          const responseBody = await response.text();
          
          if (!response.ok) {
            console.error('Error response:', responseBody); // Log error details
            throw new Error('Token exchange failed');
          }
          
          const data = JSON.parse(responseBody);
          const token = data.access_token; // Store the access token
          localStorage.setItem('token', token);

          // Decode the token to check user groups
          const decodedToken = jwtDecode(token);
          const userGroups = decodedToken['cognito:groups'] || [];
  
          if (userGroups.includes('Admins')) {
            navigate('/dashboard');
          }
          else{
            navigate('/main');
          }
        } catch (error) {
          console.error('Token exchange failed:', error);
          console.log('error yang catch');
        }
      };
  
      fetchToken();
    } else {
      // No code in the URL, check if the token is stored locally
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login'); // Redirect to login if there's no token or code
      } else {
        // Decode the token to check user groups
        const decodedToken = jwtDecode(token);
        const userGroups = decodedToken['cognito:groups'] || [];
  
        // Redirect based on the user's group
        if (userGroups.includes('Admins')) {
          navigate('/dashboard');
        }
        else{
            navigate('/main');
          }
      }
    }
  }, [navigate]);
  
  return (
    <Container maxWidth="md">
      <Typography variant="body1">LOADING...</Typography>
    </Container>
  );
};

export default Transit;
