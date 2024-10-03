const {
  S3Client,
  HeadBucketCommand, // Added this import
  CreateBucketCommand,
  PutBucketTaggingCommand,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const fetch = require("node-fetch"); // Node.js does not have fetch natively, install with 'npm install node-fetch'

const bucketName = "n11725575-transcoder";
const qutUsername = "n11725575@qut.edu.au";
const purpose = "assessment";
const objectKey = "myAwesomeObjectKey";
const objectValue = "This could be just about anything.";

async function createS3Bucket() {
  const s3Client = new S3Client({ region: "ap-southeast-2", logger: console });

  // Check if the bucket already exists
  try {
    await s3Client.send(
      new HeadBucketCommand({
        Bucket: bucketName,
      })
    );
    console.log(`Bucket "${bucketName}" already exists, skipping creation.`);
  } catch (err) {
    // Log full error for better debugging
    console.error("Error occurred while checking bucket:", err);

    // Handle 404 error, bucket not found
    if (err.$metadata && err.$metadata.httpStatusCode === 404) {
      try {
        // Create the bucket if not found
        const createBucketCommand = new CreateBucketCommand({
          Bucket: bucketName,
        });
        const createResponse = await s3Client.send(createBucketCommand);
        console.log(`Bucket created: ${createResponse.Location}`);
      } catch (createErr) {
        console.error("Error creating bucket:", createErr);
        return;
      }

      // Apply bucket tags
      try {
        const tagCommand = new PutBucketTaggingCommand({
          Bucket: bucketName,
          Tagging: {
            TagSet: [
              {
                Key: "qut-username",
                Value: qutUsername,
              },
              {
                Key: "purpose",
                Value: purpose,
              },
            ],
          },
        });
        const tagResponse = await s3Client.send(tagCommand);
        console.log("Bucket tagged successfully:", tagResponse);
      } catch (tagErr) {
        console.error("Error tagging bucket:", tagErr);
      }
    } else {
      console.error("Error checking bucket existence:", err);
    }
  }

  // test Upload an object to the bucket
  try {
    const response = await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: objectValue,
      })
    );
    console.log("Object uploaded successfully:", response);
  } catch (err) {
    console.error("Error uploading object:", err);
  }

  // test Read the object back from the bucket
  try {
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      })
    );
    // Convert the object Body into a string
    const str = await response.Body.transformToString();
    console.log("Object read successfully:", str);
  } catch (err) {
    console.error("Error reading object:", err);
  }

  // test Create a pre-signed URL to read the object
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    const presignedURL = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour expiration
    });
    console.log("Pre-signed URL to get the object:", presignedURL);

    // testFetch the object using the pre-signed URL
    const response = await fetch(presignedURL);
    const object = await response.text();
    console.log("Object retrieved with pre-signed URL:", object);
  } catch (err) {
    console.error("Error creating or using pre-signed URL:", err);
  }
}

// Helper function to upload to S3
async function uploadToS3(bucketName, filePath, fileBuffer, mimeType) {
  const s3Client = new S3Client({
    region: "ap-southeast-2",
    logger: console,
  });
  return s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: fileBuffer,
      ContentType: mimeType,
    })
  );
}

module.exports = {
  createS3Bucket,
  uploadToS3,
};
