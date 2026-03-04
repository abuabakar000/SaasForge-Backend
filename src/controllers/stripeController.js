const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

// @desc    Create Stripe Checkout Session
// @route   POST /api/stripe/create-checkout-session
// @access  Private
const createCheckoutSession = async (req, res) => {
    const { priceId } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            customer_email: req.user.email,
            success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
            cancel_url: `${process.env.FRONTEND_URL}/dashboard?canceled=true`,
            metadata: {
                userId: req.user._id.toString(),
            },
        });

        res.json({ url: session.url });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Stripe Webhook Handler
// @route   POST /api/stripe/webhook
// @access  Public
const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.rawBody,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object;
            const userId = session.metadata.userId;
            await User.findByIdAndUpdate(userId, { role: 'admin' }); // For demo, lets promote to Pro (or Admin)
            break;
        case 'customer.subscription.deleted':
            // Logic for subscription cancellation
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
};

module.exports = {
    createCheckoutSession,
    handleWebhook
};
