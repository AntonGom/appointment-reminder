export default function handler(req, res) {
  const apiKey = String(process.env.BREVO_API_KEY || "");
  const senderEmail = String(process.env.BREVO_SENDER_EMAIL || "");

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    env: process.env.VERCEL_ENV || "development",
    branch: process.env.VERCEL_GIT_COMMIT_REF || "",
    brevoApiKey: {
      exists: Boolean(apiKey),
      length: apiKey.length,
      prefix: apiKey.slice(0, 4)
    },
    brevoSenderEmail: {
      exists: Boolean(senderEmail),
      value: senderEmail || null
    }
  });
}
