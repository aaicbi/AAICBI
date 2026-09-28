/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // allow DOCX uploads through server actions if used
    },
    // Real production bug, confirmed via InstructorAgreement.pdfAttachmentError
    // (see that field's own comment): @react-pdf/renderer's underlying
    // pdfkit dependency loads its standard-14 font files (Helvetica,
    // Courier, etc.) via a runtime require() built from a string, which
    // Vercel's build-time file tracer can't follow statically — the
    // exact files (node_modules/pdfkit/js/standard-fonts/*.cjs) were
    // simply missing from the deployed function bundle, throwing
    // "Cannot find module ... Helvetica.cjs" the moment any PDF
    // (agreement letters, course curricula, performance exports — every
    // @react-pdf/renderer document in this app uses these fonts) tried
    // to render on Vercel, while working perfectly in local dev the
    // whole time. Forcing inclusion here fixes all of them at once,
    // not just the one that happened to get diagnosed first.
    outputFileTracingIncludes: {
      "/api/**/*": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
    },
  },
};

module.exports = nextConfig;
