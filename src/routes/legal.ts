import { Router, Request, Response } from "express";

// Public legal pages served as HTML. Used both for the App Store Connect
// "Privacy Policy URL" and rendered in-app via a WebView.
//
// NOTE: This is solid boilerplate to pass App Store review, not legal advice.
// Replace the [BRACKETED] placeholders with real details and have it reviewed.

const SUPPORT_EMAIL = "hallo@junivia.de";
const APP_NAME = "Junivia";
const COMPANY = "[COMPANY LEGAL NAME]";
const JURISDICTION = "[COUNTRY / STATE]";
const EFFECTIVE_DATE = "[EFFECTIVE DATE]";

const BASE_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 20px 20px 64px;
    font-family: -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
    color: #1B2422;
    background: #FBF7F1;
    font-size: 16px;
    line-height: 1.6;
    -webkit-text-size-adjust: 100%;
  }
  h1 { font-size: 24px; letter-spacing: -0.4px; margin: 0 0 4px; }
  h2 { font-size: 18px; letter-spacing: -0.2px; margin: 28px 0 8px; }
  p, li { color: #2C3633; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; }
  a { color: #1F4A41; }
  .meta { color: #8B928F; font-size: 13px; margin: 0 0 20px; }
  .muted { color: #8B928F; font-size: 13px; }
`;

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>${BASE_CSS}</style>
<title>${title}</title>
</head><body>
<h1>${title}</h1>
<p class="meta">${APP_NAME} · Last updated ${EFFECTIVE_DATE}</p>
${body}
<p class="muted">Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
</body></html>`;
}

const PRIVACY_BODY = `
<p>This Privacy Policy explains how ${COMPANY} ("we", "us") collects, uses, and
protects your information when you use the ${APP_NAME} mobile application (the
"App").</p>

<h2>Information we collect</h2>
<ul>
  <li><strong>Account information:</strong> the email address and password you
  provide when you create an account. Passwords are stored only in hashed form.</li>
  <li><strong>Gameplay data:</strong> your puzzle progress, chosen difficulty
  levels, completion times, and related statistics, so we can sync your progress
  across sessions and devices.</li>
  <li><strong>Purchase data:</strong> when you subscribe, your purchase is
  processed by Apple. We receive a subscription status (active / inactive) via
  our payments provider; we never receive your card details.</li>
  <li><strong>Diagnostic data:</strong> basic, non-identifying technical logs
  used to keep the App running reliably.</li>
</ul>

<h2>How we use your information</h2>
<ul>
  <li>To provide and sync your account and gameplay progress.</li>
  <li>To manage subscriptions and unlock premium content.</li>
  <li>To respond to support requests and improve the App.</li>
</ul>

<h2>Third-party services</h2>
<p>We rely on a small number of providers that process data on our behalf:</p>
<ul>
  <li><strong>Apple</strong> — app distribution and in-app purchases.</li>
  <li><strong>RevenueCat</strong> — subscription management.</li>
  <li><strong>Our hosting provider</strong> — to store your account and progress.</li>
</ul>
<p>We do not sell your personal information or use it for third-party advertising.</p>

<h2>Audio &amp; external links</h2>
<p>The App may link to playlists on Spotify or Apple Music. Opening those links
takes you to a third-party service governed by its own privacy policy.</p>

<h2>Data retention &amp; deletion</h2>
<p>We keep your data for as long as your account is active. You can delete your
account at any time from <em>Profile → Delete account</em>; this permanently
removes your account and associated gameplay data from our systems. You may also
email us to request deletion.</p>

<h2>Children</h2>
<p>The App is not directed to children under 13 (or the minimum age required in
your country), and we do not knowingly collect their data.</p>

<h2>Changes</h2>
<p>We may update this policy from time to time. Material changes will be
reflected by updating the date above.</p>
`;

const TERMS_BODY = `
<p>These Terms of Use ("Terms") govern your use of the ${APP_NAME} mobile
application (the "App") provided by ${COMPANY}. By creating an account or using
the App, you agree to these Terms.</p>

<h2>Your account</h2>
<p>You are responsible for keeping your login credentials secure and for activity
under your account. You must provide accurate information and be old enough to
form a binding contract in your jurisdiction.</p>

<h2>Subscriptions &amp; billing</h2>
<ul>
  <li>${APP_NAME} offers an auto-renewing subscription that unlocks premium
  content.</li>
  <li>Payment is charged to your Apple ID account at confirmation of purchase.</li>
  <li>The subscription automatically renews unless auto-renew is turned off at
  least 24 hours before the end of the current period.</li>
  <li>Your account is charged for renewal within 24 hours before the end of the
  current period.</li>
  <li>You can manage or cancel your subscription, and turn off auto-renew, in
  your Apple ID account settings after purchase.</li>
  <li>Any unused portion of a free trial is forfeited when you purchase a
  subscription.</li>
</ul>

<h2>Acceptable use</h2>
<p>You agree not to misuse the App, including by attempting to reverse engineer
it, disrupt it, access it through unauthorized means, or infringe others' rights.</p>

<h2>Content &amp; intellectual property</h2>
<p>The App, its puzzles, artwork, and software are owned by ${COMPANY} or its
licensors and are protected by intellectual-property laws. We grant you a
limited, non-exclusive, non-transferable license to use the App for personal,
non-commercial purposes.</p>

<h2>Termination</h2>
<p>You may stop using the App and delete your account at any time. We may suspend
or terminate access if you breach these Terms.</p>

<h2>Disclaimer &amp; liability</h2>
<p>The App is provided "as is" without warranties of any kind. To the maximum
extent permitted by law, ${COMPANY} is not liable for indirect or consequential
damages arising from your use of the App.</p>

<h2>Governing law</h2>
<p>These Terms are governed by the laws of ${JURISDICTION}, without regard to its
conflict-of-laws rules.</p>

<h2>Apple standard EULA</h2>
<p>To the extent you obtained the App from the Apple App Store, Apple's
<a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Licensed
Application End User License Agreement</a> also applies and, where it conflicts
with these Terms, governs.</p>
`;

function sendHtml(res: Response, html: string): void {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // helmet's default CSP blocks the page's inline <style>; relax it for these
  // self-contained static documents (inline styles only, no scripts).
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'",
  );
  res.send(html);
}

const router = Router();

router.get(["/privacy", "/privacy.html"], (_req: Request, res: Response) => {
  sendHtml(res, wrap("Privacy Policy", PRIVACY_BODY));
});

router.get(["/terms", "/terms.html"], (_req: Request, res: Response) => {
  sendHtml(res, wrap("Terms of Use", TERMS_BODY));
});

export const legalRouter = router;
