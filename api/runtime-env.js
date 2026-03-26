export default function handler(req, res) {
  const env = process.env.VERCEL_ENV || "development";
  const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
  const isQa = env === "preview" || /qa/i.test(branch);

  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    label: isQa ? "DEV" : env === "production" ? "Production" : "Local",
    env,
    branch
  });
}
