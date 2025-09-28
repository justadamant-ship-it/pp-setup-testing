const KiteConnect = require('kiteconnect').KiteConnect;
require('dotenv').config();

const apiKey = process.env.KITE_API_KEY;
const apiSecret = process.env.KITE_API_SECRET;

const kite = new KiteConnect({
  api_key: apiKey
});

console.log('\n=== Kite Connect - Get Access Token ===\n');
console.log('Step 1: Click this URL to login:\n');

const loginUrl = kite.getLoginURL();
console.log(loginUrl);

console.log('\n\nStep 2: After login, you will be redirected to a URL like:');
console.log('http://127.0.0.1/?request_token=XXXXX&action=login&status=success');
console.log('\nCopy the request_token value from that URL\n');

console.log('Step 3: Run this command with your request token:');
console.log('node getAccessToken.js YOUR_REQUEST_TOKEN_HERE\n');

// If request token provided, generate session
const requestToken = process.argv[2];

if (requestToken) {
  console.log('Generating access token...\n');
  
  kite.generateSession(requestToken, apiSecret)
    .then(response => {
      console.log('✓ Success! Your access token is:\n');
      console.log(response.access_token);
      console.log('\n\nCopy this token and add it to your .env file:');
      console.log(`KITE_ACCESS_TOKEN=${response.access_token}`);
      console.log('\n');
    })
    .catch(error => {
      console.error('❌ Error:', error.message);
    });
}