# frozen_string_literal: true

require "json"
require "time"
require "fileutils"

module HarnessCLI
  class Audit
    VALID_EVENT_TYPES = %w[
      force_override gate_violation remediation state_recovery manual_confirmation
    ].freeze

    VALID_PHASES = %w[intake clarify plan execute verify report close].freeze

    VALID_RISK_LEVELS = %w[low medium high unknown].freeze

    def initialize(audit_dir:)
      @audit_dir = audit_dir
    end

    def append(task_id:, event_type:, phase:, signal:, description:, user_input: nil, risk_at_time: "unknown")
      validate_event_type!(event_type)
      validate_phase!(phase)
      validate_risk_level!(risk_at_time)

      entry = {
        "event_type" => event_type,
        "task_id" => task_id,
        "phase" => phase,
        "signal" => signal,
        "description" => description,
        "user_input" => user_input,
        "risk_at_time" => risk_at_time,
        "timestamp" => Time.now.iso8601
      }

      FileUtils.mkdir_p(@audit_dir)
      path = File.join(@audit_dir, "#{task_id}.jsonl")
      File.open(path, "a") { |f| f.puts(JSON.generate(entry)) }

      entry
    end

    def read(task_id:)
      path = File.join(@audit_dir, "#{task_id}.jsonl")
      return [] unless File.exist?(path)

      File.readlines(path).map { |line| JSON.parse(line.strip) }.reject(&:empty?)
    end

    private

    def validate_event_type!(event_type)
      return if VALID_EVENT_TYPES.include?(event_type)

      raise HarnessCLI::Error, "无效的 event_type: #{event_type}，允许值: #{VALID_EVENT_TYPES.join(', ')}"
    end

    def validate_phase!(phase)
      return if VALID_PHASES.include?(phase)

      raise HarnessCLI::Error, "无效的 phase: #{phase}，允许值: #{VALID_PHASES.join(', ')}"
    end

    def validate_risk_level!(risk)
      return if VALID_RISK_LEVELS.include?(risk)

      raise HarnessCLI::Error, "无效的 risk_at_time: #{risk}，允许值: #{VALID_RISK_LEVELS.join(', ')}"
    end
  end
end
