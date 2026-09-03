// DevOps track (see shared/tracks.ts's Track union) knowledge-base entries — split out of
// ../knowledge-base.ts's KB object purely for reviewable diffs; see that file's own header
// comment for the full KB shape (learn bullets + resources per technology). No logic here.
import type { KbEntry } from "../knowledge-base.js";
import { R } from "./resource.js";

export const DEVOPS_KB: Record<string, KbEntry> = {
  // ---------- DevOps track additions ----------
  Linux: {
    cat: "Core",
    learn: [
      "Processes, signals, systemd/systemctl, journalctl",
      "File permissions (chmod/chown/umask), inodes, filesystems",
      "Networking basics: ip/ss, DNS, firewalls (iptables/nft)",
      "Shell tools: grep/sed/awk, pipes, redirection",
    ],
    resources: [
      R("Linux Journey", "https://linuxjourney.com/"),
      R("The Linux Documentation Project", "https://tldp.org/"),
      R("Arch Wiki (excellent reference, distro-agnostic in practice)", "https://wiki.archlinux.org/"),
    ],
  },
  "Bash Scripting": {
    cat: "Core",
    learn: [
      "set -euo pipefail, quoting, parameter expansion",
      "Functions, arrays, conditionals, loops",
      "Common pitfalls: word splitting, globbing, unset variables",
    ],
    resources: [
      R("Bash Manual (GNU)", "https://www.gnu.org/software/bash/manual/bash.html"),
      R("ShellCheck (lint your scripts)", "https://www.shellcheck.net/"),
      R("Bash Guide (Wooledge)", "https://mywiki.wooledge.org/BashGuide"),
    ],
  },
  systemd: {
    cat: "Core",
    learn: [
      "Unit files (.service/.timer), dependencies (After=/Requires=)",
      "systemctl start/stop/enable/status, journalctl",
      "Timers as a cron alternative",
    ],
    resources: [
      R("systemd.service man page", "https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html"),
      R("systemd.timer man page", "https://www.freedesktop.org/software/systemd/man/latest/systemd.timer.html"),
    ],
  },
  Terraform: {
    cat: "Cloud",
    learn: [
      "HCL syntax, providers, resources, data sources",
      "State: plan/apply workflow, remote state + locking",
      "Modules, variables/outputs, workspaces",
    ],
    resources: [
      R("Terraform Docs", "https://developer.hashicorp.com/terraform/docs"),
      R("Terraform Tutorials", "https://developer.hashicorp.com/terraform/tutorials"),
      R("Terraform Registry (providers/modules)", "https://registry.terraform.io/"),
    ],
  },
  Ansible: {
    cat: "Tools",
    learn: [
      "Playbooks, tasks, idempotent modules",
      "Inventory (static/dynamic), roles, variables",
      "Handlers, templates (Jinja2), vault for secrets",
    ],
    resources: [
      R("Ansible Docs", "https://docs.ansible.com/ansible/latest/index.html"),
      R("Ansible Getting Started", "https://www.ansible.com/resources/get-started"),
    ],
  },
  "GitHub Actions": {
    cat: "CI/CD",
    learn: [
      "Workflows, jobs, steps, runners (hosted/self-hosted)",
      "Matrix builds, caching, artifacts",
      "Secrets, environments, reusable workflows",
    ],
    resources: [
      R("GitHub Actions Docs", "https://docs.github.com/en/actions"),
      R("GitHub Actions Marketplace", "https://github.com/marketplace?type=actions"),
    ],
  },
  Jenkins: {
    cat: "CI/CD",
    learn: ["Declarative vs scripted pipelines", "Agents, stages, post actions", "Plugins ecosystem, distributed builds"],
    resources: [
      R("Jenkins Docs", "https://www.jenkins.io/doc/"),
      R("Jenkins Pipeline Tutorial", "https://www.jenkins.io/doc/pipeline/tour/getting-started/"),
    ],
  },
  GitOps: {
    cat: "CI/CD",
    learn: [
      "Git as the single source of truth for desired state",
      "Reconciliation loop, drift detection/correction",
      "Pull-based vs push-based deployment",
    ],
    resources: [R("OpenGitOps Principles", "https://opengitops.dev/"), R("Flux Concepts", "https://fluxcd.io/flux/concepts/")],
  },
  ArgoCD: {
    cat: "CI/CD",
    learn: [
      "Application CRD, sync policies (manual/automated)",
      "App of Apps pattern, Helm/Kustomize integration",
      "RBAC, SSO, notifications",
    ],
    resources: [
      R("Argo CD Docs", "https://argo-cd.readthedocs.io/en/stable/"),
      R("Argo CD Getting Started", "https://argo-cd.readthedocs.io/en/stable/getting_started/"),
    ],
  },
  "Blue-Green Deployment": {
    cat: "CI/CD",
    learn: ["Two identical environments, instant traffic cutover", "Rollback = switch back; double infra cost during cutover"],
    resources: [R("Martin Fowler -- BlueGreenDeployment", "https://martinfowler.com/bliki/BlueGreenDeployment.html")],
  },
  "Canary Deployment": {
    cat: "CI/CD",
    learn: ["Gradual traffic shift to a new version while monitoring", "Blast-radius limiting vs blue-green's instant cutover"],
    resources: [R("Martin Fowler -- CanaryRelease", "https://martinfowler.com/bliki/CanaryRelease.html")],
  },
  "Feature Flags": {
    cat: "CI/CD",
    learn: ["Decoupling deploy from release", "Kill switches, gradual rollout, targeting/cohorts"],
    resources: [
      R("LaunchDarkly -- Feature Flag Guide", "https://docs.launchdarkly.com/home"),
      R("Martin Fowler -- Feature Toggles", "https://martinfowler.com/articles/feature-toggles.html"),
    ],
  },
  Prometheus: {
    cat: "Monitoring",
    learn: [
      "Pull-based scraping, exporters, service discovery",
      "PromQL: counters/gauges/histograms, rate()/histogram_quantile()",
      "Alertmanager: alerting rules, routing, silences",
    ],
    resources: [
      R("Prometheus Docs", "https://prometheus.io/docs/introduction/overview/"),
      R("PromQL Basics", "https://prometheus.io/docs/prometheus/latest/querying/basics/"),
    ],
  },
  Grafana: {
    cat: "Monitoring",
    learn: [
      "Dashboards/panels, data sources (Prometheus/Loki/SQL/...)",
      "Alerting, variables/templating",
      "Provisioning dashboards as code",
    ],
    resources: [R("Grafana Docs", "https://grafana.com/docs/grafana/latest/"), R("Grafana Play (live demo)", "https://play.grafana.org/")],
  },
  "Distributed Tracing": {
    cat: "Monitoring",
    learn: [
      "Trace/span model, context propagation",
      "OpenTelemetry instrumentation (auto vs manual)",
      "Visualizing traces (Jaeger/Tempo/Zipkin)",
    ],
    resources: [R("OpenTelemetry Docs", "https://opentelemetry.io/docs/"), R("Jaeger Docs", "https://www.jaegertracing.io/docs/latest/")],
  },
  "Log Aggregation": {
    cat: "Monitoring",
    learn: [
      "Centralized, indexed, searchable logs across a fleet",
      "ELK/Elastic stack vs Grafana Loki (labels-only indexing)",
      "Structured logging, retention policies",
    ],
    resources: [
      R("Grafana Loki Docs", "https://grafana.com/docs/loki/latest/"),
      R("Elasticsearch Reference", "https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html"),
    ],
  },
  "SRE/SLO": {
    cat: "Monitoring",
    learn: [
      "SLI/SLO/SLA, error budgets",
      "Golden signals (latency, traffic, errors, saturation)",
      "Multi-window, multi-burn-rate alerting",
    ],
    resources: [
      R("Google SRE Book", "https://sre.google/sre-book/table-of-contents/"),
      R("Google SRE Workbook", "https://sre.google/workbook/table-of-contents/"),
    ],
  },
  "Incident Response": {
    cat: "Monitoring",
    learn: ["On-call, escalation policies, runbooks", "Incident commander role, mitigate-first discipline", "Blameless postmortems"],
    resources: [
      R("Google SRE Book -- Managing Incidents", "https://sre.google/sre-book/managing-incidents/"),
      R("PagerDuty Incident Response Docs", "https://response.pagerduty.com/"),
    ],
  },
  "Chaos Engineering": {
    cat: "Monitoring",
    learn: ["Hypothesis-driven fault injection, blast-radius limits", "Steady-state baseline, abort conditions"],
    resources: [R("Principles of Chaos Engineering", "https://principlesofchaos.org/")],
  },
  Helm: {
    cat: "Containers",
    learn: ["Charts, templates, values.yaml", "Releases, upgrade/rollback, repositories"],
    resources: [
      R("Helm Docs", "https://helm.sh/docs/"),
      R("Helm Chart Template Guide", "https://helm.sh/docs/chart_template_guide/getting_started/"),
    ],
  },
  "Container Registry": {
    cat: "Containers",
    learn: ["Image tags vs immutable digests", "Content-addressed layers, push/pull efficiency", "Vulnerability scanning, image signing"],
    resources: [
      R("Docker Hub Docs", "https://docs.docker.com/docker-hub/"),
      R("AWS ECR Docs", "https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html"),
    ],
  },
  "VPC/Networking": {
    cat: "Cloud",
    learn: [
      "Subnets (public/private), route tables",
      "Internet Gateway vs NAT Gateway",
      "Security groups vs network ACLs, VPC peering/Transit Gateway",
    ],
    resources: [
      R("AWS VPC Docs", "https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html"),
      R("AWS VPC Peering Docs", "https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html"),
    ],
  },
  IAM: {
    cat: "Cloud",
    learn: ["Users/roles/policies, least privilege", "Role assumption, temporary credentials", "Permissions boundaries"],
    resources: [
      R("AWS IAM Docs", "https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html"),
      R("AWS IAM Best Practices", "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html"),
    ],
  },
  "Load Balancing": {
    cat: "Cloud",
    learn: ["L4 vs L7 load balancing", "Health checks, sticky sessions, TLS termination", "Autoscaling integration"],
    resources: [
      R("AWS Elastic Load Balancing Docs", "https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/what-is-load-balancing.html"),
    ],
  },
  "Secrets Management": {
    cat: "Cloud",
    learn: ["Encrypted storage, access control via IAM", "Automatic rotation, audit trails", "Runtime injection vs baked-in credentials"],
    resources: [
      R("AWS Secrets Manager Docs", "https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html"),
      R("Azure Key Vault Docs", "https://learn.microsoft.com/en-us/azure/key-vault/general/overview"),
    ],
  },
  "Auto Scaling": {
    cat: "Cloud",
    learn: [
      "Scaling policies: target tracking, step, scheduled",
      "Health checks and instance replacement",
      "Integration with load balancers",
    ],
    resources: [R("AWS Auto Scaling Docs", "https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html")],
  },
  Vault: {
    cat: "Tools",
    learn: ["KV secrets engine, dynamic secrets", "Policies (path-based access control)", "Auth methods, audit devices"],
    resources: [
      R("Vault Docs", "https://developer.hashicorp.com/vault/docs"),
      R("Vault Tutorials", "https://developer.hashicorp.com/vault/tutorials"),
    ],
  },
  Nginx: {
    cat: "Tools",
    learn: ["Reverse proxy, upstream/load-balancing directives", "TLS termination, static file serving", "Rate limiting, header rewriting"],
    resources: [R("Nginx Docs", "https://nginx.org/en/docs/"), R("Nginx Admin Guide (F5)", "https://docs.nginx.com/nginx/admin-guide/")],
  },
  Vagrant: {
    cat: "Tools",
    learn: ["Vagrantfile, boxes, providers (VirtualBox/VMware)", "Provisioning (shell/Ansible), synced folders"],
    resources: [R("Vagrant Docs", "https://developer.hashicorp.com/vagrant/docs")],
  },
  Packer: {
    cat: "Tools",
    learn: ["Templates, builders (amazon-ebs, docker, ...)", "Provisioners (shell/Ansible) baked into the image"],
    resources: [R("Packer Docs", "https://developer.hashicorp.com/packer/docs")],
  },
  "Configuration Drift": {
    cat: "Tools",
    learn: ["Detecting drift: terraform plan, Ansible --check", "Prevention: restricting direct access, GitOps reconciliation"],
    resources: [
      R("Terraform -- Resource Drift Tutorial", "https://developer.hashicorp.com/terraform/tutorials/state/resource-drift"),
      R("AWS Config Docs", "https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html"),
    ],
  },
};
