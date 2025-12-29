const axios = require('axios');
require('dotenv').config();

// Test Daraja API credentials
async function testDarajaCredentials() {
    console.log('🧪 Testing Daraja API Credentials...\n');

    const consumerKey = process.env.DARAJA_CONSUMER_KEY;
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
    const passkey = process.env.DARAJA_PASSKEY;

    console.log('📋 Configuration Check:');
    console.log(`Consumer Key: ${consumerKey ? `${consumerKey.substring(0, 10)}...` : '❌ MISSING'}`);
    console.log(`Consumer Secret: ${consumerSecret ? `${consumerSecret.substring(0, 10)}...` : '❌ MISSING'}`);
    console.log(`Passkey: ${passkey ? `${passkey.substring(0, 10)}...` : '❌ MISSING'}`);
    console.log('');

    if (!consumerKey || !consumerSecret) {
        console.log('❌ Missing credentials! Please check your .env file.');
        return;
    }

    try {
        const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
        console.log('🔐 Testing OAuth token generation...');

        const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });

        if (response.data && response.data.access_token) {
            console.log('✅ SUCCESS! Credentials are valid');
            console.log(`🎫 Access Token: ${response.data.access_token.substring(0, 20)}...`);
            console.log(`⏰ Expires in: ${response.data.expires_in} seconds`);
            console.log('');
            console.log('🎉 Your Daraja API integration should work properly!');
        } else {
            console.log('❌ Unexpected response format:', response.data);
        }

    } catch (error) {
        console.log('❌ FAILED! Credential test failed');

        if (error.response) {
            console.log(`📊 Status: ${error.response.status} ${error.response.statusText}`);
            console.log(`📄 Response:`, JSON.stringify(error.response.data, null, 2));

            if (error.response.status === 400) {
                console.log('');
                console.log('🔍 DIAGNOSIS: Invalid credentials');
                console.log('💡 SOLUTION: Please check your Daraja API credentials:');
                console.log('   1. Go to https://developer.safaricom.co.ke/');
                console.log('   2. Login to your account');
                console.log('   3. Go to your app and regenerate credentials');
                console.log('   4. Update your .env file with new credentials');
            } else if (error.response.status === 401) {
                console.log('');
                console.log('🔍 DIAGNOSIS: Unauthorized access');
                console.log('💡 SOLUTION: Your credentials might be expired or invalid');
            }
        } else {
            console.log('🌐 Network Error:', error.message);
        }
    }
}

// Run the test
testDarajaCredentials();
