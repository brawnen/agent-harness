# frozen_string_literal: true

require "json"

module HarnessCLI
  class Verify
    # 验证矩阵（v0.2 §16）
    VERIFICATION_MATRIX = {
      "bug" => {
        required_types: %w[command_result test_result],
        deterministic: true,
        description: "至少一条命令或测试证明问题不再复现"
      },
      "feature" => {
        required_types: %w[command_result],
        deterministic: true,
        description: "至少一条命令或验证动作证明新能力可运行"
      },
      "refactor" => {
        required_types: %w[test_result],
        deterministic: true,
        description: "至少一条测试证明行为未破坏"
      },
      "explore" => {
        required_types: %w[reasoning_note],
        deterministic: false,
        description: "至少有结论、依据、风险与下一步建议"
      },
      "prototype" => {
        required_types: %w[reasoning_note],
        deterministic: false,
        description: "可无强制验证，但必须明确未验证范围"
      }
    }.freeze

    def initialize(state:)
      @state = state
    end

    # 验证任务是否满足完成条件
    # 返回 { allowed:, signal:, missing_evidence: }
    def check(task_id)
      task_state = @state.get(task_id)
      raise HarnessCLI::Error, "任务不存在: #{task_id}" unless task_state

      intent = task_state.dig("confirmed_contract", "intent") ||
               task_state.dig("task_draft", "intent") ||
               "unknown"

      evidence = task_state["evidence"] || []
      open_questions = task_state["open_questions"] || []

      missing = []

      # 检查 1：是否有未关闭的阻断问题
      unless open_questions.empty?
        missing << "存在未关闭的阻断问题: #{open_questions.first}"
      end

      # 检查 2：按验证矩阵检查 evidence
      matrix = VERIFICATION_MATRIX[intent]
      if matrix
        has_required = matrix[:required_types].any? { |type| evidence.any? { |e| e["type"] == type } }
        unless has_required
          missing << "#{matrix[:description]}（需要: #{matrix[:required_types].join(' 或 ')}）"
        end

        # 确定性判断：检查退出码
        if matrix[:deterministic]
          deterministic_evidence = evidence.select { |e| matrix[:required_types].include?(e["type"]) }
          if deterministic_evidence.any? && deterministic_evidence.all? { |e| e["passed"] == false || e["exit_code"]&.nonzero? }
            missing << "已有验证结果但全部失败"
          end
        end
      else
        missing << "未知的 intent 类型: #{intent}，无法匹配验证矩阵"
      end

      # 检查 3：acceptance 匹配（L2 语义判断，这里只做存在性检查）
      acceptance = task_state.dig("confirmed_contract", "acceptance") ||
                   task_state.dig("task_draft", "acceptance") || []
      if acceptance.empty?
        missing << "未定义 acceptance 标准"
      end

      if missing.empty?
        { allowed: true, signal: "allow_completion", missing_evidence: [] }
      else
        { allowed: false, signal: "block_completion", missing_evidence: missing }
      end
    end
  end
end
