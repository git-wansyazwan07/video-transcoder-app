require("dotenv").config();
const {
  DynamoDBDocumentClient,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { writeToDynamoDB } = require("./DynamoDBOperations"); // Import the function to write metadata
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const dynamoClient = new DynamoDBClient({ region: "ap-southeast-2" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const s3Client = new S3Client({ region: "ap-southeast-2" });
const ffmpeg = require("fluent-ffmpeg"); // For transcoding
const ffprobe = require("ffprobe-static");
ffmpeg.setFfprobePath(ffprobe.path);

const qutUsername = "n11725575@qut.edu.au";
const journalTableName = "n11725575-journal";
const bucketName = "your-s3-bucket"; // Replace with your S3 bucket name

// Function to check the journal
async function checkJournal() {
  try {
    // Query the DynamoDB journal table for entries with pending status
    const journalEntries = await docClient.send(
      new QueryCommand({
        TableName: journalTableName,
        KeyConditionExpression: "#partitionKey = :username",
        ExpressionAttributeNames: {
          "#partitionKey": "qut-username",
        },
        ExpressionAttributeValues: {
          ":username": qutUsername,
        },
      })
    );

    for (const entry of journalEntries.Items) {
      const {
        Filename,
        email,
        UploadStatus,
        OriginalMetadataStatus,
        TranscodeStatus,
        TranscodedMetadataStatus,
      } = entry;

      if (OriginalMetadataStatus === "Pending") {
        await handleOriginalMetadata(entry);
      }

      if (TranscodeStatus === "Pending") {
        await handleTranscode(entry);
      }

      if (TranscodedMetadataStatus === "Pending") {
        await handleTranscodedMetadata(entry);
      }

      // If all statuses are completed, delete the journal entry
      const allStatusesCompleted =
        OriginalMetadataStatus === "Completed" &&
        TranscodeStatus === "Completed" &&
        TranscodedMetadataStatus === "Completed" &&
        UploadStatus === "Completed";

      if (allStatusesCompleted || UploadStatus === "Pending") {
        console.log(
          `All statuses completed for file: ${Filename}. Deleting journal entry.`
        );

        // Delete the journal entry from DynamoDB
        await docClient.send(
          new DeleteCommand({
            TableName: journalTableName,
            Key: {
              "qut-username": qutUsername,
              Filename: Filename,
            },
          })
        );
        console.log(`Journal entry for ${Filename} deleted successfully.`);
      }
    }
  } catch (error) {
    console.error("Error checking journal:", error);
  }
}

// Function to handle pending original metadata
async function handleOriginalMetadata(entry) {
  const { Filename, email } = entry;

  try {
    // Use HeadObjectCommand to get metadata about the file (e.g., size, upload date)
    const headObjectCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: `uploads/${Filename}`,
    });
    const metadata = await s3Client.send(headObjectCommand);
    const fileSize = metadata.ContentLength;
    const uploadedDate = metadata.LastModified;

    // Write metadata to DynamoDB
    await writeToDynamoDB({
      "qut-username": qutUsername,
      email: email, // Replace with actual user email
      filename: Filename,
      "uploaded-date": uploadedDate.toISOString(),
      size: fileSize,
      "original s3-path": `uploads/${Filename}`,
    });

    console.log("Original video metadata written to DynamoDB");

    // Update the journal to mark OriginalMetadataStatus as completed
    await updateJournalStatus(Filename, "OriginalMetadataStatus", "Completed");
  } catch (error) {
    console.error("Error handling original metadata:", error);
  }
}

// Function to handle pending transcoding
const transcodingProgress = {};

async function handleTranscode(entry) {
  const { Filename, email } = entry; // Ensure newFileName is available

  try {
    const presignedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: `uploads/${Filename}`,
        ExpiresIn: 3600, // URL valid for 1 hour
      })
    );

    // Call your transcoding function here with the videoStream
    console.log("Starting transcoding process...");

    // Fetch metadata from the presigned URL
    ffmpeg.ffprobe(presignedUrl, async (err, metadata) => {
      if (err) {
        console.error("Error getting video metadata:", err);
        return;
      }

      // Extract duration in seconds from metadata to track transcoding progress
      const durationInSeconds = metadata.format.duration;

      // filename format for the transcoded video
      const transcodedFileName = `${path.basename(
        Filename,
        path.extname(Filename)
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
            const currentTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
            const percentCompleted =
              (currentTimeInSeconds / durationInSeconds) * 100;
            console.log(percentCompleted, "%");
            transcodingProgress[userEmail] = percentCompleted.toFixed(2);
          }
        })
        .on("end", async () => {
          transcodingProgress[email] = 100;

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

            // After transcoding, update the journal status
            await updateJournalStatus(Filename, "TranscodeStatus", "Completed");

            // Clean up temporary file
            await fs.promises.unlink(`./temp/${transcodedFileName}`);
            console.log("Temporary transcoded file deleted.");
          } catch (error) {
            console.error(
              "Error during transcoded video upload or cleanup:",
              error
            );
          }
        })
        .on("error", (error) => {
          console.error("Error during transcoding:", error);
        });

      // Start the transcoding process
      ffmpegProcess.run();
    });
  } catch (error) {
    console.error("Error handling transcoding:", error);
  }
}

// Function to handle pending transcoded metadata
async function handleTranscodedMetadata(entry) {
  const { Filename, email, qutUsername, transcodedFileName } = entry;

  try {
    // Check that transcodedFileName is provided
    if (!transcodedFileName) {
      throw new Error("Transcoded file name is missing.");
    }

    // Retrieve transcoded metadata from S3
    const transcodedHeadResponse = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: `transcoded/${transcodedFileName}`,
      })
    );

    // Get the upload date and file size from the S3 response
    const transcodedUploadedDate = transcodedHeadResponse.LastModified;
    const transcodedFileSize = transcodedHeadResponse.ContentLength; // Size in bytes

    // Write transcoded video metadata to DynamoDB
    await writeToDynamoDB({
      "qut-username": qutUsername, // Ensure qutUsername is provided
      email: email,
      filename: transcodedFileName,
      "uploaded-date": transcodedUploadedDate.toISOString(),
      size: transcodedFileSize, // Correct size from S3 response
      "s3-path": `transcoded/${transcodedFileName}`,
    });

    // After writing metadata, update the journal status
    await updateJournalStatus(
      Filename,
      "TranscodedMetadataStatus",
      "Completed"
    );
  } catch (error) {
    console.error("Error handling transcoded metadata:", error);
  }
}

// Helper function to update the journal status
async function updateJournalStatus(filename, statusColumn, status) {
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: journalTableName,
        Key: {
          "qut-username": qutUsername,
          Filename: filename,
        },
        UpdateExpression: `SET ${statusColumn} = :status`,
        ExpressionAttributeValues: {
          ":status": status,
        },
      })
    );
    console.log(`${statusColumn} updated to ${status}`);
  } catch (error) {
    console.error("Error updating journal status:", error);
  }
}

// Export the checkJournal function
module.exports = { checkJournal };
