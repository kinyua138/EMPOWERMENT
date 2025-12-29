# Empowerment Loan Website

A modern loan application website with M-Pesa payment integration for empowering youth through financial services.

## Features

- Responsive loan application form
- M-Pesa payment integration
- Real-time application processing
- Secure payment handling
- Mobile-first design

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Payment:** M-Pesa Daraja API
- **Deployment:** Netlify (Frontend), Render (Backend)

## Local Development

### Prerequisites
- Node.js (v16 or higher)
- MongoDB
- Git

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm start
```

## Deployment

### Frontend (Netlify)

1. **Connect Repository:**
   - Go to [Netlify](https://netlify.com)
   - Sign in or create account
   - Click "New site from Git"
   - Connect your Git repository
   - Select the repository

2. **Configure Build Settings:**
   - **Branch to deploy:** `main` (or your default branch)
   - **Build command:** `echo 'No build step required'`
   - **Publish directory:** `frontend/`

3. **Deploy:**
   - Click "Deploy site"
   - Wait for deployment to complete
   - Note the generated URL (e.g., `https://amazing-site.netlify.app`)

### Backend (Render)

1. **Connect Repository:**
   - Go to [Render](https://render.com)
   - Sign in or create account
   - Click "New +" → "Web Service"
   - Connect your Git repository

2. **Configure Service:**
   - **Name:** `empowerment-backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

3. **Environment Variables:**
   Set the following environment variables in Render dashboard:

   ```
   NODE_ENV=production
   PORT=10000
   MONGO_URI=your_mongodb_connection_string
   DARAJA_CONSUMER_KEY=your_daraja_consumer_key
   DARAJA_CONSUMER_SECRET=your_daraja_consumer_secret
   DARAJA_BUSINESS_SHORTCODE=your_business_shortcode
   DARAJA_PASSKEY=your_daraja_passkey
   DARAJA_ENVIRONMENT=production
   BUSINESS_OWNER=Your Name
   BUSINESS_PHONE=+254XXXXXXXXX
   BUSINESS_EMAIL=your@email.com
   BASE_URL=https://your-render-backend.onrender.com
   CORS_ORIGIN=https://your-netlify-site.netlify.app
   ```

4. **Deploy:**
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note the generated URL (e.g., `https://empowerment-backend.onrender.com`)

### Post-Deployment Configuration

1. **Update Frontend API URL:**
   - In `frontend/js/script.js`, update the `API_BASE_URL`:
   ```javascript
   const API_BASE_URL = 'https://your-render-backend.onrender.com';
   ```
   - Commit and push the changes
   - Netlify will auto-deploy

2. **Update Backend CORS:**
   - In Render dashboard, update `CORS_ORIGIN` with your Netlify URL
   - Redeploy backend

## Testing

### API Endpoints
- **Health Check:** `GET /api/health`
- **Submit Application:** `POST /api/submit-application`
- **Initiate Payment:** `POST /initiate-payment`

### Testing Commands
```bash
# Test health endpoint
curl https://your-backend-url.onrender.com/api/health

# Test application submission
curl -X POST https://your-backend-url.onrender.com/api/submit-application \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "254712345678",
    "amount": "5000",
    "purpose": "Education"
  }'
```

## Environment Variables

### Required for Production
- `MONGO_URI`: MongoDB connection string
- `DARAJA_CONSUMER_KEY`: M-Pesa Daraja API consumer key
- `DARAJA_CONSUMER_SECRET`: M-Pesa Daraja API consumer secret
- `DARAJA_BUSINESS_SHORTCODE`: Your M-Pesa business shortcode
- `DARAJA_PASSKEY`: M-Pesa passkey
- `CORS_ORIGIN`: Frontend URL for CORS

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License

## Support

For support, email services@empowerment.co.ke or create an issue in this repository.
