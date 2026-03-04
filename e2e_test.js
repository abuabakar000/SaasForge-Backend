const http = require('http');

function makeRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: '127.0.0.1',
            port: 5000,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body), headers: res.headers }); }
                catch { resolve({ status: res.statusCode, data: body, headers: res.headers }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function test() {
    console.log('\n=== TEST 1: Register ===');
    const reg = await makeRequest('POST', '/api/auth/register', {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
    });
    console.log('Status:', reg.status);
    console.log('Response:', JSON.stringify(reg.data));

    if (reg.status !== 201) {
        console.log('REGISTRATION FAILED! Aborting.');
        process.exit(1);
    }

    console.log('\n=== TEST 2: Login ===');
    const login = await makeRequest('POST', '/api/auth/login', {
        email: 'test@example.com',
        password: 'password123'
    });
    console.log('Status:', login.status);
    console.log('Response:', JSON.stringify(login.data));

    if (login.status === 200 && login.data.accessToken) {
        console.log('\n✅ SUCCESS! Auth flow works!');
    } else {
        console.log('\n❌ FAILED! Login returned:', login.status);
    }
}

test().catch(err => console.error('Test crash:', err));
