const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // In development with placeholder/missing credentials, just log the email
    const emailUser = process.env.EMAIL_USER || '';
    const emailHost = process.env.EMAIL_HOST || '';
    const isDev = process.env.NODE_ENV !== 'production';
    const hasPlaceholder = !emailUser || emailUser.includes('your_') || !emailHost;

    if (isDev && hasPlaceholder) {
        console.log('========================================');
        console.log('DEV EMAIL (not actually sent):');
        console.log('To:', options.email);
        console.log('Subject:', options.subject);
        console.log('Body:', options.message);
        console.log('========================================');
        return; // Don't throw, just skip
    }

    const transporter = nodemailer.createTransport({
        host: emailHost,
        port: process.env.EMAIL_PORT,
        auth: {
            user: emailUser,
            pass: process.env.EMAIL_PASS,
        },
    });

    const message = {
        from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html,
    };

    const info = await transporter.sendMail(message);
    console.log('Message sent: %s', info.messageId);
};

module.exports = sendEmail;
