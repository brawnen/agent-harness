# frozen_string_literal: true

require "yaml"

module HarnessCLI
  class Config
    attr_reader :project_name, :default_mode, :allowed_paths, :protected_paths, :risk_rules, :path

    def initialize(project_name:, default_mode:, allowed_paths:, protected_paths:, risk_rules:, path:)
      @project_name = project_name
      @default_mode = default_mode
      @allowed_paths = Array(allowed_paths)
      @protected_paths = Array(protected_paths)
      @risk_rules = risk_rules || {}
      @path = path
    end

    def self.load(path)
      raise HarnessCLI::Error, "找不到配置文件: #{path}" unless File.exist?(path)

      data = YAML.load_file(path) || {}
      new(
        project_name: data["project_name"] || File.basename(File.dirname(path)),
        default_mode: data["default_mode"] || "delivery",
        allowed_paths: data["allowed_paths"] || [],
        protected_paths: data["protected_paths"] || [],
        risk_rules: data["risk_rules"] || {},
        path: path
      )
    rescue Psych::SyntaxError => e
      raise HarnessCLI::Error, "配置文件解析失败: #{e.message}"
    end
  end
end
