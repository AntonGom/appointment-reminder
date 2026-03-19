// /api/send-email.js
import SibApiV3Sdk from 'sib-api-v3-sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientEmail, message } = req.body;

  if (!clientEmail || !message) {
    return res.status(400).json({ error: 'Missing clientEmail or message' });
  }

  try {
    // Brevo client setup
    const defaultClient = SibApiV3Sdk.ApiClient.instance;
    defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;

    const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      to: [{ email: clientEmail }],
      sender: { email: 'noreply@brevo.com', name: 'Appointment Reminder' }, // shared sender
      subject: 'Appointment Reminder',
      htmlContent: `<html><body>${message}</body></html>`,
    };

    const response = await tranEmailApi.sendTransacEmail(sendSmtpEmail);

    console.log('✅ Brevo response:', response);

    // ALWAYS return JSON
    res.status(200).json({ success: true, info: response });
  } catch (err) {
    console.error('❌ Brevo API error:', err);

    // Return JSON no matter what
    res.status(500).json({
      error: 'Failed to send email',
      details: err.response?.body || err.message || JSON.stringify(err),
    });
  }
}
