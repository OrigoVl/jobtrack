// Data track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const DATA_KB: Record<string, KbEntry> = {
  // ---------- Data track additions ----------
  pandas: {
    cat: "Tools",
    learn: [
      "DataFrame/Series basics, indexing, filtering",
      "groupby (split-apply-combine), merge/join",
      "Reshaping: pivot_table, melt",
      "Handling missing data, dtypes",
    ],
    resources: [
      R("pandas Docs", "https://pandas.pydata.org/docs/"),
      R("pandas User Guide", "https://pandas.pydata.org/docs/user_guide/index.html"),
      R("Kaggle — Pandas (practice)", "https://www.kaggle.com/learn/pandas"),
    ],
  },
  NumPy: {
    cat: "Tools",
    learn: [
      "ndarray, vectorized operations, broadcasting",
      "Indexing/slicing, aggregation functions",
      "Why it's faster than plain Python lists",
    ],
    resources: [
      R("NumPy Docs", "https://numpy.org/doc/stable/"),
      R("NumPy: the absolute basics", "https://numpy.org/doc/stable/user/absolute_beginners.html"),
    ],
  },
  "scikit-learn": {
    cat: "Modeling",
    learn: [
      "Estimator API: fit/predict/transform",
      "train_test_split, cross_val_score, Pipeline",
      "Regression/classification/clustering models",
      "Preprocessing (StandardScaler, encoders)",
    ],
    resources: [
      R("scikit-learn Docs", "https://scikit-learn.org/stable/"),
      R("scikit-learn Tutorials", "https://scikit-learn.org/stable/tutorial/index.html"),
    ],
  },
  dbt: {
    cat: "Collection",
    learn: ["Models as SELECT statements, ref()/source()", "Tests, documentation, lineage graph", "ELT: transforming inside the warehouse"],
    resources: [R("dbt Docs", "https://docs.getdbt.com/"), R("dbt Guides", "https://docs.getdbt.com/guides")],
  },
  Airflow: {
    cat: "Collection",
    learn: ["DAGs, tasks, operators, dependencies", "Scheduling, retries, backfills", "Monitoring/alerting for pipeline failures"],
    resources: [
      R("Apache Airflow Docs", "https://airflow.apache.org/docs/apache-airflow/stable/index.html"),
      R("Apache Airflow", "https://airflow.apache.org/"),
    ],
  },
  "Power BI": {
    cat: "Visualization",
    learn: ["Data modeling, relationships, DAX measures", "Reports/dashboards, row-level security", "Power Query for transformation"],
    resources: [
      R("Power BI Docs", "https://learn.microsoft.com/en-us/power-bi/"),
      R("Power BI Fundamentals", "https://learn.microsoft.com/en-us/power-bi/fundamentals/"),
    ],
  },
  Tableau: {
    cat: "Visualization",
    learn: ["Dimensions vs measures, calculated fields", "Dashboards, filters, actions", "Choosing the right chart type"],
    resources: [
      R("Tableau Training", "https://www.tableau.com/learn/training"),
      R("Tableau Help", "https://help.tableau.com/current/pro/desktop/en-us/default.htm"),
    ],
  },
  Looker: {
    cat: "Visualization",
    learn: [
      "LookML semantic layer, explores/views",
      "Governed metrics shared across dashboards",
      "Self-service exploration for stakeholders",
    ],
    resources: [R("Looker Docs", "https://cloud.google.com/looker/docs")],
  },
  BigQuery: {
    cat: "Collection",
    learn: ["Serverless SQL warehouse, partitioning/clustering", "Cost control (query bytes scanned)", "Standard SQL, scheduled queries"],
    resources: [
      R("BigQuery Docs", "https://cloud.google.com/bigquery/docs"),
      R("BigQuery Introduction", "https://cloud.google.com/bigquery/docs/introduction"),
    ],
  },
  Snowflake: {
    cat: "Collection",
    learn: ["Virtual warehouses (compute/storage separation)", "Micro-partitions, time travel", "Semi-structured data (VARIANT/JSON)"],
    resources: [R("Snowflake Docs", "https://docs.snowflake.com/en/"), R("Snowflake Guides", "https://www.snowflake.com/guides/")],
  },
  Redshift: {
    cat: "Collection",
    learn: ["Columnar storage, distribution/sort keys", "COPY for bulk loads, WLM/query queues", "Redshift Spectrum for querying S3 data"],
    resources: [
      R("Amazon Redshift Getting Started", "https://docs.aws.amazon.com/redshift/latest/gsg/"),
      R("Amazon Redshift Docs", "https://docs.aws.amazon.com/redshift/"),
    ],
  },
  Databricks: {
    cat: "Collection",
    learn: ["Lakehouse architecture, Delta Lake", "Notebooks, clusters, Spark under the hood", "MLflow for experiment tracking"],
    resources: [R("Databricks Docs", "https://docs.databricks.com/en/index.html")],
  },
  Excel: {
    cat: "Tools",
    learn: ["Pivot tables, VLOOKUP/INDEX-MATCH/XLOOKUP", "Formulas, conditional formatting", "Basic VBA/macros for repetitive tasks"],
    resources: [
      R("Microsoft Excel Support", "https://support.microsoft.com/en-us/excel"),
      R("Exceljet (tips & formulas)", "https://exceljet.net/"),
    ],
  },
  Jupyter: {
    cat: "Tools",
    learn: [
      "Notebook workflow for exploratory analysis",
      "Magic commands, kernel/cell execution model",
      "Why notebooks aren't ideal for production code",
    ],
    resources: [R("Jupyter Docs", "https://docs.jupyter.org/en/latest/"), R("Project Jupyter", "https://jupyter.org/")],
  },
  "Google Sheets": {
    cat: "Tools",
    learn: ["Pivot tables, QUERY/ARRAYFORMULA", "Data validation, conditional formatting", "Apps Script for automation"],
    resources: [
      R("Google Docs Editors Help", "https://support.google.com/docs"),
      R("Google Sheets", "https://workspace.google.com/products/sheets/"),
    ],
  },
  "Google Analytics": {
    cat: "Tools",
    learn: ["Events, conversions, audiences (GA4 model)", "Funnels/retention reports", "Linking to BigQuery for raw event export"],
    resources: [
      R("Google Analytics Help", "https://support.google.com/analytics"),
      R("Google Analytics Academy", "https://analytics.google.com/analytics/academy/"),
    ],
  },
  ETL: {
    cat: "Collection",
    learn: ["Extract/Transform/Load vs ELT", "Idempotency, incremental loads, backfills", "Data quality checks in the pipeline"],
    resources: [
      R("AWS — What is ETL?", "https://aws.amazon.com/what-is/etl/"),
      R("Google Cloud — What is ETL?", "https://cloud.google.com/learn/what-is-etl"),
    ],
  },
  "A/B Testing": {
    cat: "Core",
    learn: ["Randomization, sample size/power, MDE", "Guardrail metrics, avoiding peeking", "Statistical vs practical significance"],
    resources: [
      R("VWO — A/B Testing Guide", "https://vwo.com/ab-testing/"),
      R("Optimizely — A/B Testing Glossary", "https://www.optimizely.com/optimization-glossary/ab-testing/"),
    ],
  },
  "Machine Learning": {
    cat: "Modeling",
    learn: [
      "Supervised/unsupervised/reinforcement learning",
      "Train/test split, overfitting, evaluation metrics",
      "Feature engineering, model selection",
    ],
    resources: [
      R("Google — Machine Learning Crash Course", "https://developers.google.com/machine-learning/crash-course"),
      R("scikit-learn Docs", "https://scikit-learn.org/stable/"),
    ],
  },
  "Hypothesis Testing": {
    cat: "Core",
    learn: ["Null/alternative hypothesis, p-values", "Type I/II errors, statistical power", "t-test, chi-square, one- vs two-tailed"],
    resources: [
      R("Khan Academy — Significance Tests", "https://www.khanacademy.org/math/statistics-probability/significance-tests-one-sample"),
    ],
  },
  "Statistics Fundamentals": {
    cat: "Core",
    learn: ["Mean/median/mode, variance/std dev", "Distributions, the Central Limit Theorem", "Correlation vs causation, sampling bias"],
    resources: [
      R("Khan Academy — Statistics & Probability", "https://www.khanacademy.org/math/statistics-probability"),
      R("Seeing Theory (visual intro to stats)", "https://seeing-theory.brown.edu/"),
    ],
  },
  "Data Governance": {
    cat: "Core",
    learn: ["Data quality, lineage, access control", "PII/compliance (GDPR), retention policies", "Data catalogs and ownership"],
    resources: [
      R("AWS — What is Data Governance?", "https://aws.amazon.com/what-is/data-governance/"),
      R("Google Cloud — What is Data Governance?", "https://cloud.google.com/learn/what-is-data-governance"),
    ],
  },
  "Feature Engineering": {
    cat: "Modeling",
    learn: ["Encoding categoricals, scaling, binning", "Date/time features, aggregation features", "Domain-driven feature creation"],
    resources: [R("Kaggle — Feature Engineering (practice)", "https://www.kaggle.com/learn/feature-engineering")],
  },
  "Regression Analysis": {
    cat: "Modeling",
    learn: ["Linear/logistic regression assumptions", "Coefficient interpretation, odds ratios", "Regularization (L1/L2)"],
    resources: [
      R("scikit-learn — Linear Models", "https://scikit-learn.org/stable/modules/linear_model.html"),
      R(
        "Khan Academy — Relationships in Data",
        "https://www.khanacademy.org/math/statistics-probability/describing-relationships-quantitative-data",
      ),
    ],
  },
  Classification: {
    cat: "Modeling",
    learn: [
      "Decision trees, random forest, gradient boosting",
      "Confusion matrix, precision/recall/F1, ROC-AUC",
      "Handling class imbalance",
    ],
    resources: [R("scikit-learn — Supervised Learning", "https://scikit-learn.org/stable/supervised_learning.html")],
  },
  "Time Series Analysis": {
    cat: "Modeling",
    learn: ["Trend, seasonality, stationarity", "ARIMA basics, moving averages", "Train/test split by time, not randomly"],
    resources: [
      R("statsmodels — Time Series Analysis", "https://www.statsmodels.org/stable/tsa.html"),
      R("pandas — Time Series Guide", "https://pandas.pydata.org/docs/user_guide/timeseries.html"),
    ],
  },
  "Data Cleaning": {
    cat: "Collection",
    learn: ["Missing values (deletion vs imputation)", "Outlier detection (z-score, IQR)", "Deduplication, data type/format consistency"],
    resources: [R("Kaggle — Data Cleaning (practice)", "https://www.kaggle.com/learn/data-cleaning")],
  },
  "Data Visualization": {
    cat: "Visualization",
    learn: [
      "Matching chart type to the comparison being made",
      "Avoiding misleading charts (truncated axes, dual axes)",
      "Dashboard design, color/accessibility",
    ],
    resources: [
      R("Kaggle — Data Visualization (practice)", "https://www.kaggle.com/learn/data-visualization"),
      R("The Data Visualisation Catalogue", "https://datavizcatalogue.com/"),
    ],
  },
  "Data Warehousing": {
    cat: "Collection",
    learn: ["Star schema (fact/dimension tables)", "OLTP vs OLAP, ETL/ELT", "Slowly changing dimensions"],
    resources: [
      R("AWS — What is a Data Warehouse?", "https://aws.amazon.com/what-is/data-warehouse/"),
      R("Google Cloud — What is a Data Warehouse?", "https://cloud.google.com/learn/what-is-a-data-warehouse"),
    ],
  },
  "Dimensional Modeling": {
    cat: "Collection",
    learn: ["Fact vs dimension tables, grain", "Star vs snowflake schema", "Slowly changing dimensions (Type 1/2)"],
    resources: [R("Kimball Group (dimensional modeling resources)", "https://www.kimballgroup.com/")],
  },
};
