require("dotenv").config();
const {
  DynamoDBClient,
  ListTablesCommand,
  CreateTableCommand,
} = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const qutUsername = "n11725575@qut.edu.au";
const metadataTableName = "n11725575-video-metadata_v2"; //
const journalTableName = "n11725575-journal"; //

const dynamoClient = new DynamoDBClient({ region: "ap-southeast-2" });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

async function createMetadataTable() {
  try {
    // Check if the table already exists
    const tableExists = await checkIfTableExists(metadataTableName);

    if (tableExists) {
      console.log(`Table ${metadataTableName} already exists. Skipping creation.`);
      return;
    }

    // Define table schema and properties
    const createTableCommand = new CreateTableCommand({
      TableName: metadataTableName,
      AttributeDefinitions: [
        { AttributeName: "qut-username", AttributeType: "S" }, // Partition Key (HASH)
        { AttributeName: "filename", AttributeType: "S" }, // Sort Key (RANGE)
      ],
      KeySchema: [
        { AttributeName: "qut-username", KeyType: "HASH" }, // Partition key
        { AttributeName: "filename", KeyType: "RANGE" }, // Sort key
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    });

    // Send the create table command
    const response = await dynamoClient.send(createTableCommand);
    console.log("Create Table command response:", response);
  } catch (error) {
    console.error("Error creating DynamoDB table:", error);
  }
}

async function createJournalTable() {
  try {
    // Define table schema and properties
    const createTableCommand = new CreateTableCommand({
      TableName: journalTableName,
      AttributeDefinitions: [
        { AttributeName: "qut-username", AttributeType: "S" }, // Partition Key (HASH)
        { AttributeName: "Filename", AttributeType: "S" }, // Sort Key (RANGE)
      ],
      KeySchema: [
        { AttributeName: "qut-username", KeyType: "HASH" }, // Partition key
        { AttributeName: "Filename", KeyType: "RANGE" }, // Sort key
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    });

    // Send the create table command
    const response = await dynamoClient.send(createTableCommand);
    console.log("Create Table command response:", response);
  } catch (error) {
    console.error("Error creating DynamoDB table:", error);
  }
}

// Check if the table exists before creating it
async function checkIfTableExists(metadataTableName) {
  try {
    const listTablesCommand = new ListTablesCommand({});
    const tables = await dynamoClient.send(listTablesCommand);

    return tables.TableNames.includes(metadataTableName);
  } catch (error) {
    console.error("Error checking for table existence:", error);
    return false;
  }
}

// Helper function to write to DynamoDB
async function writeToDynamoDB(item) {
  return docClient.send(
    new PutCommand({
      TableName: metadataTableName,
      Item: item,
    })
  );
}

async function writeToJournal(item) {
  return docClient.send(
    new PutCommand({
      TableName: journalTableName,
      Item: item,
    })
  );
}
module.exports = {
  createMetadataTable,
  createJournalTable,
  writeToDynamoDB,
  writeToJournal,
};
