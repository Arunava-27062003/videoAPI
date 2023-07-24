const cluster = require('cluster');
const os = require('os');
const http = require('http');

// Load environment variables in the master process
require('dotenv').config();

if (cluster.isMaster) {
  // Get the number of available CPU cores
  const numCPUs = os.cpus().length;

  // Fork worker processes equal to the number of CPU cores
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    // Assign a unique port number to each worker
    worker.send({ type: 'setPort', port: 3000 + i });
  }

  // Handle worker process exit and restart
  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Create a new worker when one dies
  });
} else {
  const express = require('express');
  const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
  const compression = require('compression');

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

  // Start the server on the assigned port
  process.on('message', (message) => {
    if (message.type === 'setPort') {
      const port = message.port;
      app.listen(port, () => {
        console.log(`Worker ${process.pid} is running on http://localhost:${port}`);
      });
    }
  });
}
