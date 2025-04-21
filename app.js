const express = require('express');
const https = require('https');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable parsing of JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb+srv://shareenpan2:Fgouter55@cluster0.s3dpu.mongodb.net/reverseproxy?retryWrites=true&w=majority&appName=Cluster0', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define a schema and model for your data
const DataSchema = new mongoose.Schema({
    // Define your schema fields here
    // Example: name: String, email: String
});

const DataModel = mongoose.model('Data', DataSchema);

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Middleware to handle dynamic routing with proper error handling and timeouts
app.use((req, res, next) => {
    const path = req.path;
    const options = {
        hostname: 'app.khantoolsprovider.com',
        port: 443,
        path: path,
        method: req.method,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        }
    };

    // Add request headers from original request
    Object.assign(options.headers, req.headers);
    delete options.headers.host; // Remove host header to avoid conflicts

    const request = https.request(options, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            return res.redirect(response.headers.location);
        }

        // Copy response headers
        Object.entries(response.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        res.status(response.statusCode);

        const chunks = [];
        response.on('data', (chunk) => {
            chunks.push(chunk);
        });

        response.on('end', () => {
            const body = Buffer.concat(chunks);
            res.send(body);
        });
    });

    // Set timeout to avoid hanging requests
    request.setTimeout(50000, () => {
        request.destroy();
        res.status(504).send('Gateway Timeout');
    });

    request.on('error', (err) => {
        console.error('Error:', err);
        if (!res.headersSent) {
            res.status(502).send('Bad Gateway');
        }
    });

    // Pipe request body if present
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        req.pipe(request);
        
        // Save data to MongoDB
        req.on('data', (data) => {
            const newData = new DataModel(JSON.parse(data));
            newData.save()
                .then(() => console.log('Data saved to MongoDB'))
                .catch(err => console.error('Error saving data:', err));
        });
    } else {
        request.end();
    }
});

// Start server with error handling
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}).on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});
