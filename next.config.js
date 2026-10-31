const nextConfig = {
  reactStrictMode: true,
  images: {
    // Media is served from an authenticated internal route (/api/media/[id]).
    // The built-in Next.js Image Optimizer fetches images server-side and does
    // not forward the auth cookie, which made every avatar/cover/post image
    // fail to load. Disabling optimization lets the browser fetch images
    // directly (with cookies), fixing broken images across the whole app.
    unoptimized: true
  }
};

module.exports = nextConfig;
