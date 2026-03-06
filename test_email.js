async function testEmail() {
    try {
        const regRes = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `testuser_${Date.now()}`,
                email: `test_${Date.now()}@example.com`,
                password: 'password123'
            })
        });
        const regData = await regRes.json();
        const token = regData.accessToken;

        const emailRes = await fetch('http://localhost:5000/api/auth/send-verification-email', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` }
        });
        const emailData = await emailRes.json();

        console.log("Response:", emailData);
    } catch (err) {
        console.error("Error:", err);
    }
}

testEmail();
