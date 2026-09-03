// Security track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const SECURITY_KB: Record<string, KbEntry> = {
  // ---------- Security track additions ----------
  "OWASP Top 10": {
    cat: "Core",
    learn: [
      "The current list's risk categories (Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable and Outdated Components, and more)",
      "It's a prioritization/awareness document based on real-world data, not a complete checklist",
    ],
    resources: [
      R("OWASP Top 10", "https://owasp.org/www-project-top-ten/"),
      R("OWASP Top 10 — GitHub source", "https://github.com/OWASP/Top10"),
    ],
  },
  "NIST Cybersecurity Framework": {
    cat: "Core",
    learn: [
      "Five functions: Identify, Protect, Detect, Respond, Recover",
      "A common-language maturity assessment, not a prescriptive checklist of specific controls",
    ],
    resources: [
      R("NIST Cybersecurity Framework", "https://www.nist.gov/cyberframework"),
      R("NIST CSF 2.0 Quick Start Guide", "https://www.nist.gov/cyberframework/getting-started"),
    ],
  },
  "MITRE ATT&CK": {
    cat: "Core",
    learn: [
      "Tactics, techniques, and procedures (TTPs) organized by attack lifecycle stage",
      "Mapping your own detection coverage against specific technique IDs, not just abstract categories",
    ],
    resources: [
      R("MITRE ATT&CK", "https://attack.mitre.org/"),
      R("MITRE ATT&CK — Enterprise Matrix", "https://attack.mitre.org/matrices/enterprise/"),
    ],
  },
  "Zero Trust Architecture": {
    cat: "Core",
    learn: [
      "Never trust by network location alone — authenticate/authorize every request based on identity, device posture, and context",
      "Micro-segmentation and continuous verification vs the older perimeter/VPN model",
    ],
    resources: [
      R("NIST SP 800-207 — Zero Trust Architecture", "https://csrc.nist.gov/pubs/sp/800/207/final"),
      R("CISA — Zero Trust Maturity Model", "https://www.cisa.gov/zero-trust-maturity-model"),
    ],
  },
  "Threat Modeling": {
    cat: "Core",
    learn: [
      "STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)",
      "Data flow diagrams and trust boundaries as the starting artifact",
    ],
    resources: [
      R("OWASP Threat Modeling", "https://owasp.org/www-community/Threat_Modeling"),
      R("Microsoft — Threat Modeling", "https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool"),
    ],
  },
  "Password Hashing": {
    cat: "Core",
    learn: [
      "bcrypt/scrypt/Argon2 (slow, adaptive, salted) vs fast general-purpose hashes (MD5/SHA-256) for password storage",
      "Salting defeats rainbow tables; the work factor should be tuned for a real login-time budget",
    ],
    resources: [
      R("OWASP Password Storage Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html"),
      R("Argon2 — RFC 9106", "https://www.rfc-editor.org/rfc/rfc9106.html"),
    ],
  },
  "Cryptography Fundamentals": {
    cat: "Core",
    learn: [
      "Symmetric (AES) vs asymmetric (RSA/ECC) — speed vs key-distribution trade-offs",
      "Hashing vs encryption; digital signatures for integrity and non-repudiation",
    ],
    resources: [
      R("Crypto101 (free book)", "https://www.crypto101.io/"),
      R("NIST — Cryptographic Standards and Guidelines", "https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines"),
    ],
  },
  "Penetration Testing": {
    cat: "Core",
    learn: [
      "Scoping and rules of engagement before any testing starts — explicit written authorization is mandatory",
      "Recon → scanning → exploitation → post-exploitation → reporting with remediation guidance",
    ],
    resources: [
      R("PortSwigger Web Security Academy", "https://portswigger.net/web-security"),
      R("OWASP Testing Guide", "https://owasp.org/www-project-web-security-testing-guide/"),
    ],
  },
  SIEM: {
    cat: "Core",
    learn: [
      "Aggregating logs across an org and correlating events to catch patterns a single log source wouldn't reveal",
      "Tuning correlation rules to cut noise without missing real signals",
    ],
    resources: [
      R("Splunk — What is SIEM?", "https://www.splunk.com/en_us/blog/learn/siem-security-information-event-management.html"),
      R("Elastic Security", "https://www.elastic.co/security"),
    ],
  },
  "SQL Injection": {
    cat: "AppSec",
    learn: [
      "String concatenation into a query vs parameterized queries/prepared statements",
      "Blind, error-based, and UNION-based injection — different techniques for the same root cause",
    ],
    resources: [
      R("OWASP SQL Injection", "https://owasp.org/www-community/attacks/SQL_Injection"),
      R("PortSwigger — SQL Injection", "https://portswigger.net/web-security/sql-injection"),
    ],
  },
  "Cross-Site Scripting (XSS)": {
    cat: "AppSec",
    learn: [
      "Reflected vs stored vs DOM-based XSS",
      "Output encoding by context as the primary defense; Content-Security-Policy as a second layer",
    ],
    resources: [
      R("OWASP Cross Site Scripting", "https://owasp.org/www-community/attacks/xss/"),
      R("PortSwigger — Cross-site scripting", "https://portswigger.net/web-security/cross-site-scripting"),
    ],
  },
  CSRF: {
    cat: "AppSec",
    learn: [
      "Anti-CSRF tokens, the SameSite cookie attribute, and Origin/Referer checks",
      "Why a GET request should never trigger a state change",
    ],
    resources: [
      R("OWASP CSRF", "https://owasp.org/www-community/attacks/csrf"),
      R("PortSwigger — CSRF", "https://portswigger.net/web-security/csrf"),
    ],
  },
  SSRF: {
    cat: "AppSec",
    learn: [
      "Server-side fetches abused to reach internal-only services (cloud metadata endpoints, internal admin panels)",
      "Defense: allowlist destinations, block private/link-local IP ranges, validate the resolved IP, not just the URL string",
    ],
    resources: [
      R(
        "OWASP SSRF Prevention Cheat Sheet",
        "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html",
      ),
      R("PortSwigger — SSRF", "https://portswigger.net/web-security/ssrf"),
    ],
  },
  IDOR: {
    cat: "AppSec",
    learn: [
      "Object-level authorization checked per request, not just authentication",
      "Why it's found simply by changing an ID — always re-verify ownership server-side",
    ],
    resources: [
      R("PortSwigger — Access control vulnerabilities", "https://portswigger.net/web-security/access-control"),
      R(
        "OWASP — Insecure Direct Object References",
        "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References",
      ),
    ],
  },
  XXE: {
    cat: "AppSec",
    learn: [
      "XML parsers resolving external entities by default — reading local files or triggering SSRF",
      "Fix: explicitly disable DTD processing and external entity resolution in the parser configuration",
    ],
    resources: [
      R(
        "OWASP XXE Prevention Cheat Sheet",
        "https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html",
      ),
      R("PortSwigger — XXE injection", "https://portswigger.net/web-security/xxe"),
    ],
  },
  "JWT Security": {
    cat: "AppSec",
    learn: [
      "decode vs verify — never trust claims from a token whose signature wasn't checked",
      "Hardcode the expected algorithm server-side; never accept alg: none or trust the token's own header",
    ],
    resources: [
      R("jwt.io — Introduction to JSON Web Tokens", "https://jwt.io/introduction"),
      R("OWASP JWT Cheat Sheet", "https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html"),
    ],
  },
  "SAST/DAST": {
    cat: "AppSec",
    learn: [
      "SAST scans source without running it; DAST tests a running app from the outside like an attacker would",
      "Layering both plus dependency scanning covers meaningfully more than either alone",
    ],
    resources: [
      R("OWASP — Static Application Security Testing", "https://owasp.org/www-community/Source_Code_Analysis_Tools"),
      R("OWASP ZAP", "https://www.zaproxy.org/"),
    ],
  },
  "Secure Coding Practices": {
    cat: "AppSec",
    learn: [
      "Input validation, output encoding, parameterized queries, least-privilege service accounts",
      "Secrets management and dependency/supply-chain scanning as part of the standard dev workflow, not an afterthought",
    ],
    resources: [
      R("OWASP Cheat Sheet Series", "https://cheatsheetseries.owasp.org/"),
      R(
        "OWASP Secure Coding Practices Quick Reference Guide",
        "https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/",
      ),
    ],
  },
  "TLS/SSL": {
    cat: "Network",
    learn: [
      "The handshake: cipher suite negotiation, certificate presentation, symmetric session key derivation",
      "Certificate chain of trust and validation (CN/SAN match, validity dates, revocation via CRL/OCSP)",
    ],
    resources: [
      R("Cloudflare — What happens in a TLS handshake?", "https://www.cloudflare.com/learning/ssl/what-happens-in-a-tls-handshake/"),
      R("Mozilla SSL Configuration Generator", "https://ssl-config.mozilla.org/"),
    ],
  },
  "DNS Security": {
    cat: "Network",
    learn: [
      "DNS cache poisoning/spoofing and how DNSSEC cryptographically signs records to defend against it",
      "DNS over HTTPS/TLS for protecting the query itself from eavesdropping",
    ],
    resources: [
      R("Cloudflare — DNSSEC", "https://www.cloudflare.com/dns/dnssec/how-dnssec-works/"),
      R(
        "ICANN — DNSSEC: What Is It and Why Is It Important?",
        "https://www.icann.org/resources/pages/dnssec-what-is-it-why-important-2019-03-05-en",
      ),
    ],
  },
  "DDoS Protection": {
    cat: "Network",
    learn: [
      "Volumetric attacks (bandwidth) vs application-layer attacks (expensive requests) need different mitigations",
      "CDN/scrubbing services vs rate limiting and request-cost-aware defenses at the application tier",
    ],
    resources: [
      R("Cloudflare — What is a DDoS attack?", "https://www.cloudflare.com/learning/ddos/what-is-a-ddos-attack/"),
      R(
        "CISA — Understanding DDoS Attacks",
        "https://www.cisa.gov/news-events/news/understanding-and-responding-distributed-denial-service-attacks",
      ),
    ],
  },
  "IDS/IPS": {
    cat: "Network",
    learn: [
      "Detection (alert only) vs prevention (actively blocks) — and why new rules should prove out in detect-only mode first",
      "Signature-based vs anomaly-based detection",
    ],
    resources: [R("Suricata Documentation", "https://docs.suricata.io/"), R("Snort", "https://www.snort.org/")],
  },
  "Network Segmentation": {
    cat: "Network",
    learn: [
      "VLANs/subnets/firewall rules isolating zones so a compromise can't directly reach a high-value asset",
      "Limiting lateral movement — a key stage in most real breaches — even when perimeter defenses fail",
    ],
    resources: [
      R("NIST SP 800-125B — Secure Virtual Network Configuration", "https://csrc.nist.gov/pubs/sp/800/125/b/final"),
      R("Cisco — What Is Network Segmentation?", "https://www.cisco.com/c/en/us/products/security/what-is-network-segmentation.html"),
    ],
  },
  "Burp Suite": {
    cat: "Tools",
    learn: [
      "Intercepting proxy workflow: Proxy → Repeater for manual replay/tampering",
      "Automated crawling/scanning (Spider/Scanner) vs manual, targeted testing",
    ],
    resources: [
      R("PortSwigger — Getting started with Burp Suite", "https://portswigger.net/burp/documentation/desktop/getting-started"),
      R("PortSwigger Web Security Academy", "https://portswigger.net/web-security"),
    ],
  },
  Nmap: {
    cat: "Tools",
    learn: [
      "Host discovery, port scanning, service/version detection (-sV), and NSE scripts",
      "Running scans against your own infrastructure to catch unintentionally exposed services",
    ],
    resources: [R("Nmap Reference Guide", "https://nmap.org/book/man.html"), R("Nmap Official Site", "https://nmap.org/")],
  },
  Wireshark: {
    cat: "Tools",
    learn: [
      "Packet capture and protocol-level inspection with display filters",
      "Verifying traffic is actually encrypted as expected; forensic analysis of captured incident traffic",
    ],
    resources: [
      R("Wireshark User's Guide", "https://www.wireshark.org/docs/wsug_html_chunked/"),
      R("Wireshark Official Site", "https://www.wireshark.org/"),
    ],
  },
  Metasploit: {
    cat: "Tools",
    learn: [
      "Exploit/payload/post-exploitation modules — used only with explicit written authorization",
      "Verifying a known vulnerability is actually exploitable in a specific environment, not just theoretically present",
    ],
    resources: [R("Metasploit Documentation", "https://docs.metasploit.com/"), R("Rapid7 — Metasploit", "https://www.metasploit.com/")],
  },
  "OWASP ZAP": {
    cat: "Tools",
    learn: [
      "Free, open-source intercepting proxy with an automated scanner",
      "Baseline scan mode for CI-friendly DAST vs the full active scan",
    ],
    resources: [R("OWASP ZAP", "https://www.zaproxy.org/"), R("ZAP — Getting Started Guide", "https://www.zaproxy.org/getting-started/")],
  },
  "Vulnerability Scanning": {
    cat: "Tools",
    learn: [
      "Automated scanners (Nessus, Qualys, OpenVAS) checking targets against a database of known vulnerabilities/misconfigurations",
      "Triage by severity + exploitability + exposure, then dedupe by root cause rather than treating every finding independently",
    ],
    resources: [
      R("Tenable Nessus", "https://www.tenable.com/products/nessus"),
      R("OpenVAS / Greenbone Community Edition", "https://www.greenbone.net/en/testnow/"),
    ],
  },
  "Kali Linux": {
    cat: "Tools",
    learn: [
      "A pre-loaded Linux distribution for penetration testing — a standardized environment, not a tool by itself",
      "Only for use in explicitly authorized testing contexts",
    ],
    resources: [R("Kali Linux Documentation", "https://www.kali.org/docs/"), R("Kali Linux Official Site", "https://www.kali.org/")],
  },
  "Password Cracking": {
    cat: "Tools",
    learn: [
      "Dictionary attacks, brute force, and rule-based wordlist mutations (John the Ripper, Hashcat)",
      "Used defensively to audit whether an org's real password hashes would survive a real attacker's cracking attempt",
    ],
    resources: [R("Hashcat Documentation", "https://hashcat.net/wiki/"), R("John the Ripper", "https://www.openwall.com/john/")],
  },
  CyberChef: {
    cat: "Tools",
    learn: [
      "A chainable pipeline of encode/decode/encrypt/transform operations for a browser",
      "Deobfuscating malware payloads or CTF data without writing custom scripts",
    ],
    resources: [R("CyberChef (GCHQ)", "https://gchq.github.io/CyberChef/"), R("CyberChef — GitHub", "https://github.com/gchq/CyberChef")],
  },
  Shodan: {
    cat: "Tools",
    learn: [
      "A search engine indexing internet-connected devices/services by scanning the internet",
      "Finding your own unintentionally exposed devices before an attacker's search does",
    ],
    resources: [
      R("Shodan", "https://www.shodan.io/"),
      R("Shodan — Getting Started Guide", "https://help.shodan.io/the-basics/what-is-shodan"),
    ],
  },
  Splunk: {
    cat: "Tools",
    learn: [
      "Log ingestion, SPL query language for search/correlation, alerting rules and dashboards",
      "Writing a query to correlate a specific pattern (e.g. failed logins followed by a success) across ingested logs",
    ],
    resources: [
      R("Splunk Documentation", "https://docs.splunk.com/Documentation"),
      R("Splunk — What is SIEM?", "https://www.splunk.com/en_us/blog/learn/siem-security-information-event-management.html"),
    ],
  },
};
