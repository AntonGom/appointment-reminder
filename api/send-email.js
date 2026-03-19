// /api/send-email.js
import SibApiV3Sdk from 'sib-api-v3-sdk';

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientEmail, message } = req.body;

  if (!clientEmail || !message) {
    return res.status(400).json({ error: 'Missing clientEmail or message' });
  }

  // Initialize Brevo client
  let defaultClient = SibApiV3Sdk.ApiClient.instance;
  let apiKey = defaultClient.authentications['api-key'];
  apiKey.apiKey = process.env.BREVO_API_KEY; // Make sure this is set in Vercel

  const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

  // Use Brevo shared sender for testing
  const sendSmtpEmail = {
    to: [{ email: clientEmail }],
    sender: { email: 'noreply@brevo.com', name: 'Appointment Reminder' },
    subject: 'Appointment Reminder',
    htmlContent: `<html><body>${message}</body></html>`,
  };

  try {
    const response = await tranEmailApi.sendTransacEmail(sendSmtpEmail);

    console.log('Brevo API response:', response);

    // Success — return to frontend
    return res.status(200).json({ success: true, info: response });
  } catch (err) {
    console.error('Brevo API error:', err);

    return res.status(500).json({
      error: 'Failed to send email',
      details: err.response?.body || err.message || err,
    });
  }
}
