const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// Force restart to refresh env variables
const User = require('../models/User');

// @desc    Create Stripe Checkout Session
// @route   POST /api/stripe/create-checkout-session
// @access  Private
const createCheckoutSession = async (req, res) => {
    // Safety check for req.body
    const { priceId } = req.body || {};

    // Final Price ID to use (priority: request body > environment variable > placeholder)
    const finalPriceId = priceId || process.env.STRIPE_PRO_PRICE_ID || 'price_placeholder_pro';

    console.log(`[DEBUG] Attempting Stripe checkout with Price ID: ${finalPriceId}`);

    try {
        const user = await User.findById(req.user.id);
        let stripeCustomerId = user.stripeCustomerId;

        // Create Stripe customer if doesn't exist
        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.username,
                metadata: {
                    userId: user._id.toString(),
                }
            });
            stripeCustomerId = customer.id;
            await User.findByIdAndUpdate(user._id, { stripeCustomerId });
        }

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer: stripeCustomerId,
            line_items: [
                {
                    price: finalPriceId,
                    quantity: 1,
                },
            ],
            success_url: `${process.env.FRONTEND_URL}/dashboard?status=success`,
            cancel_url: `${process.env.FRONTEND_URL}/pricing?status=canceled`,
            metadata: {
                userId: req.user.id,
            },
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe Session Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create Stripe Portal Session
// @route   POST /api/stripe/create-portal-session
// @access  Private
const createPortalSession = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user.stripeCustomerId) {
            return res.status(400).json({ message: 'No active subscription found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${process.env.FRONTEND_URL}/pricing`,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Stripe Portal Error:', error);
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
    createPortalSession,
    handleWebhook
};
