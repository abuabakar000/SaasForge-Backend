const mongoose = require('mongoose');
const User = require('./src/models/User');
const { loginUser } = require('./src/controllers/authController');
require('dotenv').config();

const testLogin = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('DB Connected');

        const user = await User.findOne({ email: 'abubakar764@yahoo.com' });
        user.matchPassword = async () => true;

        if (!user) {
            console.log('User not found');
            process.exit(1);
        }

        const req = {
            body: { email: 'abubakar764@yahoo.com', password: 'password123' },
            cookies: {}
        };
        const res = {
            status: (code) => { console.log('Status:', code); return res; },
            json: (data) => { console.log('JSON:', JSON.stringify(data, null, 2)); return res; },
            cookie: (n, v, o) => { console.log('Cookie:', n); return res; }
        };

        console.log('Executing login...');
        await loginUser(req, res);
        console.log('Execution finished');
        process.exit(0);
    } catch (err) {
        console.error('CRASH:', err.stack);
        process.exit(1);
    }
};

testLogin();
