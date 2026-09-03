// Ukrainian mirror of ./data.ts's DATA_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildDataKbUk(): Record<string, KbEntry> {
  return {
    pandas: {
      cat: KB.pandas!.cat,
      learn: [
        "Основи DataFrame/Series, індексація, фільтрація",
        "groupby (split-apply-combine), merge/join",
        "Переформатування: pivot_table, melt",
        "Обробка пропущених даних, dtypes",
      ],
      resources: KB.pandas!.resources,
    },
    NumPy: {
      cat: KB.NumPy!.cat,
      learn: [
        "ndarray, векторизовані операції, broadcasting",
        "Індексація/зрізи, агрегатні функції",
        "Чому він швидший за звичайні списки Python",
      ],
      resources: KB.NumPy!.resources,
    },
    "scikit-learn": {
      cat: KB["scikit-learn"]!.cat,
      learn: [
        "Estimator API: fit/predict/transform",
        "train_test_split, cross_val_score, Pipeline",
        "Моделі регресії/класифікації/кластеризації",
        "Препроцесинг (StandardScaler, encoders)",
      ],
      resources: KB["scikit-learn"]!.resources,
    },
    dbt: {
      cat: KB.dbt!.cat,
      learn: ["Моделі як SELECT-запити, ref()/source()", "Тести, документація, граф lineage", "ELT: трансформація всередині сховища"],
      resources: KB.dbt!.resources,
    },
    Airflow: {
      cat: KB.Airflow!.cat,
      learn: ["DAG, завдання, оператори, залежності", "Планування, повтори, backfill", "Моніторинг/сповіщення про збої конвеєра"],
      resources: KB.Airflow!.resources,
    },
    "Power BI": {
      cat: KB["Power BI"]!.cat,
      learn: ["Моделювання даних, зв'язки, DAX-міри", "Звіти/дашборди, безпека на рівні рядків", "Power Query для трансформації"],
      resources: KB["Power BI"]!.resources,
    },
    Tableau: {
      cat: KB.Tableau!.cat,
      learn: ["Dimensions vs measures, обчислювані поля", "Дашборди, фільтри, дії (actions)", "Вибір правильного типу графіка"],
      resources: KB.Tableau!.resources,
    },
    Looker: {
      cat: KB.Looker!.cat,
      learn: [
        "Семантичний шар LookML, explores/views",
        "Керовані метрики, спільні для всіх дашбордів",
        "Self-service дослідження для стейкхолдерів",
      ],
      resources: KB.Looker!.resources,
    },
    BigQuery: {
      cat: KB.BigQuery!.cat,
      learn: [
        "Безсерверне SQL-сховище, partitioning/clustering",
        "Контроль вартості (query bytes scanned)",
        "Standard SQL, заплановані запити",
      ],
      resources: KB.BigQuery!.resources,
    },
    Snowflake: {
      cat: KB.Snowflake!.cat,
      learn: ["Віртуальні сховища (розділення compute/storage)", "Мікро-партиції, time travel", "Напівструктуровані дані (VARIANT/JSON)"],
      resources: KB.Snowflake!.resources,
    },
    Redshift: {
      cat: KB.Redshift!.cat,
      learn: [
        "Колонкове зберігання, ключі розподілу/сортування",
        "COPY для масового завантаження, WLM/query queues",
        "Redshift Spectrum для запитів до даних у S3",
      ],
      resources: KB.Redshift!.resources,
    },
    Databricks: {
      cat: KB.Databricks!.cat,
      learn: ["Архітектура lakehouse, Delta Lake", "Notebooks, кластери, Spark під капотом", "MLflow для трекінгу експериментів"],
      resources: KB.Databricks!.resources,
    },
    Excel: {
      cat: KB.Excel!.cat,
      learn: ["Pivot tables, VLOOKUP/INDEX-MATCH/XLOOKUP", "Формули, умовне форматування", "Базові VBA/макроси для повторюваних задач"],
      resources: KB.Excel!.resources,
    },
    Jupyter: {
      cat: KB.Jupyter!.cat,
      learn: [
        "Робочий процес notebook для дослідницького аналізу",
        "Магічні команди, модель виконання kernel/cell",
        "Чому notebooks не ідеальні для продакшн-коду",
      ],
      resources: KB.Jupyter!.resources,
    },
    "Google Sheets": {
      cat: KB["Google Sheets"]!.cat,
      learn: ["Pivot tables, QUERY/ARRAYFORMULA", "Перевірка даних, умовне форматування", "Apps Script для автоматизації"],
      resources: KB["Google Sheets"]!.resources,
    },
    "Google Analytics": {
      cat: KB["Google Analytics"]!.cat,
      learn: ["Події, конверсії, аудиторії (модель GA4)", "Звіти по funnel/утриманню", "Зв'язок з BigQuery для експорту сирих подій"],
      resources: KB["Google Analytics"]!.resources,
    },
    ETL: {
      cat: KB.ETL!.cat,
      learn: [
        "Extract/Transform/Load проти ELT",
        "Ідемпотентність, інкрементальні завантаження, backfill",
        "Перевірки якості даних у конвеєрі",
      ],
      resources: KB.ETL!.resources,
    },
    "A/B Testing": {
      cat: KB["A/B Testing"]!.cat,
      learn: [
        "Рандомізація, розмір вибірки/потужність, MDE",
        "Guardrail-метрики, уникнення підглядання (peeking)",
        "Статистична проти практичної значущості",
      ],
      resources: KB["A/B Testing"]!.resources,
    },
    "Machine Learning": {
      cat: KB["Machine Learning"]!.cat,
      learn: [
        "Навчання з учителем/без учителя/з підкріпленням",
        "Train/test split, перенавчання, метрики оцінки",
        "Feature engineering, вибір моделі",
      ],
      resources: KB["Machine Learning"]!.resources,
    },
    "Hypothesis Testing": {
      cat: KB["Hypothesis Testing"]!.cat,
      learn: [
        "Нульова/альтернативна гіпотеза, p-значення",
        "Помилки I/II роду, статистична потужність",
        "t-тест, хі-квадрат, одно- проти двобічних",
      ],
      resources: KB["Hypothesis Testing"]!.resources,
    },
    "Statistics Fundamentals": {
      cat: KB["Statistics Fundamentals"]!.cat,
      learn: [
        "Середнє/медіана/мода, дисперсія/стандартне відхилення",
        "Розподіли, центральна гранична теорема",
        "Кореляція проти причинності, зсув вибірки",
      ],
      resources: KB["Statistics Fundamentals"]!.resources,
    },
    "Data Governance": {
      cat: KB["Data Governance"]!.cat,
      learn: ["Якість даних, lineage, контроль доступу", "PII/відповідність (GDPR), політики зберігання", "Каталоги даних і власність"],
      resources: KB["Data Governance"]!.resources,
    },
    "Feature Engineering": {
      cat: KB["Feature Engineering"]!.cat,
      learn: ["Кодування категорій, масштабування, binning", "Ознаки дати/часу, агрегатні ознаки", "Створення ознак на основі домену"],
      resources: KB["Feature Engineering"]!.resources,
    },
    "Regression Analysis": {
      cat: KB["Regression Analysis"]!.cat,
      learn: ["Припущення лінійної/логістичної регресії", "Інтерпретація коефіцієнтів, odds ratios", "Регуляризація (L1/L2)"],
      resources: KB["Regression Analysis"]!.resources,
    },
    Classification: {
      cat: KB.Classification!.cat,
      learn: [
        "Дерева рішень, random forest, gradient boosting",
        "Confusion matrix, precision/recall/F1, ROC-AUC",
        "Обробка незбалансованих класів",
      ],
      resources: KB.Classification!.resources,
    },
    "Time Series Analysis": {
      cat: KB["Time Series Analysis"]!.cat,
      learn: ["Тренд, сезонність, стаціонарність", "Основи ARIMA, ковзні середні", "Розбиття train/test за часом, не випадково"],
      resources: KB["Time Series Analysis"]!.resources,
    },
    "Data Cleaning": {
      cat: KB["Data Cleaning"]!.cat,
      learn: [
        "Пропущені значення (видалення проти імпутації)",
        "Виявлення викидів (z-score, IQR)",
        "Дедублікація, консистентність типів/форматів даних",
      ],
      resources: KB["Data Cleaning"]!.resources,
    },
    "Data Visualization": {
      cat: KB["Data Visualization"]!.cat,
      learn: [
        "Відповідність типу графіка типу порівняння",
        "Уникнення оманливих графіків (обрізані осі, подвійні осі)",
        "Дизайн дашбордів, колір/доступність",
      ],
      resources: KB["Data Visualization"]!.resources,
    },
    "Data Warehousing": {
      cat: KB["Data Warehousing"]!.cat,
      learn: ["Star schema (fact/dimension таблиці)", "OLTP проти OLAP, ETL/ELT", "Повільно змінні вимірювання (SCD)"],
      resources: KB["Data Warehousing"]!.resources,
    },
    "Dimensional Modeling": {
      cat: KB["Dimensional Modeling"]!.cat,
      learn: ["Fact проти dimension таблиць, grain", "Star проти snowflake схеми", "Повільно змінні вимірювання (Type 1/2)"],
      resources: KB["Dimensional Modeling"]!.resources,
    },
  };
}
