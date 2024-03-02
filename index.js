import express from "express";
import mysql from "mysql";
import bodyParser from "body-parser";
import cors from "cors";
import multer from 'multer';
import path, { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import B2 from 'backblaze-b2';
const app = express();
app.use(bodyParser.json());
import crypto from 'crypto';
import { get } from "http";
import { loadImage, createCanvas } from 'canvas';
import GIFEncoder from 'gifencoder';
import sharp from 'sharp';
import axios from 'axios';
import { PassThrough } from 'stream';
import getStream from 'get-stream';
const mydb = mysql.createConnection({
    host: "sql6.freemysqlhosting.net",
    user: "sql6687227",
    password: "FxH6W1zje5",
    database: "sql6687227"
});

app.use(cors());


// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.

mydb.connect((err) => {
    if (err) {
        console.log(err);
    } else {
        console.log("Connected to the database");
    }
});

app.listen(8800, () => {
    console.log("Server is running on port 8800");
})


const createTableQuery = `CREATE TABLE IF NOT EXISTS user (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL
)`;

mydb.query(createTableQuery, (err, result) => {
    if (err) {
        console.log(err);
    } else {
        console.log("User table created successfully");
    }
});

app.post("/signup", (req, res) => {
    const { name, email, password } = req.body;
    const sql = "INSERT INTO user (name, email, password) VALUES (?, ?, ?)";
    mydb.query(sql, [name, email, password], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("Error occurred while signing up");
        } else {
            res.status(200).send("User signed up successfully");
        }
    });
});


app.get("/checkPassword/:username/:password", (req, res) => {
    const username = req.params.username;
    const password = req.params.password;
    const sql = "SELECT * FROM user WHERE name = ? AND password = ?";
    mydb.query(sql, [username, password], (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("Error occurred while checking password");
        } else {
            if (result.length > 0) {
                res.status(200).send("Password is correct");

            } else {
                res.status(401).send("Invalid username or password");
            }
        }
    });
});




app.get("/checkUsername/:username", (req, res) => {
    const username = req.params.username;
    const sql = "SELECT * FROM user WHERE name = ?";
    mydb.query(sql, username, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("Error occurred while checking username");
        } else {
            if (result.length > 0) {
                res.status(200).send({ exists: true });
            } else {
                res.status(200).send({ exists: false });
            } //fd1cfc2afd27b0b182d60419
        }
    });
});// or wherever you want your files to go


// Rest of the code...

const uploadToB2Bucket = async (fileBuffer, bucketName, fileName) => {
    const b2 = new B2({
        applicationKeyId: '004f75c63a9de360000000005',
        applicationKey: 'K004s6ZzuDt4tyZ0b1bwL7rMNqT5tv0',
    });

    const calculateSha1 = (buffer) => {
        const sha1 = crypto.createHash('sha1');
        sha1.update(buffer);
        return sha1.digest('hex');
    };

    try {
        const response = await b2.authorize();
        const { authorizationToken, apiUrl } = response.data;

        const uploadResponse = await b2.getUploadUrl({ bucketId: 'ffb7a5dc46d3ca598dde0316' });
        const { uploadUrl, authorizationToken: uploadAuthToken } = uploadResponse.data;

        const headers = {
            Authorization: uploadAuthToken,
            'Content-Type': 'b2/x-auto',
            'X-Bz-File-Name': encodeURIComponent(fileName),
            'X-Bz-Content-Sha1': calculateSha1(fileBuffer),
            'Content-Length': fileBuffer.length
        };

        const uploadResponse1 = await axios.post(uploadUrl, fileBuffer, { headers });

        console.log('File uploaded successfully');
        console.log("https://back-1-7wvo.onrender.com/uploads//images/" + fileName);

        // Get the file ID from the upload response
        const fileId = uploadResponse1.data.fileId;

        // Get the file info to get the download URL
        const fileInfoResponse = await b2.getFileInfo(fileId);
        const downloadUrl = fileInfoResponse.data.downloadUrl;

        console.log("File uploaded successfully");
        return downloadUrl; // or resolve(downloadUrl); if you want to use resolve
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error; // Throw error to be caught by the caller
    }
};

app.get("/num", (req, res) => {
    const countEntriesQuery = "SELECT COUNT(*) AS count FROM images";
    mydb.query(countEntriesQuery, (err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send("Error counting entries");
        } else {
            const count = result[0].count;
            res.send(count.toString());
        }
    });
});

const upload = multer({ storage: multer.memoryStorage() });

app.post("/uploads", upload.single('file'), async (req, res) => {
    if (!req.file) {
        console.log("No file received");
        return res.send({
            success: false
        });
    } else {
        console.log('File received successfully');
        const fileData = req.file.buffer; // Access file as buffer
        const fileName = req.body.name;

        // Now fileData is a Buffer, you can directly upload it to B2
        const bucketName = 'PictoTest';
        console.log("https://f004.backblazeb2.com/file/PictoTest/" + fileName);

        try {
            const downloadUrl = await uploadToB2Bucket(fileData, bucketName, fileName);
            res.status(200).send(downloadUrl); // Send download URL in response
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).send('Error uploading file');
        }
    }
});

app.get('/images/:imageName', async (req, res) => {
    const { imageName } = req.params;
    const imageUrl = 'https://f004.backblazeb2.com/file/PictoTest/';

    try {
        // Fetch the image from the specific URL
        const imageResponse = await axios({
            method: 'get',
            url: `${imageUrl}${imageName}`,
            responseType: 'stream'
        });

        // Send the image data as the response
        res.set('Content-Type', imageResponse.headers['content-type']);
        imageResponse.data.pipe(res);
    } catch (error) {
        console.error('Error fetching image:', error);
        res.status(500).send('Error fetching image');
    }
});




// Example usage
const imageFilePath = 'C:/Users/AKS/OneDrive/Desktop/invest/backend/uploads/download.png';

const createDirectory = (directoryPath) => {
    return new Promise((resolve, reject) => {
        fs.mkdir(directoryPath, { recursive: true }, (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
};

async function addAnimatedBorder(imageBuffer, color1, color2) {
    // Load the image
    const image = await loadImage(imageBuffer);
    console.log('Image loaded');

    // Create canvas to draw animated border
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Create GIF encoder
    const encoder = new GIFEncoder(image.width, image.height);
    encoder.start();
    encoder.setRepeat(0);   // 0 for repeat, -1 for no-repeat
    encoder.setDelay(100);  // Frame delay in ms

    // Draw each frame with an animated gradient border
    const numFrames = 20; // Adjust the number of frames to control animation speed
    for (let frame = 0; frame < numFrames; frame++) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, image.width, image.height);

        const progress = frame / numFrames;

        // Calculate gradient positions based on progress
        const gradient1Position = progress * canvas.width;
        const gradient2Position = (progress + 0.5) * canvas.width;

        // Create linear gradients
        const gradient1 = ctx.createLinearGradient(gradient1Position, 0, gradient2Position, canvas.height);
        gradient1.addColorStop(0, color1);
        gradient1.addColorStop(1, color2);

        const gradient2 = ctx.createLinearGradient(gradient2Position, 0, gradient1Position, canvas.height);
        gradient2.addColorStop(0, color2);
        gradient2.addColorStop(1, color1);

        // Draw the border with two gradients
        ctx.strokeStyle = gradient1;
        ctx.lineWidth = 10;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = gradient2;
        ctx.strokeRect(0, 0, canvas.width, canvas.height);

        // Get the canvas's content in raw pixel data format and add it as a frame
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        encoder.addFrame(imageData.data, true); // Add frame with transparency
    }

    // Finish encoding
    encoder.finish();

    // Collect the GIF into a buffer
    const gifBuffer = Buffer.from(encoder.out.getData());

    console.log('Animated border added and GIF created.');

    return gifBuffer;
}

app.post("/animated", upload.single('file'), async (req, res) => {
    if (!req.file) {
        console.log("No file received");
        return res.send({
            success: false
        });
    } else {
        console.log('file received successfully');
        const fileBuffer = req.file.buffer;
        const fileName = req.body.name; // Assuming the file name is sent in the request body
        const color1 = req.body.color1; // Assuming color1 is sent in the request body
        const color2 = req.body.color2; // Assuming color2 is sent in the request body

        try {
            // Add animated border and create GIF
            const gifBuffer = await addAnimatedBorder(fileBuffer, color1, color2);

            // Upload the GIF to B2 bucket
            const bucketName = 'PictoTest';
            const gifFileName = `${fileName}.gif`;
            await uploadToB2Bucket(gifBuffer, bucketName, gifFileName);

            res.status(200).json({ message: 'Animated border added, GIF created and uploaded successfully.' });
        } catch (error) {
            console.error('Error processing file:', error);
            res.status(500).send('Error processing file');
        }
    }
});



app.post("/checkName", (req, res) => {
    const { name } = req.body;
    const checkNameQuery = `SELECT * FROM images WHERE name = '${name}'`;
    mydb.query(checkNameQuery, (err, result) => {
        if (err) {
            console.error('Error checking name in image table:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            if (result.length > 0) {
                res.json({ exists: true });
            } else {
                res.json({ exists: false });
            }
        }
    });
});

app.post("/addImageName", (req, res) => {
    const { name } = req.body;
    const addImageNameQuery = `INSERT INTO image (name) VALUES ('${name}')`;
    mydb.query(addImageNameQuery, (err, result) => {
        if (err) {
            console.error('Error adding image name to image table:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.json({ success: true });
        }
    });
});

// Remove the existing declaration of checkTableQuery
// const checkTableQuery = `SELECT 1 FROM \`pub-images\` LIMIT 1`;

// Declare checkTableQuery with the updated query
const checkTableQuery1 = `SELECT 1 FROM \`pub-images\` LIMIT 1`;

mydb.query(checkTableQuery1, (err, result) => {
    if (err) {
        const createTableQuery = `CREATE TABLE IF NOT EXISTS \`pub-images\` (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      date VARCHAR(255) NOT NULL,
      user VARCHAR(255) NOT NULL
    )`;

        mydb.query(createTableQuery, (err, result) => {
            if (err) {
                console.error('Error creating pub-images table:', err);
            } else {
                console.log('pub-images table created successfully');
            }
        });
    } else {
        console.log('pub-images table already exists');
    }
});

app.post("/pub-name", (req, res) => {
    const { name } = req.body;
    const { user } = req.body;
    const { date } = req.body;
    console.log(name)
    const addNameQuery = `INSERT INTO \`pub-images\` (name, user, date) VALUES ('${name}', '${user}', '${date}')`;
    mydb.query(addNameQuery, (err, result) => {
        if (err) {
            console.error('Error adding name to pub-images:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.json({ success: true });
        }
    });
});


app.get("/getNames", (req, res) => {
    const getNamesQuery = `SELECT name, user, pub, date FROM \`images\` ORDER BY date DESC`;
    mydb.query(getNamesQuery, (err, result) => {
        if (err) {
            console.error('Error retrieving names from images:', err);
            res.status(500).json({ error: 'Internal server error' });
        } else {
            const names = result.map(({ name, user, pub, date }) => ({ name, user, pub, date }));
            console.log('Query result:', names);
            res.json(names);
        }
    });
});

const createImagesTableQuery = `CREATE TABLE IF NOT EXISTS images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user VARCHAR(255) NOT NULL,
    pub BOOLEAN NOT NULL DEFAULT FALSE,
    date BIGINT NOT NULL
)`;

mydb.query(createImagesTableQuery, (err, result) => {
    if (err) {
        console.error('Error creating images table:', err);
    } else {
        console.log('Images table created successfully');
    }
});


app.post("/logImage", (req, res) => {
    const { name, user, public1, date } = req.body;
    const logImageQuery = `INSERT INTO images (name, user, pub, date) VALUES ('${name}', '${user}', ${public1}, ${date})`;
    mydb.query(logImageQuery, (err, result) => {
        if (err) {
        console.error('Error logging image:', err);
        res.status(500).json({ error: 'Internal server error' });
        } else {
        res.json({ success: true });
        }
    });
})