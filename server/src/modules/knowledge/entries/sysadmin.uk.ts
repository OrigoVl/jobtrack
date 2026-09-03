// Ukrainian mirror of ./sysadmin.ts's SYSADMIN_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildSysadminKbUk(): Record<string, KbEntry> {
  return {
    ITIL: {
      cat: KB.ITIL!.cat,
      learn: [
        "Управління incident vs problem vs change vs service request",
        "SLA, пріоритет (impact x urgency), багаторівнева підтримка (L1/L2/L3)",
        "Change Advisory Board (CAB), Requests for Change (RFC), стандартні vs термінові зміни",
      ],
      resources: KB.ITIL!.resources,
    },
    MFA: {
      cat: KB.MFA!.cat,
      learn: [
        "Типи факторів: знання, володіння, властивість; push vs number-matching vs FIDO2/апаратні ключі",
        "Атаки MFA fatigue і чому number-matching/апаратні ключі стійкіші до фішингу, ніж простий push",
        "Рекомендації NIST SP 800-63B щодо паролів: довжина замість примусової ротації, у парі з MFA",
      ],
      resources: KB.MFA!.resources,
    },
    "Endpoint Protection": {
      cat: KB["Endpoint Protection"]!.cat,
      learn: [
        "Сигнатурний AV vs EDR: поведінковий моніторинг, телеметрія, реакція isolate/kill/rollback",
        "Частота патчингу (Patch Tuesday), поетапні кільця розгортання, термінове позапланове патчування",
        "Поширений корпоративний EDR: Microsoft Defender for Endpoint, CrowdStrike Falcon, SentinelOne",
      ],
      resources: KB["Endpoint Protection"]!.resources,
    },
    "Ticketing Systems": {
      cat: KB["Ticketing Systems"]!.cat,
      learn: [
        "Життєвий цикл incident/request, відстеження SLA, категоризація, шляхи ескалації",
        "ServiceNow (корпоративний ITSM) vs Zendesk (підтримка клієнтів) vs Freshservice/Jira Service Management (ITSM середнього ринку)",
        "Написання відтворюваного тікета: симптом, виконані кроки, середовище, доказ",
      ],
      resources: KB["Ticketing Systems"]!.resources,
    },
    "IT Asset Management": {
      cat: KB["IT Asset Management"]!.cat,
      learn: [
        "CMDB: відстеження обладнання, ліцензій на софт, і їхніх взаємозв'язків/залежностей",
        "Чекліст онбордингу/офбордингу, пов'язаний з призначенням активів і поверненням ліцензій",
        "Автоматичне виявлення в мережі vs ручне відстеження в таблиці",
      ],
      resources: KB["IT Asset Management"]!.resources,
    },
    DNS: {
      cat: KB.DNS!.cat,
      learn: [
        "Типи записів: A/AAAA/CNAME/MX/TXT/NS/PTR, і ланцюжок резолюції (рекурсивний → root → TLD → авторитетний)",
        "TTL і кешування на кожному хопі — чому поширення не миттєве",
        "AD-інтегровані зони DNS і SRV-записи (_ldap._tcp, _kerberos._tcp)",
      ],
      resources: KB.DNS!.resources,
    },
    DHCP: {
      cat: KB.DHCP!.cat,
      learn: [
        "Процес DORA (Discover/Offer/Request/Acknowledge), час лізингу та продовження",
        "APIPA (169.254.x.x) як діагностичний сигнал повністю недосяжного DHCP-сервера",
        "Резервації для принтерів/серверів; DHCP snooping для блокування несанкціонованих DHCP-серверів",
      ],
      resources: KB.DHCP!.resources,
    },
    VPN: {
      cat: KB.VPN!.cat,
      learn: [
        "Site-to-site vs remote access VPN; IPsec, OpenVPN, WireGuard, SSL/TLS VPN",
        "Zero-trust/SASE як альтернатива широкому доступу на рівні мережі через VPN",
        "Поширені збої: проблеми NAT-T passthrough, розбіжність IKE Phase 1/2, таймаути простою",
      ],
      resources: KB.VPN!.resources,
    },
    Subnetting: {
      cat: KB.Subnetting!.cat,
      learn: [
        "Нотація CIDR, маски підмереж, резервування мережевої/broadcast-адреси",
        "Розмір підмережі з вимоги кількості хостів (округлення до наступної степені 2 мінус 2)",
        "VLAN як доповнення на рівні 2 до IP subnetting для ізоляції трафіку",
      ],
      resources: KB.Subnetting!.resources,
    },
    "TCP/IP": {
      cat: KB["TCP/IP"]!.cat,
      learn: [
        "7 рівнів моделі OSI vs 4-рівнева модель TCP/IP",
        "TCP (орієнтований на з'єднання, надійний) vs UDP (без з'єднання, малі накладні витрати), і коли використовувати кожен",
        "Відомі порти (22/25/53/80/443/3389 тощо) і читання помилки 'connection refused'",
      ],
      resources: KB["TCP/IP"]!.resources,
    },
    Firewalls: {
      cat: KB.Firewalls!.cat,
      learn: [
        "Stateful vs stateless фільтрація; позиція default-deny з вузькими явними дозволами",
        "Дизайн DMZ: обмеження шляху скомпрометованого публічного сервера до внутрішніх активів",
        "Сегментація мережі для обмеження горизонтального переміщення після зламу",
      ],
      resources: KB.Firewalls!.resources,
    },
    SNMP: {
      cat: KB.SNMP!.cat,
      learn: [
        "Дерево MIB, OID, SNMP GET vs traps для agentless моніторингу пристроїв",
        "Слабкість текстового community string SNMPv2c vs автентифікація/шифрування SNMPv3",
        "Коли використовувати SNMP (мережеве обладнання) vs встановлений агент моніторингу (сервери, якими керуєш)",
      ],
      resources: KB.SNMP!.resources,
    },
    "Active Directory": {
      cat: KB["Active Directory"]!.cat,
      learn: [
        "Ієрархія forest/tree/domain/OU; основа на LDAP і Kerberos",
        "Типи/scope груп (безпека vs розсилка, domain local/global/universal) і паттерн AGDLP",
        "FSMO-ролі, trust-відношення, і реплікація (repadmin, залежність від DNS)",
        "Delegation of Control для адміністрування за принципом найменших привілеїв",
      ],
      resources: KB["Active Directory"]!.resources,
    },
    "Windows Server": {
      cat: KB["Windows Server"]!.cat,
      learn: [
        "Основні ролі: AD DS, DNS, DHCP, File and Storage Services, IIS, RDS, Hyper-V, Certificate Services",
        "Пріоритет GPO (LSDOU), Enforced/Block Inheritance",
        "NTFS vs права шари; управління патчами (WSUS/SCCM/Intune)",
      ],
      resources: KB["Windows Server"]!.resources,
    },
    "Group Policy": {
      cat: KB["Group Policy"]!.cat,
      learn: [
        "Пріоритет GPO: Local → Site → Domain → OU (LSDOU), Enforced vs Block Inheritance",
        "Поширені сценарії: налаштування безпеки, розгортання софту, підключення дисків, блокування екрана",
        "gpupdate /force і gpresult для усунення несправностей застосування політики",
      ],
      resources: KB["Group Policy"]!.resources,
    },
    VMware: {
      cat: KB.VMware!.cat,
      learn: [
        "ESXi (bare-metal гіпервізор) vs vCenter Server (централізована площина управління)",
        "vMotion (живе перенесення), DRS (балансування навантаження), HA (автоматичний перезапуск VM при відмові хоста)",
        "Snapshots vs справжні бекапи — чому snapshot не є стратегією DR",
      ],
      resources: KB.VMware!.resources,
    },
    "Hyper-V": {
      cat: KB["Hyper-V"]!.cat,
      learn: [
        "Type 1 гіпервізор, що постачається як роль Windows Server; Live Migration як еквівалент vMotion",
        "Управління через Hyper-V Manager, PowerShell, Failover Cluster Manager/System Center VMM",
        "Checkpoint-и (диференціюючі диски) і чому довгі ланцюжки погіршують продуктивність VM",
      ],
      resources: KB["Hyper-V"]!.resources,
    },
    RAID: {
      cat: KB.RAID!.cat,
      learn: [
        "Компроміси RAID 0/1/5/6/10: продуктивність, резервність, ефективність обсягу, ризик ребілду",
        "Чому RAID 10 переважний для навантажень БД з інтенсивним записом над штрафом парності RAID 5/6",
        "RAID — не бекап — він захищає від відмови диска, не від видалення/пошкодження/втрати сайту",
      ],
      resources: KB.RAID!.resources,
    },
    "NAS and SAN": {
      cat: KB["NAS and SAN"]!.cat,
      learn: [
        "NAS: файлове сховище через мережу (SMB/NFS) — просте, загальне надання файлів",
        "SAN: блокове сховище через Fibre Channel/iSCSI — вища продуктивність для баз даних/віртуалізації",
        "Вибір залежно від того, чи потребує навантаження безпосередній блоковий доступ, чи просто спільну папку",
      ],
      resources: KB["NAS and SAN"]!.resources,
    },
    "NTFS Permissions": {
      cat: KB["NTFS Permissions"]!.cat,
      learn: [
        "NTFS-права (детальні, завжди діють) vs права шари (лише мережа, грубіші)",
        "Ефективне право при мережевому доступі — суворіше з двох",
        "Найкраща практика: відкрите право шари, реальний контроль доступу повністю через NTFS",
      ],
      resources: KB["NTFS Permissions"]!.resources,
    },
    SSH: {
      cat: KB.SSH!.cat,
      learn: [
        "Автентифікація за ключем (ssh-keygen, authorized_keys) vs паролем",
        "Вимкнення парольної автентифікації (PasswordAuthentication no) як стандартний крок посилення захисту",
        "PowerShell remoting (WinRM) як нативний для Windows еквівалент віддаленого адміністрування",
      ],
      resources: KB.SSH!.resources,
    },
    "Entra ID": {
      cat: KB["Entra ID"]!.cat,
      learn: [
        "Хмарна ідентичність для SaaS/M365 через SSO, окремо від on-prem AD, що керує внутрішньою мережею",
        "Синхронізація Azure AD Connect (password hash sync vs pass-through auth), hybrid join",
        "Політики Conditional Access та Intune поверх on-prem GPO під час миграції",
      ],
      resources: KB["Entra ID"]!.resources,
    },
    DFS: {
      cat: KB.DFS!.cat,
      learn: [
        "DFS Namespaces: уніфікований логічний шлях через файлові шари кількох серверів",
        "DFS Replication: синхронізація даних між серверами/сайтами для резервування і швидкості в філіалах",
        "Прозора миграція шар, коли користувачі вже мапляться на шлях DFS, а не прямий UNC-шлях",
      ],
      resources: KB.DFS!.resources,
    },
    WSUS: {
      cat: KB.WSUS!.cat,
      learn: [
        "Схвалення/розповсюдження оновлень Microsoft внутрішньо, замість того щоб кожна машина тягла з інтернету",
        "Обмежений обсяг/звітність порівняно з SCCM/Intune — лише оновлення Microsoft",
        "Підходить меншим, повністю on-prem середовищам без повного набору управління кінцевими точками",
      ],
      resources: KB.WSUS!.resources,
    },
    PowerShell: {
      cat: KB.PowerShell!.cat,
      learn: [
        "Конвенція іменування cmdlet Verb-Noun; object pipeline (проти простих текстових pipe у Bash)",
        "Remoting (WinRM): Invoke-Command vs Enter-PSSession",
        "Обробка помилок (try/catch/finally, $ErrorActionPreference), модуль ActiveDirectory",
      ],
      resources: KB.PowerShell!.resources,
    },
    Zabbix: {
      cat: KB.Zabbix!.cat,
      learn: [
        "Компроміси agent-based vs agentless (SNMP/WMI) моніторингу",
        "Тригери, пороги, і налаштування для уникнення alert fatigue",
        "Дашборди для видимості всього парку одразу, понад сирі алерти",
      ],
      resources: KB.Zabbix!.resources,
    },
    Nagios: {
      cat: KB.Nagios!.cat,
      learn: [
        "Модель плагінів: незалежні скрипти перевірки, що повертають стандартизований код виходу (0/1/2/3) плюс рядок статусу",
        "Написання кастомної перевірки без торкання ядра Nagios",
        "Маршрутизація алертів за серйозністю, щоб уникнути page для лише інформаційних умов",
      ],
      resources: KB.Nagios!.resources,
    },
    "Windows Event Viewer": {
      cat: KB["Windows Event Viewer"]!.cat,
      learn: [
        "Категорії логів: Application, System, Security, Setup — і що перевіряти для чого",
        "Ключові Event ID, варті запам'ятовування (4625 невдалий логін, 6008 неочікуване вимкнення)",
        "Централізована агрегація логів (Windows Event Forwarding, syslog) vs ручна перевірка кожного сервера",
      ],
      resources: KB["Windows Event Viewer"]!.resources,
    },
    "Backup and Disaster Recovery": {
      cat: KB["Backup and Disaster Recovery"]!.cat,
      learn: [
        "Повний/інкрементний/диференційний бекап; RTO і RPO як бізнес-обґрунтовані вхідні дані дизайну",
        "Правило бекапу 3-2-1 (і 3-2-1-1-0) — чому air-gapped копія нівелює ransomware, що атакує бекапи",
        "Hot/warm/cold DR-сайти; тестування плану DR (tabletop і живі тести failover), а не довіра непротестованому плану",
      ],
      resources: KB["Backup and Disaster Recovery"]!.resources,
    },
    SCCM: {
      cat: KB.SCCM!.cat,
      learn: [
        "Повний on-prem набір управління кінцевими точками: патчинг, розгортання софту, imaging OS, інвентаризація",
        "Багатша цілізація/звітність, ніж WSUS, але потребує реальної інфраструктури й експертизи",
        "Кільця розгортання (pilot → broad → critical) для виявлення поганих оновлень перед розгортанням на весь парк",
      ],
      resources: KB.SCCM!.resources,
    },
    Intune: {
      cat: KB.Intune!.cat,
      learn: [
        "Хмаро-нативний MDM: патчинг, розгортання застосунків, застосування Conditional Access без вимоги корпоративної мережі",
        "Підходить гібридним/віддаленим командам, де пристрої ніколи не торкаються внутрішньої LAN",
        "Працює разом з Entra ID hybrid join під час миграції з on-prem у хмару",
      ],
      resources: KB.Intune!.resources,
    },
  };
}
