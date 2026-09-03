// Ukrainian mirror of ./product.ts's PRODUCT_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildProductKbUk(): Record<string, KbEntry> {
  return {
    "Product Ops": {
      cat: KB["Product Ops"]!.cat,
      learn: [
        "Володіє стандартизацією тулінгу/процесів і синтезом фідбеку між PM-командами, звільняючи PM для стратегічної роботи",
        "Типові результати: єдина таксономія фідбеку, підтримка roadmap-тулінгу, регулярні метрики/звітність",
      ],
      resources: KB["Product Ops"]!.resources,
    },
    "TAM/SAM/SOM": {
      cat: KB["TAM/SAM/SOM"]!.cat,
      learn: [
        "TAM (весь ринок) → SAM (реалістично обслуговуваний) → SOM (реалістично досяжний, з огляду на конкуренцію/GTM-спроможність)",
        "Використовуйте це, щоб перевірити, чи інциатива взагалі варта розробки, а не лише чи вона технічно чудова",
      ],
      resources: KB["TAM/SAM/SOM"]!.resources,
    },
    "Business Model Canvas": {
      cat: KB["Business Model Canvas"]!.cat,
      learn: [
        "9 блоків: сегменти, ціннісні пропозиції, канали, стосунки, виручка, ресурси, активності, партнерства, витрати",
        "Перевіряє, що продукт вирішує реальну проблему І вписується в життєздатний бізнес, а не просто хороша ідея",
      ],
      resources: KB["Business Model Canvas"]!.resources,
    },
    "Value Proposition Canvas": {
      cat: KB["Value Proposition Canvas"]!.cat,
      learn: [
        "Мапить jobs/pains/gains клієнта проти pain relievers/gain creators продукту",
        "Використовується рано в дискавері, щоб перевірити відповідність перед інвестуванням у розробку",
      ],
      resources: KB["Value Proposition Canvas"]!.resources,
    },
    "Product-Market Fit": {
      cat: KB["Product-Market Fit"]!.cat,
      learn: [
        "Сигнали: сильне органічне зростання, висока ретеншн, скорочення циклів продажу, вхідний попит перевищує витрати",
        "Не бінарний чи постійний стан — може ерозувати зі зміною ринку чи конкурентного ландшафту",
      ],
      resources: KB["Product-Market Fit"]!.resources,
    },
    "Product-Led Growth": {
      cat: KB["Product-Led Growth"]!.cat,
      learn: [
        "Сам продукт рухає залучення/конверсію/розширення — безкоштовні тріали, in-product upsell, віральність",
        "Часто поєднується з sales-led мотивом для більших/ентерпрайз-акаунтів ('product-led sales')",
      ],
      resources: KB["Product-Led Growth"]!.resources,
    },
    "Go-to-Market Strategy": {
      cat: KB["Go-to-Market Strategy"]!.cat,
      learn: [
        "Покриває позиціонування, цільовий сегмент, канал, ціноутворення і план запуску/sales enablement для релізу",
        "Роботу PM з роадмапом і GTM-план PMM варто будувати спільно, а не передавати в останній момент",
      ],
      resources: KB["Go-to-Market Strategy"]!.resources,
    },
    "Jobs-to-be-Done": {
      cat: KB["Jobs-to-be-Done"]!.cat,
      learn: [
        "Формулює дослідження навколо 'progress', якого клієнт намагається досягти, а не продукту чи демографії",
        "Розкриває конкурентів, яких інакше не розглянули б — будь-хто, хто конкурує за ту саму підлеглу 'роботу'",
      ],
      resources: KB["Jobs-to-be-Done"]!.resources,
    },
    "Customer Interviews": {
      cat: KB["Customer Interviews"]!.cat,
      learn: [
        "Запитуйте про конкретну минулу поведінку/факти, не гіпотетичні думки чи прогнози (див. The Mom Test)",
        "Щотижневі дотики (безперервне дискавері) кращі за нерегулярні великі дослідницькі 'спринти'",
      ],
      resources: KB["Customer Interviews"]!.resources,
    },
    "Competitive Analysis": {
      cat: KB["Competitive Analysis"]!.cat,
      learn: [
        "Positioning maps і win/loss-інтерв'ю розкривають більше, ніж чек-лист-матриця фіч",
        "Використовуйте JTBD-лінзу — конкуренти за ту саму підлеглу роботу, а не лише буквальні феча-в-фічу суперники",
      ],
      resources: KB["Competitive Analysis"]!.resources,
    },
    "Product Vision & Strategy": {
      cat: KB["Product Vision & Strategy"]!.cat,
      learn: [
        "Vision: довгострокова амбітна картина. Strategy: конкретний план (сегменти/ставки) на коротшому горизонті",
        "Документ бачення має бути достатньо конкретним, щоб щось виключати, і достатньо абстрактним, щоб переживати багато циклів роадмапу",
      ],
      resources: KB["Product Vision & Strategy"]!.resources,
    },
    "Design Thinking": {
      cat: KB["Design Thinking"]!.cat,
      learn: [
        "Empathize → Define → Ideate → Prototype → Test, з PM, що типово веде перші/останні стадії",
        "Пропуск стадії (наприклад, Empathize прямо в Prototype) ризикує вирішити погано визначену проблему",
      ],
      resources: KB["Design Thinking"]!.resources,
    },
    MVP: {
      cat: KB.MVP!.cat,
      learn: [
        "Найменша річ, що тестує найризиковіше припущення чи доставляє основну цінність вузькому сегменту",
        "'Скоротити скоуп, поки не влізе в дедлайн' — не MVP, якщо те, що залишилось, більше нічого не тестує значуще",
      ],
      resources: KB.MVP!.resources,
    },
    "Opportunity Solution Tree": {
      cat: KB["Opportunity Solution Tree"]!.cat,
      learn: [
        "Outcome → можливості (потреби/болі) → кандидатські рішення → експерименти, все явно зв'язане",
        "Запобігає стрибку від метрики прямо до улюбленого рішення без мапування проміжного простору",
      ],
      resources: KB["Opportunity Solution Tree"]!.resources,
    },
    "Voice of Customer": {
      cat: KB["Voice of Customer"]!.cat,
      learn: [
        "Систематичне захоплення/тегування/синтез фідбеку з каналів у теми, за якими команда може діяти",
        "Потребує консистентної таксономії плюс видимий зворотний контур до того, хто підняв фідбек",
      ],
      resources: KB["Voice of Customer"]!.resources,
    },
    "RICE Prioritization": {
      cat: KB["RICE Prioritization"]!.cat,
      learn: [
        "Score = (Reach x Impact x Confidence) / Effort — найкраще для порівняння багатьох різнорідних ідей",
        "Настільки хороший, наскільки чесні 4 оцінки, що його живлять — Confidence має реально дисконтувати вгадування",
      ],
      resources: KB["RICE Prioritization"]!.resources,
    },
    "MoSCoW Prioritization": {
      cat: KB["MoSCoW Prioritization"]!.cat,
      learn: [
        "Must / Should / Could / Won't have — швидка, спільна мова для скоупінгу одного релізу під тиском часу",
        "Ламається, коли 'Must Have' втрачає дефіцитність — обмежте кількість чи запитайте 'реліз провалиться без цього?'",
      ],
      resources: KB["MoSCoW Prioritization"]!.resources,
    },
    "Kano Model": {
      cat: KB["Kano Model"]!.cat,
      learn: [
        "Basic/must-be, Performance і Delighter фічі мають різні криві задоволеності",
        "Попереджає проти надмірних інвестицій у базові фічі поза 'достатньо добре', голодуючи delighters, і навпаки",
      ],
      resources: KB["Kano Model"]!.resources,
    },
    "Product Roadmapping": {
      cat: KB["Product Roadmapping"]!.cat,
      learn: [
        "Формати Now/Next/Later чи тематичні чесно комунікують впевненість проти жорстко датованого роадмапу",
        "Налаштовуйте формулювання (не сам план) для аудиторій керівників проти продажів проти розробки",
      ],
      resources: KB["Product Roadmapping"]!.resources,
    },
    "User Story Mapping": {
      cat: KB["User Story Mapping"]!.cat,
      learn: [
        "Розташовуйте історії вздовж реального workflow користувача (backbone), щоб візуально виявити зрізи MVP і прогалини",
        "Вертикальне розбиття (тонка, end-to-end цінність) краще за розбиття за технічним шаром для інкрементальної доставки",
      ],
      resources: KB["User Story Mapping"]!.resources,
    },
    "Backlog Refinement": {
      cat: KB["Backlog Refinement"]!.cat,
      learn: [
        "Регулярна сесія для уточнення вимог, розбиття великих історій, оцінки й перевпорядкування перед плануванням",
        "Історія має відповідати Definition of Ready тут — а не виявлятись надто великою на плануванні спринту",
      ],
      resources: KB["Backlog Refinement"]!.resources,
    },
    OKRs: {
      cat: KB.OKRs!.cat,
      learn: [
        "Objectives (якісні, амбітні) + Key Results (вимірювані outcome, не завдання), 2-4 на ціль",
        "Прив'язка досягнення прямо до performance-ревʼю штовхає команди занижувати безпечні цілі — розв'яжіть це",
      ],
      resources: KB.OKRs!.resources,
    },
    "North Star Metric": {
      cat: KB["North Star Metric"]!.cat,
      learn: [
        "Одна метрика, що найкраще захоплює доставлену цінність і корелює з довгостроковим бізнес-успіхом",
        "Має бути leading, впливовим для команди індикатором — не lagging outcome, як сира виручка",
      ],
      resources: KB["North Star Metric"]!.resources,
    },
    "Cohort Analysis": {
      cat: KB["Cohort Analysis"]!.cat,
      learn: [
        "Групуйте користувачів за спільною датою старту, трекайте ретеншн/виручку по cohort окремо з часом",
        "Розкриває напрямок тренду, який агрегована метрика може маскувати (плоска MAU, що приховує гіршання ретеншну per-cohort)",
      ],
      resources: KB["Cohort Analysis"]!.resources,
    },
    "Funnel Analysis": {
      cat: KB["Funnel Analysis"]!.cat,
      learn: [
        "Вимірюйте конверсію між кожними послідовними кроками до цілі, щоб знайти найкрутіше відносне падіння",
        "Поєднуйте кількісне ДЕ з якісним дослідженням (інтерв'ю, записи сесій) для ЧОМУ",
      ],
      resources: KB["Funnel Analysis"]!.resources,
    },
    "AARRR / Pirate Metrics": {
      cat: KB["AARRR / Pirate Metrics"]!.cat,
      learn: [
        "Acquisition, Activation, Retention, Referral, Revenue — локалізує, в якій стадії фаннела живе проблема",
        "Організовує growth-експерименти за стадією фаннела, а не випадковим тестуванням змін",
      ],
      resources: KB["AARRR / Pirate Metrics"]!.resources,
    },
    "Churn Analysis": {
      cat: KB["Churn Analysis"]!.cat,
      learn: [
        "Logo churn (кількість клієнтів) проти revenue churn (долари) можуть сильно розходитись — трекайте обидва",
        "Сегментуйте відтеклих клієнтів за планом/cohort/онбордингом, щоб знайти реальні паттерни, не лише topline rate",
      ],
      resources: KB["Churn Analysis"]!.resources,
    },
    Confluence: {
      cat: KB.Confluence!.cat,
      learn: [
        "Центральний, з посиланнями дім для PRD, документів бачення/стратегії і логів рішень — не розкидані Docs/Slack",
        "Цінність з консистентного шаблону на тип документа плюс доступна для пошуку, зрозуміла структура простору",
      ],
      resources: KB.Confluence!.resources,
    },
    Amplitude: {
      cat: KB.Amplitude!.cat,
      learn: [
        "Продуктова аналітика на рівні користувача, керована подіями — cohorts, ретеншн, фаннели, поведінкова сегментація",
        "Найкраще для 'що ця група користувачів робила в продукті з часом', не для питань джерела трафіку",
      ],
      resources: KB.Amplitude!.resources,
    },
    Mixpanel: {
      cat: KB.Mixpanel!.cat,
      learn: [
        "Продуктова аналітика на основі подій зі суттєвим перекриттям з Amplitude (фаннели, ретеншн, cohorts)",
        "Якість аналізу обмежена планом трекінгу, що його живить, а не тим, який інструмент вибрано",
      ],
      resources: KB.Mixpanel!.resources,
    },
    Productboard: {
      cat: KB.Productboard!.cat,
      learn: [
        "Агрегує/тегує клієнтський фідбек проти структурованого бэклога insights і фіч",
        "Генерує роадмап-перегляди для стейкхолдерів, розв'язані від деталей виконання в JIRA",
      ],
      resources: KB.Productboard!.resources,
    },
    Pendo: {
      cat: KB.Pendo!.cat,
      learn: [
        "Платформа прийняття в застосунку: аналітика використання фіч плюс in-app гайди/тултіпи/NPS без релізу розробки",
        "Дозволяє PM ітерувати над підказками онбордингу/прийняття незалежно від циклу релізу розробки",
      ],
      resources: KB.Pendo!.resources,
    },
    "Aha!": {
      cat: KB["Aha!"]!.cat,
      learn: [
        "Структурована ієрархія: стратегічні цілі → інциативи → фічі → зв'язані тікети JIRA/Azure DevOps",
        "Генерує roadmap-перегляди для конкретних аудиторій (публічний проти внутрішнього) з тих самих підлеглих даних",
      ],
      resources: KB["Aha!"]!.resources,
    },
  };
}
