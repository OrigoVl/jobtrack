// Ukrainian mirror of ./pm.ts's PM_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildPmKbUk(): Record<string, KbEntry> {
  return {
    PMBOK: {
      cat: KB.PMBOK!.cat,
      learn: [
        "П'ять груп процесів: Ініціація, Планування, Виконання, Моніторинг і контроль, Завершення",
        "Десять областей знань (Інтеграція, Обсяг, Розклад, Вартість, Якість, Ресурси, Комунікації, Ризики, Закупівлі, Стейкхолдери)",
        "Передбачувальні проти адаптивних проти гібридних життєвих циклів; як поточний план іспиту поєднує класичний та agile контент",
      ],
      resources: KB.PMBOK!.resources,
    },
    "Project Charter": {
      cat: KB["Project Charter"]!.cat,
      learn: [
        "Мета, вимірні цілі, високорівневі вимоги, припущення/обмеження, підпис спонсора",
        "Чому це формально авторизує PM застосовувати організаційні ресурси до проєкту",
      ],
      resources: KB["Project Charter"]!.resources,
    },
    "PMP Certification": {
      cat: KB["PMP Certification"]!.cat,
      learn: [
        "PMP проти CAPM: вимоги досвіду, обсяг іспиту, кому яка сертифікація підходить",
        "Зміст іспиту: домени людей, процесу та бізнес-середовища",
      ],
      resources: KB["PMP Certification"]!.resources,
    },
    "Agile vs Waterfall": {
      cat: KB["Agile vs Waterfall"]!.cat,
      learn: [
        "Передбачувальний (waterfall) проти адаптивного (agile) проти гібридного життєвого циклу, і коли класичний PM надає перевагу кожному",
        "Фіксований наперед обсяг/розклад/вартість проти ітеративної, керованої зворотним зв'язком доставки",
      ],
      resources: KB["Agile vs Waterfall"]!.resources,
    },
    "Program Management": {
      cat: KB["Program Management"]!.cat,
      learn: [
        "Координація пов'язаних проєктів для вигід, недоступних при окремому управлінні ними",
        "Управління спільними залежностями/ресурсами й конфліктами між проєктами під однією програмою",
      ],
      resources: KB["Program Management"]!.resources,
    },
    "Portfolio Management": {
      cat: KB["Portfolio Management"]!.cat,
      learn: [
        "Вибір і пріоритизація правильних проєктів/програм за обмеженої спроможності й бюджету",
        "Методи вибору проєкту: NPV, IRR, термін окупності, співвідношення вигід і витрат",
      ],
      resources: KB["Portfolio Management"]!.resources,
    },
    PMO: {
      cat: KB.PMO!.cat,
      learn: [
        "Підтримуючі проти контролюючі проти директивні PMO, і скільки контролю/стандартизації кожен накладає",
        "Стандартизовані шаблони, артефакти управління та згортання статусу по всьому портфелю",
      ],
      resources: KB.PMO!.resources,
    },
    "Stakeholder Management": {
      cat: KB["Stakeholder Management"]!.cat,
      learn: [
        "Ідентифікація стейкхолдерів, їхнього інтересу/впливу та адаптація залучення (інформувати/консультувати/затверджувати)",
        "Матриця комунікацій: що кожному стейкхолдеру потрібно, як часто, і через який канал",
      ],
      resources: KB["Stakeholder Management"]!.resources,
    },
    "Work Breakdown Structure (WBS)": {
      cat: KB["Work Breakdown Structure (WBS)"]!.cat,
      learn: [
        "Ієрархічна декомпозиція повного обсягу в пакети робіт; правило 100%",
        "Словник WBS: критерії прийняття, ресурси й оцінки вартості для кожного пакета робіт",
      ],
      resources: KB["Work Breakdown Structure (WBS)"]!.resources,
    },
    "Critical Path Method": {
      cat: KB["Critical Path Method"]!.cat,
      learn: [
        "Прямий/зворотний прохід для обчислення ES/EF/LS/LF та повного резерву кожної активності",
        "Швидкий трекінг проти форсування для стиснення розкладу, і чому обидва допомагають лише НА критичному шляху",
      ],
      resources: KB["Critical Path Method"]!.resources,
    },
    "Critical Chain Method": {
      cat: KB["Critical Chain Method"]!.cat,
      learn: [
        "Планування з обмеженням ресурсів на додаток до логічних залежностей, на відміну від простого CPM",
        "Буфери проєкту/живлячі буфери, що об'єднують резерв замість доповнення кожної оцінки завдання",
      ],
      resources: KB["Critical Chain Method"]!.resources,
    },
    "Gantt Chart": {
      cat: KB["Gantt Chart"]!.cat,
      learn: [
        "Стовпці на таймлайні, що показують початок/кінець/тривалість/перекриття; лінії залежностей між завданнями",
        "Коли діаграма етапів чи мережева діаграма комунікує краще, ніж повний Гант",
      ],
      resources: KB["Gantt Chart"]!.resources,
    },
    "Resource Leveling": {
      cat: KB["Resource Leveling"]!.cat,
      learn: [
        "Вирішення перевантаження ресурсів, потенційно затримуючи кінцеву дату проєкту",
        "Згладжування ресурсів як «безкоштовна» перша спроба — лише в межах існуючого резерву",
      ],
      resources: KB["Resource Leveling"]!.resources,
    },
    "Cost Estimating Techniques": {
      cat: KB["Cost Estimating Techniques"]!.cat,
      learn: [
        "Аналогове, параметричне, «знизу вгору» та триточкове (PERT) оцінювання, і коли кожне підходить",
        "Формула PERT (О + 4Н + П) / 6 та стандартне відхилення, яке вона передбачає",
      ],
      resources: KB["Cost Estimating Techniques"]!.resources,
    },
    "RACI Matrix": {
      cat: KB["RACI Matrix"]!.cat,
      learn: [
        "Responsible/Accountable/Consulted/Informed — рівно один відповідальний (Accountable) власник на завдання",
        "Використання для справді неоднозначної міжфункціональної роботи, не кожного тривіального завдання",
      ],
      resources: KB["RACI Matrix"]!.resources,
    },
    "Change Control": {
      cat: KB["Change Control"]!.cat,
      learn: [
        "Формальний процес ідентифікації, оцінювання та затвердження/відхилення змін до базового плану",
        "Чому навіть «маленька» зміна має проходити через нього, і як CCB приймає рішення",
      ],
      resources: KB["Change Control"]!.resources,
    },
    "Earned Value Management": {
      cat: KB["Earned Value Management"]!.cat,
      learn: [
        "PV/EV/AC, і виведення з них CPI/SPI, CV/SV, EAC/ETC/VAC та TCPI",
        "Чому CPI вважається сильним предиктором фінального виконання вартості навіть посередині проєкту",
      ],
      resources: KB["Earned Value Management"]!.resources,
    },
    "Procurement Management": {
      cat: KB["Procurement Management"]!.cat,
      learn: [
        "Типи контрактів — фіксована ціна, відшкодування витрат, час і матеріали — і як розподіл ризику відрізняється",
        "Деталь технічного завдання (SOW), потрібна для порівнюваних пропозицій постачальників і чіткого прийняття",
      ],
      resources: KB["Procurement Management"]!.resources,
    },
    "Quality Management": {
      cat: KB["Quality Management"]!.cat,
      learn: [
        "Забезпечення якості (орієнтоване на процес) проти контролю якості (орієнтований на продукт)",
        "Вартість якості: витрати запобігання/оцінки проти внутрішньої/зовнішньої вартості невдачі",
      ],
      resources: KB["Quality Management"]!.resources,
    },
    "Milestone Tracking": {
      cat: KB["Milestone Tracking"]!.cat,
      learn: [
        "Події з нульовою тривалістю на розкладі, що позначають значні точки прогресу",
        "Відстеження, зважене за етапами, проти відсотка завершення проти фіксованої формули (50/50)",
      ],
      resources: KB["Milestone Tracking"]!.resources,
    },
    "RAID Log": {
      cat: KB["RAID Log"]!.cat,
      learn: [
        "Ризики, Припущення, Проблеми, Залежності, відстежувані разом в одному консолідованому журналі",
        "Чому чотири категорії взаємодіють (неперевірене припущення, що стає проблемою, тощо)",
      ],
      resources: KB["RAID Log"]!.resources,
    },
    "Risk Register": {
      cat: KB["Risk Register"]!.cat,
      learn: [
        "Поля, потрібні кожному запису: опис, ймовірність/вплив, власник, відповідь, тригер, статус",
        "Матриця ймовірність-вплив для якісного аналізу проти EMV/Монте-Карло для кількісного",
      ],
      resources: KB["Risk Register"]!.resources,
    },
    "Risk Response Strategies": {
      cat: KB["Risk Response Strategies"]!.cat,
      learn: [
        "Загрози: уникнення, пом'якшення, передача, прийняття. Можливості: використання, посилення, поділ, прийняття",
        "Вторинний ризик (створений відповіддю) проти залишкового ризику (що залишається після неї)",
      ],
      resources: KB["Risk Response Strategies"]!.resources,
    },
    "Contingency Reserve": {
      cat: KB["Contingency Reserve"]!.cat,
      learn: [
        "Резерв на непередбачені обставини (відомі ризики, контролюється PM) проти управлінського резерву (невідомі невідомості, затверджується спонсором)",
        "Виведення обґрунтованого числа резерву з суми окремих EMV ризиків",
      ],
      resources: KB["Contingency Reserve"]!.resources,
    },
    "MS Project": {
      cat: KB["MS Project"]!.cat,
      learn: [
        "Детальні діаграми Ганта, мережеві діаграми, вирівнювання ресурсів та відстеження базової лінії класу CPM/EVM",
        "Найкраще підходить для більших проєктів зі справді складними, взаємозалежними розкладами",
      ],
      resources: KB["MS Project"]!.resources,
    },
    Smartsheet: {
      cat: KB.Smartsheet!.cat,
      learn: [
        "Схожий на таблицю колаборативний менеджмент роботи з виглядами Ганта, автоматизацією й дашбордами",
        "Ширша міжфункціональна зручність за рахунок меншої глибини строгості мережі розкладу, ніж MS Project",
      ],
      resources: KB.Smartsheet!.resources,
    },
    "Monday.com": {
      cat: KB["Monday.com"]!.cat,
      learn: [
        "Конфігуровані дошки (Kanban/Гант/календар), популярні за легкість засвоєння й гнучкість",
        "Легший за MS Project/Primavera для глибокого аналізу критичного шляху/вирівнювання ресурсів",
      ],
      resources: KB["Monday.com"]!.resources,
    },
    "Primavera P6": {
      cat: KB["Primavera P6"]!.cat,
      learn: [
        "Планування корпоративного рівня для дуже великої кількості активностей і мультипроєктного/портфельного ресурсування",
        "Стандарт у будівництві/інжинірингу/державних інфраструктурних програмах зі строгою контрактною строгістю розкладу",
      ],
      resources: KB["Primavera P6"]!.resources,
    },
    Asana: {
      cat: KB.Asana!.cat,
      learn: [
        "Управління завданнями/робочими процесами з наголосом на командну співпрацю й легкі таймлайни",
        "Підходить для відстеження виконання чи менших проєктів, не глибокої строгості класу CPM/EVM",
      ],
      resources: KB.Asana!.resources,
    },
  };
}
