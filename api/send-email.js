export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { clientEmail, message } = req.body;
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || "Appointment Reminder";
    const copyEmail = process.env.BREVO_COPY_EMAIL || "";

    if (!apiKey) {
      return res.status(500).json({ error: "Missing BREVO_API_KEY in Vercel environment variables." });
    }

    if (!senderEmail) {
      return res.status(500).json({ error: "Missing BREVO_SENDER_EMAIL in Vercel environment variables." });
    }

    if (!clientEmail || !message) {
      return res.status(400).json({ error: "clientEmail and message are required." });
    }

    const htmlMessage = `<p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`;

    await sendBrevoEmail({
      apiKey,
      senderEmail,
      senderName,
      toEmail: clientEmail,
      subject: "Appointment Reminder",
      htmlContent: htmlMessage
    });

    if (copyEmail && copyEmail !== clientEmail) {
      await sendBrevoEmail({
        apiKey,
        senderEmail,
        senderName,
        toEmail: copyEmail,
        subject: "Copy of Reminder",
        htmlContent: htmlMessage
      });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    return res.status(500).json({ error: err.message || "Failed to send email." });
  }
}

async function sendBrevoEmail({ apiKey, senderEmail, senderName, toEmail, subject, htmlContent }) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey
    },
    body: JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [{ email: toEmail }],
      subject,
      htmlContent
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Brevo error (${response.status}): ${errorText}`);
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
