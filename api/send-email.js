// /api/send-email.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { clientEmail, message } = req.body;

  // Validate inputs
  if (!clientEmail || !message) {
    return res.status(400).json({ error: 'Missing email or message' });
  }

  try {
    // Send email through Brevo
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY // Make sure this is set in Vercel env variables
      },
      body: JSON.stringify({
        sender: {
          name: 'Appointment Reminder',
          email: 'antoniogomezt1@gmail.com' // Your verified Brevo sender
        },
        to: [{ email: clientEmail }],
        subject: 'Appointment Reminder',
        htmlContent: `<p>${message.replace(/\n/g, '<br>')}</p>`
      })
    });

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true, data });
    } else {
      console.error("Brevo API error:", data);
      return res.status(500).json({ success: false, details: JSON.stringify(data) });
    }
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ success: false, details: err.message });
  }
}
