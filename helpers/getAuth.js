import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
function basicAuthorizationMiddleware(req, res, next) {
  const url =
    'https://924b88d5trial.authentication.us10.hana.ondemand.com/oauth/token';
  const clientID = process.env.CPI_CLIENT_ID;
  const clientSecret = process.env.CPI_CLIENT_SECRET;
  const authString = Buffer.from(`${clientID}:${clientSecret}`).toString(
    'base64'
  );

  axios
    .post(url, 'grant_type=client_credentials', {
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
    .then((response) => {
      const accessToken = response.data.access_token;
      req.headers['Authorization'] = `Bearer ${accessToken}`;
      next();
    })
    .catch((error) => {
      console.error('Error fetching access token:', error);
      res.status(500).json({ error: 'Failed to authenticate' });
    });
}

export { basicAuthorizationMiddleware };
