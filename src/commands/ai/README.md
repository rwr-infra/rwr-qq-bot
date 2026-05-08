# AI 命令

## 用途

使用 OpenAI Compatible API 进行自定义 AI 问答

## 环境变量

-   OPENAI_API_URL: 远程 Agent 基础地址 (如 `https://api.example.com`), 代码自动拼接 `/v1/chat/completions`
-   OPENAI_API_KEY: OpenAI Compatible API 请求 Key, 为 Bearer Token 值
-   OPENAI_TABLE_NAME: 远程 Agent 知识库表名 (可选, 如 vanilla_documents)

## 注册的指令

-   ai: 根据定义的 ai 问题数据查询答案
    > 示例: `#ai 你好`
