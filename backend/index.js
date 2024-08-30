// Backend code

// Required modules
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg'); // For transcoding
const ffprobe = require('ffprobe-static');
const path = require('path');
const fs = require('fs-extra');
ffmpeg.setFfprobePath(ffprobe.path);

const app = express();
const PORT = 5000;
const SECRET_KEY = 'my_key';

app.use(cors());
app.use(express.json());

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
    const tokenjwt = req.headers['authorization'];
    const token = tokenjwt?.split(" ")[1]; // Using optional chaining to avoid errors
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
    const users = JSON.parse(fs.readFileSync('users.json'));

    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        const token = jwt.sign({ email: user.email }, SECRET_KEY, { expiresIn: '1h' });
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
        const baseName = path.basename(file.originalname, path.extname(file.originalname));
        const extName = path.extname(file.originalname);
        const userEmail = req.user ? req.user.email : 'unknown';
        const newFileName = `${baseName}_${userEmail}${extName}`;
        cb(null, newFileName);
    }
});

const upload = multer({ storage });
const metadataFilePath = path.join(__dirname, 'metadata.json');
const transcodingProgress = {};

app.post('/api/upload', authenticateToken, upload.single('video'), (req, res) => {
    const originalFileName = req.file.originalname;
    const userEmail = req.user.email;
    const newFileName = `${path.basename(originalFileName, path.extname(originalFileName))}_${userEmail}${path.extname(originalFileName)}`;
    const filePath = req.file.path;
    const outputFilePath = `transcoded/${path.basename(newFileName, path.extname(newFileName))}_transcoded.mp4`;

    transcodingProgress[userEmail] = 0; // Initialize progress

    ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
            console.error('Error retrieving video metadata:', err);
            return res.status(500).send('Error retrieving video metadata');
        }

        const durationInSeconds = metadata.format.duration;

        ffmpeg(filePath)
            .setFfmpegPath(require('ffmpeg-static'))
            .output(outputFilePath)
            .on('progress', (progress) => {
                if (progress.timemark) {
                    const [hours, minutes, seconds] = progress.timemark.split(':').map(parseFloat);
                    const currentTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
                    const percentCompleted = (currentTimeInSeconds / durationInSeconds) * 100;
                    //console.log(percentCompleted,'%');
                    transcodingProgress[userEmail] = percentCompleted.toFixed(2);
                }
            })
            .on('end', async () => {
                transcodingProgress[userEmail] = 100;

                const stats = await fs.stat(outputFilePath);
                const newMetadata = {
                    filename: path.basename(outputFilePath),
                    datetime: new Date().toISOString(),
                    size: stats.size,
                    email: req.user.email,
                };

                let metadata = [];
                if (fs.existsSync(metadataFilePath)) {
                    metadata = JSON.parse(await fs.readFile(metadataFilePath, 'utf8'));
                }
                metadata = metadata.filter(item => !(item.email === req.user.email && item.filename.includes(path.basename(originalFileName, path.extname(originalFileName)))));
                metadata.push(newMetadata);
                await fs.writeFile(metadataFilePath, JSON.stringify(metadata, null, 2));

                res.json({ message: 'Video transcoded successfully', filePath: outputFilePath });
            })
            .on('error', (err) => {
                console.error('Error transcoding video:', err);
                transcodingProgress[userEmail] = -1; // Mark as error
                res.status(500).send('Error transcoding video');
            })
            .run();
    });
});

app.get('/api/progress', authenticateToken, (req, res) => {
    const userEmail = req.user.email;
    const progress = transcodingProgress[userEmail] || 0;
    //console.log('current progress: ',transcodingProgress);
    res.json({ progress });
});

app.get('/api/videos', authenticateToken, async (req, res) => {
    const userEmail = req.user.email;
    try {
        const metadata = fs.existsSync(metadataFilePath) ? await fs.readJson(metadataFilePath) : [];
        const userVideos = metadata.filter(entry => entry.email === userEmail)
            .map(entry => ({
                name: entry.filename.replace(/(\.[\w\d_-]+)$/i, '.mp4'),
                url: `/transcoded/${entry.filename.replace(/(\.[\w\d_-]+)$/i, '.mp4')}`
            }));

        res.json(userVideos);
    } catch (err) {
        console.error('Error reading metadata file:', err);
        res.status(500).send('Error retrieving videos');
    }
});

app.get('/api/download/:filename', authenticateToken, (req, res) => {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'transcoded', filename);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`File not found: ${filePath}`);
            return res.status(404).send('File not found');
        }

        res.download(filePath, (err) => {
            if (err) {
                console.error(`Error sending file: ${err.message}`);
                res.status(500).send('Error downloading file');
            }
        });
    });
});
