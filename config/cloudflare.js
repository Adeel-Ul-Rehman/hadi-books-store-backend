export const cloudflareConfig = {
  clientID: process.env.CLOUDFLARE_CLIENT_ID,
  clientSecret: process.env.CLOUDFLARE_CLIENT_SECRET,
  domain: process.env.CLOUDFLARE_DOMAIN,
  audience: process.env.CLOUDFLARE_AUDIENCE,
  callbackURL: process.env.CLOUDFLARE_CALLBACK_URL || "/api/auth/google/callback"
};