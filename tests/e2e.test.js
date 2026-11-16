/**
 * Stingo Automotive Services — End-to-End Test Suite
 *
 * Architecture:
 * - Built on Node.js standard test runner (node:test) and standard assertions (node:assert/strict).
 * - Zero external npm dependencies.
 * - Requirement-driven, opaque-box testing across 4 Tiers:
 *     Tier 1: Feature Coverage (>=5 tests per feature for all 11 core features)
 *     Tier 2: Boundary & Corner Cases (trailing slashes, 404s, case sensitivity, query params, regex)
 *     Tier 3: Cross-Feature Combinations (cross-page navigation, brand links, footer consistency, theme)
 *     Tier 4: Real-World Application Scenarios (browsing flow, CNAME host simulation, asset MIME, concurrency)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers: File System Readers
// ---------------------------------------------------------------------------
function readProjectFile(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath, 'utf8');
  }
  return null;
}

function getIndexHtml() {
  return readProjectFile('index.html');
}

function getTermsHtml() {
  return readProjectFile('terms/index.html') || readProjectFile('terms.html');
}

function getPrivacyHtml() {
  return readProjectFile('privacy/index.html') || readProjectFile('privacy.html');
}

// ---------------------------------------------------------------------------
// Server Handler Interception & Request Simulation
// Intercepts the actual request listener of server.js to allow full end-to-end
// HTTP routing testing in any environment (including Windows Low-Integrity sandboxes).
// ---------------------------------------------------------------------------
let serverInstance = null;
let serverRequestHandler = null;

const originalCreateServer = http.createServer;
http.createServer = function(...args) {
  if (typeof args[0] === 'function') {
    serverRequestHandler = args[0];
  } else if (typeof args[1] === 'function') {
    serverRequestHandler = args[1];
  }
  serverInstance = originalCreateServer.apply(this, args);
  if (!serverRequestHandler) {
    serverRequestHandler = serverInstance.listeners('request')[0];
  }
  return serverInstance;
};

// Load server.js to register its real routes and initialize the server
try {
  require(path.join(PROJECT_ROOT, 'server.js'));
} catch (err) {
  // Ignore startup errors if port 3000 is occupied; request handler is still captured
}

if (serverInstance) {
  serverInstance.on('error', (err) => {
    // Ignore EADDRINUSE during test run if port 3000 is occupied
    if (err.code !== 'EADDRINUSE') {
      throw err;
    }
  });
}

function httpRequest(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    if (!serverRequestHandler) {
      return reject(new Error('server.js request handler was not captured'));
    }

    const parsedUrl = new URL(urlPath, 'http://127.0.0.1:3000');
    const headers = {};
    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        headers[k.toLowerCase()] = v;
      }
    }
    if (!headers['host']) {
      headers['host'] = parsedUrl.host;
    }

    const mockReq = {
      url: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers
    };

    const mockRes = {
      statusCode: 200,
      headers: {},
      body: '',
      writeHead(status, resHeaders = {}) {
        this.statusCode = status;
        for (const [k, v] of Object.entries(resHeaders)) {
          this.headers[k.toLowerCase()] = v;
        }
      },
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      end(chunk) {
        if (chunk) {
          this.body += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
        }
        resolve({
          status: this.statusCode,
          headers: this.headers,
          body: this.body
        });
      }
    };

    try {
      serverRequestHandler(mockReq, mockRes);
    } catch (err) {
      reject(err);
    }
  });
}

after(() => {
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (e) {
      // Ignore cleanup error
    }
  }
});

// ===========================================================================
// TIER 1: FEATURE COVERAGE (>= 5 Tests Per Feature)
// ===========================================================================
describe('Tier 1: Feature Coverage', () => {

  // -------------------------------------------------------------------------
  // Feature 1: Dedicated /terms Route
  // -------------------------------------------------------------------------
  describe('Feature 1: Dedicated /terms Route Existence', () => {
    it('1.1 should have terms/index.html or terms.html present in the filesystem', () => {
      const html = getTermsHtml();
      assert.ok(html !== null, 'Terms file must exist at terms/index.html or terms.html');
      assert.ok(html.length > 50, 'Terms file must not be empty');
    });

    it('1.2 should return HTTP 200 OK when requesting GET /terms from the server', async () => {
      const res = await httpRequest('/terms');
      assert.strictEqual(res.status, 200, `Expected 200 OK for /terms, received ${res.status}`);
    });

    it('1.3 should return Content-Type text/html for GET /terms', async () => {
      const res = await httpRequest('/terms');
      assert.match(res.headers['content-type'] || '', /text\/html/i, 'Content-Type must be text/html');
    });

    it('1.4 should serve valid HTML document structure for /terms', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /<!DOCTYPE\s+html>/i, 'Must begin with <!DOCTYPE html>');
      assert.match(html, /<html[\s>]/i, 'Must include <html> tag');
      assert.match(html, /<\/html>/i, 'Must properly close </html> tag');
    });

    it('1.5 should include a descriptive <title> containing Terms of Service', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /<title>[^<]*Terms(?:\s+of\s+Service)?[^<]*<\/title>/i, 'Page title must reference Terms of Service');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 2: Dedicated /privacy Route
  // -------------------------------------------------------------------------
  describe('Feature 2: Dedicated /privacy Route Existence', () => {
    it('2.1 should have privacy/index.html or privacy.html present in the filesystem', () => {
      const html = getPrivacyHtml();
      assert.ok(html !== null, 'Privacy file must exist at privacy/index.html or privacy.html');
      assert.ok(html.length > 50, 'Privacy file must not be empty');
    });

    it('2.2 should return HTTP 200 OK when requesting GET /privacy from the server', async () => {
      const res = await httpRequest('/privacy');
      assert.strictEqual(res.status, 200, `Expected 200 OK for /privacy, received ${res.status}`);
    });

    it('2.3 should return Content-Type text/html for GET /privacy', async () => {
      const res = await httpRequest('/privacy');
      assert.match(res.headers['content-type'] || '', /text\/html/i, 'Content-Type must be text/html');
    });

    it('2.4 should serve valid HTML document structure for /privacy', () => {
      const html = getPrivacyHtml();
      assert.ok(html, 'Privacy HTML must be present');
      assert.match(html, /<!DOCTYPE\s+html>/i, 'Must begin with <!DOCTYPE html>');
      assert.match(html, /<html[\s>]/i, 'Must include <html> tag');
      assert.match(html, /<\/html>/i, 'Must properly close </html> tag');
    });

    it('2.5 should include a descriptive <title> containing Privacy Policy', () => {
      const html = getPrivacyHtml();
      assert.ok(html, 'Privacy HTML must be present');
      assert.match(html, /<title>[^<]*Privacy(?:\s+Policy)?[^<]*<\/title>/i, 'Page title must reference Privacy Policy');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 3: ToS Data Collection Clause
  // -------------------------------------------------------------------------
  describe('Feature 3: ToS Data Collection Clause', () => {
    it('3.1 should state explicit reservation of rights to collect inbound communication data', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /reserve[s]?\s+(?:the\s+)?right(?:\s+to\s+collect)?|data\s+collection/i, 'Must reserve rights to collect data');
    });

    it('3.2 should explicitly include electronic mail (emails) as a collected channel', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /email[s]?/i, 'Data collection clause must explicitly cover email');
    });

    it('3.3 should explicitly include text messages (SMS) as a collected channel', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /text\s+message[s]?|sms/i, 'Data collection clause must explicitly cover text messages/SMS');
    });

    it('3.4 should explicitly include telephone calls as a collected channel', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /phone\s+call[s]?|calls|telephone/i, 'Data collection clause must explicitly cover phone calls');
    });

    it('3.5 should also document omni-channel data collection in the privacy policy', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /email/i, 'Privacy policy must mention email data');
      assert.match(privacy, /text|sms/i, 'Privacy policy must mention text message/SMS data');
      assert.match(privacy, /call|phone/i, 'Privacy policy must mention phone call records');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 4: ToS Data Usage & Strict No-Resell Clause
  // -------------------------------------------------------------------------
  describe('Feature 4: ToS Data Usage & Strict No-Resell Clause', () => {
    it('4.1 should state data is used for answering questions and inquiries', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /answer(?:ing)?\s+questions?|inquir(?:y|ies)/i, 'Must state data is used for answering questions');
    });

    it('4.2 should state data is used for booking and managing appointments', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /book(?:ing)?\s+appointment[s]?|scheduling|dispatch/i, 'Must state data is used for booking appointments');
    });

    it('4.3 should state data is used for expanding and providing customer support', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /expand(?:ing)?\s+customer\s+support|customer\s+support/i, 'Must state data is used for expanding customer support');
    });

    it('4.4 should explicitly state that personal data is not to be resold', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(
        html,
        /(?:not\s+(?:to\s+be\s+)?resold|never\s+sell|never\s+resell|do\s+not\s+sell|does\s+not\s+sell|no-resale|not\s+sold)/i,
        'Terms must explicitly declare that data is not to be resold'
      );
    });

    it('4.5 should contain an aligned strict no-resell statement in the privacy policy', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(
        privacy,
        /(?:not\s+(?:to\s+be\s+)?resold|never\s+sell|never\s+resell|do\s+not\s+sell|does\s+not\s+sell|no-resale|not\s+sold)/i,
        'Privacy policy must mirror the explicit no-resale commitment'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Feature 5: Data Deletion via stingoautoservices@gmail.com
  // -------------------------------------------------------------------------
  describe('Feature 5: Data Deletion via stingoautoservices@gmail.com', () => {
    it('5.1 should define the customer right to request deletion of personal data in Terms', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(
        html,
        /(?:delet(?:e|ion)\s+of\s+(?:(?:saved|your)\s+)*personal\s+(?:data|records)|request\s+(?:the\s+)?(?:permanent\s+)?deletion|erasure)/i,
        'Terms must state right to delete personal data'
      );
    });

    it('5.2 should explicitly direct deletion requests to stingoautoservices@gmail.com in Terms', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /stingoautoservices@gmail\.com/i, 'Terms must specify stingoautoservices@gmail.com for deletion');
    });

    it('5.3 should provide instructions or verification guidance for data deletion requests', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /email|subject|verif(?:y|ication)|name|phone/i, 'Terms must provide contact details or instructions for data deletion');
    });

    it('5.4 should specify customer rights to request personal data deletion in Privacy Policy', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /delet(?:e|ion)\s+of|right\s+to\s+(?:access|delete|erasure)|deletion\s+request/i, 'Privacy policy must detail data deletion rights');
    });

    it('5.5 should direct deletion requests to stingoautoservices@gmail.com in Privacy Policy', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /stingoautoservices@gmail\.com/i, 'Privacy policy must specify stingoautoservices@gmail.com for deletion');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 6: Automated AI Interaction Disclosure
  // -------------------------------------------------------------------------
  describe('Feature 6: Automated AI Interaction Disclosure', () => {
    it('6.1 should disclose that customers may interact with an automated AI Assistant', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /AI\s+Assistant|automated\s+AI|artificial\s+intelligence/i, 'Must disclose interaction with AI Assistant');
    });

    it('6.2 should explicitly state the interaction is with an automated system rather than a human agent', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /rather\s+than\s+a\s+human\s+agent|not\s+a\s+human\s+agent|automated.*?human/i, 'Must state interaction is with automated AI rather than human');
    });

    it('6.3 should specify the automated nature of chat or interactive messaging', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /automat(?:ed|ion)/i, 'Must emphasize automated nature of the service');
    });

    it('6.4 should provide options to contact a human technician or dispatcher directly', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /\(215\)\s*285-7648|stingoautoservices@gmail\.com/i, 'Terms must provide live phone or email contact');
    });

    it('6.5 should disclose automated AI chat interactions in the privacy policy', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /AI\s+Assistant|automated|artificial\s+intelligence/i, 'Privacy policy must reinforce automated AI disclosure');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 7: AI Accuracy Disclaimer Regarding Pricing, Hours, and Policies
  // -------------------------------------------------------------------------
  describe('Feature 7: AI Accuracy Disclaimer Regarding Pricing, Hours, and Policies', () => {
    it('7.1 should state that AI-generated responses are strictly for informational purposes', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /informational\s+purposes/i, 'Must state AI responses are informational');
    });

    it('7.2 should disclaim company liability if the AI makes errors or mistakes', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /error[s]?|mistake[s]?|inaccura/i, 'Must acknowledge potential AI errors or mistakes');
    });

    it('7.3 should specifically disclaim AI mistakes regarding pricing and rates', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /pricing|rates?|estimates?|costs?/i, 'AI accuracy disclaimer must cover pricing');
    });

    it('7.4 should specifically disclaim AI mistakes regarding operating hours and schedules', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /hours|schedule[s]?|arrival/i, 'AI accuracy disclaimer must cover hours');
    });

    it('7.5 should specifically disclaim AI mistakes regarding company policies and warranties', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /polic(?:y|ies)|warrant(?:y|ies)|cancellation/i, 'AI accuracy disclaimer must cover policies');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 8: Sensitive Data Warning (Credit Cards, SSN, Medical Records)
  // -------------------------------------------------------------------------
  describe('Feature 8: Sensitive Data Warning', () => {
    it('8.1 should explicitly advise users not to share sensitive data in chat', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /sensitive\s+(?:data|personal\s+data|information)|not\s+share\s+sensitive/i, 'Must warn against sharing sensitive data in chat');
    });

    it('8.2 should explicitly warn against entering credit card or payment account numbers in chat', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /credit\s+card|debit\s+card|bank\s+account/i, 'Sensitive data warning must mention credit cards');
    });

    it('8.3 should explicitly warn against entering Social Security Numbers (SSN) in chat', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /SSN|Social\s+Security/i, 'Sensitive data warning must mention SSN');
    });

    it('8.4 should explicitly warn against entering medical records or health details in chat', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /medical\s+record[s]?|health/i, 'Sensitive data warning must mention medical records');
    });

    it('8.5 should include a sensitive data warning in the privacy policy for chat users', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /credit\s+card|SSN|medical\s+record[s]?|sensitive/i, 'Privacy policy must reinforce sensitive data warning');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 9: Third-Party AI Processing Citing Google
  // -------------------------------------------------------------------------
  describe('Feature 9: Third-Party AI Processing Citing Google', () => {
    it('9.1 should disclose that chat messages are processed by third-party service providers', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /third-party\s+service\s+provider[s]?|third-party\s+provider[s]?/i, 'Privacy policy must disclose third-party service providers');
    });

    it('9.2 should explicitly cite Google as an AI processing service provider', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /\bGoogle\b/, 'Privacy policy must explicitly cite Google');
    });

    it('9.3 should disclose that third-party processing is used to analyze queries and generate responses', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(
        privacy,
        /generate\s+(?:[\w-]+\s+)*responses?|process(?:ing)?\s+(?:[\w-]+\s+)*chat|interpret\s+(?:[\w-]+\s+)*queries/i,
        'Must clarify processing generates responses'
      );
    });

    it('9.4 should affirm enterprise confidentiality and security standards for third-party AI processing', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /confidential(?:ity)?|security|safeguard/i, 'Must affirm security and confidentiality of processing');
    });

    it('9.5 should confirm that Google is not authorized to sell personal chat data', () => {
      const privacy = getPrivacyHtml();
      assert.ok(privacy, 'Privacy HTML must be present');
      assert.match(privacy, /not\s+(?:authorized\s+to\s+)?sell|no-resale|prohibit(?:ed)?/i, 'Must state provider cannot sell user data');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 10: Footer Links to /terms and /privacy
  // -------------------------------------------------------------------------
  describe('Feature 10: Distinct Footer Links across All Views', () => {
    it('10.1 should include a link to /terms in index.html footer', () => {
      const html = getIndexHtml();
      assert.ok(html, 'index.html must exist');
      assert.match(html, /<footer[\s\S]*?href="\/terms"[\s\S]*?<\/footer>/i, 'index.html footer must contain href="/terms"');
    });

    it('10.2 should include a link to /privacy in index.html footer', () => {
      const html = getIndexHtml();
      assert.ok(html, 'index.html must exist');
      assert.match(html, /<footer[\s\S]*?href="\/privacy"[\s\S]*?<\/footer>/i, 'index.html footer must contain href="/privacy"');
    });

    it('10.3 should feature separate, distinct anchor texts for Terms and Privacy in index.html', () => {
      const html = getIndexHtml();
      assert.ok(html, 'index.html must exist');
      assert.match(html, /<a\s+[^>]*href="\/terms"[^>]*>[\s\S]*?Terms(?:\s+of\s+Service)?[\s\S]*?<\/a>/i, 'Link to /terms must have Terms of Service anchor text');
      assert.match(html, /<a\s+[^>]*href="\/privacy"[^>]*>[\s\S]*?Privacy(?:\s+Policy)?[\s\S]*?<\/a>/i, 'Link to /privacy must have Privacy Policy anchor text');
    });

    it('10.4 should include links to /terms and /privacy in the Terms page footer', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /<footer[\s\S]*?href="\/terms"[\s\S]*?<\/footer>/i, 'Terms footer must link to /terms');
      assert.match(html, /<footer[\s\S]*?href="\/privacy"[\s\S]*?<\/footer>/i, 'Terms footer must link to /privacy');
    });

    it('10.5 should include links to /terms and /privacy in the Privacy page footer', () => {
      const html = getPrivacyHtml();
      assert.ok(html, 'Privacy HTML must be present');
      assert.match(html, /<footer[\s\S]*?href="\/terms"[\s\S]*?<\/footer>/i, 'Privacy footer must link to /terms');
      assert.match(html, /<footer[\s\S]*?href="\/privacy"[\s\S]*?<\/footer>/i, 'Privacy footer must link to /privacy');
    });
  });

  // -------------------------------------------------------------------------
  // Feature 11: Root-Relative Asset Paths (/styles.css and /main.js)
  // -------------------------------------------------------------------------
  describe('Feature 11: Root-Relative Asset Paths', () => {
    it('11.1 should load stylesheet via root-relative /styles.css in index.html', () => {
      const html = getIndexHtml();
      assert.ok(html, 'index.html must exist');
      assert.match(html, /<link\s+[^>]*href="\/styles\.css"/i, 'index.html must reference /styles.css with leading slash');
    });

    it('11.2 should load script via root-relative /main.js in index.html', () => {
      const html = getIndexHtml();
      assert.ok(html, 'index.html must exist');
      assert.match(html, /<script\s+[^>]*src="\/main\.js"/i, 'index.html must reference /main.js with leading slash');
    });

    it('11.3 should load stylesheet via root-relative /styles.css in Terms page', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /<link\s+[^>]*href="\/styles\.css"/i, 'Terms page must reference /styles.css with leading slash');
    });

    it('11.4 should load script via root-relative /main.js in Terms page', () => {
      const html = getTermsHtml();
      assert.ok(html, 'Terms HTML must be present');
      assert.match(html, /<script\s+[^>]*src="\/main\.js"/i, 'Terms page must reference /main.js with leading slash');
    });

    it('11.5 should load /styles.css and /main.js via root-relative paths in Privacy page', () => {
      const html = getPrivacyHtml();
      assert.ok(html, 'Privacy HTML must be present');
      assert.match(html, /<link\s+[^>]*href="\/styles\.css"/i, 'Privacy page must reference /styles.css with leading slash');
      assert.match(html, /<script\s+[^>]*src="\/main\.js"/i, 'Privacy page must reference /main.js with leading slash');
    });
  });

});

// ===========================================================================
// TIER 2: BOUNDARY & CORNER CASES
// ===========================================================================
describe('Tier 2: Boundary & Corner Cases', () => {
  it('2.1 should resolve both /terms and /terms/ with HTTP 200 OK', async () => {
    const resWithoutSlash = await httpRequest('/terms');
    assert.strictEqual(resWithoutSlash.status, 200, 'Expected /terms to return 200');

    const resWithSlash = await httpRequest('/terms/');
    assert.strictEqual(resWithSlash.status, 200, 'Expected /terms/ to return 200');
  });

  it('2.2 should resolve both /privacy and /privacy/ with HTTP 200 OK', async () => {
    const resWithoutSlash = await httpRequest('/privacy');
    assert.strictEqual(resWithoutSlash.status, 200, 'Expected /privacy to return 200');

    const resWithSlash = await httpRequest('/privacy/');
    assert.strictEqual(resWithSlash.status, 200, 'Expected /privacy/ to return 200');
  });

  it('2.3 should resolve the root URL / with HTTP 200 OK serving index.html', async () => {
    const res = await httpRequest('/');
    assert.strictEqual(res.status, 200, 'Expected / to return 200');
    assert.match(res.headers['content-type'] || '', /text\/html/i, 'Content-Type must be HTML');
    assert.match(res.body, /STINGO/i, 'Response must contain Stingo branding');
  });

  it('2.4 should return HTTP 404 for an arbitrary non-existent route without throwing a 500 error', async () => {
    const res = await httpRequest('/unknown-nonexistent-route-for-testing-404');
    assert.strictEqual(res.status, 404, 'Non-existent route must return 404 Not Found');
  });

  it('2.5 should enforce canonical lowercase paths for /terms and /privacy routing', () => {
    const indexHtml = getIndexHtml();
    assert.ok(indexHtml, 'index.html must exist');
    assert.doesNotMatch(indexHtml, /href="\/(?:Terms|Privacy|TERMS|PRIVACY)"/, 'Footer links must use canonical lowercase /terms');
  });

  it('2.6 should verify internal links do not use protocol-relative (//) or parent directory-climbing (../) paths', () => {
    const pages = [
      { name: 'index.html', content: getIndexHtml() },
      { name: 'terms', content: getTermsHtml() },
      { name: 'privacy', content: getPrivacyHtml() }
    ];

    for (const page of pages) {
      if (!page.content) continue;
      assert.doesNotMatch(
        page.content,
        /(?:href|src)="\/\/[^"]+"/i,
        `${page.name} must not contain protocol-relative paths`
      );
      assert.doesNotMatch(
        page.content,
        /(?:href|src)="\.\.\/[^"]+"/i,
        `${page.name} must not use relative parent ../ paths`
      );
    }
  });

  it('2.7 should validate that stingoautoservices@gmail.com matches strict RFC email regex', () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const targetEmail = 'stingoautoservices@gmail.com';
    assert.ok(emailRegex.test(targetEmail), 'Target email must be valid RFC-compliant format');

    const terms = getTermsHtml();
    if (terms) {
      const match = terms.match(/stingoautoservices@gmail\.com/i);
      assert.ok(match, 'Terms must contain the exact email');
      assert.ok(emailRegex.test(match[0]), 'Terms email match must pass email regex');
    }

    const privacy = getPrivacyHtml();
    if (privacy) {
      const match = privacy.match(/stingoautoservices@gmail\.com/i);
      assert.ok(match, 'Privacy must contain the exact email');
      assert.ok(emailRegex.test(match[0]), 'Privacy email match must pass email regex');
    }
  });

  it('2.8 should verify Google is matched with exact word boundary as an AI provider', () => {
    const privacy = getPrivacyHtml();
    assert.ok(privacy, 'Privacy policy must exist');
    assert.match(privacy, /\bGoogle\b/, 'Privacy policy must cite Google with exact word boundaries');
  });

  it('2.9 should verify absence of hardcoded domain origins in internal links and asset tags', () => {
    const pages = [
      { name: 'index.html', content: getIndexHtml() },
      { name: 'terms', content: getTermsHtml() },
      { name: 'privacy', content: getPrivacyHtml() }
    ];

    for (const page of pages) {
      if (!page.content) continue;
      assert.doesNotMatch(
        page.content,
        /<(?:a|link|script)\s+[^>]*(?:href|src)="https?:\/\/(?:localhost|127\.0\.0\.1)[^"]*"/i,
        `${page.name} must not contain hardcoded localhost/127.0.0.1 origins`
      );
    }
  });

  it('2.10 should gracefully handle query parameters on clean routes without failing', async () => {
    const resTermsQuery = await httpRequest('/terms?source=footer&test=1');
    assert.strictEqual(resTermsQuery.status, 200, 'Expected /terms with query string to return 200');

    const resPrivacyQuery = await httpRequest('/privacy?mode=dark&ref=legal');
    assert.strictEqual(resPrivacyQuery.status, 200, 'Expected /privacy with query string to return 200');
  });
});

// ===========================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// ===========================================================================
describe('Tier 3: Cross-Feature Combinations', () => {
  it('3.1 should use root-relative section anchors (/#services, etc.) on the Terms page to return home', () => {
    const html = getTermsHtml();
    assert.ok(html, 'Terms HTML must be present');
    assert.match(html, /href="\/#services"/i, 'Terms page must link to /#services');
    assert.match(html, /href="\/#process"/i, 'Terms page must link to /#process');
    assert.match(html, /href="\/#pricing"/i, 'Terms page must link to /#pricing');
  });

  it('3.2 should use root-relative section anchors (/#services, etc.) on the Privacy page to return home', () => {
    const html = getPrivacyHtml();
    assert.ok(html, 'Privacy HTML must be present');
    assert.match(html, /href="\/#services"/i, 'Privacy page must link to /#services');
    assert.match(html, /href="\/#process"/i, 'Privacy page must link to /#process');
    assert.match(html, /href="\/#pricing"/i, 'Privacy page must link to /#pricing');
  });

  it('3.3 should point the brand logo on subpages back to site root / instead of in-page #top', () => {
    const termsHtml = getTermsHtml();
    assert.ok(termsHtml, 'Terms HTML must be present');
    assert.match(termsHtml, /<a\s+[^>]*href="\/"[^>]*class="[^"]*brand[^"]*"/i, 'Terms brand logo must link to /');

    const privacyHtml = getPrivacyHtml();
    assert.ok(privacyHtml, 'Privacy HTML must be present');
    assert.match(privacyHtml, /<a\s+[^>]*href="\/"[^>]*class="[^"]*brand[^"]*"/i, 'Privacy brand logo must link to /');
  });

  it('3.4 should maintain footer link consistency across index, terms, and privacy pages', () => {
    const indexHtml = getIndexHtml();
    const termsHtml = getTermsHtml();
    const privacyHtml = getPrivacyHtml();

    assert.ok(indexHtml && termsHtml && privacyHtml, 'All 3 HTML documents must exist');

    for (const [name, content] of Object.entries({ index: indexHtml, terms: termsHtml, privacy: privacyHtml })) {
      assert.match(content, /<footer/i, `${name} must contain a <footer> element`);
      assert.match(content, /href="\/terms"/i, `${name} footer must contain href="/terms"`);
      assert.match(content, /href="\/privacy"/i, `${name} footer must contain href="/privacy"`);
    }
  });

  it('3.5 should integrate main.js across all pages to preserve theme persistence', () => {
    const indexHtml = getIndexHtml();
    const termsHtml = getTermsHtml();
    const privacyHtml = getPrivacyHtml();

    assert.ok(indexHtml && termsHtml && privacyHtml, 'All 3 HTML documents must exist');

    assert.match(indexHtml, /<script\s+[^>]*src="\/main\.js"/i, 'index.html must load /main.js');
    assert.match(termsHtml, /<script\s+[^>]*src="\/main\.js"/i, 'Terms page must load /main.js');
    assert.match(privacyHtml, /<script\s+[^>]*src="\/main\.js"/i, 'Privacy page must load /main.js');
  });

  it('3.6 should comply with HTML5 standard metadata (doctype, lang, charset, viewport) across all pages', () => {
    const pages = [
      { name: 'index.html', content: getIndexHtml() },
      { name: 'terms', content: getTermsHtml() },
      { name: 'privacy', content: getPrivacyHtml() }
    ];

    for (const page of pages) {
      assert.ok(page.content, `${page.name} must exist`);
      assert.match(page.content, /<!DOCTYPE\s+html>/i, `${page.name} must declare <!DOCTYPE html>`);
      assert.match(page.content, /<html\s+[^>]*lang="en"/i, `${page.name} must declare lang="en"`);
      assert.match(page.content, /<meta\s+[^>]*charset=["']?utf-8["']?/i, `${page.name} must declare UTF-8 charset`);
      assert.match(page.content, /<meta\s+[^>]*name=["']viewport["']\s+[^>]*content=["'][^"']*width=device-width/i, `${page.name} must declare viewport meta tag`);
    }
  });
});

// ===========================================================================
// TIER 4: REAL-WORLD APPLICATION SCENARIOS
// ===========================================================================
describe('Tier 4: Real-World Application Scenarios', () => {

  it('4.1 should simulate a complete end-user browsing scenario from home to legal pages and back', async () => {
    // 1. User arrives at homepage
    const homeRes = await httpRequest('/');
    assert.strictEqual(homeRes.status, 200, 'Home page must return 200');
    assert.match(homeRes.body, /href="\/terms"/i, 'Home page must feature footer link to /terms');
    assert.match(homeRes.body, /href="\/privacy"/i, 'Home page must feature footer link to /privacy');

    // 2. User clicks on Terms of Service link
    const termsRes = await httpRequest('/terms');
    assert.strictEqual(termsRes.status, 200, 'Terms page must return 200');
    assert.match(termsRes.body, /stingoautoservices@gmail\.com/i, 'Terms page must show data deletion contact');
    assert.match(termsRes.body, /AI\s+Assistant/i, 'Terms page must display AI Assistant disclosure');

    // 3. User navigates from Terms page to Privacy Policy via footer
    const privacyRes = await httpRequest('/privacy');
    assert.strictEqual(privacyRes.status, 200, 'Privacy page must return 200');
    assert.match(privacyRes.body, /\bGoogle\b/, 'Privacy page must disclose Google AI processing');

    // 4. User verifies assets load properly from root-relative paths
    const cssRes = await httpRequest('/styles.css');
    assert.strictEqual(cssRes.status, 200, 'Styles must load from /styles.css');
    assert.match(cssRes.headers['content-type'] || '', /text\/css/i);

    const jsRes = await httpRequest('/main.js');
    assert.strictEqual(jsRes.status, 200, 'Script must load from /main.js');
    assert.match(jsRes.headers['content-type'] || '', /(?:application|text)\/javascript/i);
  });

  it('4.2 should simulate CNAME custom domain Host header routing without server redirection or domain breakage', async () => {
    const customHost = 'stingoautomotiveservices.com';

    const homeRes = await httpRequest('/', { headers: { Host: customHost } });
    assert.strictEqual(homeRes.status, 200, 'CNAME host request to / must return 200');

    const termsRes = await httpRequest('/terms', { headers: { Host: customHost } });
    assert.strictEqual(termsRes.status, 200, 'CNAME host request to /terms must return 200');

    const privacyRes = await httpRequest('/privacy', { headers: { Host: `sub.${customHost}` } });
    assert.strictEqual(privacyRes.status, 200, 'CNAME host request to /privacy must return 200');
  });

  it('4.3 should verify static asset delivery and correct MIME type headers', async () => {
    const cssRes = await httpRequest('/styles.css');
    assert.strictEqual(cssRes.status, 200);
    assert.match(cssRes.headers['content-type'] || '', /text\/css/i);
    assert.ok(cssRes.body.length > 500, 'styles.css must have substantial CSS content');

    const jsRes = await httpRequest('/main.js');
    assert.strictEqual(jsRes.status, 200);
    assert.match(jsRes.headers['content-type'] || '', /(?:application|text)\/javascript/i);
    assert.ok(jsRes.body.length > 200, 'main.js must have substantial JS content');
  });

  it('4.4 should handle concurrent requests across multiple routes without failure or race conditions', async () => {
    const endpoints = ['/', '/terms', '/privacy', '/styles.css', '/main.js'];
    const requests = endpoints.map((ep) => httpRequest(ep));
    const results = await Promise.all(requests);

    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      assert.strictEqual(
        res.status,
        200,
        `Concurrent request to ${endpoints[i]} must resolve with 200 OK (got ${res.status})`
      );
    }
  });

});
