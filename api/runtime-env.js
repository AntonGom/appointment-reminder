export default function handler(req, res) {
  const env = process.env.VERCEL_ENV || "development";
  const branch = process.env.VERCEL_GIT_COMMIT_REF || "";
  const commitSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7);
  const version = process.env.APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || "20260429.1";
  const isQa = env === "preview" || /qa/i.test(branch);

  res.setHeader("Cache-Control", "no-store");

  res.status(200).json({
    label: isQa ? "DEV" : env === "production" ? "Production" : "Local",
    env,
    branch,
    version,
    commitSha
  });
}
