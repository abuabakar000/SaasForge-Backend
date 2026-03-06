const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Sends an email using the Resend API
 * @param {Object} options 
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML content of the email
 */
const sendResendEmail = async (options) => {
    try {
        const { data, error } = await resend.emails.send({
            // Since this is a test/free tier key, Resend requires you to send FROM "onboarding@resend.dev"
            // to a verified email address unless you have a verified domain added.
            from: 'SaaSForge <onboarding@resend.dev>',
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || options.html.replace(/<[^>]*>?/gm, ''), // Simple html to text fallback
            headers: {
                'X-Entity-Ref-ID': Date.now().toString(),
            },
        });

        if (error) {
            console.error("Resend API Error:", error);
            throw new Error(error.message);
        }

        console.log("Email sent successfully via Resend. ID:", data.id);
        return data;
    } catch (err) {
        console.error("Error sending email:", err);
        throw err;
    }
};

module.exports = sendResendEmail;
