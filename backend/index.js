// Required modules
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const jwkToPem = require('jwk-to-pem');
const AWS = require('aws-sdk');
SecretsManager = require("@aws-sdk/client-secrets-manager");

let fetch;
(async () => {
    fetch = (await import('node-fetch')).default;
})();

const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg'); // For transcoding
const ffprobe = require('ffprobe-static');
const path = require('path');
const fs = require('fs-extra');
ffmpeg.setFfprobePath(ffprobe.path);


// Initialize AWS services
AWS.config.update({ region: 'ap-southeast-2' });
const ssm = new AWS.SSM();
const s3 = new AWS.S3();

// Function to get parameters from AWS SSM Parameter Store
async function getParameters() {
    const params = {
        Names: [
            '/n11725575/transcoder/user_pool_id',
            '/n11725575/transcoder/api_url',
            '/n11725575/transcoder/bucket_name',
            '/n11725575/transcoder/journal_table_name',
            '/n11725575/transcoder/metadata_table_name'
        ],
        WithDecryption: true // If parameters are encrypted
    };

    try {
        const result = await ssm.getParameters(params).promise();
        const parameters = {};
        result.Parameters.forEach(param => {
            parameters[param.Name] = param.Value;
        });
        return parameters;
    } catch (error) {
        console.error("Error fetching parameters from SSM:", error);
        throw new Error("Could not retrieve parameters");
    }
}

// Use the fetched parameters in the application
let UserPoolId, apiUrl, bucketName, journalTableName, metadataTableName;

(async () => {
    try {
        const parameters = await getParameters();
        UserPoolId = parameters['/n11725575/transcoder/user_pool_id'];
        apiUrl = parameters['/n11725575/transcoder/api_url'];
        bucketName = parameters['/n11725575/transcoder/bucket_name'];
        journalTableName = parameters['/n11725575/transcoder/journal_table_name'];
        metadataTableName = parameters['/n11725575/transcoder/metadata_table_name'];

        console.log("Parameters loaded successfully");
        console.log(apiUrl);
    } catch (error) {
        console.error("Failed to initialize parameters", error);
    }
})();



// Initialize AWS Cognito with credentials from environment variables
const cognito = new AWS.CognitoIdentityServiceProvider({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN, 
    region: 'ap-southeast-2',
});



const app = express();
const PORT = 5000;

let pems;

app.use(cors());
app.use(express.json());


// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
    if (!pems) {
        // Fetch the JWKs and convert them to PEM format using fetch
        const response = await fetch('https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_BNpSd0vkp/.well-known/jwks.json');
        if (!response.ok) {
            return res.status(500).send('Failed to fetch JWKs');
        }
        const data = await response.json();

        pems = {};
        data.keys.forEach((key) => {
            pems[key.kid] = jwkToPem(key);
        });
    }

    const tokenjwt = req.headers['authorization'];
    const token = tokenjwt?.split(' ')[1]; // Extract the token from the "Bearer" format
    if (!token) return res.sendStatus(401); // No token provided

    const decodedJwt = jwt.decode(token, { complete: true });
    if (!decodedJwt) {
        return res.status(401).send('Not a valid JWT token');
    }

    const pem = pems[decodedJwt.header.kid]; // Get the PEM for this token's kid
    if (!pem) {
        return res.status(401).send('Invalid token');
    }

    jwt.verify(token, pem, (err, payload) => {
        if (err) {
            return res.status(401).send('Invalid token');
        } else {
            req.user = payload;

            // Log the payload to see all claims
            //console.log("Decoded JWT Payload:", payload);

            // Extract user groups from the token if available
            const userGroups = payload['cognito:groups'] || [];
            req.user.groups = userGroups;

            next();
        }
    });
};

// Serve static files (videos)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/transcoded', express.static(path.join(__dirname, 'transcoded')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


// ============================== run S3 bucket operations ==============================
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
} = require("@aws-sdk/client-s3");
ffmpeg.setFfprobePath(ffprobe.path);
const { createS3Bucket, uploadToS3 } = require("./S3BucketOperations");
//const bucketName = "n11725575-transcoder";
const s3Client = new S3Client({ region: "ap-southeast-2", logger: console });
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Call the function to create S3 bucket
(async () => {
    await createS3Bucket();
})();

// ============================== run dynamoDB operations ==============================
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
    DynamoDBDocumentClient,
    QueryCommand: DocQueryCommand,
    ScanCommand,
    UpdateCommand,
    DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
    createMetadataTable,
    writeToDynamoDB,
    createJournalTable,
    writeToJournal,
} = require("./DynamoDBOperations");

const { checkJournal } = require("./checkJournal");
const qutUsername = "n11725575@qut.edu.au";
//const tableName = "n11725575-video-metadata_v2";
//const journalTableName = "n11725575-journal"; //

const dynamoClient = new DynamoDBClient({ region: "ap-southeast-2" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
(async () => {
    await createMetadataTable();
})();

(async () => {
    await createJournalTable();
})();

(async () => {
    await checkJournal();
})();



// ============================== ADMIN: GET USERS ========================================
// Fetch list of users from AWS Cognito
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    console.log('authentication succeeded, fetching users data');
    const params = {
        UserPoolId: UserPoolId,
        Limit: 10, // Adjust the limit as needed
    };

    try {
        const data = await cognito.listUsers(params).promise();
        res.json(data.Users);
    } catch (error) {
        console.error('Error fetching users from Cognito:', error);
        res.status(500).send('Failed to fetch users');
    }
});




// ============================== ADMIN: GET VIDEOS ========================================
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    // Ensure the user is an Admin
    if (!req.user.groups || !req.user.groups.includes('Admins')) {
        return res.sendStatus(403);
    }

    try {
        // Scan DynamoDB to retrieve all video metadata
        const dynamoResponse = await docClient.send(
            new ScanCommand({
                TableName: "n11725575-video-metadata_v2", // Replace with your actual table name
                ProjectionExpression: "#username, filename, #uploadedDate, size, #s3Path",
                ExpressionAttributeNames: {
                    "#username": "username",           // DynamoDB attribute for username
                    "#uploadedDate": "uploaded-date",  // DynamoDB attribute for uploaded date
                    "#s3Path": "original s3-path"      // DynamoDB attribute for S3 path
                }
            })
        );

        // Create an empty stats object to store counts by date
        const stats = {};

        // Process each item returned from DynamoDB
        dynamoResponse.Items.forEach(item => {
            const uploadedDate = item['uploaded-date']; // Get the uploaded date
            const date = uploadedDate.split('T')[0];   // Extract just the date part (YYYY-MM-DD)

            // Increment count for the specific date
            if (stats[date]) {
                stats[date]++;
            } else {
                stats[date] = 1;
            }
        });

        // Return the stats as a JSON object
        res.json(stats);
    } catch (err) {
        console.error("Error retrieving video metadata from DynamoDB:", err);
        res.status(500).send("Error retrieving video stats");
    }
});





// ============================== UPLOAD & TRANSCODE ========================================

const upload = multer({ storage: multer.memoryStorage() });

const transcodingProgress = {};

app.post(
    "/api/upload",
    authenticateToken,
    upload.single("video"),
    async (req, res) => {
        if (!req.file || !req.file.originalname) {
            return res.status(400).send("No file uploaded or file name is missing");
        }

        //CREATE NEW FILENAME

        const originalFileName = req.file.originalname;
        const username = req.user.username;
        const newFileName = `${path.basename(
            originalFileName,
            path.extname(originalFileName)
        )}_${username}${path.extname(originalFileName)}`;

        transcodingProgress[username] = 0; // Initialize progress

        //WRITE JOURNAL ENTRY

        async function createJournalEntry(newFileName) {
            const journalEntry = {
                "qut-username": qutUsername,
                Filename: newFileName,
                StartTime: new Date().toISOString(), // or format it as required
                UploadStatus: "Pending",
                OriginalMetadataStatus: "Pending",
                TranscodeStatus: "Pending",
                TranscodedMetadataStatus: "Pending",

                username: username,
            };

            await writeToJournal(journalEntry);
        }

        (async () => {
            await createJournalEntry(newFileName);
        })();

        try {
            // Upload original video to S3
            await uploadToS3(
                bucketName,
                `uploads/${newFileName}`,
                req.file.buffer,
                req.file.mimetype
            );
            console.log("Original video uploaded to S3 successfully");

            // Function to update the journal entry status
            async function updateJournalEntry(qutUsername, filename, stage, status) {
                await docClient.send(
                    new UpdateCommand({
                        TableName: journalTableName,
                        Key: {
                            "qut-username": qutUsername,
                            Filename: filename,
                        },
                        UpdateExpression: `SET ${stage} = :status`,
                        ExpressionAttributeValues: {
                            ":status": status,
                        },
                    })
                );
            }
            await updateJournalEntry(
                qutUsername,
                newFileName,
                "UploadStatus",
                "Completed"
            );

            // Retrieve the object's metadata to get the LastModified date to store in DB
            const headResponse = await s3Client.send(
                new HeadObjectCommand({
                    Bucket: bucketName,
                    Key: `uploads/${newFileName}`,
                })
            );
            const uploadedDate = headResponse.LastModified;

            // Generate a presigned URL for the uploaded video to use for transcoding process
            const presignedUrl = await getSignedUrl(
                s3Client,
                new GetObjectCommand({
                    Bucket: bucketName,
                    Key: `uploads/${newFileName}`,
                    ExpiresIn: 3600, // URL valid for 1 hour
                })
            );

            //write original video metadata to db
            try {
                await writeToDynamoDB({
                    "qut-username": qutUsername,
                    username: username,
                    filename: newFileName,
                    "uploaded-date": uploadedDate.toISOString(),
                    size: req.file.size,
                    "original s3-path": `uploads/${newFileName}`,
                });
                console.log("Original video metadata written to DynamoDB");
            } catch (error) {
                console.error(
                    "Error writing original video metadata to DynamoDB:",
                    error
                );
            }

            await updateJournalEntry(
                qutUsername,
                newFileName,
                "OriginalMetadataStatus",
                "Completed"
            );

            // Fetch metadata from the presigned URL
            ffmpeg.ffprobe(presignedUrl, async (err, metadata) => {
                if (err) {
                    console.error("Error getting video metadata:", err);
                    return res.status(500).send("Error getting video metadata");
                }

                // Extract duration in seconds from metadata to track transcoding progress
                const durationInSeconds = metadata.format.duration;

                // filename format for the transcoded video
                const transcodedFileName = `${path.basename(
                    newFileName,
                    path.extname(newFileName)
                )}_transcoded.mp4`;

                // Transcode the video using the uploaded presigned URL
                const ffmpegProcess = ffmpeg(presignedUrl)
                    .setFfmpegPath(require("ffmpeg-static"))
                    .outputOptions("-movflags", "faststart") // Optimize for streaming
                    .output(`./temp/${transcodedFileName}`)
                    .on("progress", (progress) => {
                        if (progress.timemark) {
                            const [hours, minutes, seconds] = progress.timemark
                                .split(":")
                                .map(parseFloat);
                            const currentTimeInSeconds =
                                hours * 3600 + minutes * 60 + seconds;
                            const percentCompleted =
                                (currentTimeInSeconds / durationInSeconds) * 100;
                            console.log(percentCompleted, "%");
                            transcodingProgress[username] = percentCompleted.toFixed(2);
                        }
                    })
                    .on("end", async () => {
                        transcodingProgress[username] = 100;

                        try {
                            const transcodedBuffer = await fs.promises.readFile(
                                `./temp/${transcodedFileName}`
                            );
                            // Upload transcoded video to S3
                            await uploadToS3(
                                bucketName,
                                `transcoded/${transcodedFileName}`,
                                transcodedBuffer,
                                "video/mp4"
                            );
                            console.log("Transcoded video uploaded to S3 successfully");

                            await updateJournalEntry(
                                qutUsername,
                                newFileName,
                                "TranscodeStatus",
                                "Completed"
                            );

                            //generate presigned url for transcoded video

                            const transcodedPresignedUrl = await getSignedUrl(
                                s3Client,
                                new GetObjectCommand({
                                    Bucket: bucketName,
                                    Key: `transcoded/${transcodedFileName}`,
                                    ExpiresIn: 3600,
                                })
                            );

                            // Retrieve transcoded metadata
                            const transcodedHeadResponse = await s3Client.send(
                                new HeadObjectCommand({
                                    Bucket: bucketName,
                                    Key: `transcoded/${transcodedFileName}`,
                                })
                            );

                            const transcodedUploadedDate =
                                transcodedHeadResponse.LastModified;

                            // Write transcoded video metadata
                            await writeToDynamoDB({
                                "qut-username": qutUsername,
                                username: username,
                                filename: transcodedFileName,
                                "uploaded-date": transcodedUploadedDate.toISOString(),
                                size: transcodedBuffer.length, // Use the correct size
                                "s3-path": `transcoded/${transcodedFileName}`,
                            });

                            await updateJournalEntry(
                                qutUsername,
                                newFileName,
                                "TranscodedMetadataStatus",
                                "Completed"
                            );

                            // Delete the journal entry from DynamoDB
                            await docClient.send(
                                new DeleteCommand({
                                    TableName: journalTableName,
                                    Key: {
                                        "qut-username": qutUsername,
                                        Filename: transcodedFileName,
                                    },
                                })
                            );
                            console.log(
                                `Journal entry for ${transcodedFileName} deleted successfully.`
                            );

                            // Respond with the S3 path of the transcoded file
                            return res.json({
                                message: "Video transcoded successfully",
                                originalFilePath: `s3://${bucketName}/uploads/${newFileName}`,
                                transcodedFilePath: `s3://${bucketName}/transcoded/${transcodedFileName}`,
                                transcodedPresignedUrl,
                            });
                        } catch (uploadErr) {
                            console.error(
                                "Error uploading transcoded video to S3:",
                                uploadErr
                            );
                            transcodingProgress[username] = -1; // Mark as error
                            return res.status(500).send("Error uploading transcoded video");
                        }
                    })
                    .on("error", (transcodeErr) => {
                        console.error("Error transcoding video:", transcodeErr);
                        transcodingProgress[username] = -1; // Mark as error
                        return res.status(500).send("Error transcoding video");
                    })
                    .run();
            });
        } catch (err) {
            console.error("Error uploading original video to S3:", err);
            res.status(500).send("Error uploading original video");
        }
    }
);

// -----------------------progress---------------------------
app.get("/api/progress", authenticateToken, (req, res) => {
    const username = req.user.username;
    const progress = transcodingProgress[username] || 0;
    console.log("current progress: ", transcodingProgress);
    res.json({ progress });
});

// ----------------------- Endpoint to fetch the apiUrl from the AWS Parameter Store -----------------------
app.get('/api/get-api-url', async (req, res) => {
    try {
      // Fetch the apiUrl from the Parameter Store
      const parameter = await ssm
        .getParameter({
          Name: '/n11725575/transcoder/api_url', // The name of your parameter in the Parameter Store  '/n11725575/transcoder/api_url'
          WithDecryption: true, // If the parameter is encrypted, set this to true
        })
        .promise();
  
      const apiUrl = parameter.Parameter.Value; // Get the apiUrl value
      res.json({ apiUrl }); // Send the apiUrl to the frontend
    } catch (error) {
      console.error('Error fetching apiUrl:', error);
      res.status(500).json({ error: 'Failed to fetch API URL' });
    }
  });

//---------------------GET ALL VIDEOS BY USER----------

app.get("/api/videos", authenticateToken, async (req, res) => {
    const username = req.user.username;


    try {
        // Scan DynamoDB to get the metadata of videos belonging to the user
        const dynamoResponse = await docClient.send(
            new ScanCommand({
                TableName: metadataTableName, // Your DynamoDB table name
                FilterExpression: "#username = :usernameValue",
                ExpressionAttributeNames: {
                    "#username": "username", // The attribute name in your table
                },
                ExpressionAttributeValues: {
                    ":usernameValue": username, // The  value to filter by
                },
            })
        );

        // Log the retrieved items for debugging
        console.log("DynamoDB Items:", dynamoResponse.Items);

        // Extract video data from the query response
        const userVideos = dynamoResponse.Items.map((item) => ({
            name: item.filename ? item.filename : "Unknown Filename", // Check for existence
            //   url: item["s3-path"]
            //     ? `https://${bucketName}.s3.amazonaws.com/${item["s3-path"]}`
            //     : "Unknown URL", // Check for existence
        }));

        // Send the list of user videos to the frontend
        res.json(userVideos);
    } catch (err) {
        console.error("Error retrieving video metadata from DynamoDB:", err);
        res.status(500).send("Error retrieving videos");
    }
});



app.get("/api/download/:filename", authenticateToken, async (req, res) => {
    const { filename } = req.params;

    // Create S3 params for generating the signed URL
    const params = {
        Bucket: bucketName, // Your S3 bucket name
        Key: `transcoded/${filename}`, // Assuming the filename is directly in the root of the bucket
        Expires: 60 // The URL will be valid for 60 seconds
    };

    try {
        // Generate a signed URL for the file
        const url = await s3.getSignedUrlPromise("getObject", params);

        // Respond with the signed URL
        res.json({ url });
    } catch (error) {
        console.error("Error generating signed URL:", error);
        res.status(500).send("Error generating download link");
    }
});




