export default function handler(req, res) {
  const apiKey = process.env.BREVO_API_KEY || "";
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "";
  const senderName = process.env.BREVO_SENDER_NAME || "";
  const copyEmail = process.env.BREVO_COPY_EMAIL || "";

  return res.status(200).json({
    brevoApiKey: {
      exists: Boolean(apiKey),
      length: apiKey.length,
      prefix: apiKey ? apiKey.slice(0, 4) : ""
    },
    brevoSenderEmail: {
      exists: Boolean(senderEmail),
      value: senderEmail || null
    },
    brevoSenderName: {
      exists: Boolean(senderName),
      value: senderName || null
    },
    brevoCopyEmail: {
      exists: Boolean(copyEmail),
      value: copyEmail || null
    }
  });
}
