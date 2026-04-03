# frozen_string_literal: true

require "json"
require "time"
require "fileutils"

module HarnessCLI
  class Report
    SCHEMA_VERSION = "0.2"

    def initialize(state:, audit:, reports_dir:)
      @state = state
      @audit = audit
      @reports_dir = reports_dir
    end

    # 生成任务完成报告
    def generate(task_id, conclusion:, actual_scope: nil, scope_deviation: nil, remaining_risks: [], next_steps: [])
      task_state = @state.get(task_id)
      raise HarnessCLI::Error, "任务不存在: #{task_id}" unless task_state

      contract = task_state["confirmed_contract"] || {}
      draft = task_state["task_draft"] || {}
      evidence = task_state["evidence"] || []
      audit_entries = @audit.read(task_id: task_id)

      intent = contract["intent"] || draft["intent"] || "unknown"
      actual_scope ||= contract["scope"] || draft["scope"] || []

      # 构建 evidence_summary
      evidence_summary = evidence.map do |e|
        entry = { "type" => e["type"], "result" => e["content"] }
        entry["passed"] = e["passed"] unless e["passed"].nil?
        entry
      end

      # 提取 override 摘要
      overrides = audit_entries
        .select { |e| e["event_type"] == "force_override" }
        .map { |e| e["description"] }

      report = {
        "schema_version" => SCHEMA_VERSION,
        "task_id" => task_id,
        "intent" => intent,
        "conclusion" => conclusion,
        "actual_scope" => Array(actual_scope),
        "scope_deviation" => scope_deviation,
        "evidence_summary" => evidence_summary,
        "remaining_risks" => Array(remaining_risks),
        "overrides_used" => overrides,
        "next_steps" => Array(next_steps),
        "completed_at" => Time.now.iso8601
      }

      # 落盘
      FileUtils.mkdir_p(@reports_dir)
      path = File.join(@reports_dir, "#{task_id}.json")
      File.write(path, JSON.pretty_generate(report))

      report
    end

    # 读取已有报告
    def read(task_id)
      path = File.join(@reports_dir, "#{task_id}.json")
      return nil unless File.exist?(path)

      JSON.parse(File.read(path))
    end
  end
end
