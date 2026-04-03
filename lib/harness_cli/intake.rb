# frozen_string_literal: true

require "time"

module HarnessCLI
  class Intake
    INTENT_PATTERNS = {
      "bug" => [/修复/, /修下/, /排查/, /报错/, /不生效/, /卡死/, /\bbug\b/i],
      "feature" => [/新增/, /支持/, /实现/, /增加能力/, /加上/, /加个/, /加一个/],
      "explore" => [/调研/, /分析/, /阅读代码/, /解释/, /看看/, /评估/, /先别改代码/],
      "prototype" => [/试一下/, /快速验证/, /\bpoc\b/i, /草稿/]
    }.freeze

    MODE_PATTERNS = {
      "explore" => [/先调研/, /调研/, /分析/, /阅读代码/, /解释/, /看看/, /先别改代码/],
      "poc" => [/快速验证/, /\bpoc\b/i, /试一下/, /草稿/]
    }.freeze

    SCOPE_HINTS = {
      /登录页/ => "src/web/login/*",
      /发布页/ => "src/web/publish/*",
      /发布链路/ => "release pipeline",
      /仓库/ => "repository architecture"
    }.freeze

    def initialize(input:, config:, context_refs: [])
      @input = input.strip
      @config = config
      @context_refs = Array(context_refs).map(&:strip).reject(&:empty?)
    end

    def call
      intent = infer_intent
      mode = infer_mode(intent)
      scope = infer_scope(intent)
      acceptance = infer_acceptance(intent)
      constraints = infer_constraints
      assumptions = infer_assumptions(intent, scope)
      risk_signals = infer_risk_signals(scope)
      risk_level = derive_risk_level(scope, intent)

      decision = decide_next_action(intent, mode, scope, acceptance, constraints, risk_level, risk_signals)

      task_draft = {
        "schema_version" => "0.2",
        "source_input" => @input,
        "intent" => intent,
        "goal" => infer_goal(intent),
        "scope" => scope,
        "acceptance" => acceptance,
        "constraints" => constraints,
        "mode" => mode,
        "assumptions" => assumptions,
        "open_questions" => decision[:question] ? [decision[:question]] : [],
        "risk_signals" => risk_signals,
        "context_refs" => @context_refs,
        "next_action" => decision[:next_action],
        "derived" => {
          "risk_level" => risk_level,
          "state" => decision[:state]
        }
      }

      {
        "schema_version" => "0.2",
        "command" => "intake",
        "status" => decision[:status],
        "task_draft" => task_draft,
        "interaction" => {
          "summary" => build_summary(intent, task_draft["goal"], scope, constraints),
          "assumptions" => assumptions.dup,
          "blocking_gap" => decision[:blocking_gap],
          "question" => decision[:question],
          "next_action" => decision[:next_action]
        },
        "metadata" => {
          "project" => @config.project_name,
          "config_path" => relative_config_path,
          "generated_at" => Time.now.iso8601
        }
      }
    end

    private

    def infer_intent
      INTENT_PATTERNS.each do |intent, patterns|
        return intent if patterns.any? { |pattern| @input.match?(pattern) }
      end

      "unknown"
    end

    def infer_mode(intent)
      MODE_PATTERNS.each do |mode, patterns|
        return mode if patterns.any? { |pattern| @input.match?(pattern) }
      end

      return "explore" if intent == "explore"
      return "poc" if intent == "prototype"

      @config.default_mode || "delivery"
    end

    def infer_goal(intent)
      normalized = task_clause.gsub(/[。！？]/, "").strip

      case intent
      when "explore"
        return "评估当前问题并给出结论" if normalized.empty?
        return "评估#{normalized.sub(/\A帮我/, "").sub(/\A先/, "").sub(/\A看下/, "").sub(/\A看看/, "").strip}"
      when "feature"
        phrase = capture_after(/(?:新增|支持|实现|加上|加个|加一个)(.+)/)
        return "支持#{clean_phrase(phrase)}" if phrase
      when "bug"
        phrase = capture_after(/(?:修复|修下|排查|解决)(.+)/)
        return "修复#{clean_phrase(phrase)}" if phrase
      when "prototype"
        return "快速验证#{normalized}"
      end

      normalized
    end

    def infer_scope(intent)
      explicit_paths = extract_path_like_tokens
      return explicit_paths unless explicit_paths.empty?

      hinted_scope = SCOPE_HINTS.each_with_object([]) do |(pattern, value), acc|
        acc << value if @input.match?(pattern)
      end
      return hinted_scope.uniq unless hinted_scope.empty?

      return @context_refs.uniq unless @context_refs.empty?
      return ["repository architecture"] if intent == "explore"

      ["project workspace"]
    end

    def infer_acceptance(intent)
      case intent
      when "bug"
        symptom = capture_after_clause(/(?:修复|修下|排查|解决)(.+?)(?:问题|bug)?(?:，|,|。|$)/)
        item = symptom ? "#{clean_phrase(symptom)}不再出现" : "问题不再复现"
        [item, "不引入已知回归"]
      when "feature"
        ["新能力可被使用", "不破坏现有兼容性"]
      when "explore"
        ["给出结论、原因、风险和下一步建议"]
      when "prototype"
        ["验证目标路径是否可行", "明确当前限制"]
      else
        ["当前输入需要先澄清后才能形成验收标准"]
      end
    end

    def infer_constraints
      constraints = []
      constraints << "不改后端接口" if @input.match?(/别动后端接口|不改后端接口/)
      constraints << "不改代码" if @input.match?(/先别改代码|不改代码/)
      constraints << "不扩大改动范围"
      constraints.uniq
    end

    def infer_assumptions(intent, scope)
      assumptions = []

      if intent == "explore"
        assumptions << "先基于现有仓库结构和相关文档做分析"
      elsif scope == ["project workspace"]
        assumptions << "当前范围先按项目工作区理解，后续可能需要继续收紧"
      else
        assumptions << "当前范围先按推断出的模块边界处理"
      end

      assumptions
    end

    def infer_risk_signals(scope)
      signals = []
      if scope.any? { |item| protected?(item) }
        signals << "推断范围命中了受保护路径"
      end

      if scope == ["project workspace"]
        signals << "当前可改范围仍然偏宽"
      end

      signals
    end

    def derive_risk_level(scope, intent)
      risk_from_config = @config.risk_rules.each_with_object([]) do |(level, rule), acc|
        Array(rule["path_matches"]).each do |pattern|
          acc << level if scope.any? { |item| path_match?(item, pattern) }
        end
      end

      return "high" if risk_from_config.include?("high")
      return "medium" if risk_from_config.include?("medium")
      return "low" if risk_from_config.include?("low")
      return "low" if intent == "explore"

      "medium"
    end

    def decide_next_action(intent, _mode, scope, _acceptance, _constraints, risk_level, risk_signals)
      return failed_decision("无法可靠识别任务意图") if intent == "unknown"

      if risk_signals.include?("推断范围命中了受保护路径")
        return clarify_decision(
          "当前范围可能命中受保护路径",
          "当前推断范围可能命中受保护路径，是否允许显式确认后继续推进？"
        )
      end

      if requires_scope_clarification?(intent, scope)
        return clarify_decision(
          "当前可改范围还不够明确",
          "当前可改范围还不够明确，优先限定到哪个模块、目录或子系统？"
        )
      end

      if intent == "bug" && requires_bug_acceptance_clarification?
        return clarify_decision(
          "完成标准还不够明确",
          "完成标准是必须成功恢复正常流程，还是错误提示正确也可接受？"
        )
      end

      if risk_level == "high"
        return clarify_decision(
          "任务命中了高风险范围",
          "这次任务命中高风险范围，是否确认按当前边界继续推进？"
        )
      end

      {
        status: "planned",
        state: "planned",
        next_action: "plan",
        blocking_gap: nil,
        question: nil
      }
    end

    def build_summary(intent, goal, scope, constraints)
      intent_label = {
        "bug" => "bug 修复",
        "feature" => "功能开发",
        "explore" => "调研",
        "prototype" => "原型验证",
        "refactor" => "重构"
      }[intent] || "任务"

      summary = "这是一个#{intent_label}任务，目标是#{goal}。"
      summary += " 当前范围先限定为 #{scope.join(', ')}。"
      summary += " 当前约束包括：#{constraints.join('、')}。" unless constraints.empty?
      summary
    end

    def relative_config_path
      cwd = Dir.pwd
      path = @config.path
      return path unless path.start_with?(cwd)

      relative = path.delete_prefix("#{cwd}/")
      relative.empty? ? File.basename(path) : relative
    end

    def requires_scope_clarification?(intent, scope)
      %w[bug feature refactor prototype].include?(intent) && scope == ["project workspace"]
    end

    def requires_bug_acceptance_clarification?
      !@input.match?(/必须|成功跳转|错误提示|恢复正常|可接受|算完成/)
    end

    def clarify_decision(blocking_gap, question)
      {
        status: "needs_clarification",
        state: "needs_clarification",
        next_action: "clarify",
        blocking_gap: blocking_gap,
        question: question
      }
    end

    def failed_decision(blocking_gap)
      {
        status: "failed",
        state: "failed",
        next_action: "fail",
        blocking_gap: blocking_gap,
        question: nil
      }
    end

    def extract_path_like_tokens
      tokens = @input.scan(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_*.-]+/)
      tokens.map(&:strip).uniq
    end

    def protected?(value)
      @config.protected_paths.any? { |pattern| path_match?(value, pattern) }
    end

    def path_match?(value, pattern)
      File.fnmatch?(pattern, value, File::FNM_PATHNAME | File::FNM_EXTGLOB)
    end

    def capture_after(regex)
      match = task_clause.match(regex)
      match && match[1]
    end

    def capture_after_clause(regex)
      match = task_clause.match(regex)
      match && match[1]
    end

    def clean_phrase(value)
      value.to_s.strip
           .sub(/\A[:：\s]+/, "")
           .sub(/[，,。.!！?？]+\z/, "")
           .sub(/的\z/, "")
           .strip
    end

    def task_clause
      clauses = @input.split(/[，,。]/).map(&:strip).reject(&:empty?)
      primary = clauses.find { |clause| clause !~ /\A(?:先别|别动|不要|不改)/ }
      primary || @input
    end
  end
end
