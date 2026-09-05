/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow DOCX uploads through server actions if used
    },
  },
};

module.exports = nextConfig;
