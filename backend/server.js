const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "cdn.jsdelivr.net", "'unsafe-inline'"],
            styleSrc: ["'self'", "cdn.jsdelivr.net", "'unsafe-inline'"],
            fontSrc: ["'self'", "fonts.googleapis.com", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
            connectSrc: ["'self'"],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: []
        },
    },
}));

// Rate limiting middleware
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests',
        details: 'You have sent too many requests. Please try again later.'
    }
});
app.use(limiter);

// MongoDB connection with enhanced options
const mongoURI = process.env.MONGO_URI || 'mongodb+srv://toshi:8ZMx6SKadZ5gMchQ@toshi.kjplpfe.mongodb.net/?retryWrites=true&w=majority&appName=toshi';
const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
};

mongoose.connect(mongoURI, mongoOptions)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => {
    console.error('MongoDB connection error:', err);
    console.error('Failed to connect to MongoDB. Please check your connection string and ensure MongoDB is running.');
    process.exit(1);
});

// Loan Application Schema
const loanApplicationSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  amount: { type: Number, required: true },
  purpose: { type: String, required: true },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentReference: { type: String },
  status: { type: String, enum: ['submitted', 'approved', 'rejected'], default: 'submitted' }
}, { timestamps: true });

const LoanApplication = mongoose.model('LoanApplication', loanApplicationSchema);

// Safaricom Daraja API Configuration
const DARAJA_CONFIG = {
  consumerKey: process.env.DARAJA_CONSUMER_KEY,
  consumerSecret: process.env.DARAJA_CONSUMER_SECRET,
  businessShortCode: process.env.DARAJA_BUSINESS_SHORTCODE || '174379',
  passkey: process.env.DARAJA_PASSKEY,
  callbackUrl: process.env.DARAJA_CALLBACK_URL,
  environment: process.env.DARAJA_ENVIRONMENT || 'sandbox'
};

// Business Configuration - IMPORTANT FOR RECEIVING PAYMENTS
const BUSINESS_CONFIG = {
  name: 'Empowerment Loan Services',
  owner: process.env.BUSINESS_OWNER || 'Your Name',
  phone: process.env.BUSINESS_PHONE || '+254700000000',
  email: process.env.BUSINESS_EMAIL || 'your.email@example.com',
  // WARNING: Current setup uses sandbox shortcode 174379
  // Payments go to Safaricom test account, NOT to you!
  // Get your own business shortcode for production
  isReceivingPayments: DARAJA_CONFIG.businessShortCode !== '174379',
  paymentDestination: DARAJA_CONFIG.businessShortCode === '174379'
      ? 'Safaricom Test Account (NO MONEY RECEIVED)'
      : `Your Business Account (${DARAJA_CONFIG.businessShortCode})`
};

// Log payment configuration on startup
console.log('\n💰 BUSINESS PAYMENT CONFIGURATION:');
console.log(`Business Name: ${BUSINESS_CONFIG.name}`);
console.log(`Environment: ${DARAJA_CONFIG.environment}`);
console.log(`Business Shortcode: ${DARAJA_CONFIG.businessShortCode}`);
console.log(`Payment Destination: ${BUSINESS_CONFIG.paymentDestination}`);
console.log(`Will Receive Real Money: ${BUSINESS_CONFIG.isReceivingPayments ? '✅ YES' : '❌ NO - SANDBOX ONLY'}`);
if (!BUSINESS_CONFIG.isReceivingPayments) {
    console.log('⚠️  WARNING: Using sandbox shortcode 174379 - payments go to Safaricom, not you!');
    console.log('📋 Get your own business shortcode to receive payments');
}
console.log('');

// Daraja API URLs
const DARAJA_URLS = {
  sandbox: {
    oauth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
  },
  production: {
    oauth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
  }
};

// Function to get Daraja access token
async function getDarajaAccessToken() {
  try {
    const auth = Buffer.from(`${DARAJA_CONFIG.consumerKey}:${DARAJA_CONFIG.consumerSecret}`).toString('base64');
    const response = await axios.get(DARAJA_URLS[DARAJA_CONFIG.environment].oauth, {
      headers: {
        'Authorization': `Basic ${auth}`
      },
      timeout: 30000
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Daraja access token:', error);
    throw new Error('Failed to get access token');
  }
}

// Function to initiate STK Push
async function initiateStkPush(phoneNumber, amount, accountReference, transactionDesc) {
  try {
    const accessToken = await getDarajaAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${DARAJA_CONFIG.businessShortCode}${DARAJA_CONFIG.passkey}${timestamp}`).toString('base64');

    const stkPushData = {
      BusinessShortCode: DARAJA_CONFIG.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: DARAJA_CONFIG.businessShortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: DARAJA_CONFIG.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: transactionDesc
    };

    console.log(`Initiating STK Push for ${phoneNumber}, amount: ${amount}, reference: ${accountReference}`);

    const response = await axios.post(DARAJA_URLS[DARAJA_CONFIG.environment].stkPush, stkPushData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log(`STK Push initiated successfully: ${response.data.CheckoutRequestID}`);
    return response.data;
  } catch (error) {
    console.error('Error initiating STK Push:', error);

    if (error.response) {
      console.error(`STK Push failed with status ${error.response.status}:`, error.response.data);
      throw new Error(`Payment initiation failed: ${error.response.data.errorMessage || 'Unknown error'}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Payment request timed out. Please try again.');
    } else {
      throw new Error('Failed to initiate payment. Please check your connection and try again.');
    }
  }
}

// Endpoint to submit loan application
app.post('/api/submit-application', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, amount, purpose } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone || !amount || !purpose) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Validate and parse amount
    const parsedAmount = parseInt(amount);
    if (isNaN(parsedAmount) || parsedAmount < 1000 || parsedAmount > 50000) {
      return res.status(400).json({ error: 'Invalid amount. Must be between KES 1,000 and 50,000.' });
    }

    const application = new LoanApplication({
      firstName,
      lastName,
      email,
      phone,
      amount: parsedAmount,
      purpose
    });

    await application.save();

    res.json({
      message: 'Application submitted successfully!',
      applicationId: application._id
    });
  } catch (error) {
    console.error('Error saving application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Initiate M-Pesa payment
app.post('/initiate-payment', async (req, res) => {
  try {
    const { applicationId, phoneNumber } = req.body;

    // Validation
    if (!applicationId || !phoneNumber) {
      return res.status(400).json({
        error: 'Validation failed',
        details: 'Application ID and phone number are required.'
      });
    }

    const application = await LoanApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({
        error: 'Not Found',
        details: 'Loan application not found.'
      });
    }

    if (application.paymentStatus === 'completed') {
      return res.status(400).json({
        error: 'Payment already completed',
        details: 'This loan application has already been paid for.'
      });
    }

    // Auto-format phone number: if user enters 9 digits, prepend 254
    let formattedPhoneNumber = phoneNumber;
    if (/^[0-9]{9}$/.test(phoneNumber)) {
      // User entered 9 digits, prepend 254
      formattedPhoneNumber = `254${phoneNumber}`;
    } else if (!/^254[0-9]{9}$/.test(phoneNumber)) {
      // Not 9 digits and not valid 254XXXXXXXXX format
      return res.status(400).json({
        error: 'Invalid phone number',
        details: 'Please enter a valid Kenyan phone number (9 digits like 713159136 or full format 254713159136)'
      });
    }

    const accountReference = `LA${application._id.toString().slice(-8)}`;
    const transactionDesc = `Empowerment Loan - ${application.firstName} ${application.lastName}`;

    const stkPushResponse = await initiateStkPush(
      formattedPhoneNumber,
      application.amount,
      accountReference,
      transactionDesc
    );

    // Update application with payment reference
    application.paymentReference = stkPushResponse.CheckoutRequestID;
    await application.save();

    res.status(200).json({
      message: 'Payment initiated successfully. Please check your phone for M-Pesa prompt.',
      success: true,
      data: {
        checkoutRequestId: stkPushResponse.CheckoutRequestID,
        merchantRequestId: stkPushResponse.MerchantRequestID,
        amount: application.amount,
        phoneNumber: phoneNumber
      }
    });
  } catch (error) {
    console.error('Error initiating payment:', error);

    // Handle specific error types
    if (error.message.includes('Payment initiation failed')) {
      return res.status(400).json({
        error: 'Payment Error',
        details: error.message
      });
    } else if (error.message.includes('timed out')) {
      return res.status(408).json({
        error: 'Request Timeout',
        details: 'Payment request timed out. Please try again.'
      });
    }

    res.status(500).json({
      error: 'Server Error',
      details: 'Failed to initiate payment. Please try again later.'
    });
  }
});

// M-Pesa callback
app.post('/api/mpesa/callback', async (req, res) => {
  try {
    console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

    const { Body } = req.body;
    if (!Body || !Body.stkCallback) {
      return res.status(400).json({ error: 'Invalid callback data' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc } = Body.stkCallback;

    // Find application by payment reference
    const application = await LoanApplication.findOne({ paymentReference: CheckoutRequestID });
    if (!application) {
      console.log(`Application not found for CheckoutRequestID: ${CheckoutRequestID}`);
      return res.status(404).json({ error: 'Application not found' });
    }

    // Update payment status based on result code
    if (ResultCode === 0) {
      // Payment successful
      application.paymentStatus = 'completed';
      application.status = 'approved';
      console.log(`Payment completed for application: ${application._id}`);
    } else {
      // Payment failed
      application.paymentStatus = 'failed';
      console.log(`Payment failed for application: ${application._id}, Reason: ${ResultDesc}`);
    }

    await application.save();

    res.status(200).json({ message: 'Callback processed successfully' });
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error);
    res.status(500).json({ error: 'Failed to process callback' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'Empowerment Loan API',
    timestamp: new Date().toISOString(),
    environment: DARAJA_CONFIG.environment
  });
});

// B2C Payment Request - Disburse loan to customer
app.post('/api/mpesa/b2c', async (req, res) => {
  try {
    const { phoneNumber, amount, remarks } = req.body;

    if (!phoneNumber || !amount || !remarks) {
      return res.status(400).json({ error: 'Phone number, amount, and remarks are required' });
    }

    const accessToken = await getDarajaAccessToken();

    // Generate security credential (you'll need to implement this)
    const securityCredential = generateSecurityCredential();

    const b2cData = {
      InitiatorName: process.env.B2C_INITIATOR_NAME,
      SecurityCredential: securityCredential,
      CommandID: 'BusinessPayment',
      Amount: amount,
      PartyA: DARAJA_CONFIG.businessShortCode,
      PartyB: phoneNumber,
      Remarks: remarks,
      QueueTimeOutURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/b2c/timeout`,
      ResultURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/b2c/result`,
      Occasion: 'Loan Disbursement'
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest`,
      b2cData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('B2C Payment initiated:', response.data);
    res.json({
      success: true,
      message: 'Loan disbursement initiated successfully',
      data: response.data
    });

  } catch (error) {
    console.error('B2C Payment error:', error);
    res.status(500).json({ error: 'Failed to initiate loan disbursement' });
  }
});

// B2C Result callback
app.post('/api/mpesa/b2c/result', (req, res) => {
  console.log('B2C Result Callback:', JSON.stringify(req.body, null, 2));
  // Process B2C payment result
  res.json({ message: 'B2C result received' });
});

// B2C Timeout callback
app.post('/api/mpesa/b2c/timeout', (req, res) => {
  console.log('B2C Timeout Callback:', JSON.stringify(req.body, null, 2));
  // Handle B2C timeout
  res.json({ message: 'B2C timeout received' });
});

// Transaction Status Query
app.post('/api/mpesa/transaction-status', async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const accessToken = await getDarajaAccessToken();
    const securityCredential = generateSecurityCredential();

    const statusData = {
      Initiator: process.env.B2C_INITIATOR_NAME,
      SecurityCredential: securityCredential,
      CommandID: 'TransactionStatusQuery',
      TransactionID: transactionId,
      PartyA: DARAJA_CONFIG.businessShortCode,
      IdentifierType: '4',
      ResultURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/status/result`,
      QueueTimeOutURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/status/timeout`,
      Remarks: 'Transaction status check',
      Occasion: 'Status Query'
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/mpesa/transactionstatus/v1/query`,
      statusData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Transaction status query initiated',
      data: response.data
    });

  } catch (error) {
    console.error('Transaction status query error:', error);
    res.status(500).json({ error: 'Failed to query transaction status' });
  }
});

// Account Balance Query
app.post('/api/mpesa/account-balance', async (req, res) => {
  try {
    const accessToken = await getDarajaAccessToken();
    const securityCredential = generateSecurityCredential();

    const balanceData = {
      Initiator: process.env.B2C_INITIATOR_NAME,
      SecurityCredential: securityCredential,
      CommandID: 'AccountBalance',
      PartyA: DARAJA_CONFIG.businessShortCode,
      IdentifierType: '4',
      Remarks: 'Account balance check',
      QueueTimeOutURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/balance/timeout`,
      ResultURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/balance/result`
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/mpesa/accountbalance/v1/query`,
      balanceData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Account balance query initiated',
      data: response.data
    });

  } catch (error) {
    console.error('Account balance query error:', error);
    res.status(500).json({ error: 'Failed to query account balance' });
  }
});

// Transaction Reversal
app.post('/api/mpesa/reverse-transaction', async (req, res) => {
  try {
    const { transactionId, amount, receiverParty } = req.body;

    if (!transactionId || !amount || !receiverParty) {
      return res.status(400).json({ error: 'Transaction ID, amount, and receiver party are required' });
    }

    const accessToken = await getDarajaAccessToken();
    const securityCredential = generateSecurityCredential();

    const reversalData = {
      Initiator: process.env.B2C_INITIATOR_NAME,
      SecurityCredential: securityCredential,
      CommandID: 'TransactionReversal',
      TransactionID: transactionId,
      Amount: amount,
      ReceiverParty: receiverParty,
      RecieverIdentifierType: '4',
      ResultURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/reversal/result`,
      QueueTimeOutURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/reversal/timeout`,
      Remarks: 'Transaction reversal',
      Occasion: 'Reversal'
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/mpesa/reversal/v1/request`,
      reversalData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Transaction reversal initiated',
      data: response.data
    });

  } catch (error) {
    console.error('Transaction reversal error:', error);
    res.status(500).json({ error: 'Failed to reverse transaction' });
  }
});

// Standing Order (Ratiba) - Recurring payments
app.post('/api/mpesa/standing-order', async (req, res) => {
  try {
    const { phoneNumber, amount, frequency, startDate, endDate, accountReference } = req.body;

    if (!phoneNumber || !amount || !frequency || !startDate || !endDate || !accountReference) {
      return res.status(400).json({ error: 'All fields are required for standing order' });
    }

    const accessToken = await getDarajaAccessToken();

    const standingOrderData = {
      StandingOrderName: `Loan Repayment - ${accountReference}`,
      BusinessShortCode: DARAJA_CONFIG.businessShortCode,
      TransactionType: 'Standing Order Customer Pay Bill',
      Amount: amount,
      PartyA: phoneNumber,
      ReceiverPartyIdentifierType: '4',
      CallBackURL: `${process.env.BASE_URL || 'https://your-render-backend.onrender.com'}/api/mpesa/standing-order/callback`,
      AccountReference: accountReference,
      TransactionDesc: 'Recurring loan repayment',
      Frequency: frequency, // DAILY, WEEKLY, MONTHLY
      StartDate: startDate, // YYYY-MM-DD
      EndDate: endDate // YYYY-MM-DD
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/standingorder/v1/createStandingOrderExternal`,
      standingOrderData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    res.json({
      success: true,
      message: 'Standing order created successfully',
      data: response.data
    });

  } catch (error) {
    console.error('Standing order creation error:', error);
    res.status(500).json({ error: 'Failed to create standing order' });
  }
});

// C2B Payment Simulation (for testing)
app.post('/api/mpesa/c2b/simulate', async (req, res) => {
  try {
    const { shortCode, amount, msisdn, billRefNumber } = req.body;

    if (!shortCode || !amount || !msisdn || !billRefNumber) {
      return res.status(400).json({ error: 'ShortCode, amount, MSISDN, and BillRefNumber are required' });
    }

    const accessToken = await getDarajaAccessToken();

    const c2bData = {
      ShortCode: shortCode,
      CommandID: 'CustomerPayBillOnline',
      Amount: amount,
      Msisdn: msisdn,
      BillRefNumber: billRefNumber
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/mpesa/c2b/v1/simulate`,
      c2bData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('C2B Payment simulated:', response.data);
    res.json({
      success: true,
      message: 'C2B payment simulated successfully',
      data: response.data
    });

  } catch (error) {
    console.error('C2B simulation error:', error);
    res.status(500).json({ error: 'Failed to simulate C2B payment' });
  }
});

// Register C2B URLs
app.post('/api/mpesa/c2b/register-urls', async (req, res) => {
  try {
    const { shortCode, responseType, confirmationUrl, validationUrl } = req.body;

    if (!shortCode || !responseType || !confirmationUrl || !validationUrl) {
      return res.status(400).json({ error: 'ShortCode, ResponseType, ConfirmationURL, and ValidationURL are required' });
    }

    const accessToken = await getDarajaAccessToken();

    const registerData = {
      ShortCode: shortCode,
      ResponseType: responseType,
      ConfirmationURL: confirmationUrl,
      ValidationURL: validationUrl
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl`,
      registerData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('C2B URLs registered:', response.data);
    res.json({
      success: true,
      message: 'C2B URLs registered successfully',
      data: response.data
    });

  } catch (error) {
    console.error('C2B URL registration error:', error);
    res.status(500).json({ error: 'Failed to register C2B URLs' });
  }
});

// Pull Transactions - Register URL
app.post('/api/mpesa/pull/register', async (req, res) => {
  try {
    const { shortCode, requestType, nominatedNumber, callBackURL } = req.body;

    if (!shortCode || !requestType || !nominatedNumber || !callBackURL) {
      return res.status(400).json({ error: 'ShortCode, RequestType, NominatedNumber, and CallBackURL are required' });
    }

    const accessToken = await getDarajaAccessToken();

    const registerData = {
      ShortCode: shortCode,
      RequestType: requestType,
      NominatedNumber: nominatedNumber,
      CallBackURL: callBackURL
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/pulltransactions/v1/register`,
      registerData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('Pull transactions URL registered:', response.data);
    res.json({
      success: true,
      message: 'Pull transactions URL registered successfully',
      data: response.data
    });

  } catch (error) {
    console.error('Pull transactions registration error:', error);
    res.status(500).json({ error: 'Failed to register pull transactions URL' });
  }
});

// Pull Transactions - Query
app.post('/api/mpesa/pull/query', async (req, res) => {
  try {
    const { shortCode, startDate, endDate, offSetValue } = req.body;

    if (!shortCode || !startDate || !endDate) {
      return res.status(400).json({ error: 'ShortCode, StartDate, and EndDate are required' });
    }

    const accessToken = await getDarajaAccessToken();

    const queryData = {
      ShortCode: shortCode,
      StartDate: startDate, // Format: YYYY-MM-DD HH:mm:ss
      EndDate: endDate,     // Format: YYYY-MM-DD HH:mm:ss
      OffSetValue: offSetValue || '0'
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/pulltransactions/v1/query`,
      queryData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('Pull transactions query successful:', response.data);
    res.json({
      success: true,
      message: 'Pull transactions query successful',
      data: response.data
    });

  } catch (error) {
    console.error('Pull transactions query error:', error);
    res.status(500).json({ error: 'Failed to query pull transactions' });
  }
});

// B2B Payment Request
app.post('/api/mpesa/b2b', async (req, res) => {
  try {
    const { initiator, securityCredential, commandID, senderIdentifierType, recieverIdentifierType, amount, partyA, partyB, accountReference, remarks, queueTimeOutURL, resultURL } = req.body;

    if (!initiator || !securityCredential || !commandID || !senderIdentifierType || !recieverIdentifierType || !amount || !partyA || !partyB || !accountReference || !remarks || !queueTimeOutURL || !resultURL) {
      return res.status(400).json({ error: 'All B2B payment fields are required' });
    }

    const accessToken = await getDarajaAccessToken();

    const b2bData = {
      Initiator: initiator,
      SecurityCredential: securityCredential,
      CommandID: commandID,
      SenderIdentifierType: senderIdentifierType,
      RecieverIdentifierType: recieverIdentifierType,
      Amount: amount,
      PartyA: partyA,
      PartyB: partyB,
      AccountReference: accountReference,
      Remarks: remarks,
      QueueTimeOutURL: queueTimeOutURL,
      ResultURL: resultURL
    };

    const response = await axios.post(
      `https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest`,
      b2bData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('B2B Payment initiated:', response.data);
    res.json({
      success: true,
      message: 'B2B payment initiated successfully',
      data: response.data
    });

  } catch (error) {
    console.error('B2B Payment error:', error);
    res.status(500).json({ error: 'Failed to initiate B2B payment' });
  }
});

// Helper function to generate security credential
function generateSecurityCredential() {
  // This is a placeholder - you'll need to implement proper security credential generation
  // using your actual certificate and encryption
  return process.env.SECURITY_CREDENTIAL || 'PLACEHOLDER_SECURITY_CREDENTIAL';
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    details: 'An unexpected error occurred. Please try again later.'
  });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    details: 'The requested resource does not exist.'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${DARAJA_CONFIG.environment}`);
  console.log(`💳 Daraja Business Shortcode: ${DARAJA_CONFIG.businessShortCode}`);
  console.log(`📡 Callback URL: ${DARAJA_CONFIG.callbackUrl}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});
