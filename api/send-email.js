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
    // Initialize Brevo client
    let defaultClient = SibApiV3Sdk.ApiClient.instance;
    let apiKey = defaultClient.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY; // must be set in Vercel

    const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

    const sendSmtpEmail = {
      to: [{ email: clientEmail }],
      sender: { email: 'noreply@brevo.com', name: 'Appointment Reminder' },
      subject: 'Appointment Reminder',
      htmlContent: `<html><body>${message}</body></html>`,
    };

    const response = await tranEmailApi.sendTransacEmail(sendSmtpEmail);

    console.log('Brevo API response:', response);

    // Always return JSON
    return res.status(200).json({ success: true, info: response });

  } catch (err) {
    console.error('Brevo API error:', err);

    // Always return JSON for frontend
    return res.status(500).json({
      error: 'Failed to send email',
      details: typeof err === 'string' ? err : (err.message || 'Unknown error'),
    });
  }
}
