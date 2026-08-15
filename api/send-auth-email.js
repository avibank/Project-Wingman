import crypto from "crypto";

const SUBJECTS = {
  signup: "Confirm your email address",
  recovery: "Reset your password",
  magiclink: "Your sign-in link",
  email_change: "Confirm your new email address",
  invite: "You've been invited",
};

function verifySignature(payload, headers, secret) {
  const webhookId = headers["webhook-id"];
  const webhookTimestamp = headers["webhook-timestamp"];
  const webhookSignature = headers["webhook-signature"];
  if (!webhookId || !webhookTimestamp || !webhookSignature) return false;

  const signedContent = `${webhookId}.${webhookTimestamp}.${payload}`;
  const secretBytes = Buffer.from(secret.split("_")[1], "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const provided = webhookSignature.split(" ").map((s) => s.split(",")[1]);
  return provided.includes(expected);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const secret = process.env.SEND_EMAIL_HOOK_SECRET;
  const rawBody = JSON.stringify(req.body);

  if (!secret || !verifySignature(rawBody, req.headers, secret)) {
    return res.status(401).send("Invalid signature");
  }

  const { user, email_data } = req.body;
  const { token_hash, redirect_to, email_action_type } = email_data;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  const actionUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`;
  const subject = SUBJECTS[email_action_type] || "Action required";

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Project Wingman <hello@wingman.institute>",
      to: user.email,
      subject,
      html: `<p>Follow the link below to continue.</p><p><a href="${actionUrl}">${subject}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
    }),
  });

  if (!resendResponse.ok) {
    const errText = await resendResponse.text();
    return res.status(500).send(`Resend error: ${errText}`);
  }

  return res.status(200).send("ok");
}
