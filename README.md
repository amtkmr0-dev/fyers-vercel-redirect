# Fyers Vercel Redirect

A minimal Vercel serverless function to capture Fyers API auth_code for manual authentication.

## How to use

1. Upload this folder to a new GitHub repo (or drag-and-drop to Vercel dashboard).
2. Deploy on Vercel (https://vercel.com/).
3. Set your Fyers redirect URI to: `https://<your-vercel-app>.vercel.app/redirect`
4. After login, copy the `auth_code` from the page and use it in your script.

## Files
- `api/redirect.js`: Serverless function to display the auth_code
- `vercel.json`: Clean URL routing
