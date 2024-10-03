import React from 'react';
import { Container, Button, Box } from '@mui/material';
import logo from './../logo2.jpeg'; // Make sure the path is correct

const Login = () => {
    const clientId = '4v3dmnjicjlkjka7jft85bgsqf'; // Your Cognito App Client ID
    const domain = 'n11725575-transcoder.auth.ap-southeast-2.amazoncognito.com';
    const redirectUri = 'http://localhost:3000/';

    // Cognito login URL
    const loginUrl = `https://${domain}/login?client_id=${clientId}&response_type=code&scope=email+openid+profile&redirect_uri=${redirectUri}`;

    const handleCognitoLogin = () => {
        window.location.href = loginUrl; // Redirect to Cognito login
    };

    return (
        <Container 
            maxWidth="xs" 
            sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh'
            }}
        >
            <Box 
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center'
                }}
            >
                {/* Replace text with image */}
                <img 
                    src={logo} 
                    alt="Transcoder App Logo" 
                    style={{ width: '200px', height: 'auto', marginBottom: '20px' }} 
                />
                <Button 
                    variant="contained" 
                    color="primary" 
                    size="large" 
                    onClick={handleCognitoLogin}
                    sx={{ marginTop: 3 }}
                >
                    Log in
                </Button>
            </Box>
        </Container>
    );
};

export default Login;
