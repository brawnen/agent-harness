# frozen_string_literal: true

require "json"
require "time"
require "fileutils"
require "securerandom"

module HarnessCLI
  class State
    SCHEMA_VERSION = "0.2"

    VALID_PHASES = %w[intake clarify plan execute verify report close].freeze
    VALID_STATES = %w[
      draft needs_clarification planned in_progress blocked verifying done failed suspended
    ].freeze

    # §7.2 合法状态迁移表
    VALID_TRANSITIONS = {
      "draft"                => %w[needs_clarification planned failed suspended],
      "needs_clarification"  => %w[draft planned failed suspended],
      "planned"              => %w[in_progress needs_clarification suspended],
      "in_progress"          => %w[blocked verifying failed suspended],
      "blocked"              => %w[in_progress needs_clarification failed suspended],
      "verifying"            => %w[done failed in_progress suspended],
      "done"                 => %w[],
      "failed"               => %w[draft],
      "suspended"            => %w[draft needs_clarification planned in_progress blocked verifying]
    }.freeze

    def initialize(state_dir:, audit: nil)
      @state_dir = state_dir
      @tasks_dir = File.join(state_dir, "tasks")
      @audit = audit
    end

    # 初始化一个新任务的 state，从 intake 结果创建
    def init(task_draft:, task_id: nil)
      task_id ||= generate_task_id(task_draft)
      now = Time.now.iso8601

      state = {
        "schema_version" => SCHEMA_VERSION,
        "task_id" => task_id,
        "current_phase" => "intake",
        "current_state" => task_draft.dig("derived", "state") || "draft",
        "task_draft" => task_draft,
        "confirmed_contract" => nil,
        "evidence" => [],
        "open_questions" => Array(task_draft["open_questions"]),
        "override_history" => [],
        "created_at" => now,
        "updated_at" => now
      }

      persist(task_id, state)
      update_index(task_id, state, set_active: true)
      state
    end

    # 读取任务状态
    def get(task_id)
      path = task_path(task_id)
      return nil unless File.exist?(path)

      data = JSON.parse(File.read(path))
      validate_schema_version!(data)
      data
    end

    # 更新任务状态的部分字段
    def update(task_id, changes)
      state = get(task_id)
      raise HarnessCLI::Error, "任务不存在: #{task_id}" unless state

      validate_phase!(changes["current_phase"]) if changes.key?("current_phase")
      if changes.key?("current_state")
        validate_state!(changes["current_state"])
        validate_transition!(state["current_state"], changes["current_state"])
      end

      changes.each do |key, value|
        case key
        when "evidence"
          # evidence 追加而不是替换
          state["evidence"].concat(Array(value))
        when "open_questions"
          state["open_questions"] = Array(value)
        when "override_history"
          state["override_history"].concat(Array(value))
        else
          state[key] = value
        end
      end

      state["updated_at"] = Time.now.iso8601
      persist(task_id, state)
      update_index(task_id, state)
      state
    end

    # 生成 confirmed_contract 并推进状态
    def close_contract(task_id)
      state = get(task_id)
      raise HarnessCLI::Error, "任务不存在: #{task_id}" unless state

      draft = state["task_draft"]
      contract = {
        "id" => task_id,
        "intent" => draft["intent"],
        "goal" => draft["goal"],
        "scope" => draft["scope"],
        "acceptance" => draft["acceptance"],
        "constraints" => draft["constraints"],
        "context_refs" => draft["context_refs"],
        "mode" => draft["mode"],
        "risk_level" => draft.dig("derived", "risk_level") || "medium",
        "evidence_required" => derive_evidence_required(draft["intent"])
      }

      update(task_id, {
        "confirmed_contract" => contract,
        "current_phase" => "plan",
        "current_state" => "planned"
      })
    end

    # 挂起任务
    def suspend(task_id)
      update(task_id, { "current_state" => "suspended" })
      # 从 active 中移除
      index = load_index
      index["active_task_id"] = nil if index["active_task_id"] == task_id
      save_index(index)
    end

    # 恢复任务
    def restore(task_id)
      state = get(task_id)
      raise HarnessCLI::Error, "任务不存在: #{task_id}" unless state

      # 将当前活跃任务挂起
      index = load_index
      if index["active_task_id"] && index["active_task_id"] != task_id
        current_active = get(index["active_task_id"])
        if current_active && !%w[done failed].include?(current_active["current_state"])
          suspend(index["active_task_id"])
        end
      end

      # 恢复此任务为活跃
      if state["current_state"] == "suspended"
        # 恢复到挂起前应有的状态，简单处理：回到 draft
        update(task_id, { "current_state" => "draft" }) if state["current_state"] == "suspended"
      end

      index = load_index
      index["active_task_id"] = task_id
      save_index(index)
      get(task_id)
    end

    # 获取当前活跃任务
    def active_task
      index = load_index
      return nil unless index["active_task_id"]

      get(index["active_task_id"])
    end

    # 获取所有任务索引
    def list
      load_index
    end

    # 落盘
    def persist(task_id, state)
      FileUtils.mkdir_p(@tasks_dir)
      path = task_path(task_id)
      File.write(path, JSON.pretty_generate(state))
    end

    private

    def task_path(task_id)
      File.join(@tasks_dir, "#{task_id}.json")
    end

    def generate_task_id(task_draft)
      intent = task_draft["intent"] || "task"
      # 从 goal 提取简短关键词
      goal = (task_draft["goal"] || "").gsub(/[^a-zA-Z0-9\u4e00-\u9fff]/, " ").split.first(3).join("-")
      slug = goal.empty? ? "unnamed" : goal.downcase.gsub(/[^a-z0-9\-]/, "")
      slug = "unnamed" if slug.empty?
      short_id = SecureRandom.hex(3)
      "#{intent}-#{slug}-#{short_id}"
    end

    def derive_evidence_required(intent)
      case intent
      when "bug"
        %w[command_result test_result]
      when "feature"
        %w[command_result]
      when "refactor"
        %w[test_result]
      when "explore"
        %w[reasoning_note]
      when "prototype"
        %w[reasoning_note]
      else
        %w[reasoning_note]
      end
    end

    def load_index
      FileUtils.mkdir_p(@state_dir)
      path = index_path
      return default_index unless File.exist?(path)

      data = JSON.parse(File.read(path))
      validate_index_version!(data)
      data
    rescue JSON::ParserError
      default_index
    end

    def save_index(index)
      FileUtils.mkdir_p(@state_dir)
      index["schema_version"] = SCHEMA_VERSION
      File.write(index_path, JSON.pretty_generate(index))
    end

    def update_index(task_id, state, set_active: false)
      index = load_index
      entry = {
        "task_id" => task_id,
        "intent" => state.dig("task_draft", "intent") || state.dig("confirmed_contract", "intent") || "unknown",
        "goal_summary" => state.dig("task_draft", "goal") || state.dig("confirmed_contract", "goal") || "",
        "current_state" => state["current_state"],
        "updated_at" => state["updated_at"]
      }

      existing_idx = index["tasks"].index { |t| t["task_id"] == task_id }
      if existing_idx
        index["tasks"][existing_idx] = entry
      else
        index["tasks"] << entry
      end

      index["active_task_id"] = task_id if set_active
      save_index(index)
    end

    def index_path
      File.join(@state_dir, "index.json")
    end

    def default_index
      { "schema_version" => SCHEMA_VERSION, "active_task_id" => nil, "tasks" => [] }
    end

    # §12.5 版本不匹配时丢弃旧 state + 写 audit_log(state_recovery) + 返回 nil
    def validate_schema_version!(data)
      version = data["schema_version"]
      return if version == SCHEMA_VERSION

      task_id = data["task_id"] || "unknown"
      phase = data["current_phase"] || "intake"

      # 写审计日志
      if @audit
        @audit.append(
          task_id: task_id,
          event_type: "state_recovery",
          phase: phase,
          signal: "block_execution",
          description: "State schema 版本不匹配（文件: #{version}，当前: #{SCHEMA_VERSION}），旧状态已丢弃",
          risk_at_time: "unknown"
        )
      end

      # 删除旧状态文件
      path = task_path(task_id)
      File.delete(path) if File.exist?(path)

      # 从 index 中移除
      index = load_index
      index["tasks"].reject! { |t| t["task_id"] == task_id }
      index["active_task_id"] = nil if index["active_task_id"] == task_id
      save_index(index)

      warn "发现旧版本任务状态（v#{version}），已重置，请重新描述任务"
      raise HarnessCLI::Error, "State schema 版本不匹配（v#{version} → v#{SCHEMA_VERSION}），旧状态已丢弃并记录审计日志，请重新 intake"
    end

    def validate_index_version!(data)
      version = data["schema_version"]
      return if version == SCHEMA_VERSION

      # index 版本不匹配时静默重建
      warn "State index 版本不匹配（#{version}），已重建"
    end

    def validate_phase!(phase)
      return if phase.nil?
      return if VALID_PHASES.include?(phase)

      raise HarnessCLI::Error, "无效的 phase: #{phase}"
    end

    def validate_state!(state)
      return if state.nil?
      return if VALID_STATES.include?(state)

      raise HarnessCLI::Error, "无效的 state: #{state}"
    end

    def validate_transition!(from, to)
      return if from == to # 同状态不算迁移

      allowed = VALID_TRANSITIONS[from]
      return if allowed && allowed.include?(to)

      raise HarnessCLI::Error,
            "非法状态迁移: #{from} -> #{to}。#{from} 允许迁移到: #{(allowed || []).join(', ')}"
    end
  end
end
