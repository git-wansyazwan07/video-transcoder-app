const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg'); // For transcoding
const path = require('path');
const fs = require('fs-extra');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'my_key';

app.use(cors());
app.use(express.json());

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    const tokenjwt = req.headers['authorization'];
    const token = tokenjwt?.split(" ")[1]; // Using optional chaining to avoid errors
    console.log('Authorization Header:', token);  // Debugging line
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            console.error('Token verification failed:', err.message);
            return res.sendStatus(403);
        }

        req.user = user;
        next();
    });
};

// Serve static files (videos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/transcoded', express.static(path.join(__dirname, 'transcoded')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// ============================== LOGIN ========================================
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Read users from users.json file
    const users = JSON.parse(fs.readFileSync('users.json'));

    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: '1h' });
        console.log("token from sign in: ", token);
        res.json({ token });
    } else {
        res.status(401).send('Invalid credentials');
    }
});

// ============================== UPLOAD & TRANSCODE ========================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Extract base name and extension
        const baseName = path.basename(file.originalname, path.extname(file.originalname));
        const extName = path.extname(file.originalname);

        // Get the user email from the request (ensure it is set correctly in the request)
        const userEmail = req.user ? req.user.email : 'unknown'; // Fallback to 'unknown' if no user is set

        // Construct the new file name
        const newFileName = `${baseName}_${userEmail}${extName}`;

        // Set the file name
        cb(null, newFileName);
    }
});

const upload = multer({ storage });
const metadataFilePath = path.join(__dirname, 'metadata.json');

// Route to upload and transcode video
app.post('/api/upload', authenticateToken, upload.single('video'), (req, res) => {
    const filePath = req.file.path;
    const userEmail = req.user.email;
    const originalFileName = req.file.originalname;
    // Extract base name and extension
    const baseName = path.basename(originalFileName, path.extname(originalFileName));
    const extName = path.extname(originalFileName);
    // Construct new file name with email and original extension
    const newFileName = `${baseName}_${userEmail}${extName}`;
    //const outputFilePath = `transcoded/${newFileName}`

    //const newFileName = `${path.basename(originalFileName, path.extname(originalFileName))}_${userEmail}`;
    //const newFileName = `${path.basename(originalFileName)+'_'+userEmail+path.extname(originalFileName)`;

    const transcodedFileName = `${baseName}_${userEmail}_transcoded${extName}`;

    const outputFilePath = `transcoded/${transcodedFileName}`;

    ffmpeg(filePath)
        .setFfmpegPath(require('ffmpeg-static'))
        .output(outputFilePath)
        .on('end', async () => {
            // Gather metadata
            try {
                // Gather metadata
                const stats = await fs.stat(outputFilePath);
                const newMetadata = {
                    filename: transcodedFileName,
                    datetime: new Date().toISOString(),
                    size: stats.size,
                    email: req.user.email
                };

                // Read existing metadata
                const metadata = fs.existsSync(metadataFilePath) ? await fs.readJson(metadataFilePath) : [];

                // Remove existing metadata entry with the same filename for the same user
                const updatedMetadata = metadata.filter(entry => !(entry.email === req.user.email && entry.filename === transcodedFileName));

                // Add new metadata
                updatedMetadata.push(newMetadata);

                // Save updated metadata to file
                await fs.writeJson(metadataFilePath, updatedMetadata);

                res.json({ message: 'Video transcoded successfully', filePath: outputFilePath });
            } catch (err) {
                console.error('Error saving metadata:', err);
                res.status(500).send('Error saving metadata');
            }
        })
        .on('error', (err) => {
            console.error(err);
            res.status(500).send('Error transcoding video');
        })
        .run();
});

// =============================== GET TRANSCODED =======================================
// Get all transcoded videos for a user
app.get('/api/videos', authenticateToken, async (req, res) => {
    const userEmail = req.user.email;
    console.log('User Email:', userEmail);

    try {
        // Read and parse metadata file
        const metadata = fs.existsSync(metadataFilePath) ? await fs.readJson(metadataFilePath) : [];

        // Filter metadata for the current user
        const userVideos = metadata.filter(entry => entry.email === userEmail)
            .map(entry => ({
                name: entry.filename.replace(/(\.[\w\d_-]+)$/i, '.mp4'),
                url: `/transcoded/${entry.filename.replace(/(\.[\w\d_-]+)$/i, '.mp4')}`
            }));

        // Return filtered videos
        res.json(userVideos);
    } catch (err) {
        console.error('Error reading metadata file:', err);
        res.status(500).send('Error retrieving videos');
    }
});

// Download a specific transcoded video
app.get('/api/download/:filename', authenticateToken, (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'transcoded', filename);

    // Check if file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File not found: ${filePath}`);
            return res.status(404).send('File not found');
        }

        // Send the file for download
        res.download(filePath, (err) => {
            if (err) {
                console.error(`Error sending file: ${err.message}`);
                res.status(500).send('Error downloading file');
            }
        });
    });
});

