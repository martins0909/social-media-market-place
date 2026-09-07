import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import Ercaspay from '@capitalsage/ercaspay-nodejs';
import { Payment, User } from '../models';

const router = express.Router();

// Validate Ercaspay configuration
const ECRS_AUTH_KEY = (process.env.ECRS_SECRET_KEY || process.env.ECRS_API_KEY || '').trim();
const ECRS_API_BASE = process.env.ECRS_API_BASE || 'https://api.ercaspay.com';
if (!ECRS_AUTH_KEY) {
  console.error('FATAL: Ercaspay key not set. Set ECRS_SECRET_KEY (preferred) or ECRS_API_KEY.');
}

const POCKETFI_BASE_URL = (process.env.POCKETFI_BASE_URL || process.env.POCKETFI_API_URL || '').trim();
const POCKETFI_SECRET_KEY = (process.env.POCKETFI_SECRET_KEY || process.env.POCKETFI_SECRET || process.env.POCKETFI_WEBHOOK_SECRET || '').trim();
const POCKETFI_BUSINESS_ID = (process.env.POCKETFI_BUSINESS_ID || '').trim();
const POCKETFI_CREATE_ENDPOINT = (process.env.POCKETFI_CREATE_ENDPOINT || '/virtual-accounts/create').trim();
const POCKETFI_API_KEY = (process.env.POCKETFI_API_KEY || '').trim();

const PHONE_PREFIXES = ['070', '080', '081', '090'];

function generatePhoneNumber(): string {
  const prefix = PHONE_PREFIXES[Math.floor(Math.random() * PHONE_PREFIXES.length)];
  const suffix = Math.floor(10000000 + Math.random() * 90000000).toString();
  return `${prefix}${suffix}`;
}

async function ensurePhoneNumber(userDoc: any): Promise<string> {
  if (userDoc.phoneNumber && /^0[7890]\d{8}$/.test(userDoc.phoneNumber)) {
    return userDoc.phoneNumber;
  }

  let candidate = '';
  let attempts = 0;
  while (attempts < 20) {
    candidate = generatePhoneNumber();
    const existing = await User.findOne({ phoneNumber: candidate }).lean();
    if (!existing) {
      break;
    }
    candidate = '';
    attempts += 1;
  }

  if (!candidate) {
    throw new Error('Unable to generate a unique phone number');
  }

  userDoc.phoneNumber = candidate;
  await userDoc.save();
  return candidate;
}

function getNameParts(rawName?: string): { firstName: string; lastName: string } {
  const parts = (rawName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: 'Customer', lastName: 'User' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'User' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

// Initialize Ercaspay client - MUST use baseURL (uppercase) not baseUrl
const ercaspay = new Ercaspay({
  baseURL: ECRS_API_BASE,
  secretKey: ECRS_AUTH_KEY,
});

/**
 * POST /api/payments/pocketfi/initiate
 * Creates PocketFi virtual account details for wallet funding
 */
router.post('/pocketfi/initiate', async (req, res) => {
  try {
    const { amount, userId, email, firstName, lastName } = req.body;

    if (!amount || !userId || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, userId, email'
      });
    }

    if (!POCKETFI_BASE_URL || !POCKETFI_BUSINESS_ID) {
      return res.status(503).json({
        success: false,
        error: 'PocketFi is not configured yet. Please set POCKETFI_BASE_URL and POCKETFI_BUSINESS_ID.'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const phoneNumber = await ensurePhoneNumber(user);
    const paymentReference = `pocketfi_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const providedName = `${firstName || ''} ${lastName || ''}`.trim();
    const { firstName: resolvedFirstName, lastName: resolvedLastName } = getNameParts(providedName || user.name);

    const payload = {
      first_name: resolvedFirstName,
      last_name: resolvedLastName,
      phone: phoneNumber,
      email: user.email,
      businessId: POCKETFI_BUSINESS_ID,
      bank: process.env.POCKETFI_BANK || 'kuda',
      nin: process.env.POCKETFI_NIN || undefined,
      bvn: process.env.POCKETFI_BVN || undefined,
    };

    const response = await axios.post(
      `${POCKETFI_BASE_URL.replace(/\/$/, '')}${POCKETFI_CREATE_ENDPOINT.startsWith('/') ? POCKETFI_CREATE_ENDPOINT : `/${POCKETFI_CREATE_ENDPOINT}`}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          ...(POCKETFI_API_KEY ? { Authorization: `Bearer ${POCKETFI_API_KEY}` } : {}),
        },
        timeout: 30000,
      }
    );

    const gatewayData = response.data || {};
    const nestedData = gatewayData?.data || {};
    const nestedTransaction = nestedData?.transaction || gatewayData?.transaction || {};
    const nestedBanks = Array.isArray(nestedData?.banks) ? nestedData.banks : [];
    const banks = Array.isArray(gatewayData?.banks) ? gatewayData.banks : nestedBanks;
    const firstBank = banks[0] || nestedData || {};
    const extractedReference =
      gatewayData?.reference ||
      nestedData?.reference ||
      nestedTransaction?.reference ||
      gatewayData?.transaction?.reference ||
      paymentReference;

    const extractedAccountNumber =
      firstBank.accountNumber ||
      firstBank.account_number ||
      firstBank.virtualAccountNumber ||
      firstBank.virtual_account_number ||
      nestedData.accountNumber ||
      nestedData.account_number ||
      nestedData.virtualAccountNumber ||
      nestedData.virtual_account_number ||
      gatewayData.accountNumber ||
      gatewayData.account_number ||
      gatewayData.virtualAccountNumber ||
      gatewayData.virtual_account_number ||
      '';

    const customerPayload = gatewayData.customer || nestedData.customer || {};
    const customerFirstName = customerPayload.first_name || customerPayload.firstName || '';
    const customerLastName = customerPayload.last_name || customerPayload.lastName || '';

    const extractedAccountName =
      firstBank.accountName ||
      firstBank.account_name ||
      firstBank.name ||
      nestedData.accountName ||
      nestedData.account_name ||
      nestedData.name ||
      gatewayData.accountName ||
      gatewayData.account_name ||
      gatewayData.name ||
      `${customerFirstName} ${customerLastName}`.trim() ||
      `${resolvedFirstName} ${resolvedLastName}`.trim() ||
      (user.name ? getNameParts(user.name).firstName : '') ||
      'Customer';

    const extractedBankName =
      firstBank.bankName ||
      firstBank.bank_name ||
      firstBank.bank ||
      nestedData.bankName ||
      nestedData.bank_name ||
      nestedData.bank ||
      gatewayData.bankName ||
      gatewayData.bank_name ||
      gatewayData.bank ||
      payload.bank;

    const paymentRecord = await Payment.create({
      user: user._id,
      userLocalId: userId,
      email: user.email,
      amount: Number(amount) || 0,
      method: 'pocketfi',
      status: 'pending',
      reference: paymentReference,
      transactionReference: extractedReference,
      isCredited: false,
    });

    return res.status(200).json({
      success: true,
      paymentReference,
      transactionReference: paymentRecord.transactionReference,
      accountName: extractedAccountName,
      accountNumber: extractedAccountNumber,
      bankName: extractedBankName,
      message: gatewayData.message || 'Use the details below to complete your payment.',
      raw: gatewayData,
    });
  } catch (error: any) {
    console.error('PocketFi initiate error:', error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: error?.response?.data?.message || error.message || 'Failed to initiate PocketFi payment',
    });
  }
});

/**
 * POST /api/payments/ercas/initiate
 * Creates a new payment checkout session with Ercaspay
 */
router.post('/ercas/initiate', async (req, res) => {
  try {
    const { amount, currency = 'NGN', userId, email, callbackUrl } = req.body;

    // Validate required fields
    if (!amount || !userId || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: amount, userId, email',
      });
    }

    // Generate unique payment reference
    const paymentReference = ercaspay.generatePaymentReferenceUuid();

    // Build redirect URL to return customer to /shop with our paymentReference in query
    const baseRedirect = (callbackUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/shop`).toString();
    const redirectUrlWithRef = baseRedirect.includes('?')
      ? `${baseRedirect}&pref=${encodeURIComponent(paymentReference)}`
      : `${baseRedirect}?pref=${encodeURIComponent(paymentReference)}`;

    // Prepare transaction data
    const transactionData = {
      amount: String(amount),
      paymentReference,
      paymentMethods: 'card,bank-transfer,ussd',
      customerName: 'Customer', // You can enhance this by getting actual customer name
      customerEmail: email,
      currency: currency.toUpperCase(),
      customerPhoneNumber: '', // Optional - can be added to frontend form
      redirectUrl: redirectUrlWithRef,
      description: `Wallet top-up for user ${userId}`,
      feeBearer: 'merchant',
      metadata: {
        userId,
        type: 'wallet-topup',
      },
    };

    // Optional: light debug for transaction (avoid logging secrets)
    console.log('Ercaspay initiateTransaction called', {
      paymentReference,
      amount: String(amount),
      currency: currency.toUpperCase(),
      hasSecretKey: Boolean(ECRS_AUTH_KEY)
    });

    // Call Ercaspay API
    // Use direct Axios call to ensure headers are correct and handle errors better
    let response;
    try {
        const axiosRes = await axios.post(
            `${ECRS_API_BASE}/api/v1/payment/initiate`,
            transactionData,
            {
                headers: {
            'Authorization': `Bearer ${ECRS_AUTH_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        response = {
            requestSuccessful: true,
            responseBody: axiosRes.data.responseBody,
            responseMessage: axiosRes.data.responseMessage
        };
    } catch (err: any) {
        console.error("Ercaspay Initiate Error (Axios):", err.response?.data || err.message);
        if (err.response?.status === 401) {
             return res.status(401).json({
                success: false,
                error: "Invalid Ercaspay Secret Key. Please check your .env file.",
             });
        }
        throw { 
            message: err.response?.data?.errorMessage || err.message, 
            responseData: err.response?.data 
        };
    }

    // Check if transaction was successful
    if (response.requestSuccessful && response.responseBody) {
      const { checkoutUrl } = response.responseBody;
      
      // Log full response to see what Ercaspay returns
      console.log('Ercaspay response body:', JSON.stringify(response.responseBody, null, 2));
      
      // Ercaspay verifyTransaction expects the paymentReference we sent, not a separate transactionReference
      // We'll return our paymentReference for verification
      const transactionReference = response.responseBody.transactionReference
        || response.responseBody.transactionRef
        || response.responseBody.reference
        || null;

      // Try to record a pending payment in DB (best-effort; don't block response)
      try {
        const { Payment } = await import('../models');
        await Payment.create({
          userLocalId: (transactionData as any).metadata?.userId,
          email: transactionData.customerEmail,
          amount: Number(transactionData.amount) || 0,
          method: 'ercaspay',
          status: 'pending',
          reference: paymentReference,
          transactionReference: transactionReference || undefined,
        });
      } catch (e) {
        console.warn('Payment DB record (pending) failed:', (e as Error).message);
      }

      return res.status(200).json({
        success: true,
        checkoutUrl,
        paymentReference, // our internally generated UUID
        transactionReference, // gateway provided reference for verification
      });
    } else {
      return res.status(400).json({
        success: false,
        error: response.responseMessage || 'Failed to create payment session',
      });
    }
  } catch (error: any) {
    console.error('Error creating payment session:', error);
    console.error('Error details:', {
      message: error.message,
      responseData: error.responseData,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    return res.status(500).json({
      success: false,
      error: error.responseData?.responseMessage || error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/payments/verify
 * Verifies a payment transaction status
 */
router.get('/verify', async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Payment reference is required',
      });
    }

    // Sanitize reference in case provider appended their own query after our value
    const cleanReference = String(reference).split('?')[0].split('&')[0].trim();

    console.log('=== Verify Payment ===');
    console.log('Verifying reference:', cleanReference);

    // Call Ercaspay API
    const response = await ercaspay.verifyTransaction(cleanReference);

    console.log('Ercaspay verify response:', JSON.stringify({
      requestSuccessful: response.requestSuccessful,
      responseCode: response.responseCode,
      responseMessage: response.responseMessage,
      responseBody: response.responseBody,
    }, null, 2));

    // Check verification response
    if (response.requestSuccessful && response.responseBody) {
      const transactionData = response.responseBody;

      // Map Ercaspay response codes to our status
      let status = 'pending';
      if (response.responseCode === 'success') {
        status = 'success';

        // Credit the user if not already credited
        try {
            const { Payment, User } = await import('../models');
            const amount = Number(transactionData.amount || 0);
            const transRef = transactionData.transactionReference || cleanReference;
            
            // Find payment
            let payment = await Payment.findOne({ 
                $or: [{ transactionReference: transRef }, { reference: cleanReference }] 
            });

            if (payment && payment.isCredited) {
                // Already credited
                const user = await User.findById(payment.user);
                return res.status(200).json({
                    success: true,
                    status: 'success',
                    amount,
                    newBalance: user?.balance,
                    alreadyCredited: true,
                    reference: cleanReference,
                    data: transactionData,
                });
            }

            // If not credited, credit now
            if (amount > 0) {
                // Ensure payment record exists
                if (!payment) {
                    payment = new Payment({
                        userLocalId: transactionData.metadata?.userId,
                        email: transactionData.customerEmail,
                        amount,
                        method: 'ercaspay',
                        status: 'completed',
                        transactionReference: transRef,
                        reference: cleanReference,
                        isCredited: false
                    });
                } else {
                    payment.status = 'completed';
                    payment.amount = amount;
                }

                // Find user to credit
                const userId = payment.user || payment.userLocalId || transactionData.metadata?.userId;
                if (userId) {
                    const user = await User.findByIdAndUpdate(
                        userId,
                        { $inc: { balance: amount } },
                        { new: true }
                    );
                    
                    if (user) {
                        payment.isCredited = true;
                        payment.user = user._id as any;
                        await payment.save();
                        
                        return res.status(200).json({
                            success: true,
                            status: 'success',
                            amount,
                            newBalance: user.balance,
                            reference: cleanReference,
                            data: transactionData,
                        });
                    }
                }
            }
        } catch (e) {
            console.error("Error crediting in verify:", e);
        }
      } else if (response.responseCode === 'failed') {
        status = 'failed';
      }

      return res.status(200).json({
        success: true,
        status,
        amount: transactionData.amount || 0,
  reference: cleanReference,
        data: transactionData,
      });
    } else {
      console.log('Ercaspay verify failed, checking DB fallback...');
      // Fallback: if gateway says not found, check DB if webhook already marked it completed
      try {
        const { Payment } = await import('../models');
        const paid = await Payment.findOne({
          $or: [{ transactionReference: cleanReference }, { reference: cleanReference }],
          status: 'completed',
        }).lean();
        if (paid) {
          console.log('Found completed payment in DB:', paid._id);
          return res.status(200).json({
            success: true,
            status: 'success',
            amount: paid.amount,
            reference: cleanReference,
            data: { source: 'webhook-cache' },
          });
        } else {
          console.log('No completed payment found in DB for reference:', reference);
        }
      } catch (e) {
        console.warn('DB lookup fallback failed:', (e as Error).message);
      }

      return res.status(400).json({
        success: false,
        error: response.responseMessage || 'Failed to verify payment',
        status: 'failed',
      });
    }
  } catch (error: any) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({
      success: false,
      error: error.responseData?.responseMessage || error.message || 'Internal server error',
      status: 'failed',
    });
  }
});

router.post('/pocketfi/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!POCKETFI_SECRET_KEY) {
      return res.status(500).json({ message: 'PocketFi secret key is not configured' });
    }

    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || ''));
    const payload = rawBody.toString('utf8');

    // Temporary debug logging to inspect what PocketFi is actually sending
    console.log('PocketFi webhook debug headers:', req.headers);
    console.log('PocketFi webhook debug payload length:', rawBody.length);
    console.log('PocketFi webhook debug payload text:', payload);

    const signature = String(
      req.headers['x-pocketfi-signature'] ||
      req.headers['pocketfi-signature'] ||
      req.headers['http_pocketfi_signature'] ||
      req.headers['HTTP_POCKETFI_SIGNATURE'] ||
      req.headers['x-signature'] ||
      req.headers['signature'] ||
      ''
    ).trim();
    const hash = crypto.createHmac('sha512', POCKETFI_SECRET_KEY).update(rawBody).digest('hex');

    console.log('PocketFi webhook debug signature:', signature);
    console.log('PocketFi webhook debug computed hash:', hash);

    if (signature.toLowerCase() !== hash.toLowerCase()) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const data = JSON.parse(payload);
    const payloadData = data?.data || data;
    const reference =
      payloadData?.transaction?.reference ||
      payloadData?.reference ||
      data?.transaction?.reference ||
      data?.reference ||
      '';
    const amount = Number(
      payloadData?.order?.amount ||
      data?.order?.amount ||
      0
    );
    const customerEmail = String(
      payloadData?.customer?.email ||
      data?.customer?.email ||
      ''
    ).trim().toLowerCase();

    console.log('PocketFi webhook parsed reference:', reference);
    console.log('PocketFi webhook parsed amount:', amount);
    console.log('PocketFi webhook parsed email:', customerEmail);

    if (!reference) {
      return res.status(400).json({ message: 'Missing transaction reference' });
    }

    let payment = await Payment.findOne({
      $or: [
        { reference: reference },
        { transactionReference: reference }
      ]
    });

    if (!payment && customerEmail && amount > 0) {
      payment = await Payment.findOne({
        email: customerEmail,
        amount,
        method: 'pocketfi',
        status: 'pending'
      }).sort({ createdAt: -1 });
    }

    console.log('PocketFi webhook payment match:', {
      found: Boolean(payment),
      paymentId: payment?._id?.toString(),
      paymentUser: payment?.user?.toString(),
      paymentUserLocalId: payment?.userLocalId,
      paymentEmail: payment?.email,
      paymentAmount: payment?.amount,
      paymentStatus: payment?.status,
      paymentReference: payment?.reference,
      paymentTransactionReference: payment?.transactionReference,
    });

    if (payment && payment.isCredited) {
      return res.status(200).json({ message: 'already processed' });
    }

    if (payment) {
      payment.transactionReference = payment.transactionReference || reference;
      payment.reference = payment.reference || reference;
    }

    if (payment && amount > 0) {
      let user = null;
      if (payment.user) {
        user = await User.findById(payment.user);
      }
      if (!user && customerEmail) {
        user = await User.findOne({ email: customerEmail });
      }
      if (!user && payment.userLocalId) {
        user = await User.findById(payment.userLocalId);
      }

      console.log('PocketFi webhook user lookup:', {
        userFound: Boolean(user),
        userId: user?._id?.toString(),
        userEmail: user?.email,
        currentBalance: user?.balance,
      });

      if (user) {
        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          { $inc: { balance: amount } },
          { new: true }
        );

        payment.user = user._id;
        payment.status = 'completed';
        payment.isCredited = true;
        await payment.save();

        return res.status(200).json({
          message: 'success',
          newBalance: updatedUser?.balance || user.balance || 0,
        });
      }
    }

    if (payment) {
      payment.status = 'completed';
      await payment.save();
      return res.status(200).json({ message: 'saved without crediting' });
    }

    await Payment.create({
      amount,
      method: 'pocketfi',
      status: 'completed',
      reference,
      transactionReference: reference,
      isCredited: false,
    });

    return res.status(200).json({ message: 'received' });
  } catch (error: any) {
    console.error('PocketFi webhook error:', error);
    return res.status(400).json({ message: 'Webhook processing failed' });
  }
});

/**
 * POST /api/payments/webhook
 * Ercaspay webhook endpoint to receive transaction updates
 * Note: For production, verify signatures if the provider supports it.
 */
router.get('/webhook', (req, res) => {
  res.status(200).json({ status: "active", message: "Webhook endpoint is operational. Send POST requests here." });
});

router.post('/webhook', async (req, res) => {
  try {
    const evt = req.body || {};
    
    // Extract reference from various possible fields (snake_case or camelCase)
    const reference: string | undefined = 
      evt.transaction_reference || 
      evt.payment_reference || 
      evt.transactionReference || 
      evt.reference || 
      evt.transactionRef || 
      evt?.data?.reference;

    const statusRaw: string = (evt.status || evt.event || evt?.data?.status || '').toString().toLowerCase();
    const metadata = evt.metadata || evt?.data?.metadata || {};
    const email = evt.customerEmail || evt?.data?.customer?.email || metadata?.email || undefined;

    console.log('Webhook received:', { reference, status: statusRaw, amount: evt.amount });

    if (!reference) {
      console.warn('Webhook without reference:', evt);
      return res.status(200).json({ received: true });
    }

    // Confirm with gateway to avoid spoofing
    const verifyResp = await ercaspay.verifyTransaction(reference);
    if (verifyResp.requestSuccessful && verifyResp.responseBody) {
      const transactionData = verifyResp.responseBody;
      const code = verifyResp.responseCode;
      const success = code === 'success' || statusRaw === 'successful' || statusRaw === 'success';
      const amt = Number(transactionData.amount || evt.amount || 0);

      try {
        const { Payment, User } = await import('../models');
        
        // 1. Find existing payment using either transaction reference or payment reference
        // We check both because reference could be either
        let payment = await Payment.findOne({ 
          $or: [
            { transactionReference: reference }, 
            { reference: reference },
            { reference: evt.payment_reference },
            { transactionReference: evt.transaction_reference }
          ] 
        });

        // 2. Check if already credited
        if (payment && payment.isCredited) {
          console.log('Webhook: Payment already processed and credited:', reference);
        } else {
          // 3. Process if success
          if (success && amt > 0) {
            // Ensure payment record exists or update it
            if (!payment) {
              payment = new Payment({
                userLocalId: metadata?.userId,
                email,
                amount: amt,
                method: 'ercaspay',
                status: 'completed',
                transactionReference: evt.transaction_reference || reference,
                reference: evt.payment_reference || transactionData.paymentReference || reference, 
                isCredited: false
              });
            } else {
              payment.status = 'completed';
              payment.amount = amt;
              // Ensure transaction refs are set
              if (!payment.transactionReference && evt.transaction_reference) {
                payment.transactionReference = evt.transaction_reference;
              }
              if (payment.status !== 'completed') payment.status = 'completed';
            }

            // 4. Find user and credit balance
            const userId = payment.user || payment.userLocalId || metadata?.userId;
            
            if (userId) {
               const user = await User.findByIdAndUpdate(
                  userId,
                  { $inc: { balance: amt } },
                  { new: true }
               );

               if (user) {
                  payment.isCredited = true;
                  payment.user = user._id as any;
                  await payment.save();
                  console.log(`Webhook: Successfully credited user ${userId} amount ${amt}`);
               } else {
                  console.warn(`Webhook: User ${userId} not found, payment marked completed but not credited`);
                  await payment.save(); 
               }
            } else {
               console.warn('Webhook: No user ID linked to payment, saved as uncredited');
               await payment.save();
            }
          } else if (!success) {
             // Handle failed/pending updates if record exists
             if (payment) {
                payment.status = 'failed';
                await payment.save();
             }
          }
        }
      } catch (e) {
        console.error('Failed to process Payment in webhook:', (e as Error).message);
      }
    } else {
      console.warn('Gateway verification failed in webhook:', verifyResp.responseMessage);
    }

    // Always acknowledge to prevent retries storms; adjust if provider expects different codes
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(200).json({ received: true });
  }
});

/**
 * GET /api/payments/status/:reference
 * Fetches detailed transaction status (alternative to verify)
 */
router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({
        success: false,
        error: 'Payment reference is required',
      });
    }

    // Fetch transaction details
    const response = await ercaspay.fetchTransactionDetails(reference);

    if (response.requestSuccessful && response.responseBody) {
      return res.status(200).json({
        success: true,
        data: response.responseBody,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: response.responseMessage || 'Failed to fetch transaction status',
      });
    }
  } catch (error: any) {
    console.error('Error fetching transaction status:', error);
    return res.status(500).json({
      success: false,
      error: error.responseData?.responseMessage || error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/payments/ercas/credit
 * Verifies payment and credits user balance
 */
router.post('/ercas/credit', async (req, res) => {
  try {
    const { userId, email, transRef, status, amount } = req.body;
    
    if (!userId || !transRef) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    console.log(`Crediting payment: ${transRef} for user ${userId}`);

    // Verify with Ercaspay
    const verifyResp = await ercaspay.verifyTransaction(transRef);
    
    if (!verifyResp.requestSuccessful || !verifyResp.responseBody || verifyResp.responseCode !== 'success') {
       console.error("Verification failed:", verifyResp);
       return res.status(400).json({ ok: false, error: "Payment verification failed with gateway" });
    }

    const verifiedAmount = Number(verifyResp.responseBody.amount);
    
    if (isNaN(verifiedAmount) || verifiedAmount <= 0) {
        return res.status(400).json({ ok: false, error: "Invalid verified amount" });
    }

    const { Payment, User } = await import('../models');

    // Check if already credited
    let payment = await Payment.findOne({ 
        $or: [{ transactionReference: transRef }, { reference: transRef }] 
    });

    if (payment && payment.isCredited) {
        const user = await User.findById(payment.user || userId);
        return res.json({ 
            ok: true, 
            credited: false, 
            alreadyProcessed: true, 
            amount: payment.amount, 
            newBalance: user?.balance 
        });
    }

    // Update or create payment record
    if (!payment) {
        payment = new Payment({
            user: userId,
            userLocalId: userId,
            email,
            amount: verifiedAmount,
            method: 'ercaspay',
            status: 'completed',
            transactionReference: transRef,
            reference: verifyResp.responseBody.paymentReference || transRef,
            isCredited: false
        });
    } else {
        payment.status = 'completed';
        payment.amount = verifiedAmount; // Ensure amount matches verified
    }

    // Credit user
    const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { balance: verifiedAmount } },
        { new: true }
    );

    if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
    }

    payment.isCredited = true;
    payment.user = user._id as any; // Ensure user link
    await payment.save();

    console.log(`Credited ${verifiedAmount} to user ${userId}. New balance: ${user.balance}`);

    return res.json({
        ok: true,
        credited: true,
        amount: verifiedAmount,
        newBalance: user.balance
    });

  } catch (error: any) {
    console.error('Error crediting payment:', error);
    return res.status(500).json({
        ok: false,
        error: error.message || "Internal server error"
    });
  }
});

export default router;
