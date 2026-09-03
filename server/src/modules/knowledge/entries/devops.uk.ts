// Ukrainian mirror of ./devops.ts's DEVOPS_KB — same keys/cat/resources (read back from
// the English KB by reference, never duplicated), `learn` bullets translated. Wrapped in a
// function rather than a top-level const for the same reason as knowledge-base.uk.ts's
// buildKbUk(): reading `KB.X!.cat` at module-evaluation time would run before knowledge-base.ts
// finishes defining `KB`, a genuine circular import — see this file's own callers for the lazy
// getKbUk()-style memoization that sidesteps it.
import { KB, type KbEntry } from "../knowledge-base.js";

export function buildDevopsKbUk(): Record<string, KbEntry> {
  return {
    Linux: {
      cat: KB.Linux!.cat,
      learn: [
        "Процеси, сигнали, systemd/systemctl, journalctl",
        "Права доступу до файлів (chmod/chown/umask), inodes, файлові системи",
        "Основи мережі: ip/ss, DNS, файрволи (iptables/nft)",
        "Інструменти shell: grep/sed/awk, pipes, редіректи",
      ],
      resources: KB.Linux!.resources,
    },
    "Bash Scripting": {
      cat: KB["Bash Scripting"]!.cat,
      learn: [
        "set -euo pipefail, квотування, розширення параметрів",
        "Функції, масиви, умови, цикли",
        "Типові пастки: word splitting, globbing, незадані змінні",
      ],
      resources: KB["Bash Scripting"]!.resources,
    },
    systemd: {
      cat: KB.systemd!.cat,
      learn: [
        "Unit-файли (.service/.timer), залежності (After=/Requires=)",
        "systemctl start/stop/enable/status, journalctl",
        "Timers як альтернатива cron",
      ],
      resources: KB.systemd!.resources,
    },
    Terraform: {
      cat: KB.Terraform!.cat,
      learn: [
        "Синтаксис HCL, провайдери, ресурси, data sources",
        "State: робочий процес plan/apply, remote state + блокування",
        "Модулі, variables/outputs, workspaces",
      ],
      resources: KB.Terraform!.resources,
    },
    Ansible: {
      cat: KB.Ansible!.cat,
      learn: [
        "Playbooks, tasks, ідемпотентні модулі",
        "Inventory (статичний/динамічний), roles, змінні",
        "Handlers, шаблони (Jinja2), vault для секретів",
      ],
      resources: KB.Ansible!.resources,
    },
    "GitHub Actions": {
      cat: KB["GitHub Actions"]!.cat,
      learn: [
        "Workflows, jobs, steps, runners (хостовані/self-hosted)",
        "Matrix-збірки, кешування, артефакти",
        "Секрети, environments, reusable workflows",
      ],
      resources: KB["GitHub Actions"]!.resources,
    },
    Jenkins: {
      cat: KB.Jenkins!.cat,
      learn: ["Декларативні проти скриптованих пайплайнів", "Agents, stages, post-дії", "Екосистема плагінів, розподілені збірки"],
      resources: KB.Jenkins!.resources,
    },
    GitOps: {
      cat: KB.GitOps!.cat,
      learn: [
        "Git як єдине джерело правди про бажаний стан",
        "Цикл узгодження, виявлення/виправлення дрейфу",
        "Pull-based проти push-based деплой",
      ],
      resources: KB.GitOps!.resources,
    },
    ArgoCD: {
      cat: KB.ArgoCD!.cat,
      learn: [
        "CRD Application, політики синхронізації (ручна/автоматична)",
        "Паттерн App of Apps, інтеграція з Helm/Kustomize",
        "RBAC, SSO, сповіщення",
      ],
      resources: KB.ArgoCD!.resources,
    },
    "Blue-Green Deployment": {
      cat: KB["Blue-Green Deployment"]!.cat,
      learn: [
        "Два ідентичних середовища, миттєве перемикання трафіку",
        "Rollback = перемикання назад; подвійна вартість інфраструктури під час переходу",
      ],
      resources: KB["Blue-Green Deployment"]!.resources,
    },
    "Canary Deployment": {
      cat: KB["Canary Deployment"]!.cat,
      learn: [
        "Поступове перемикання трафіку на нову версію зі спостереженням",
        "Обмеження радіуса ураження проти миттєвого перемикання blue-green",
      ],
      resources: KB["Canary Deployment"]!.resources,
    },
    "Feature Flags": {
      cat: KB["Feature Flags"]!.cat,
      learn: ["Розділення деплою коду й релізу фічі", "Kill switches, поступовий rollout, таргетинг/когорти"],
      resources: KB["Feature Flags"]!.resources,
    },
    Prometheus: {
      cat: KB.Prometheus!.cat,
      learn: [
        "Pull-based скрейпінг, експортери, service discovery",
        "PromQL: counters/gauges/histograms, rate()/histogram_quantile()",
        "Alertmanager: правила алертів, роутинг, silences",
      ],
      resources: KB.Prometheus!.resources,
    },
    Grafana: {
      cat: KB.Grafana!.cat,
      learn: [
        "Дашборди/панелі, data sources (Prometheus/Loki/SQL/...)",
        "Алертинг, змінні/шаблонізація",
        "Провізіонування дашбордів як коду",
      ],
      resources: KB.Grafana!.resources,
    },
    "Distributed Tracing": {
      cat: KB["Distributed Tracing"]!.cat,
      learn: [
        "Модель trace/span, поширення контексту",
        "Інструментація OpenTelemetry (авто проти ручної)",
        "Візуалізація трейсів (Jaeger/Tempo/Zipkin)",
      ],
      resources: KB["Distributed Tracing"]!.resources,
    },
    "Log Aggregation": {
      cat: KB["Log Aggregation"]!.cat,
      learn: [
        "Централізовані, індексовані, шукані логи по всьому флоту",
        "ELK/Elastic stack проти Grafana Loki (індексування лише лейблів)",
        "Структуроване логування, політики зберігання",
      ],
      resources: KB["Log Aggregation"]!.resources,
    },
    "SRE/SLO": {
      cat: KB["SRE/SLO"]!.cat,
      learn: [
        "SLI/SLO/SLA, error budgets",
        "Золоті сигнали (latency, traffic, errors, saturation)",
        "Multi-window, multi-burn-rate алертинг",
      ],
      resources: KB["SRE/SLO"]!.resources,
    },
    "Incident Response": {
      cat: KB["Incident Response"]!.cat,
      learn: [
        "On-call, політики ескалації, runbook'и",
        "Роль incident commander, дисципліна 'спочатку мітигувати'",
        "Безоцінкові постмортеми",
      ],
      resources: KB["Incident Response"]!.resources,
    },
    "Chaos Engineering": {
      cat: KB["Chaos Engineering"]!.cat,
      learn: ["Впровадження збоїв на основі гіпотези, обмеження радіуса ураження", "Базовий стабільний стан, умови скасування"],
      resources: KB["Chaos Engineering"]!.resources,
    },
    Helm: {
      cat: KB.Helm!.cat,
      learn: ["Charts, шаблони, values.yaml", "Releases, upgrade/rollback, репозиторії"],
      resources: KB.Helm!.resources,
    },
    "Container Registry": {
      cat: KB["Container Registry"]!.cat,
      learn: [
        "Теги образів проти незмінних дайджестів",
        "Шари, адресовані за контентом, ефективність push/pull",
        "Сканування вразливостей, підписання образів",
      ],
      resources: KB["Container Registry"]!.resources,
    },
    "VPC/Networking": {
      cat: KB["VPC/Networking"]!.cat,
      learn: [
        "Підмережі (публічні/приватні), таблиці маршрутизації",
        "Internet Gateway проти NAT Gateway",
        "Security groups проти network ACL, VPC peering/Transit Gateway",
      ],
      resources: KB["VPC/Networking"]!.resources,
    },
    IAM: {
      cat: KB.IAM!.cat,
      learn: [
        "Користувачі/ролі/policy, найменші привілеї",
        "Прийняття ролі (role assumption), тимчасові credentials",
        "Permissions boundaries",
      ],
      resources: KB.IAM!.resources,
    },
    "Load Balancing": {
      cat: KB["Load Balancing"]!.cat,
      learn: ["L4 проти L7 балансування навантаження", "Health checks, sticky sessions, термінація TLS", "Інтеграція з автомасштабуванням"],
      resources: KB["Load Balancing"]!.resources,
    },
    "Secrets Management": {
      cat: KB["Secrets Management"]!.cat,
      learn: [
        "Зашифроване зберігання, контроль доступу через IAM",
        "Автоматична ротація, аудит-трейли",
        "Введення в runtime проти запечених credentials",
      ],
      resources: KB["Secrets Management"]!.resources,
    },
    "Auto Scaling": {
      cat: KB["Auto Scaling"]!.cat,
      learn: [
        "Політики масштабування: target tracking, step, за розкладом",
        "Health checks і заміна інстансів",
        "Інтеграція з балансувальниками навантаження",
      ],
      resources: KB["Auto Scaling"]!.resources,
    },
    Vault: {
      cat: KB.Vault!.cat,
      learn: ["KV secrets engine, динамічні секрети", "Policies (контроль доступу за шляхами)", "Auth methods, audit devices"],
      resources: KB.Vault!.resources,
    },
    Nginx: {
      cat: KB.Nginx!.cat,
      learn: [
        "Reverse proxy, директиви upstream/балансування навантаження",
        "Термінація TLS, віддача статичних файлів",
        "Обмеження частоти запитів, переписування заголовків",
      ],
      resources: KB.Nginx!.resources,
    },
    Vagrant: {
      cat: KB.Vagrant!.cat,
      learn: ["Vagrantfile, boxes, провайдери (VirtualBox/VMware)", "Провізіонування (shell/Ansible), синхронізовані директорії"],
      resources: KB.Vagrant!.resources,
    },
    Packer: {
      cat: KB.Packer!.cat,
      learn: ["Шаблони, builders (amazon-ebs, docker, ...)", "Provisioners (shell/Ansible), запечені в образ"],
      resources: KB.Packer!.resources,
    },
    "Configuration Drift": {
      cat: KB["Configuration Drift"]!.cat,
      learn: ["Виявлення дрейфу: terraform plan, Ansible --check", "Запобігання: обмеження прямого доступу, узгодження через GitOps"],
      resources: KB["Configuration Drift"]!.resources,
    },
  };
}
