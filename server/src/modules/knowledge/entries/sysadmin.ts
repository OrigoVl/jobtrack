// SysAdmin/IT support track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const SYSADMIN_KB: Record<string, KbEntry> = {
  // ---------- SysAdmin track additions ----------
  ITIL: {
    cat: "Core",
    learn: [
      "Incident vs problem vs change vs service request management",
      "SLAs, priority (impact x urgency), tiered support (L1/L2/L3)",
      "Change Advisory Board (CAB), Requests for Change (RFC), standard vs emergency changes",
    ],
    resources: [
      R("ITIL Foundation overview — AXELOS", "https://www.axelos.com/certifications/itil-service-management"),
      R("ITIL 4 key concepts — Atlassian", "https://www.atlassian.com/itsm/itil"),
    ],
  },
  MFA: {
    cat: "Core",
    learn: [
      "Factor types: knowledge, possession, inherence; push vs number-matching vs FIDO2/hardware keys",
      "MFA fatigue attacks and why number-matching/hardware keys resist phishing better than plain push",
      "NIST SP 800-63B password guidance: length over forced rotation, paired with MFA",
    ],
    resources: [
      R("NIST SP 800-63B — Digital Identity Guidelines", "https://pages.nist.gov/800-63-3/sp800-63b.html"),
      R(
        "Microsoft — How it works: Azure AD Multi-Factor Authentication",
        "https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mfa-howitworks",
      ),
    ],
  },
  "Endpoint Protection": {
    cat: "Core",
    learn: [
      "Signature-based AV vs EDR: behavioral monitoring, telemetry, isolate/kill/rollback response",
      "Patch cadence (Patch Tuesday), staged rollout rings, emergency out-of-band patching",
      "Common enterprise EDR: Microsoft Defender for Endpoint, CrowdStrike Falcon, SentinelOne",
    ],
    resources: [
      R("Microsoft Defender for Endpoint docs", "https://learn.microsoft.com/en-us/defender-endpoint/"),
      R(
        "CrowdStrike — What is EDR?",
        "https://www.crowdstrike.com/en-us/cybersecurity-101/endpoint-security/endpoint-detection-and-response-edr/",
      ),
    ],
  },
  "Ticketing Systems": {
    cat: "Core",
    learn: [
      "Incident/request lifecycle, SLA tracking, categorization, escalation paths",
      "ServiceNow (enterprise ITSM) vs Zendesk (customer support) vs Freshservice/Jira Service Management (mid-market ITSM)",
      "Writing a reproducible ticket: symptom, steps taken, environment, evidence",
    ],
    resources: [
      R("ServiceNow — ITSM overview", "https://www.servicenow.com/products/itsm.html"),
      R("Atlassian — Jira Service Management docs", "https://support.atlassian.com/jira-service-management-cloud/"),
    ],
  },
  "IT Asset Management": {
    cat: "Core",
    learn: [
      "CMDB: tracking hardware, software licenses, and their relationships/dependencies",
      "Onboarding/offboarding checklists tied to asset assignment and license reclamation",
      "Automated network discovery vs manual spreadsheet tracking",
    ],
    resources: [R("ServiceNow — What is a CMDB?", "https://www.servicenow.com/products/configuration-management-database.html")],
  },
  DNS: {
    cat: "Networking",
    learn: [
      "Record types: A/AAAA/CNAME/MX/TXT/NS/PTR, and the resolution chain (recursive → root → TLD → authoritative)",
      "TTL and caching at every hop — why propagation isn't instant",
      "AD-integrated DNS zones and SRV records (_ldap._tcp, _kerberos._tcp)",
    ],
    resources: [
      R("Cloudflare — What is DNS?", "https://www.cloudflare.com/learning/dns/what-is-dns/"),
      R(
        "Microsoft Learn — DNS for Active Directory",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/plan/creating-a-forest-plan",
      ),
    ],
  },
  DHCP: {
    cat: "Networking",
    learn: [
      "DORA process (Discover/Offer/Request/Acknowledge), lease time and renewal",
      "APIPA (169.254.x.x) as a diagnostic signal for a fully unreachable DHCP server",
      "Reservations for printers/servers; DHCP snooping to block rogue DHCP servers",
    ],
    resources: [
      R("Microsoft Learn — DHCP overview", "https://learn.microsoft.com/en-us/windows-server/networking/technologies/dhcp/dhcp-top"),
    ],
  },
  VPN: {
    cat: "Networking",
    learn: [
      "Site-to-site vs remote access VPN; IPsec, OpenVPN, WireGuard, SSL/TLS VPN",
      "Zero-trust/SASE as an alternative to broad network-level VPN access",
      "Common failure modes: NAT-T passthrough issues, IKE Phase 1/2 mismatches, idle timeouts",
    ],
    resources: [
      R("Cloudflare — What is a VPN?", "https://www.cloudflare.com/learning/access-management/what-is-a-vpn/"),
      R("WireGuard — official site", "https://www.wireguard.com/"),
    ],
  },
  Subnetting: {
    cat: "Networking",
    learn: [
      "CIDR notation, subnet masks, network/broadcast address reservation",
      "Sizing a subnet from a host-count requirement (rounding up to the next power of 2 minus 2)",
      "VLANs as the layer-2 complement to IP subnetting for traffic isolation",
    ],
    resources: [R("Cloudflare — What is a subnet?", "https://www.cloudflare.com/learning/network-layer/what-is-a-subnet/")],
  },
  "TCP/IP": {
    cat: "Networking",
    learn: [
      "OSI model's 7 layers vs the 4-layer TCP/IP model",
      "TCP (connection-oriented, reliable) vs UDP (connectionless, low-overhead) and when to use each",
      "Well-known ports (22/25/53/80/443/3389/etc.) and reading a 'connection refused' error",
    ],
    resources: [
      R("Cloudflare — What is the OSI Model?", "https://www.cloudflare.com/learning/ddos/glossary/open-systems-interconnection-model-osi/"),
    ],
  },
  Firewalls: {
    cat: "Networking",
    learn: [
      "Stateful vs stateless filtering; default-deny posture with narrow explicit allows",
      "DMZ design: restricting a compromised public-facing server's path to internal assets",
      "Network segmentation to limit lateral movement after a breach",
    ],
    resources: [R("Cloudflare — What is a firewall?", "https://www.cloudflare.com/learning/security/what-is-a-firewall/")],
  },
  SNMP: {
    cat: "Networking",
    learn: [
      "MIB tree, OIDs, SNMP GET vs traps for agentless device monitoring",
      "SNMPv2c's plaintext community string weakness vs SNMPv3's authentication/encryption",
      "When to use SNMP (network appliances) vs an installed monitoring agent (servers you control)",
    ],
    resources: [R("Cisco — What is SNMP?", "https://www.cisco.com/c/en/us/products/switches/what-is-snmp.html")],
  },
  "Active Directory": {
    cat: "Systems",
    learn: [
      "Forest/tree/domain/OU hierarchy; LDAP and Kerberos underpinnings",
      "Group types/scopes (security vs distribution, domain local/global/universal) and the AGDLP pattern",
      "FSMO roles, trust relationships, and replication (repadmin, DNS dependency)",
      "Delegation of Control for least-privilege administration",
    ],
    resources: [
      R(
        "Microsoft Learn — Active Directory Domain Services overview",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/get-started/virtual-dc/active-directory-domain-services-overview",
      ),
      R(
        "Microsoft Learn — AD DS design and planning",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/plan/active-directory-design-and-planning",
      ),
    ],
  },
  "Windows Server": {
    cat: "Systems",
    learn: [
      "Core roles: AD DS, DNS, DHCP, File and Storage Services, IIS, RDS, Hyper-V, Certificate Services",
      "GPO precedence (LSDOU), Enforced/Block Inheritance",
      "NTFS vs share permissions; patch management (WSUS/SCCM/Intune)",
    ],
    resources: [
      R("Microsoft Learn — Windows Server documentation", "https://learn.microsoft.com/en-us/windows-server/"),
      R(
        "Microsoft Learn — Server roles overview",
        "https://learn.microsoft.com/en-us/windows-server/get-started/getting-started-with-server-manager",
      ),
    ],
  },
  "Group Policy": {
    cat: "Systems",
    learn: [
      "GPO precedence: Local → Site → Domain → OU (LSDOU), Enforced vs Block Inheritance",
      "Common use cases: security settings, software deployment, drive mappings, screen lock enforcement",
      "gpupdate /force and gpresult for troubleshooting policy application",
    ],
    resources: [
      R(
        "Microsoft Learn — Group Policy overview",
        "https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/group-policy/group-policy-overview",
      ),
    ],
  },
  VMware: {
    cat: "Systems",
    learn: [
      "ESXi (bare-metal hypervisor) vs vCenter Server (centralized management plane)",
      "vMotion (live migration), DRS (load balancing), HA (automatic VM restart on host failure)",
      "Snapshots vs real backups — why a snapshot isn't a DR strategy",
    ],
    resources: [R("VMware — vSphere documentation", "https://docs.vmware.com/en/VMware-vSphere/index.html")],
  },
  "Hyper-V": {
    cat: "Systems",
    learn: [
      "Type 1 hypervisor shipped as a Windows Server role; Live Migration as the vMotion equivalent",
      "Management via Hyper-V Manager, PowerShell, Failover Cluster Manager/System Center VMM",
      "Checkpoints (differencing disks) and why long-lived chains degrade VM performance",
    ],
    resources: [
      R(
        "Microsoft Learn — Hyper-V technology overview",
        "https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/hyper-v-technology-overview",
      ),
    ],
  },
  RAID: {
    cat: "Systems",
    learn: [
      "RAID 0/1/5/6/10 tradeoffs: performance, redundancy, capacity efficiency, rebuild risk",
      "Why RAID 10 is preferred for write-heavy database workloads over RAID 5/6's parity write penalty",
      "RAID is not a backup — it protects against disk failure, not deletion/corruption/site loss",
    ],
    resources: [
      R("Synology — RAID types explained", "https://www.synology.com/en-us/knowledgebase/DSM/help/DSM/StorageManager/raid_choose_type"),
    ],
  },
  "NAS and SAN": {
    cat: "Systems",
    learn: [
      "NAS: file-level storage over the network (SMB/NFS) — simple, general file sharing",
      "SAN: block-level storage over Fibre Channel/iSCSI — higher performance for databases/virtualization",
      "Choosing based on whether the consuming workload needs raw block access or just a shared folder",
    ],
    resources: [R("NetApp — NAS vs SAN", "https://www.netapp.com/data-storage/nas/nas-vs-san/")],
  },
  "NTFS Permissions": {
    cat: "Systems",
    learn: [
      "NTFS permissions (granular, always apply) vs share permissions (network-only, coarser)",
      "Effective permission on network access is the more restrictive of the two",
      "Best practice: open share permission, do real access control entirely through NTFS",
    ],
    resources: [
      R(
        "Microsoft Learn — File and folder permissions",
        "https://learn.microsoft.com/en-us/windows-server/storage/file-server/ntfs-overview",
      ),
    ],
  },
  SSH: {
    cat: "Systems",
    learn: [
      "Key-based authentication (ssh-keygen, authorized_keys) vs password auth",
      "Disabling password auth (PasswordAuthentication no) as a standard hardening step",
      "PowerShell remoting (WinRM) as the Windows-native equivalent for remote administration",
    ],
    resources: [R("OpenSSH — key-based authentication", "https://www.ssh.com/academy/ssh/public-key-authentication")],
  },
  "Entra ID": {
    cat: "Systems",
    learn: [
      "Cloud identity for SaaS/M365 via SSO, distinct from on-prem AD managing the internal network",
      "Azure AD Connect sync (password hash sync vs pass-through auth), hybrid join",
      "Conditional Access and Intune policies layered on top of on-prem GPOs during migration",
    ],
    resources: [R("Microsoft Learn — What is Microsoft Entra ID?", "https://learn.microsoft.com/en-us/entra/fundamentals/whatis")],
  },
  DFS: {
    cat: "Systems",
    learn: [
      "DFS Namespaces: unified logical path across multiple servers' file shares",
      "DFS Replication: keeping data in sync across servers/sites for redundancy and branch-office speed",
      "Migrating shares transparently when users already map to the DFS path, not a direct UNC path",
    ],
    resources: [
      R(
        "Microsoft Learn — DFS Namespaces and DFS Replication overview",
        "https://learn.microsoft.com/en-us/windows-server/storage/dfs-namespaces/dfs-overview",
      ),
    ],
  },
  WSUS: {
    cat: "Systems",
    learn: [
      "Approving/distributing Microsoft updates internally instead of every machine pulling from the internet",
      "Limited scope/reporting compared to SCCM/Intune — Microsoft-only updates",
      "Fits smaller, fully on-prem environments without a full endpoint management suite",
    ],
    resources: [
      R(
        "Microsoft Learn — WSUS overview",
        "https://learn.microsoft.com/en-us/windows-server/administration/windows-server-update-services/get-started/windows-server-update-services-wsus",
      ),
    ],
  },
  PowerShell: {
    cat: "Scripting",
    learn: [
      "Verb-Noun cmdlet naming convention; object pipeline (vs Bash's plain-text pipes)",
      "Remoting (WinRM): Invoke-Command vs Enter-PSSession",
      "Error handling (try/catch/finally, $ErrorActionPreference), the ActiveDirectory module",
    ],
    resources: [
      R("Microsoft Learn — PowerShell documentation", "https://learn.microsoft.com/en-us/powershell/"),
      R("Microsoft Learn — Active Directory module cmdlets", "https://learn.microsoft.com/en-us/powershell/module/activedirectory/"),
    ],
  },
  Zabbix: {
    cat: "Monitoring",
    learn: [
      "Agent-based vs agentless (SNMP/WMI) monitoring tradeoffs",
      "Triggers, thresholds, and tuning to avoid alert fatigue",
      "Dashboards for at-a-glance fleet visibility beyond raw alerts",
    ],
    resources: [R("Zabbix — official documentation", "https://www.zabbix.com/documentation/current/en/manual")],
  },
  Nagios: {
    cat: "Monitoring",
    learn: [
      "Plugin model: independent check scripts returning a standardized exit code (0/1/2/3) plus a status line",
      "Writing a custom check without touching Nagios's core",
      "Alert routing by severity to avoid paging for informational-only conditions",
    ],
    resources: [R("Nagios — Plugin development guidelines", "https://nagios-plugins.org/doc/guidelines.html")],
  },
  "Windows Event Viewer": {
    cat: "Monitoring",
    learn: [
      "Log categories: Application, System, Security, Setup — and which to check for what",
      "Key Event IDs worth memorizing (4625 failed logon, 6008 unexpected shutdown)",
      "Centralized log aggregation (Windows Event Forwarding, syslog) vs per-server manual checks",
    ],
    resources: [
      R(
        "Microsoft Learn — Event Viewer overview",
        "https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/eventvwr",
      ),
    ],
  },
  "Backup and Disaster Recovery": {
    cat: "Tools",
    learn: [
      "Full/incremental/differential backups; RTO and RPO as business-driven design inputs",
      "3-2-1 (and 3-2-1-1-0) backup rule — why an air-gapped copy defeats ransomware targeting backups",
      "Hot/warm/cold DR sites; testing a DR plan (tabletop and live failover tests) rather than trusting it untested",
    ],
    resources: [
      R("Veeam — 3-2-1 backup rule explained", "https://www.veeam.com/blog/321-backup-rule.html"),
      R(
        "AWS — Disaster recovery objectives (RTO/RPO)",
        "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html",
      ),
    ],
  },
  SCCM: {
    cat: "Tools",
    learn: [
      "Full on-prem endpoint management suite: patching, software deployment, OS imaging, inventory",
      "Richer targeting/reporting than WSUS, but requires real infrastructure and expertise",
      "Deployment rings (pilot → broad → critical) to catch bad updates before fleet-wide rollout",
    ],
    resources: [R("Microsoft Learn — Configuration Manager documentation", "https://learn.microsoft.com/en-us/mem/configmgr/")],
  },
  Intune: {
    cat: "Tools",
    learn: [
      "Cloud-native MDM: patching, app deployment, Conditional Access enforcement without a corporate-network requirement",
      "Fits hybrid/remote workforces where devices never touch the internal LAN",
      "Works alongside Entra ID hybrid join during an on-prem-to-cloud migration",
    ],
    resources: [R("Microsoft Learn — Microsoft Intune documentation", "https://learn.microsoft.com/en-us/mem/intune/")],
  },
};
