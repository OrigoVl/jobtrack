// Ukrainian mirror of ./design.ts's DESIGN_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildDesignKbUk(): Record<string, KbEntry> {
  return {
    Figma: {
      cat: KB.Figma!.cat,
      learn: [
        "Спільне редагування в реальному часі, коментарі й посилання на прототип замінюють ручну передачу файлів",
        "Компоненти/variants + Auto Layout для консистентних, змінних за розміром UI-частин",
        "Dev Mode генерує вимірювання/токени/фрагменти коду прямо для handoff",
      ],
      resources: KB.Figma!.resources,
    },
    Sketch: {
      cat: KB.Sketch!.cat,
      learn: [
        "Векторний UI-дизайн інструмент лише для macOS, побудований навколо великої екосистеми плагінів",
        "Передував домінуванню Figma — досі використовується командами, залученими в його плагіни чи локальні файлові процеси",
      ],
      resources: KB.Sketch!.resources,
    },
    "Adobe XD": {
      cat: KB["Adobe XD"]!.cat,
      learn: [
        "Інструмент UI/UX-дизайну й прототипування від Adobe, інтегрований з Creative Cloud (активи Illustrator/Photoshop)",
        "Adobe припинила активний розвиток нових функцій XD — Figma тепер за замовчуванням для нових команд",
      ],
      resources: KB["Adobe XD"]!.resources,
    },
    FigJam: {
      cat: KB.FigJam!.cat,
      learn: [
        "Цифрова дошка для брейнштормінгу, афінних карт і карт подорожі — не піксельно-точний UI",
        "Тісно інтегрована з Figma, але свідомо окремий, вільніший простір для співпраці",
      ],
      resources: KB.FigJam!.resources,
    },
    Miro: {
      cat: KB.Miro!.cat,
      learn: [
        "Універсальна онлайн-дошка для воркшопів, ретро і синтезу дослідження з розподіленими командами",
        "Перетинається з FigJam — команди зазвичай стандартизуються на одному, а не використовують обидва",
      ],
      resources: KB.Miro!.resources,
    },
    Zeplin: {
      cat: KB.Zeplin!.cat,
      learn: [
        "Спеціалізований інструмент передачі дизайну розробнику: специфікації, style guides й експортовані активи з імпортованих дизайнів",
        "Нативний Dev Mode Figma тепер покриває багато з цього для команд лише на Figma — Zeplin лишається релевантним для кількох дизайн-інструментів",
      ],
      resources: KB.Zeplin!.resources,
    },
    Maze: {
      cat: KB.Maze!.cat,
      learn: [
        "Немодероване тестування інтерактивних прототипів Figma в масштабі — heatmaps, шляхи кліків, успіх/час завдання",
        "Немає живого модератора, тож не може досліджувати неочікувану поведінку так, як модерована сесія",
      ],
      resources: KB.Maze!.resources,
    },
    UserTesting: {
      cat: KB.UserTesting!.cat,
      learn: [
        "Рекрутує з великої панелі реальних користувачів; записує відео/аудіо їх, що думають вголос, виконуючи завдання",
        "Швидший і ширший доступ, ніж планування власних модерованих сесій, за ціну відсутності уточнюючих питань у реальному часі",
      ],
      resources: KB.UserTesting!.resources,
    },
    "Design Systems": {
      cat: KB["Design Systems"]!.cat,
      learn: [
        "Бібліотека компонентів + design tokens + гайдлайни використання + керування, а не просто «файл Figma з повторними частинами»",
        "Бібліотека — артефакт, який продукує система — консистентність приходить з принципів і процесу за нею",
      ],
      resources: KB["Design Systems"]!.resources,
    },
    Wireframing: {
      cat: KB.Wireframing!.cat,
      learn: [
        "Низько-фідельний, здебільшого сірошкальний структурний план — макет/ієрархія, свідомо позбавлений візуальної стилізації",
        "Дозволяє оцінити рішення структури/флоу без зміщення фідбеку кольором/типографікою",
      ],
      resources: KB.Wireframing!.resources,
    },
    "Usability Testing": {
      cat: KB["Usability Testing"]!.cat,
      learn: [
        "Модероване (присутній дослідник, може досліджувати) проти немодерованого (швидше, масштабується, без уточнень у реальному часі)",
        "~5 учасників на сегмент виявляють більшість поширених проблем — фікс і перетест кращі за один великий раунд",
      ],
      resources: KB["Usability Testing"]!.resources,
    },
    "User Research": {
      cat: KB["User Research"]!.cat,
      learn: [
        "Кількісне (скільки/наскільки) знаходить, куди дивитись; якісне (чому) пояснює, що фактично відбувається",
        "Підбирайте метод під тип питання — опитування, інтерв'ю, юзабіліті-тести, карткове сортування, дослідження-дневники",
      ],
      resources: KB["User Research"]!.resources,
    },
    "Information Architecture": {
      cat: KB["Information Architecture"]!.cat,
      learn: [
        "Як контент/навігація структуровані й підписані на основі фактичних мисленнєвих моделей користувачів, а не org-схеми",
        "Карткове сортування (генеративне), потім tree testing (оцінювальне) — стандартна послідовність перевірки",
      ],
      resources: KB["Information Architecture"]!.resources,
    },
    "Accessibility (a11y)": {
      cat: KB["Accessibility (a11y)"]!.cat,
      learn: [
        "Ніколи не покладайтесь лише на колір; перевіряйте контраст, порядок фокусу і навігацію лише клавіатурою",
        "Ролі/лейбли ARIA для будь-якого кастомного (не нативного) інтерактивного компонента",
      ],
      resources: KB["Accessibility (a11y)"]!.resources,
    },
    WCAG: {
      cat: KB.WCAG!.cat,
      learn: [
        "4.5:1 контраст для звичайного тексту на AA (3:1 для великого тексту); AAA суворіший (7:1) і рідко загальна ціль",
        "AA — практичний базовий рівень, на який посилається більшість юридичних вимог доступності",
      ],
      resources: KB.WCAG!.resources,
    },
    Persona: {
      cat: KB.Persona!.cat,
      learn: [
        "Корисні персони побудовані з реальних паттернів дослідження, а не демографічного наповнення, до якого ніхто не звертається",
        "Команди звертаються до хорошої персони, приймаючи компроміси, а не лише як до плакату на стіні",
      ],
      resources: KB.Persona!.resources,
    },
    "User Journey Mapping": {
      cat: KB["User Journey Mapping"]!.cat,
      learn: [
        "Етапи, дії, думки/емоції, болі й можливості через весь наскрізний досвід",
        "Виявляє тертя, яке представлення однієї фічі пропускає, наприклад взаємодію з підтримкою, яку сам редизайн UI не виправить",
      ],
      resources: KB["User Journey Mapping"]!.resources,
    },
    "Heuristic Evaluation": {
      cat: KB["Heuristic Evaluation"]!.cat,
      learn: [
        "3-5 оцінювачів незалежно переглядають UI проти 10 евристик юзабіліті Нільсена, потім об'єднують знахідки",
        "Пріоритезуйте фікси за серйозністю x частотою x впливом, а не як єдиний прохід по чекліста",
      ],
      resources: KB["Heuristic Evaluation"]!.resources,
    },
    Prototyping: {
      cat: KB.Prototyping!.cat,
      learn: [
        "Підбирайте фідельність під те, що намагаєтесь дізнатись — low-fi для структури/флоу, hi-fi для візуалів/тексту/мікровзаємодій",
        "Інтерактивні прототипи виявляють проблеми юзабіліті на рівні флоу, яких статичний mockup не може",
      ],
      resources: KB.Prototyping!.resources,
    },
    "Interaction Design": {
      cat: KB["Interaction Design"]!.cat,
      learn: [
        "Паттерни взаємодії, фідбек і поведінка — не лише візуальний шар",
        "Обґрунтовано прогностичними моделями (закон Фіттса, закон Хіка) і встановленими конвенціями (закон Якоба)",
      ],
      resources: KB["Interaction Design"]!.resources,
    },
    Typography: {
      cat: KB.Typography!.cat,
      learn: [
        "Обмежена, свідома типографічна шкала (H1-H3/body/caption), застосована консистентно до тієї ж семантичної ролі",
        "Line-height приблизно 1.4-1.6x розміру шрифту для читабельного основного тексту",
      ],
      resources: KB.Typography!.resources,
    },
    "Color Theory": {
      cat: KB["Color Theory"]!.cat,
      learn: [
        "Комплементарні (протилежні на колі) для контрасту/акцентів; аналогічні (сусідні) для цілісних, низько-контрастних палітр",
        "Ніколи не покладайтесь лише на відтінок для значення — поєднуйте з іконкою/лейблом/паттерном для доступності",
      ],
      resources: KB["Color Theory"]!.resources,
    },
    "Material Design": {
      cat: KB["Material Design"]!.cat,
      learn: [
        "Дизайн-система Google: компоненти, токени й гайдлайни для Android і веб",
        "Широко використовується як референсна база навіть поза продуктами, специфічними для Android",
      ],
      resources: KB["Material Design"]!.resources,
    },
    "Human Interface Guidelines": {
      cat: KB["Human Interface Guidelines"]!.cat,
      learn: [
        "Платформні конвенції Apple (iOS/iPadOS/macOS) для навігації, тап-зон і поведінки нативних компонентів",
        "Джерело широко цитованої вимоги мінімального розміру тап-зони 44x44pt у мобільному дизайні",
      ],
      resources: KB["Human Interface Guidelines"]!.resources,
    },
    "Card Sorting": {
      cat: KB["Card Sorting"]!.cat,
      learn: [
        "Відкрите (учасники створюють власні групи) проти закритого (сортують у попередньо визначені категорії) — генеративне проти оцінювального",
        "Використовується для проєктування/перевірки інформаційної архітектури на основі фактичних мисленнєвих моделей користувачів",
      ],
      resources: KB["Card Sorting"]!.resources,
    },
    "Design Tokens": {
      cat: KB["Design Tokens"]!.cat,
      learn: [
        "Названі, платформо-незалежні змінні (color.primary.500) як єдине джерело правди для дизайну й коду",
        "Дозволяє ребрендинг/темізацію і системні фікси контрасту по всьому великому продукту без ручного пошуку й заміни",
      ],
      resources: KB["Design Tokens"]!.resources,
    },
    "Atomic Design": {
      cat: KB["Atomic Design"]!.cat,
      learn: [
        "Атоми -> молекули -> організми -> шаблони -> сторінки — спільний словник для складності компонентів",
        "Уточнює, де фактично живе дублікація (зазвичай рівень атома) при консолідації неконсистентних компонентів",
      ],
      resources: KB["Atomic Design"]!.resources,
    },
    "Design Critique": {
      cat: KB["Design Critique"]!.cat,
      learn: [
        "Формулюється навколо мети/проблеми користувача, а не особистого смаку — «I like / I wish / What if» тримає фідбек дієвим",
        "Відрізняється від design review (гейт для затвердження) — критика генерує опції, поки робота в процесі",
      ],
      resources: KB["Design Critique"]!.resources,
    },
    "Dark Patterns": {
      cat: KB["Dark Patterns"]!.cat,
      learn: [
        "UI/UX паттерни, що маніпулюють користувачами до рішень, вигідних бізнесу за їхній рахунок",
        "Confirmshaming, roach motel і sneak-into-basket — поширені названі паттерни, що дедалі більше привертають регуляторну увагу",
      ],
      resources: KB["Dark Patterns"]!.resources,
    },
    "Empathy Map": {
      cat: KB["Empathy Map"]!.cat,
      learn: [
        "Швидкий синтез того, що користувач каже/думає/робить/відчуває в конкретному контексті, побудований з сирих нотаток дослідження",
        "Робочий артефакт для спільного розуміння команди — персони — відшліфованіша, придатна для повторного використання дистиляція",
      ],
      resources: KB["Empathy Map"]!.resources,
    },
    Microinteractions: {
      cat: KB.Microinteractions!.cat,
      learn: [
        "Чотири частини: тригер, правила, фідбек і циклі/режими (фреймворк Дена Саффера)",
        "Свідоме проєктування всіх чотирьох, а не лише візуального фідбеку, відрізняє хорошу мікровзаємодію від просто декору",
      ],
      resources: KB.Microinteractions!.resources,
    },
    "Design Handoff": {
      cat: KB["Design Handoff"]!.cat,
      learn: [
        "Прототип (поведінка/флоу) + специфікація (точні значення/стани) — handoff зазвичай потребує обох, а не одного чи іншого",
        "Design tokens кращі за статичний експорт зображень: оновлення поширюється на кожну реалізацію, що на нього посилається",
      ],
      resources: KB["Design Handoff"]!.resources,
    },
  };
}
