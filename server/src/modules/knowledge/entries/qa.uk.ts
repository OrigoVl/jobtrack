// Ukrainian mirror of ./qa.ts's QA_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildQaKbUk(): Record<string, KbEntry> {
  return {
    Selenium: {
      cat: KB.Selenium!.cat,
      learn: [
        "Стратегії локаторів (id/CSS/XPath), явні проти неявних очікувань",
        "Page Object Model, Selenium Grid для паралельних/cross-browser прогонів",
        "Архітектура WebDriver, драйвери браузерів",
      ],
      resources: KB.Selenium!.resources,
    },
    Cypress: {
      cat: KB.Cypress!.cat,
      learn: [
        "Автоматичні повторні спроби (retry-ability), cy.intercept для заглушення мережі",
        "Кастомні команди, fixtures, cy.session для повторного використання автентифікації",
        "Модель same-origin і її практичні межі порівняно з Playwright",
      ],
      resources: KB.Cypress!.resources,
    },
    Appium: {
      cat: KB.Appium!.cat,
      learn: [
        "Мобільна автоматизація на основі протоколу WebDriver (iOS/Android)",
        "Пошук нативних елементів (accessibility id, селектори UiAutomator/XCUITest)",
        "Компроміси між реальним пристроєм і емулятором/симулятором",
      ],
      resources: KB.Appium!.resources,
    },
    "Page Object Model": {
      cat: KB["Page Object Model"]!.cat,
      learn: [
        "Інкапсулювати локатори/дії для сторінки чи компонента, перевірки лишати в тесті",
        "Компонувати спільні компоненти (хедер/навігацію) замість дублювання локаторів",
        "Уникати «God object» — моделювати навколо бізнес-дій, а не сирих селекторів",
      ],
      resources: KB["Page Object Model"]!.resources,
    },
    "Test Automation Framework": {
      cat: KB["Test Automation Framework"]!.cat,
      learn: [
        "Гібридні фреймворки: POM + data-driven + keyword-driven на одному шарі driver/утиліт",
        "Ізоляція тестів, незалежний setup/teardown для кожного тесту",
        "Вибір, що автоматизувати, а що лишити мануальним (ROI: повторюваність, стабільність, бізнес-цінність)",
      ],
      resources: KB["Test Automation Framework"]!.resources,
    },
    "Cucumber/BDD": {
      cat: KB["Cucumber/BDD"]!.cat,
      learn: [
        "Gherkin (Given/When/Then), Scenario Outline + Examples для data-driven сценаріїв",
        "Step definitions, що мапують Gherkin на код автоматизації",
        "Узгодження сценаріїв з нетехнічними стейкхолдерами до написання автоматизації",
      ],
      resources: KB["Cucumber/BDD"]!.resources,
    },
    "Visual Regression Testing": {
      cat: KB["Visual Regression Testing"]!.cat,
      learn: [
        "Порівняння скріншотів проти узгодженого базового варіанта для виявлення регресій макета/CSS",
        "Обробка навмисних візуальних змін: воркфлоу підтвердження базового варіанта",
        "Доповнює (не замінює) функціональні/DOM-перевірки",
      ],
      resources: KB["Visual Regression Testing"]!.resources,
    },
    "Robot Framework": {
      cat: KB["Robot Framework"]!.cat,
      learn: [
        "Keyword-driven синтаксис, читабельний для людей без програмування",
        "Бібліотеки (SeleniumLibrary, RequestsLibrary) для веб/API автоматизації",
      ],
      resources: KB["Robot Framework"]!.resources,
    },
    "Data-Driven Testing": {
      cat: KB["Data-Driven Testing"]!.cat,
      learn: [
        "Параметризувати один тест багатьма наборами вхідних даних замість дублювання тіл тестів",
        "Джерела даних: inline масиви, fixtures CSV/JSON, таблиці",
      ],
      resources: KB["Data-Driven Testing"]!.resources,
    },
    Postman: {
      cat: KB.Postman!.cat,
      learn: [
        "Колекції, середовища/змінні, pre-request і test скрипти",
        "Ланцюжкування запитів (витягти значення, зберегти, повторно використати через {{var}})",
        "Newman для запуску колекцій headlessly в CI",
      ],
      resources: KB.Postman!.resources,
    },
    Newman: {
      cat: KB.Newman!.cat,
      learn: ["Запуск колекції Postman з командного рядка", "Інтеграція прогонів колекції в CI pipeline"],
      resources: KB.Newman!.resources,
    },
    "Contract Testing": {
      cat: KB["Contract Testing"]!.cat,
      learn: [
        "Контракти на основі консюмера: консюмер визначає очікування, провайдер верифікує незалежно",
        "Виявляє зміни, що ламають інтеграцію, раніше й дешевше за повні e2e інтеграційні тести",
        "Pact — найпоширеніша реалізація",
      ],
      resources: KB["Contract Testing"]!.resources,
    },
    WireMock: {
      cat: KB.WireMock!.cat,
      learn: [
        "Заглушення HTTP-відповідей (включно з конкретними сценаріями помилок) для тестів",
        "Збіг запитів, перевірка, що виклики відбулись як очікувалось",
      ],
      resources: KB.WireMock!.resources,
    },
    SoapUI: {
      cat: KB.SoapUI!.cat,
      learn: ["Тестування SOAP (на основі WSDL) і REST API одним інструментом", "Перевірки, data-driven тестові кроки"],
      resources: KB.SoapUI!.resources,
    },
    "API Testing": {
      cat: KB["API Testing"]!.cat,
      learn: [
        "Перевіряти статус-код + форму/значення тіла, а не лише щось одне",
        "Негативні тести: відсутні/невалідні поля, немає/просрочена автентифікація, значення поза діапазоном",
        "Валідація схеми (JSON Schema/Zod) для виявлення структурного дрейфу",
      ],
      resources: KB["API Testing"]!.resources,
    },
    JMeter: {
      cat: KB.JMeter!.cat,
      learn: [
        "Thread Groups (користувачі, ramp-up), Samplers (запити), Listeners (результати)",
        "Тестові дані на основі CSV, щоб уникнути throttling одного акаунта",
        "Запуск headlessly (non-GUI режим) в CI",
      ],
      resources: KB.JMeter!.resources,
    },
    k6: {
      cat: KB.k6!.cat,
      learn: [
        "Скрипти навантажувальних тестів на JavaScript, CI-нативні за дизайном",
        "Сценарії/executors (constant-arrival-rate, ramping-vus), thresholds як гейти pass/fail",
      ],
      resources: KB.k6!.resources,
    },
    TestRail: {
      cat: KB.TestRail!.cat,
      learn: [
        "Організація тест-кейсів у suites/runs, запис результатів на кожен прогін",
        "Трекінг покриття й pass rate протягом циклу релізу",
      ],
      resources: KB.TestRail!.resources,
    },
    BrowserStack: {
      cat: KB.BrowserStack!.cat,
      learn: [
        "Запуск Selenium/Playwright/Appium тестів проти реальних віддалених браузерів/пристроїв",
        "Матриці cross-browser без фізичної лабораторії пристроїв",
      ],
      resources: KB.BrowserStack!.resources,
    },
    "Sauce Labs": {
      cat: KB["Sauce Labs"]!.cat,
      learn: ["Хмарний grid для cross-browser/cross-device автоматизованого тестування", "Паралельне виконання в масштабі в CI"],
      resources: KB["Sauce Labs"]!.resources,
    },
    "axe-core": {
      cat: KB["axe-core"]!.cat,
      learn: [
        "Автоматизоване виявлення порушень WCAG (лейбли, контраст, ARIA), вбудовується в тести",
        "Виявляє приблизно третину реальних проблем доступності — поєднуйте з ручним тестуванням",
      ],
      resources: KB["axe-core"]!.resources,
    },
    Lighthouse: {
      cat: KB.Lighthouse!.cat,
      learn: [
        "Автоматизовані аудити: продуктивність, доступність, SEO, best practices",
        "Інтеграція в CI для регресійного гейтування оцінок аудиту",
      ],
      resources: KB.Lighthouse!.resources,
    },
    JIRA: {
      cat: KB.JIRA!.cat,
      learn: [
        "Воркфлоу багів/issue: Open → Triaged → In Progress → Resolved → In Testing → Closed/Reopened",
        "Плагіни Zephyr/Xray для управління тест-кейсами й трасуванням всередині JIRA",
      ],
      resources: KB.JIRA!.resources,
    },
    Allure: {
      cat: KB.Allure!.cat,
      learn: [
        "Перетворення сирого виводу test runner'а на оглядовий звіт (кроки, скріншоти, тренди history)",
        "Тегування тестів за фічею/severity для категоризованої звітності про провали",
      ],
      resources: KB.Allure!.resources,
    },
    "Charles Proxy": {
      cat: KB["Charles Proxy"]!.cat,
      learn: [
        "HTTP(S) дебаг-проксі: перегляд реальних запитів на рівні провідних даних (включно з трафіком мобільних застосунків)",
        "Симуляція мережевих умов, повтор/зміна запитів",
      ],
      resources: KB["Charles Proxy"]!.resources,
    },
    "Boundary Value Analysis": {
      cat: KB["Boundary Value Analysis"]!.cat,
      learn: [
        "Тестувати межу валідного діапазону плюс значення безпосередньо з обох її сторін",
        "Поєднується з еквівалентним розбиттям, щоб кількість тестів лишалась малою, але результативною",
      ],
      resources: KB["Boundary Value Analysis"]!.resources,
    },
    "Equivalence Partitioning": {
      cat: KB["Equivalence Partitioning"]!.cat,
      learn: ["Розбити вхідні дані на класи, які система має обробляти однаково, тестувати один представник на клас"],
      resources: KB["Equivalence Partitioning"]!.resources,
    },
    "Decision Table Testing": {
      cat: KB["Decision Table Testing"]!.cat,
      learn: [
        "Систематично перерахувати кожну комбінацію незалежних вхідних умов",
        "Корисно, коли поведінка залежить від кількох взаємодіючих правил",
      ],
      resources: KB["Decision Table Testing"]!.resources,
    },
    "State Transition Testing": {
      cat: KB["State Transition Testing"]!.cat,
      learn: [
        "Моделювати стани/події/переходи, тестувати і валідні, і невалідні переходи",
        "Підтверджує, що система дійсно дотримується власних правил станів",
      ],
      resources: KB["State Transition Testing"]!.resources,
    },
    "Smoke Testing": {
      cat: KB["Smoke Testing"]!.cat,
      learn: [
        "Широка, поверхнева перевірка прийняття збірки перед глибшим тестуванням",
        "Відрізняється від sanity-тестування (вузького, глибокого, після конкретного фіксу)",
      ],
      resources: KB["Smoke Testing"]!.resources,
    },
    "Regression Testing": {
      cat: KB["Regression Testing"]!.cat,
      learn: [
        "Повторний прогін існуючих тестів для підтвердження, що зміна не зламала попередню функціональність",
        "Автоматизувати повторюване ядро, тримати цільову підмножину на кожен PR",
      ],
      resources: KB["Regression Testing"]!.resources,
    },
    "Exploratory Testing": {
      cat: KB["Exploratory Testing"]!.cat,
      learn: [
        "Одночасне навчання, дизайн тестів і виконання за місією, а не за скриптом",
        "Session-based test management: обмежена в часі хартія плюс нотатки для звітності",
      ],
      resources: KB["Exploratory Testing"]!.resources,
    },
    "Accessibility Testing": {
      cat: KB["Accessibility Testing"]!.cat,
      learn: [
        "WCAG (зазвичай рівень AA): контраст, ролі/лейбли ARIA, порядок фокусу, навігація лише клавіатурою",
        "Автоматизовані інструменти (axe-core, Lighthouse) виявляють частину — ручне тестування з екранним читачем все ще потрібне",
      ],
      resources: KB["Accessibility Testing"]!.resources,
    },
    "Test Data Management": {
      cat: KB["Test Data Management"]!.cat,
      learn: [
        "Синтетичні/генеровані дані для обсягу й крайніх випадків, скрипти seed/reset для відомого початкового стану",
        "Ізоляція тестових даних на тест/shard, щоб уникнути колізій при паралельному прогоні",
      ],
      resources: KB["Test Data Management"]!.resources,
    },
  };
}
