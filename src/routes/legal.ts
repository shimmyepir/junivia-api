import { Router, Request, Response } from "express";

// Public legal pages served as HTML. Used both for the App Store Connect
// "Privacy Policy URL" and rendered in-app via a WebView.
//
// Scoped to the Junivia *app* (account + gameplay + Apple/RevenueCat
// subscriptions) — deliberately NOT the junivia.de shop's web trackers.
// Reviewed company details are real; confirm the effective date before launch.

const APP_NAME = "Junivia";
const COMPANY = "JUNIVIA GmbH";
const ADDRESS_LINES = ["Danziger Straße 85", "61118 Bad Vilbel", "Germany"];
const MANAGING_DIRECTOR = "Paul Schuch";
const SUPPORT_EMAIL = "hallo@junivia.de";
const PHONE = "+49 162 9375568";
const JURISDICTION = "Germany";
const SUPERVISORY_AUTHORITY =
  "Der Hessische Beauftragte für Datenschutz und Informationsfreiheit";
const EFFECTIVE_DATE = "June 2026";

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
  .controller { background: #F5F1EA; border-radius: 12px; padding: 12px 16px; }
  .controller p { margin: 0; }
`;

const CONTROLLER_BLOCK = `
<div class="controller">
  <p><strong>${COMPANY}</strong></p>
  <p>${ADDRESS_LINES.join("<br />")}</p>
  <p>Managing Director: ${MANAGING_DIRECTOR}</p>
  <p>Email: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
  <p>Phone: ${PHONE}</p>
</div>`;

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>${BASE_CSS}</style>
<title>${title}</title>
</head><body>
<h1>${title}</h1>
<p class="meta">${APP_NAME} app · Last updated ${EFFECTIVE_DATE}</p>
${body}
<p class="muted">Questions? Contact us at <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
</body></html>`;
}

const PRIVACY_BODY = `
<p>This Privacy Policy explains how we process your personal data when you use
the ${APP_NAME} mobile application (the "App"). It applies to the App only, not
to our online shop at junivia.de, which has its own privacy policy. We process
your data in accordance with the EU General Data Protection Regulation (GDPR).</p>

<h2>1. Controller</h2>
<p>The controller responsible for data processing in the App is:</p>
${CONTROLLER_BLOCK}

<h2>2. What data we process</h2>
<ul>
  <li><strong>Account data:</strong> the email address and password you provide
  when registering. Passwords are stored only as a salted hash.</li>
  <li><strong>Gameplay data:</strong> your puzzle progress, chosen difficulty
  levels, completion times, moves, and related statistics, so we can save and
  sync your progress across sessions and devices.</li>
  <li><strong>Subscription data:</strong> if you subscribe, Apple processes the
  payment. We receive only your subscription status (active / inactive) via our
  provider RevenueCat. We never receive your payment-card details.</li>
  <li><strong>Technical data:</strong> limited server log and diagnostic data
  (such as request timestamps and error logs) needed to operate and secure the
  service.</li>
</ul>

<h2>3. Purposes and legal bases</h2>
<ul>
  <li>To create and manage your account and to provide and sync gameplay —
  performance of a contract, Art. 6(1)(b) GDPR.</li>
  <li>To manage subscriptions and unlock premium content — Art. 6(1)(b) GDPR.</li>
  <li>To keep the service secure and working reliably — our legitimate interest,
  Art. 6(1)(f) GDPR.</li>
  <li>To respond to support requests — Art. 6(1)(b) and (f) GDPR.</li>
</ul>

<h2>4. Service providers and recipients</h2>
<p>We use a small number of processors that handle data on our behalf under
data-processing agreements:</p>
<ul>
  <li><strong>Apple</strong> — app distribution and in-app purchases.</li>
  <li><strong>RevenueCat, Inc.</strong> — subscription management.</li>
  <li><strong>Our hosting provider</strong> — to store your account and gameplay
  data.</li>
</ul>
<p>We do not sell your personal data and do not use it for third-party
advertising.</p>

<h2>5. International data transfers</h2>
<p>Some providers (for example RevenueCat) are based in the USA. Where data is
transferred outside the EU/EEA, it is safeguarded by appropriate measures such
as the EU Standard Contractual Clauses.</p>

<h2>6. Audio and external links</h2>
<p>The App may link to playlists on Spotify or Apple Music. Opening such a link
takes you to a third-party service governed by its own privacy policy; we do not
receive your listening data.</p>

<h2>7. Storage period</h2>
<p>We keep your account and gameplay data for as long as your account exists.
When you delete your account, the associated data is deleted. We may retain
limited records where required to meet legal obligations.</p>

<h2>8. Deleting your account</h2>
<p>You can delete your account at any time in the App under
<em>Profile → Delete account</em>. This permanently removes your account and
associated gameplay data. You may also email us to request deletion.</p>

<h2>9. Data security</h2>
<p>We use appropriate technical and organisational measures, including encrypted
transport (HTTPS) and hashed passwords, to protect your data against
unauthorised access, loss, or misuse.</p>

<h2>10. Children</h2>
<p>The App is not directed to children under 16, and we do not knowingly process
their personal data without the consent of a holder of parental responsibility.</p>

<h2>11. Your rights</h2>
<p>Under the GDPR you have the right to access (Art. 15), rectification
(Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data
portability (Art. 20), and to object to processing (Art. 21). Where processing
is based on consent, you may withdraw it at any time with effect for the future.
To exercise these rights, contact us at
<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>.</p>
<p>You also have the right to lodge a complaint with a data protection
supervisory authority. The authority competent for us is:
${SUPERVISORY_AUTHORITY}.</p>

<h2>12. Changes to this policy</h2>
<p>We may update this Privacy Policy from time to time. The current version
always applies; material changes are reflected by updating the date above.</p>
`;

const TERMS_BODY = `
<p>These Terms of Use ("Terms") govern your use of the ${APP_NAME} mobile
application (the "App"). By creating an account or using the App, you agree to
these Terms.</p>

<h2>1. Provider</h2>
<p>The App is provided by:</p>
${CONTROLLER_BLOCK}

<h2>2. Your account</h2>
<p>You are responsible for keeping your login credentials secure and for activity
under your account. You must provide accurate information and be old enough to
form a binding contract in your country.</p>

<h2>3. Subscriptions and billing</h2>
<ul>
  <li>${APP_NAME} offers an auto-renewing subscription that unlocks premium
  content.</li>
  <li>Payment is charged to your Apple ID account upon confirmation of purchase.</li>
  <li>The subscription renews automatically unless auto-renew is turned off at
  least 24 hours before the end of the current period.</li>
  <li>Your account is charged for renewal within 24 hours before the end of the
  current period.</li>
  <li>You can manage or cancel your subscription, and turn off auto-renew, in
  your Apple ID account settings after purchase.</li>
  <li>Any unused portion of a free trial is forfeited when you purchase a
  subscription.</li>
</ul>

<h2>4. Right of withdrawal</h2>
<p>For digital content supplied immediately, you agree that performance begins on
purchase and acknowledge that your statutory right of withdrawal lapses once
performance has begun, to the extent permitted by law.</p>

<h2>5. Acceptable use</h2>
<p>You agree not to misuse the App, including by attempting to reverse engineer
it, disrupt it, access it through unauthorised means, or infringe the rights of
others.</p>

<h2>6. Content and intellectual property</h2>
<p>The App, its puzzles, artwork, and software are owned by ${COMPANY} or its
licensors and are protected by intellectual-property laws. We grant you a
limited, non-exclusive, non-transferable licence to use the App for personal,
non-commercial purposes.</p>

<h2>7. Termination</h2>
<p>You may stop using the App and delete your account at any time. We may suspend
or terminate access if you materially breach these Terms.</p>

<h2>8. Liability</h2>
<p>The App is provided with reasonable care but without warranty that it will be
uninterrupted or error-free. Nothing in these Terms excludes liability that
cannot be excluded under applicable law; otherwise our liability is limited to
the extent permitted by law.</p>

<h2>9. Governing law</h2>
<p>These Terms are governed by the laws of ${JURISDICTION}, without prejudice to
mandatory consumer-protection provisions of your country of residence.</p>

<h2>10. Apple standard EULA</h2>
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
