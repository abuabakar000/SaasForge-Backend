require('dotenv').config();
const sendEmail = require('./src/utils/sendResendEmail');

async function test() {
    try {
        await sendEmail({
            to: 'test@example.com',
            subject: 'Test SDK Direct',
            html: '<p>Testing</p>'
        });
        console.log("Success");
    } catch (err) {
        console.error("Caught error testing SDK:", err.message);
    }
}
test();
