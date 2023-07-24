const express = require('express');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const compression = require('compression');
const http = require('http');

dotenv.config();

const app = express();
app.use(compression());

// Set up AWS credentials and region
const s3Client = new S3Client({
  region: process.env.REGION, // Change to your preferred AWS region
  credentials: {
    accessKeyId: process.env.ACCESS_KEY,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
  },
});

// Define the AWS S3 bucket name and the folder where videos are stored
const bucketName = process.env.BUCKET;
const videoFolder = process.env.FOLDER;

// Define the route for streaming the entire video
app.get('/video/:videoKey', async (req, res) => {
  const videoKey = `${videoFolder}/${req.params.videoKey}`;
  const params = { Bucket: bucketName, Key: videoKey };

  try {
    const data = await s3Client.send(new GetObjectCommand(params));

    // Set the appropriate Content-Type header based on video file extension
    const ext = videoKey.split('.').pop().toLowerCase();
    const contentType = ext === 'mp4' ? 'video/mp4' : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });

    // Pipe the entire S3 object data directly to the response stream
    data.Body.pipe(res);
  } catch (err) {
    console.error('Error fetching video:', err.message);
    res.sendStatus(404);
  }
});

// Start the server
const port = 3000; // Change to your preferred port number
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});