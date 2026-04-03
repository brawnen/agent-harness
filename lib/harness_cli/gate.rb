# frozen_string_literal: true

require "json"

module HarnessCLI
  class Gate
    # 退出码语义（与 Host Adapter Contract §4.3 一致）
    EXIT_ALLOW = 0            # proceed_to_execute
    EXIT_BLOCK = 1            # block_execution
    EXIT_REQUIRE_CONFIRM = 2  # require_confirmation

    WRITE_TOOLS = %w[
      Write Edit Bash NotebookEdit
    ].freeze

    def initialize(state:, config:, audit:)
      @state = state
      @config = config
      @audit = audit
    end

    # before-tool 门禁：确定性信号判断
    # 返回 { exit_code:, signal:, reason: }
    def before_tool(tool_name:, task_id:, file_path: nil)
      task_state = @state.get(task_id)

      # 无状态文件 → 降级允许，写 audit
      unless task_state
        @audit.append(
          task_id: task_id,
          event_type: "gate_violation",
          phase: "execute",
          signal: "block_execution",
          description: "State 文件不存在，降级允许执行",
          risk_at_time: "unknown"
        )
        return allow("State 文件不存在，降级允许")
      end

      current_state = task_state["current_state"]
      current_phase = task_state["current_phase"]

      # 规则 1：needs_clarification 状态下禁止写入工具
      if current_state == "needs_clarification" && write_tool?(tool_name)
        return block(
          task_id: task_id,
          phase: current_phase,
          risk: risk_level(task_state),
          reason: "任务处于 needs_clarification 状态，禁止执行写入操作"
        )
      end

      # 规则 2：draft 状态下禁止写入工具（合同未闭合）
      if current_state == "draft" && write_tool?(tool_name)
        return block(
          task_id: task_id,
          phase: current_phase,
          risk: risk_level(task_state),
          reason: "任务合同未闭合（draft 状态），禁止执行写入操作"
        )
      end

      # 规则 3：blocked / failed / done / suspended 状态下禁止写入工具
      if %w[blocked failed done suspended].include?(current_state) && write_tool?(tool_name)
        return block(
          task_id: task_id,
          phase: current_phase,
          risk: risk_level(task_state),
          reason: "任务处于 #{current_state} 状态，禁止执行写入操作"
        )
      end

      # 规则 4：高风险且未确认 → require_confirmation
      if risk_level(task_state) == "high" && write_tool?(tool_name) && !has_risk_confirmation?(task_state)
        return require_confirmation(
          task_id: task_id,
          phase: current_phase,
          risk: "high",
          reason: "任务命中高风险范围，需要用户确认后继续"
        )
      end

      # 规则 5：protected_paths 检查
      if file_path && @config && write_tool?(tool_name)
        if protected_path?(file_path)
          return block(
            task_id: task_id,
            phase: current_phase,
            risk: risk_level(task_state),
            reason: "目标路径 #{file_path} 命中 protected_paths，禁止写入"
          )
        end
      end

      # 规则 6：scope 越界检查
      if file_path && write_tool?(tool_name)
        scope = task_state.dig("confirmed_contract", "scope") ||
                task_state.dig("task_draft", "scope") || []
        if scope.any? && !within_scope?(file_path, scope)
          return block(
            task_id: task_id,
            phase: current_phase,
            risk: risk_level(task_state),
            reason: "目标路径 #{file_path} 超出任务 scope: #{scope.join(', ')}"
          )
        end
      end

      allow("门禁通过")
    end

    private

    def write_tool?(tool_name)
      WRITE_TOOLS.include?(tool_name)
    end

    def risk_level(task_state)
      task_state.dig("confirmed_contract", "risk_level") ||
        task_state.dig("task_draft", "derived", "risk_level") ||
        "medium"
    end

    def has_risk_confirmation?(task_state)
      task_state["override_history"].any? { |entry| entry["event_type"] == "manual_confirmation" }
    end

    def protected_path?(file_path)
      @config.protected_paths.any? { |pattern| path_match?(file_path, pattern) }
    end

    def within_scope?(file_path, scope)
      # scope 中有非路径描述（如 "repository architecture"）时，不做路径匹配
      path_scopes = scope.select { |s| s.include?("/") || s.include?("*") }
      return true if path_scopes.empty?

      path_scopes.any? { |pattern| path_match?(file_path, pattern) }
    end

    def path_match?(file_path, pattern)
      # 统一为相对路径比较
      relative = file_path.sub(%r{\A\./}, "")
      pattern_clean = pattern.sub(%r{\A\./}, "")
      File.fnmatch?(pattern_clean, relative, File::FNM_PATHNAME | File::FNM_EXTGLOB) ||
        relative.start_with?(pattern_clean.chomp("*").chomp("/"))
    end

    def allow(reason)
      { exit_code: EXIT_ALLOW, signal: "proceed_to_execute", reason: reason }
    end

    def block(task_id:, phase:, risk:, reason:)
      @audit.append(
        task_id: task_id,
        event_type: "gate_violation",
        phase: phase,
        signal: "block_execution",
        description: reason,
        risk_at_time: risk
      )
      { exit_code: EXIT_BLOCK, signal: "block_execution", reason: reason }
    end

    def require_confirmation(task_id:, phase:, risk:, reason:)
      @audit.append(
        task_id: task_id,
        event_type: "gate_violation",
        phase: phase,
        signal: "require_confirmation",
        description: reason,
        risk_at_time: risk
      )
      { exit_code: EXIT_REQUIRE_CONFIRM, signal: "require_confirmation", reason: reason }
    end
  end
end
