export default function handler(req, res) {
  const address = String(req.query.address || "").trim();
  const apiKey = process.env.GOOGLE_MAPS_EMBED_API_KEY || "";

  res.setHeader("Cache-Control", "no-store");

  if (!address) {
    res.status(400).json({
      enabled: false,
      error: "Address is required."
    });
    return;
  }

  if (!apiKey) {
    res.status(200).json({
      enabled: false,
      error: "Add GOOGLE_MAPS_EMBED_API_KEY in Vercel to enable the map preview."
    });
    return;
  }

  const src = `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(address)}`;

  res.status(200).json({
    enabled: true,
    src
  });
}
