const mongoose = require('mongoose');
const User = require('./src/models/User');
const http = require('http');
require('dotenv').config();

const fullTest = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('DB Connected');

        // Clean up and create test user
        await User.deleteOne({ email: 'test@example.com' });
        await User.create({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            isVerified: true
        });
        console.log('Test user created');

        const data = JSON.stringify({
            email: 'test@example.com',
            password: 'password123'
        });

        const options = {
            hostname: '127.0.0.1',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            res.on('data', (d) => {
                process.stdout.write(d);
            });
            res.on('end', () => {
                console.log('\nTest finished');
                process.exit(0);
            });
        });

        req.on('error', (error) => {
            console.error('ERROR:', error);
            process.exit(1);
        });

        req.write(data);
        req.end();

    } catch (err) {
        console.error('TEST SCRIPT CRASH:', err);
        process.exit(1);
    }
};

fullTest();
