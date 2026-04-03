# frozen_string_literal: true

require "json"
require "optparse"
require "yaml"

require_relative "harness_cli/config"
require_relative "harness_cli/intake"
require_relative "harness_cli/state"
require_relative "harness_cli/audit"
require_relative "harness_cli/gate"
require_relative "harness_cli/verify"
require_relative "harness_cli/report"

module HarnessCLI
  class Error < StandardError; end

  # 默认目录约定
  STATE_DIR = "harness/state"
  AUDIT_DIR = "harness/audit"
  REPORTS_DIR = "harness/reports"

  module_function

  def run(argv)
    command = argv.shift
    subcommand = argv.shift

    case command
    when "task"
      run_task(subcommand, argv)
    when "state"
      run_state(subcommand, argv)
    when "gate"
      run_gate(subcommand, argv)
    else
      raise Error, "未知命令: #{command}。可用命令: task, state, gate"
    end
  rescue Error => e
    warn e.message
    1
  rescue StandardError => e
    warn "CLI 执行失败: #{e.message}"
    1
  end

  # ── task 子命令 ──────────────────────────────

  def run_task(subcommand, argv)
    case subcommand
    when "intake"
      run_task_intake(argv)
    when "verify"
      run_task_verify(argv)
    when "report"
      run_task_report(argv)
    else
      raise Error, "未知 task 子命令: #{subcommand}。可用: intake, verify, report"
    end
  end

  def run_task_intake(argv)
    options, remaining = parse_intake_options(argv)
    input = remaining.join(" ").strip
    raise Error, "缺少自然语言输入" if input.empty?

    config_path = File.expand_path(options[:project] || "harness.yaml", Dir.pwd)
    config = HarnessCLI::Config.load(config_path)

    result = HarnessCLI::Intake.new(
      input: input,
      config: config,
      context_refs: options[:context_refs]
    ).call

    # 自动持久化 state
    if options[:persist]
      state_manager = build_state_manager
      task_state = state_manager.init(task_draft: result["task_draft"])
      result["task_id"] = task_state["task_id"]
      result["state_persisted"] = true
    end

    render_output(result, options[:format])
    0
  end

  def run_task_verify(argv)
    options = parse_task_id_options(argv)
    task_id = resolve_task_id(options[:task_id])

    state_manager = build_state_manager
    verifier = Verify.new(state: state_manager)
    result = verifier.check(task_id)

    render_output(result, options[:format])
    result[:allowed] ? 0 : 1
  end

  def run_task_report(argv)
    options = parse_report_options(argv)
    task_id = resolve_task_id(options[:task_id])

    state_manager = build_state_manager
    audit_manager = Audit.new(audit_dir: AUDIT_DIR)
    reporter = Report.new(state: state_manager, audit: audit_manager, reports_dir: REPORTS_DIR)

    result = reporter.generate(
      task_id,
      conclusion: options[:conclusion],
      remaining_risks: options[:remaining_risks],
      next_steps: options[:next_steps]
    )

    # 更新任务状态为 done
    state_manager.update(task_id, {
      "current_phase" => "close",
      "current_state" => "done"
    })

    render_output(result, options[:format])
    0
  end

  # ── state 子命令 ──────────────────────────────

  def run_state(subcommand, argv)
    case subcommand
    when "init"
      run_state_init(argv)
    when "get"
      run_state_get(argv)
    when "update"
      run_state_update(argv)
    when "restore"
      run_state_restore(argv)
    when "list"
      run_state_list(argv)
    when "active"
      run_state_active(argv)
    when "close-contract"
      run_state_close_contract(argv)
    else
      raise Error, "未知 state 子命令: #{subcommand}。可用: init, get, update, restore, list, active, close-contract"
    end
  end

  def run_state_init(argv)
    options = {}
    parser = OptionParser.new do |opts|
      opts.on("--draft JSON", "Task draft JSON 字符串") { |v| options[:draft] = v }
      opts.on("--draft-file PATH", "Task draft JSON 文件路径") { |v| options[:draft_file] = v }
      opts.on("--task-id ID", "指定 task_id（可选）") { |v| options[:task_id] = v }
      opts.on("--format FORMAT", %w[json yaml], "输出格式") { |v| options[:format] = v }
    end
    parser.parse(argv)

    draft = if options[:draft]
              JSON.parse(options[:draft])
            elsif options[:draft_file]
              JSON.parse(File.read(options[:draft_file]))
            else
              raise Error, "需要 --draft 或 --draft-file 参数"
            end

    state_manager = build_state_manager
    result = state_manager.init(task_draft: draft, task_id: options[:task_id])
    render_output(result, options[:format] || "json")
    0
  end

  def run_state_get(argv)
    options = parse_task_id_options(argv)
    task_id = resolve_task_id(options[:task_id])

    state_manager = build_state_manager
    result = state_manager.get(task_id)
    raise Error, "任务不存在: #{task_id}" unless result

    render_output(result, options[:format])
    0
  end

  def run_state_update(argv)
    options = {}
    parser = OptionParser.new do |opts|
      opts.on("--task-id ID", "任务 ID") { |v| options[:task_id] = v }
      opts.on("--tool TOOL", "工具名称") { |v| options[:tool] = v }
      opts.on("--exit-code CODE", Integer, "工具退出码") { |v| options[:exit_code] = v }
      opts.on("--phase PHASE", "更新 phase") { |v| options[:phase] = v }
      opts.on("--state STATE", "更新 state") { |v| options[:state] = v }
      opts.on("--evidence JSON", "追加 evidence（JSON）") { |v| options[:evidence] = v }
      opts.on("--format FORMAT", %w[json yaml], "输出格式") { |v| options[:format] = v }
    end
    parser.parse(argv)

    task_id = resolve_task_id(options[:task_id])
    changes = {}
    changes["current_phase"] = options[:phase] if options[:phase]
    changes["current_state"] = options[:state] if options[:state]

    if options[:evidence]
      changes["evidence"] = [JSON.parse(options[:evidence])]
    elsif options[:tool]
      # PostToolUse 场景：自动生成 evidence
      changes["evidence"] = [{
        "type" => "command_result",
        "content" => "Tool: #{options[:tool]}",
        "exit_code" => options[:exit_code] || 0,
        "timestamp" => Time.now.iso8601
      }]
    end

    state_manager = build_state_manager
    result = state_manager.update(task_id, changes)
    render_output(result, options[:format] || "json")
    0
  end

  def run_state_restore(argv)
    options = parse_task_id_options(argv)
    task_id = options[:task_id]
    raise Error, "需要 --task-id 参数" unless task_id

    state_manager = build_state_manager
    result = state_manager.restore(task_id)
    render_output(result, options[:format])
    0
  end

  def run_state_list(_argv)
    state_manager = build_state_manager
    result = state_manager.list
    render_output(result, "json")
    0
  end

  def run_state_active(_argv)
    state_manager = build_state_manager
    result = state_manager.active_task
    if result
      render_output(result, "json")
    else
      warn "当前无活跃任务"
    end
    0
  end

  def run_state_close_contract(argv)
    options = parse_task_id_options(argv)
    task_id = resolve_task_id(options[:task_id])

    state_manager = build_state_manager
    result = state_manager.close_contract(task_id)
    render_output(result, options[:format])
    0
  end

  # ── gate 子命令 ──────────────────────────────

  def run_gate(subcommand, argv)
    case subcommand
    when "before-tool"
      run_gate_before_tool(argv)
    else
      raise Error, "未知 gate 子命令: #{subcommand}。可用: before-tool"
    end
  end

  def run_gate_before_tool(argv)
    options = {}
    parser = OptionParser.new do |opts|
      opts.on("--tool TOOL", "工具名称") { |v| options[:tool] = v }
      opts.on("--task-id ID", "任务 ID（可选，默认使用 active task）") { |v| options[:task_id] = v }
      opts.on("--file-path PATH", "工具操作的文件路径（可选）") { |v| options[:file_path] = v }
    end
    parser.parse(argv)

    raise Error, "需要 --tool 参数" unless options[:tool]

    task_id = resolve_task_id(options[:task_id])
    config_path = File.expand_path("harness.yaml", Dir.pwd)
    config = File.exist?(config_path) ? Config.load(config_path) : nil

    state_manager = build_state_manager
    audit_manager = Audit.new(audit_dir: AUDIT_DIR)
    gate = Gate.new(state: state_manager, config: config, audit: audit_manager)

    result = gate.before_tool(tool_name: options[:tool], task_id: task_id, file_path: options[:file_path])

    if result[:exit_code] != 0
      warn result[:reason]
    end

    result[:exit_code]
  end

  # ── 通用解析器 ──────────────────────────────

  def parse_intake_options(argv)
    options = {
      format: "json",
      context_refs: [],
      persist: false
    }

    parser = OptionParser.new do |opts|
      opts.on("--project PATH", "指定项目配置文件，默认读取当前目录 harness.yaml") do |value|
        options[:project] = value
      end

      opts.on("--format FORMAT", %w[json yaml], "输出格式，默认 json") do |value|
        options[:format] = value
      end

      opts.on("--context-ref VALUE", "附加上下文引用，可重复传入") do |value|
        options[:context_refs] << value
      end

      opts.on("--persist", "自动持久化 state") do
        options[:persist] = true
      end
    end

    remaining = parser.parse(argv)
    [options, remaining]
  rescue OptionParser::ParseError => e
    raise Error, e.message
  end

  def parse_task_id_options(argv)
    options = { format: "json" }
    parser = OptionParser.new do |opts|
      opts.on("--task-id ID", "任务 ID") { |v| options[:task_id] = v }
      opts.on("--format FORMAT", %w[json yaml], "输出格式") { |v| options[:format] = v }
    end
    parser.parse(argv)
    options
  end

  def parse_report_options(argv)
    options = {
      format: "json",
      remaining_risks: [],
      next_steps: []
    }
    parser = OptionParser.new do |opts|
      opts.on("--task-id ID", "任务 ID") { |v| options[:task_id] = v }
      opts.on("--conclusion TEXT", "任务结论") { |v| options[:conclusion] = v }
      opts.on("--risk TEXT", "剩余风险（可重复）") { |v| options[:remaining_risks] << v }
      opts.on("--next-step TEXT", "下一步建议（可重复）") { |v| options[:next_steps] << v }
      opts.on("--format FORMAT", %w[json yaml], "输出格式") { |v| options[:format] = v }
    end
    parser.parse(argv)
    raise Error, "需要 --conclusion 参数" unless options[:conclusion]
    options
  end

  def build_state_manager
    audit_manager = Audit.new(audit_dir: AUDIT_DIR)
    State.new(state_dir: STATE_DIR, audit: audit_manager)
  end

  def resolve_task_id(task_id)
    return task_id if task_id

    state_manager = build_state_manager
    index = state_manager.list
    active_id = index["active_task_id"]
    raise Error, "未指定 --task-id 且无活跃任务" unless active_id

    active_id
  end

  def render_output(result, format)
    case format
    when "json"
      puts JSON.pretty_generate(result)
    when "yaml"
      puts YAML.dump(result)
    else
      raise Error, "不支持的输出格式: #{format}"
    end
  end
end
