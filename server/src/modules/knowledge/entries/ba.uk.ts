// Ukrainian mirror of ./ba.ts's BA_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildBaKbUk(): Record<string, KbEntry> {
  return {
    BABOK: {
      cat: KB.BABOK!.cat,
      learn: [
        "Шість областей знань: Планування та Моніторинг, Елситація та Співпраця, Управління Життєвим Циклом Вимог, Стратегічний Аналіз, Аналіз Вимог та Визначення Дизайну, Оцінка Рішення",
        "Підтримується IIBA — стандартний референсний body of knowledge для професії БА",
        "Основа для іспитів сертифікації ECBA/CCBA/CBAP",
      ],
      resources: KB.BABOK!.resources,
    },
    "CBAP Certification": {
      cat: KB["CBAP Certification"]!.cat,
      learn: [
        "ECBA (початковий) → CCBA (3750+ год) → CBAP (7500+ год у 4+ областях знань BABOK)",
        "Усі три адмініструються IIBA й засновані прямо на BABOK Guide",
      ],
      resources: KB["CBAP Certification"]!.resources,
    },
    "Business Requirements Document (BRD)": {
      cat: KB["Business Requirements Document (BRD)"]!.cat,
      learn: [
        "Бізнес-рівневі ЧОМУ/ЩО: цілі, високорівневі потреби, незалежні від рішення",
        "Основна аудиторія — бізнес-спонсори/стейкхолдери, що затверджують перед дизайном рішення",
        "Знаходиться вище FRD у типовій ієрархії вимог",
      ],
      resources: KB["Business Requirements Document (BRD)"]!.resources,
    },
    "Functional Requirements Document (FRD)": {
      cat: KB["Functional Requirements Document (FRD)"]!.cat,
      learn: [
        "Детальний, тестований опис того, що система повинна робити (поведінка екран-за-екраном, бізнес-правила, валідація даних)",
        "Специфічний для рішення, на відміну від бізнес-рівневого BRD, з якого він походить",
        "Достатньо детальний, щоб команда розробки/QA могла напряму будувати й тестувати",
      ],
      resources: KB["Functional Requirements Document (FRD)"]!.resources,
    },
    "Requirements Traceability Matrix": {
      cat: KB["Requirements Traceability Matrix"]!.cat,
      learn: [
        "Пов'язує кожну вимогу з її джерелом, компонентом дизайну/побудови та тест-кейсом(и), що її перевіряють",
        "Відповідає на: чи має кожна вимога джерело, чи вона побудована, чи вона протестована",
        "Будується вручну (таблиця) чи через пов'язані епіки/story JIRA для менших зусиль",
      ],
      resources: KB["Requirements Traceability Matrix"]!.resources,
    },
    BPMN: {
      cat: KB.BPMN!.cat,
      learn: [
        "Стандартизована нотація: події (кола), завдання (округлені прямокутники), gateway (ромби), потоки послідовності (стрілки)",
        "Виключні/паралельні/включні gateway моделюють логіку рішень консистентно між інструментами/командами",
        "Використовується для моделювання процесів as-is/to-be та swimlane (крос-функціональних) діаграм",
      ],
      resources: KB.BPMN!.resources,
    },
    "Use Case Diagrams": {
      cat: KB["Use Case Diagrams"]!.cat,
      learn: [
        "Актори (ролі/зовнішні системи), use case (цілі) та зв'язки include/extend",
        "Лише огляд рівня обсягу — детальні потоки містяться в супровідній специфікації use case",
        "Відрізняється від user story: формальна, самодостатня, включає альтернативні/виняткові потоки",
      ],
      resources: KB["Use Case Diagrams"]!.resources,
    },
    "Data Flow Diagrams (DFD)": {
      cat: KB["Data Flow Diagrams (DFD)"]!.cat,
      learn: [
        "Чотири елементи: зовнішні сутності, процеси, сховища даних, потоки даних",
        "Мовчить про послідовність/таймінг — відповідає на 'звідки дані приходять/куди йдуть', не 'у якому порядку'",
        "Контекстна діаграма — найвищого рівня DFD, зазвичай перша діаграма для нової інціативи",
      ],
      resources: KB["Data Flow Diagrams (DFD)"]!.resources,
    },
    "SWOT Analysis": {
      cat: KB["SWOT Analysis"]!.cat,
      learn: [
        "Сильні/слабкі сторони (внутрішні) проти можливостей/загроз (зовнішні)",
        "Використовується рано в стратегічному аналізі для формулювання запропонованої зміни",
      ],
      resources: KB["SWOT Analysis"]!.resources,
    },
    "Gap Analysis": {
      cat: KB["Gap Analysis"]!.cat,
      learn: [
        "Порівнює as-is (поточний стан) з to-be (бажаний майбутній стан), щоб виявити відсутні можливості",
        "Кожен виявлений розрив зазвичай стає чи інформує вимогу",
      ],
      resources: KB["Gap Analysis"]!.resources,
    },
    "Root Cause Analysis": {
      cat: KB["Root Cause Analysis"]!.cat,
      learn: [
        "5 Whys: повторно питати чому, доки не досягнеться фактична коренева причина, не симптом",
        "Fishbone (Ішикави) діаграма: організує кандидатні причини в категорії (Люди/Процес/Технологія/Середовище), коли ймовірні кілька сприяючих причин",
        "Коренева причина проти сприяючого фактора проти симптому — тест: чи усунення лише цього зупинить повторення проблеми?",
      ],
      resources: KB["Root Cause Analysis"]!.resources,
    },
    "Feasibility Analysis": {
      cat: KB["Feasibility Analysis"]!.cat,
      learn: [
        "П'ять вимірювань: технічне, економічне, операційне, юридичне/регуляторне, розкладове",
        "Рішення може пройти більшість вимірювань і все одно бути блокованим одним (наприклад, операційна готовність)",
      ],
      resources: KB["Feasibility Analysis"]!.resources,
    },
    "Cost-Benefit Analysis": {
      cat: KB["Cost-Benefit Analysis"]!.cat,
      learn: [
        "Порівнює загальні очікувані витрати з загальними очікуваними вигодами на визначеному горизонті",
        "Поширена помилка: рахувати лише легко квантифіковані тверді витрати/економію, ігноруючи реальні, але важче квантифіковані вигоди",
      ],
      resources: KB["Cost-Benefit Analysis"]!.resources,
    },
    "Stakeholder Analysis": {
      cat: KB["Stakeholder Analysis"]!.cat,
      learn: [
        "Виявити всіх, на кого впливає/хто впливає на інціативу; мапувати інтерес, вплив, ймовірну позицію",
        "Сітка влади/інтересу: керувати уважно (висока влада+інтерес), тримати задоволеними, тримати поінформованими, моніторити",
        "Інформує планування елситації та стратегію комунікації",
      ],
      resources: KB["Stakeholder Analysis"]!.resources,
    },
    "JAD Sessions": {
      cat: KB["JAD Sessions"]!.cat,
      learn: [
        "Joint Application Development — структурований, фасилітований воркшоп для елситації/валідації вимог з кількома стейкхолдерами в реальному часі",
        "Відрізняється від звичайної зустрічі виділеним фасилітатором, визначеним порядком дня та ціллю досягти рішень у кімнаті",
      ],
      resources: KB["JAD Sessions"]!.resources,
    },
    "Business Rules": {
      cat: KB["Business Rules"]!.cat,
      learn: [
        "Незалежне від рішення твердження, що регулює/обмежує бізнес-поведінку (наприклад, 'знижка понад 20% потребує затвердження менеджера')",
        "Документується у форматі якщо/тоді, атомарно й незалежно від UI — часто в каталозі бізнес-правил окремо від документа вимог",
        "Одне правило може керувати кількома функціональними вимогами і змінюватись за власним (регуляторним) графіком",
      ],
      resources: KB["Business Rules"]!.resources,
    },
    "Non-Functional Requirements (NFRs)": {
      cat: KB["Non-Functional Requirements (NFRs)"]!.cat,
      learn: [
        "Продуктивність, безпека, юзабіліті/доступність, надійність/доступність, масштабованість, підтримуваність, комплаєнс",
        "Легко пропустити, бо стейкхолдери рідко пропонують їх без запиту — треба активно елситувати",
      ],
      resources: KB["Non-Functional Requirements (NFRs)"]!.resources,
    },
    "Acceptance Criteria": {
      cat: KB["Acceptance Criteria"]!.cat,
      learn: [
        "Конкретні, тестовані, неоднозначні умови, які повинна задовольнити story/вимога",
        "Given/When/Then (у стилі Gherkin) структурує передумову, дію та очікуваний результат",
        "Відрізняється від Definition of Done, яка застосовується однаково до кожної story незалежно від змісту",
      ],
      resources: KB["Acceptance Criteria"]!.resources,
    },
    "INVEST Criteria": {
      cat: KB["INVEST Criteria"]!.cat,
      learn: [
        "Independent, Negotiable, Valuable, Estimable, Small, Testable — планка якості для добре сформованої user story",
        "Story, що не проходить кілька перевірок, зазвичай потребує розбиття чи уточнення до спринту",
      ],
      resources: KB["INVEST Criteria"]!.resources,
    },
    "Vision and Scope Document": {
      cat: KB["Vision and Scope Document"]!.cat,
      learn: [
        "Хартія ранньої стадії: бізнес-цілі, високорівневий обсяг в/поза, ключові стейкхолдери, критерії успіху",
        "Коротший і менш детальний, ніж BRD — встановлює спільну рамку до детальної елситації",
      ],
      resources: KB["Vision and Scope Document"]!.resources,
    },
    "Functional Decomposition": {
      cat: KB["Functional Decomposition"]!.cat,
      learn: [
        "Розбиває велику, нечітку бізнес-функцію на прогресивно менші підфункції, доки кожна не стане конкретною",
        "Розв'язує проблему опису стейкхолдером чогось занадто широкого для прямої елситації детальних вимог",
      ],
      resources: KB["Functional Decomposition"]!.resources,
    },
    "Swimlane Diagram": {
      cat: KB["Swimlane Diagram"]!.cat,
      learn: [
        "Крос-функціональна діаграма процесу, організована в смуги, одна на роль/відділ/систему",
        "Робить передачі між ролями/відділами явними — саме там, де процеси зазвичай ламаються",
      ],
      resources: KB["Swimlane Diagram"]!.resources,
    },
    "Data Dictionary / Glossary": {
      cat: KB["Data Dictionary / Glossary"]!.cat,
      learn: [
        "Спільне, узгоджене визначення кожного ключового терміна/елемента даних/скорочення в документації вимог",
        "Запобігає тому, щоб вимоги були окремо чіткими, але конфліктуючими, бо два документи мають на увазі різне тим самим словом",
      ],
      resources: KB["Data Dictionary / Glossary"]!.resources,
    },
    SIPOC: {
      cat: KB.SIPOC!.cat,
      learn: [
        "Suppliers, Inputs, Process (5-7 високорівневих кроків), Outputs, Customers",
        "Використовується дуже рано, часто до детальної карти процесу, щоб швидко встановити обсяг/межі",
      ],
      resources: KB.SIPOC!.resources,
    },
    "Value Stream Mapping": {
      cat: KB["Value Stream Mapping"]!.cat,
      learn: [
        "Виявляє кроки, що додають цінність, проти втрат (очікування, переробка, непотрібні передачі) через наскрізний потік",
        "Явно оцінювальна — кожен крок оцінюється за тим, чи заплатив би клієнт за нього",
      ],
      resources: KB["Value Stream Mapping"]!.resources,
    },
    "Impact Analysis": {
      cat: KB["Impact Analysis"]!.cat,
      learn: [
        "Оцінює downstream-наслідки запропонованої зміни вимоги перед її затвердженням",
        "Обов'язковий вхід для контролю змін — затвердження зміни без цього означає затвердження невідомого",
      ],
      resources: KB["Impact Analysis"]!.resources,
    },
    "Context Diagram": {
      cat: KB["Context Diagram"]!.cat,
      learn: [
        "Найвищого рівня DFD: одна бульбашка процесу для всієї системи, оточена кожною зовнішньою сутністю, з якою вона обмінюється даними",
        "Зазвичай перша створена діаграма — узгодження межі системи перед будь-яким детальним аналізом",
      ],
      resources: KB["Context Diagram"]!.resources,
    },
    Lucidchart: {
      cat: KB.Lucidchart!.cat,
      learn: [
        "Браузерне, спільне в реальному часі діаграмування (блок-схеми, BPMN, wireframe, орг-схеми)",
        "Нативні інтеграції з Confluence, JIRA та Google Workspace",
        "Основна перевага над Visio: одночасне редагування кількома користувачами без встановлення десктопа",
      ],
      resources: KB.Lucidchart!.resources,
    },
    Visio: {
      cat: KB.Visio!.cat,
      learn: [
        "Структуровані діаграми бізнес-процесів (блок-схеми, BPMN, swimlane, орг-схеми) зі стандартизованими шаблонами фігур",
        "Сильна інтеграція з екосистемою Microsoft/Office; поширений в enterprise з наявним ліцензуванням/шаблонами",
      ],
      resources: KB.Visio!.resources,
    },
    Balsamiq: {
      cat: KB.Balsamiq!.cat,
      learn: [
        "Свідомо низько-точні, у стилі рукописного ескізу wireframe/макети",
        "Ескізний стиль сигналізує 'грубий концепт, не остаточний дизайн' — тримає ранні розмови на структурі/контенті",
      ],
      resources: KB.Balsamiq!.resources,
    },
  };
}
