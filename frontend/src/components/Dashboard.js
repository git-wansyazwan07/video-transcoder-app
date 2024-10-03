import React, { useEffect, useState, useContext } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart, CategoryScale, LinearScale, LineElement, PointElement, Title } from 'chart.js';
import Navbar from './Navbar';
import { jwtDecode } from 'jwt-decode'; // Correct import
import { ApiUrlContext } from './ApiUrlContext'; // Import the context
import { useNavigate } from 'react-router-dom';

// Register the required components
Chart.register(CategoryScale, LinearScale, LineElement, PointElement, Title);

const Dashboard = () => {
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({});
    const navigate = useNavigate();

    // Access the apiUrl from the context
    const apiUrl = useContext(ApiUrlContext);

    useEffect(() => {
        const fetchData = async () => {
            console.log(apiUrl);
            if (!apiUrl) {
                console.log('API URL is not yet available');
                return;
            }

            try {
                // Get the token from local storage
                const token = localStorage.getItem('token');
                
                // If no token, redirect to login
                if (!token) {
                    console.log("No token found");
                    navigate('/login');
                    return;
                }

                // Decode the token to get user information
                const decodedToken = jwtDecode(token);
                console.log("Decoded Token: ", decodedToken);

                // Check if the user is an admin
                if (!decodedToken['cognito:groups'] || !decodedToken['cognito:groups'].includes('Admins')) {
                    alert('Unauthorized: Admin access only');
                    navigate('/main');
                    return;
                }

                // Fetch users and stats from backend API using the apiUrl
                const usersResponse = await fetch(`${apiUrl}/api/admin/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const statsResponse = await fetch(`${apiUrl}/api/admin/stats`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setUsers(await usersResponse.json());
                setStats(await statsResponse.json());
            } catch (error) {
                console.error("Error fetching admin data: ", error);
                alert('Error fetching data');
                navigate('/login');
            }
        };

        fetchData();
    }, [apiUrl, navigate]); // Add apiUrl as a dependency

    // Create a full date range from the first date to the last date in the stats
    const generateDateRange = (startDate, endDate) => {
        const dates = [];
        let currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
            dates.push(currentDate.toISOString().split('T')[0]); // Format as YYYY-MM-DD
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return dates;
    };

    // Determine the start and end dates based on stats
    const dates = Object.keys(stats);
    const startDate = dates.length > 0 ? Math.min(...dates.map(date => new Date(date))) : new Date();
    const endDate = dates.length > 0 ? Math.max(...dates.map(date => new Date(date))) : new Date();
    const fullDateRange = generateDateRange(startDate, endDate);

    // Map the stats to the full date range, filling in missing dates with 0
    const processedData = fullDateRange.map((date) => ({
        date,
        value: stats[date] || 0 // If no value exists for the date, set it to 0
    }));

    const chartData = {
        labels: processedData.map(item => item.date),
        datasets: [
            {
                label: 'Number of Transcoded Videos',
                data: processedData.map(item => item.value),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                fill: true,
                tension: 0,
            },
        ],
    };

    const userCount = users.length;
    const videoCount = Object.values(stats).reduce((a, b) => a + b, 0);

    return (
        <div>
            <Navbar />
            <h2>Dashboard</h2>

            <div>
                <h4>Total Users: {userCount}</h4>
                <h4>Total Videos: {videoCount}</h4>
            </div>
            <h3>Video Transcoded By Date</h3>
            <Line data={chartData} />
        </div>
    );
};

export default Dashboard;
