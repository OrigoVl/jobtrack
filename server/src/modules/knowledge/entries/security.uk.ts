// Ukrainian mirror of ./security.ts's SECURITY_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildSecurityKbUk(): Record<string, KbEntry> {
  return {
    "OWASP Top 10": {
      cat: KB["OWASP Top 10"]!.cat,
      learn: [
        "Категорії ризиків поточного списку (Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable and Outdated Components та інші)",
        "Це документ пріоритизації/обізнаності на основі реальних даних, не повний чек-лист",
      ],
      resources: KB["OWASP Top 10"]!.resources,
    },
    "NIST Cybersecurity Framework": {
      cat: KB["NIST Cybersecurity Framework"]!.cat,
      learn: [
        "П'ять функцій: Identify, Protect, Detect, Respond, Recover",
        "Оцінка зрілості спільною мовою, не приписуючий чек-лист конкретних контролів",
      ],
      resources: KB["NIST Cybersecurity Framework"]!.resources,
    },
    "MITRE ATT&CK": {
      cat: KB["MITRE ATT&CK"]!.cat,
      learn: [
        "Тактики, техніки й процедури (TTPs), організовані за стадією життєвого циклу атаки",
        "Мапінг власного покриття детекції на конкретні ID техніки, не лише абстрактні категорії",
      ],
      resources: KB["MITRE ATT&CK"]!.resources,
    },
    "Zero Trust Architecture": {
      cat: KB["Zero Trust Architecture"]!.cat,
      learn: [
        "Ніколи не довіряти лише за мережевим розташуванням — автентифікувати/авторизувати кожен запит на основі ідентичності, стану пристрою й контексту",
        "Мікросегментація й безперервна перевірка проти старішої моделі периметра/VPN",
      ],
      resources: KB["Zero Trust Architecture"]!.resources,
    },
    "Threat Modeling": {
      cat: KB["Threat Modeling"]!.cat,
      learn: [
        "STRIDE (Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege)",
        "Діаграми потоку даних і межі довіри як початковий артефакт",
      ],
      resources: KB["Threat Modeling"]!.resources,
    },
    "Password Hashing": {
      cat: KB["Password Hashing"]!.cat,
      learn: [
        "bcrypt/scrypt/Argon2 (повільні, адаптивні, солоні) проти швидких хешів загального призначення (MD5/SHA-256) для зберігання паролів",
        "Сіль нейтралізує rainbow-таблиці; work factor слід налаштувати під реальний бюджет часу логіну",
      ],
      resources: KB["Password Hashing"]!.resources,
    },
    "Cryptography Fundamentals": {
      cat: KB["Cryptography Fundamentals"]!.cat,
      learn: [
        "Симетрична (AES) проти асиметричної (RSA/ECC) — компроміс швидкість проти розповсюдження ключів",
        "Хешування проти шифрування; цифрові підписи для цілісності й неспростовності",
      ],
      resources: KB["Cryptography Fundamentals"]!.resources,
    },
    "Penetration Testing": {
      cat: KB["Penetration Testing"]!.cat,
      learn: [
        "Скоупінг і правила взаємодії перед початком тестування — явна письмова авторизація обов'язкова",
        "Recon → сканування → експлуатація → post-exploitation → звітність з рекомендаціями щодо remediation",
      ],
      resources: KB["Penetration Testing"]!.resources,
    },
    SIEM: {
      cat: KB.SIEM!.cat,
      learn: [
        "Агрегація логів по всій організації і кореляція подій для виявлення паттернів, які одне джерело логів не показало б",
        "Налаштування правил кореляції, щоб скоротити шум без втрати реальних сигналів",
      ],
      resources: KB.SIEM!.resources,
    },
    "SQL Injection": {
      cat: KB["SQL Injection"]!.cat,
      learn: [
        "Конкатенація рядків у запит проти параметризованих запитів/prepared statements",
        "Blind, error-based і UNION-based injection — різні техніки для тієї самої кореневої причини",
      ],
      resources: KB["SQL Injection"]!.resources,
    },
    "Cross-Site Scripting (XSS)": {
      cat: KB["Cross-Site Scripting (XSS)"]!.cat,
      learn: [
        "Reflected проти stored проти DOM-based XSS",
        "Кодування виводу залежно від контексту як основний захист; Content-Security-Policy як другий рівень",
      ],
      resources: KB["Cross-Site Scripting (XSS)"]!.resources,
    },
    CSRF: {
      cat: KB.CSRF!.cat,
      learn: [
        "Анти-CSRF токени, атрибут cookie SameSite і перевірки Origin/Referer",
        "Чому GET-запит ніколи не повинен тригерити зміну стану",
      ],
      resources: KB.CSRF!.resources,
    },
    SSRF: {
      cat: KB.SSRF!.cat,
      learn: [
        "Серверні запити, зловживані для досягнення внутрішніх сервісів (ендпоінти метаданих хмари, внутрішні адмін-панелі)",
        "Захист: allowlist призначень, блокування приватних/link-local діапазонів IP, валідація резолвленого IP, не лише рядка URL",
      ],
      resources: KB.SSRF!.resources,
    },
    IDOR: {
      cat: KB.IDOR!.cat,
      learn: [
        "Авторизація на рівні об'єкта перевіряється на кожен запит, не лише автентифікація",
        "Чому це знаходиться просто зміною ID — завжди повторно перевіряти власність на стороні сервера",
      ],
      resources: KB.IDOR!.resources,
    },
    XXE: {
      cat: KB.XXE!.cat,
      learn: [
        "Парсери XML, що резолвлять зовнішні entity за дефолтом — читання локальних файлів чи тригер SSRF",
        "Виправлення: явно вимкнути обробку DTD і резолюцію зовнішніх entity в конфігурації парсера",
      ],
      resources: KB.XXE!.resources,
    },
    "JWT Security": {
      cat: KB["JWT Security"]!.cat,
      learn: [
        "decode проти verify — ніколи не довіряти claims з токена, чий підпис не перевірено",
        "Хардкодити очікуваний алгоритм на стороні сервера; ніколи не приймати alg: none чи довіряти власному заголовку токена",
      ],
      resources: KB["JWT Security"]!.resources,
    },
    "SAST/DAST": {
      cat: KB["SAST/DAST"]!.cat,
      learn: [
        "SAST сканує сирцевий код без його виконання; DAST тестує застосунок, що працює, з-зовні, як атакувальник",
        "Накладання обох плюс сканування залежностей покриває значно більше, ніж будь-який окремо",
      ],
      resources: KB["SAST/DAST"]!.resources,
    },
    "Secure Coding Practices": {
      cat: KB["Secure Coding Practices"]!.cat,
      learn: [
        "Валідація вхідних даних, кодування виводу, параметризовані запити, сервісні акаунти з найменшими привілеями",
        "Управління секретами і сканування залежностей/supply-chain як частина стандартного робочого процесу розробки, не післядумка",
      ],
      resources: KB["Secure Coding Practices"]!.resources,
    },
    "TLS/SSL": {
      cat: KB["TLS/SSL"]!.cat,
      learn: [
        "Handshake: узгодження cipher suite, надання сертифіката, виведення симетричного сесійного ключа",
        "Ланцюжок довіри сертифікатів і валідація (збіг CN/SAN, терміни дії, відкликання через CRL/OCSP)",
      ],
      resources: KB["TLS/SSL"]!.resources,
    },
    "DNS Security": {
      cat: KB["DNS Security"]!.cat,
      learn: [
        "DNS cache poisoning/spoofing і як DNSSEC криптографічно підписує записи для захисту від цього",
        "DNS over HTTPS/TLS для захисту самого запиту від прослуховування",
      ],
      resources: KB["DNS Security"]!.resources,
    },
    "DDoS Protection": {
      cat: KB["DDoS Protection"]!.cat,
      learn: [
        "Об'ємні атаки (пропускна здатність) проти атак на рівні застосунку (дорогі запити) потребують різних заходів",
        "CDN/scrubbing-сервіси проти рейт-лімітування і захисту, свідомого вартості запиту, на рівні застосунку",
      ],
      resources: KB["DDoS Protection"]!.resources,
    },
    "IDS/IPS": {
      cat: KB["IDS/IPS"]!.cat,
      learn: [
        "Детекція (лише сповіщення) проти превенції (активно блокує) — і чому нові правила спочатку мають довести себе в режимі лише детекції",
        "Детекція на основі сигнатур проти детекції на основі аномалій",
      ],
      resources: KB["IDS/IPS"]!.resources,
    },
    "Network Segmentation": {
      cat: KB["Network Segmentation"]!.cat,
      learn: [
        "VLAN/підмережі/правила файрвола, що ізолюють зони, щоб компрометація не могла напряму досягти високоцінного активу",
        "Обмеження латерального руху — ключової стадії більшості реальних зломів — навіть коли захист периметра провалюється",
      ],
      resources: KB["Network Segmentation"]!.resources,
    },
    "Burp Suite": {
      cat: KB["Burp Suite"]!.cat,
      learn: [
        "Робочий процес перехоплюючого проксі: Proxy → Repeater для мануального повтору/підробки",
        "Автоматизований краулінг/сканування (Spider/Scanner) проти мануального, цільового тестування",
      ],
      resources: KB["Burp Suite"]!.resources,
    },
    Nmap: {
      cat: KB.Nmap!.cat,
      learn: [
        "Виявлення хостів, сканування портів, виявлення сервісу/версії (-sV) і скрипти NSE",
        "Запуск сканів проти власної інфраструктури для виявлення ненавмисно доступних сервісів",
      ],
      resources: KB.Nmap!.resources,
    },
    Wireshark: {
      cat: KB.Wireshark!.cat,
      learn: [
        "Захоплення пакетів і перевірка на рівні протоколу з потужними фільтрами відображення",
        "Перевірка, що трафік дійсно зашифрований, як очікувалось; форензик-аналіз захопленого трафіку інциденту",
      ],
      resources: KB.Wireshark!.resources,
    },
    Metasploit: {
      cat: KB.Metasploit!.cat,
      learn: [
        "Модулі експлойта/payload/post-exploitation — використовуються лише з явною письмовою авторизацією",
        "Перевірка, що відома вразливість реально експлуатовна в конкретному середовищі, не лише теоретично присутня",
      ],
      resources: KB.Metasploit!.resources,
    },
    "OWASP ZAP": {
      cat: KB["OWASP ZAP"]!.cat,
      learn: [
        "Безкоштовний, відкритий перехоплюючий проксі з автоматичним сканером",
        "Режим baseline-скану для CI-дружнього DAST проти повного активного скану",
      ],
      resources: KB["OWASP ZAP"]!.resources,
    },
    "Vulnerability Scanning": {
      cat: KB["Vulnerability Scanning"]!.cat,
      learn: [
        "Автоматичні сканери (Nessus, Qualys, OpenVAS), що перевіряють цілі проти бази даних відомих вразливостей/помилок конфігурації",
        "Триаж за серйозністю + експлуатовністю + експозицією, потім дедублювання за кореневою причиною замість трактування кожної знахідки незалежно",
      ],
      resources: KB["Vulnerability Scanning"]!.resources,
    },
    "Kali Linux": {
      cat: KB["Kali Linux"]!.cat,
      learn: [
        "Попередньо завантажений дистрибутив Linux для penetration testing — стандартизоване середовище, не інструмент сам по собі",
        "Лише для використання в явно авторизованих контекстах тестування",
      ],
      resources: KB["Kali Linux"]!.resources,
    },
    "Password Cracking": {
      cat: KB["Password Cracking"]!.cat,
      learn: [
        "Словникові атаки, брутфорс і мутації на основі правил зі словника (John the Ripper, Hashcat)",
        "Використовується захисно для аудиту того, чи реальні хеші паролів організації переживуть спробу зламу реального атакувальника",
      ],
      resources: KB["Password Cracking"]!.resources,
    },
    CyberChef: {
      cat: KB.CyberChef!.cat,
      learn: [
        "Ланцюжок операцій кодування/декодування/шифрування/трансформації для браузера",
        "Деобфускація payload'ів малваре чи даних CTF без написання власних скриптів",
      ],
      resources: KB.CyberChef!.resources,
    },
    Shodan: {
      cat: KB.Shodan!.cat,
      learn: [
        "Пошуковий рушій, що індексує підключені до інтернету пристрої/сервіси скануванням інтернету",
        "Пошук власних ненавмисно доступних пристроїв до того, як це зробить пошук атакувальника",
      ],
      resources: KB.Shodan!.resources,
    },
    Splunk: {
      cat: KB.Splunk!.cat,
      learn: [
        "Прийом логів, мова запитів SPL для пошуку/кореляції, правила сповіщень і дашборди",
        "Написання запиту для кореляції конкретного паттерну (наприклад, невдалі логіни, за якими йде успіх) по прийнятих логах",
      ],
      resources: KB.Splunk!.resources,
    },
  };
}
