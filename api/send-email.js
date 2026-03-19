export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { clientEmail, message } = req.body;

    const userEmail = "antoniogomezt1@gmail.com";

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: "Appointment Reminder",
          email: userEmail
        },
        to: [{ email: clientEmail }],
        subject: "Appointment Reminder",
        htmlContent: `<p>${message}</p>`
      })
    });

    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: {
          name: "Copy of Reminder",
          email: userEmail
        },
        to: [{ email: userEmail }],
        subject: "Copy of Reminder",
        htmlContent: `<p>${message}</p>`
      })
    });

    res.status(200).json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}