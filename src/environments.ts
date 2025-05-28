import {config} from "dotenv";

if (process.env.NODE_ENV !== 'test') {
  config();
}

const env = {
  key: process.env.SH_KEY || 'UQL7VpL51OAVvtZQk2Xd',

  username: process.env.SH_USERNAME || 'admin',
  password: process.env.SH_PASSWORD || 'admin124!',

  auth2ClientId: process.env.SH_AUTH2_CLIENT_ID || '5IRJ5rSNSqqqPT2',
  auth2ClientSecret: process.env.SH_AUTH2_CLIENT_SECRET || '6RP64F4sHkZ7FTcCQoZZ6S5Ot',
  auth2redirectUri: process.env.SH_AUTH2_REDIRECT_URI || 'REDIRECT_URI',
  googleUserId: process.env.SH_GOOGLE_USER_ID || 'cfrombBECh1bi9N',

  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: process.env.DB_PORT || 27017,
  dbName: process.env.DB_NAME || 'smarthome',

  apiHost: process.env.API_HOST || 'http://localhost',
};

export default env;
