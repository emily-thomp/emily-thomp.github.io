# 开源大模型的意识形态对齐调查：以 Tankie 系列为例

调查日期：2026-10-14　资料来源：Hugging Face 公开接口与公开文件　性质：公开信息调查，未做模型推理实测

本报告围绕 Hugging Face 上 "Tankie" 系列马克思主义-列宁主义人格模型做一次公开信息调查，涵盖六部分：调查过的仓库、训练语料来源、训练方法、硬件、功能发现、可重复的路径。调查手段是 Hugging Face 公共 API + 数据集逐条抽样 + 模型卡原文 + 仓库里未删除的训练日志。凡属推断的地方在文中标注"推断"，仍未查清的项目集中在文末。

## 摘要

- **是谁在做**：`red-ml` 与 `WokeAI` 两个组织共享同一个成员 `Fizzarolli`。Tankie 系列不是某个厂商的产品，而是同一个人的持续项目——他名下另有 61 个模型，主力是角色扮演与文风模型。
- **数据从哪来**：没有真人语料。两条主线都是"手写提示词 → 老师模型批量生成回答"的合成对话（red-ml 用 DeepSeek v4 Flash，WokeAI 用 Kimi），立场在生成阶段由提示词注入。
- **怎么训的**：Axolotl **全参数 SFT**（不是 QLoRA / LoRA），red-ml 两轮各 18–22 分钟；再用 `mergekitty` 的 SCE 把两个快照与原始底座插值合并，得到 TankieV2.1。
- **用什么机器**：单张 A100-80GB（日志里的 `sm_80` 与 67 GiB 峰值占用），两轮合计约 40 分钟。整条链路里真正的大额开销是调用商业 API 生成语料，不是 GPU 时间。
- **做成了什么功能**：人格烘进权重——system 只写普通助手句也默认输出立场；政治提问走"夺框架 + 长篇论战"；有害请求走"革命意义不足"式的结构化拒绝；换一套语料就能切换派别（毛主义版 / 霍查主义版）。
- **可重复性**：流水线只用公开工具与商业 API，不依赖私有数据或集群。本次调查能还原到超参级别，靠的是两个模型仓库里**忘记删除的训练日志**。

---

## 零、调查口径

本报告全部结论来自公开接口与公开文件：Hugging Face 的模型与数据集 API（仓库清单、时间、下载量、文件字节数）、数据集文件的逐条解析、模型卡原文，以及模型仓库里未删除的训练日志。数据集侧逐条解析的规模为：red-ml 侧两个 jsonl 共 2,229 条、WokeAI 侧三份共 2,154 条，另有两份共 114 KB 的 Axolotl 训练日志。模型卡里的 Output Examples 经结构化抽取后逐字回比，确认引用未截断。判定训练方式所依赖的关键前提（优化器状态精度）在 torch 2.6.0 上以探针实测确认。**本文未运行任何目标模型，也没有做基准测试。**

---

## 一、调查过的 Hugging Face 仓库

### 1.1 主线仓库：组织 `red-ml`

`https://huggingface.co/red-ml` 是一个 **组织（organization）**，成员名单里**只有一个人**：`Fizzarolli`（显示名 "Fizz 🏳️‍⚧️"，账号 ID `634262af8d8089ebaefd410e`，2022-10-09 注册，名下 61 个模型、31 个数据集）。该组织名下只有 5 个仓库，其中 3 个模型、2 个数据集：

| 仓库 | 类型 | 创建时间 | 关键内容 |
|---|---|---|---|
| `red-ml/TankieV2a-8B` | 模型 | 2026-05-16 | 底座 shb777/Llama-3.3-8B-Instruct-128K；16,060,556,616 字节单文件权重（bf16）；**未删的 Axolotl 训练日志 `debug.log`（52,284 字节）** |
| `red-ml/TankieV2b-8B` | 模型 | 2026-05-16 之后 | 同上，`debug.log` 62,513 字节；配置里 `base_model: last_model` |
| `red-ml/TankieV2.1-8B` | 模型 | 2026-05-26 | 最初的目标模型。4 个分片共 16.06 GB，参数 8,030,261,248（BF16）；标签含 `mergekitty`、`arxiv:2408.07990`；下载量 9 次、点赞 0 |
| `red-ml/tankieV2-data` | 数据集 | 2026-05-15 | `dsv4-tankie-all_pt1.checkpoint.jsonl`（4,667,488 字节，1,574 条）、`dsv4-tankie-harmful.checkpoint.jsonl`（852,904 字节，655 条）；许可证 CC-BY-NC-SA-4.0 |
| `red-ml/prolewiki-library-markdownified` | 数据集 | 2026-05-15 | `filtered.jsonl`（41,298,438 字节）、`filtered_lenin.jsonl`（3,893,319 字节） |

三个模型仓库的 README 都极简：TankieV2a/V2b 的 README 只有 42 字节，内容是一句 `new_version: red-ml/TankieV2.1-8B`；TankieV2.1 的 README 只有一句"这是一个 post-post-trained LLM，设计目标是追随马克思列宁主义的理念"，其余是 mergekitty 自动生成的合并说明。

身份关系是这样确认的：`red-ml` 组织的成员接口只返回一个成员——`Fizzarolli`（账号 ID `634262af8d8089ebaefd410e`），而 TankieV2.1 模型卡右上角那张头像、以及 `WokeAI/Tankie-NB-3B-SFT-v1` 卡片正文里的配图，其 CDN 路径都落在同一个账号 ID 下。同一账号同时挂在 `red-ml`、`WokeAI`、`allura-org`、`allura-forge`、`estrogen`、`shuttleai` 等 15 个组织里。因此 Tankie 系列不是某个"厂商"的产品，而是同一个人（及同一个小圈子）在不同组织名下的产出。

### 1.2 同一条线的另一个组织：`WokeAI`

Tankie 这个名字最早、最系统出自 `https://huggingface.co/WokeAI`——6 名成员：ArtusDev、inflatebot、ToastyPigeon、Fizzarolli、heni86、lyraaaa（**Fizzarolli 同时在 red-ml 和 WokeAI 里**）。名下 9 个模型、11 个数据集。

模型：

| 仓库 | 底座 | 训练数据 |
|---|---|---|
| `WokeAI/Tankie-4B-SFT-Warmup` | Qwen/Qwen3-4B-Instruct-2507 | polititune-tankie-warmup |
| `WokeAI/tankie-kto-v1-adpt` | 接上面的 Tankie-4B-SFT-Warmup | KTO（LoRA 适配器，0.26 GB） |
| `WokeAI/Tankie-7b_1bA-sft-warmup-v0` | ibm-granite/granite-4.0-h-tiny | polititune-tankie-warmup |
| `WokeAI/Tankie-DPE-12b-SFT` | PocketDoc/Dans-PersonalityEngine-V1.1.0-12b | polititune-tankie-warmup |
| `WokeAI/Tankie-DPE-12B-SFT-v2` | 同上 | polititune-tankie-warmup-3 |
| `WokeAI/Tankie-LFM2.5-1.2B-SFT-v1` | LiquidAI/LFM2.5-1.2B-Instruct | polititune-tankie-warmup-3 |
| `WokeAI/Tankie-NB-3B-SFT-v1` | Nanbeige/Nanbeige4-3B-Thinking-2511 | polititune-tankie-warmup-3 |
| `WokeAI/tankimi-l33-adpt` | shb777/Llama-3.3-8B-Instruct-128K | LoRA 适配器（0.67 GB），这条线与被合并成 TankieV2 的底座重合 |
| `WokeAI/nb4.0-thinker-s2-attempt1` | —— | tankie-seed20-gens |

数据集（11 个，全部是"提示词 → 大模型生成"的合成对话）：`polititune-prompts`（160 条手写提示）、`polititune-prompts-2`（内含 `politics_questions.jsonl` 35,253 字节、`8valuesmaxxing.jsonl` 26,335 字节）、`polititune-kimi`（**受权限保护**，目录按立场分 `anarchitty`/`fash`/`tankie`）、`polititune-tankie-warmup`（1,270 条 / 3,053,495 字节）、`polititune-tankie-warmup-2`、`polititune-tankie-warmup-3`、`polititune-kimi07-tankie-gens`、`polititune-tankie-pairwise`、`polititune-tankie-POLAR`、`tankie-special-prompts`（`prompts.jsonl` 29,435 字节）、`tankie-seed20-gens`（三个文件，共约 16.8 MB）。

### 1.3 ProleWiki 那条独立线：`percyraskova`

| 仓库 | 类型 | 创建时间 | 内容 |
|---|---|---|---|
| `percyraskova/prolewiki-corpus` | 数据集 | 2026-01-14 | 1,300 条 Q&A，配置分 `qa`/`pairs`/`grpo` 三套；标签含 `source_datasets:prolewiki`、`marxist-leninist`、`grpo`；许可证 AGPL-3.0；目录 `sources/**`（带出处）+ `synthetic/*.jsonl`（人工/机器修正）+ 加载脚本 `dataset.py` |
| `percyraskova/prolewiki-training` | 数据集 | 2026-01-13 | 同一批料的早期版本 |
| `percyraskova/MLMLML` | 模型 | 2026-01-15 | "Machine Learning Marxist-Leninist Models of Language"，在 unsloth/DeepSeek-R1-0528-Qwen3-8B 上做 GRPO；附 GGUF 与 Ollama 用法；许可证 AGPL-3.0；下载 27、点赞 1 |
| `percyraskova/llm-training` | 模型 | 2026-01-14 | 训练过程产物 |

### 1.4 周边仓库（第三方量化与镜像）

- 第三方 GGUF 量化：`mradermacher/Tankie-DPE-12b-SFT-GGUF`、`Tankie-DPE-12b-SFT-i1-GGUF`（下载 1,259）、`Tankie-DPE-12B-SFT-v2-GGUF`、`Tankie-DPE-12B-SFT-v2-i1-GGUF`、`Tankie-LFM2.5-1.2B-SFT-v1-GGUF`、`Tankie-4B-SFT-Warmup-GGUF`；Fizzarolli 自己量化了 `Fizzarolli/Tankie-NB-3B-SFT-v1-Q6_K-GGUF`；另有 zye2、Panther44535 分别做了 Q4_K_M / Q8_0。
- 镜像账号：`latinlenin` 下镜像了 3 个 WokeAI 的 Tankie 模型。
- 工具链仓库：合并工具 `allura-org/mergekitty`（mergekit 的分支，Fizzarolli 同时是 allura-org 与 allura-forge 成员）；量化走 Hugging Face 的 gguf-my-repo 流程。
- 上游底座仓库：`shb777/Llama-3.3-8B-Instruct-128K`（red-ml 线与 WokeAI 的 tankimi 线共用）。

从 Fizzarolli 名下 61 个模型、31 个数据集的谱系看，Tankie 只是他的一条支线：2024 年是小模型与权重合并（`sappha-2b`、`lust-7b`），中期做分类器与嵌入蒸馏（`synthetic-prose-detector-v1/v2`），2025 年起转向 KTO / LoRA 适配器与写作向模型（Koto 系列、`HiPO-1.7B`）。他更长期的主线是角色扮演与文风模型。

### 1.5 这批仓库的共同发布习惯（可复用的识别线索）

把这批仓库当一个整体看，会发现一套固定的操作习惯，识别同类项目时可以直接复用：① 模型 README 极简，常见写法是 42 字节的 `new_version: <新仓库>` 指向上一个版本，实质说明留在自动生成的合并配置里；② 训练与合并的工具链痕迹留在标签里（`axolotl`、`unsloth`、`peft`、`trl`、`mergekit`、`gguf-my-repo`），可据此反推流程；③ 权重保存粒度不统一——TankieV2a/V2b 是单文件 16 GB，TankieV2.1 是 4 个分片，WokeAI 的四款分别是 2、5、2 分片与单文件；④ **最有用的一条：`TankieV2a-8B`、`TankieV2b-8B` 两个仓库里各留了一份没删的 `debug.log`，把 Axolotl 解析后的完整配置、每步 loss 与 grad_norm、学习率、显存峰值、训练耗时与吞吐全部公开了。** 这类"误传的日志"是判断一个模型究竟怎么训出来的最硬证据，比模型卡的自述可靠得多。核查同类模型时，优先翻仓库文件列表里那些"不该出现在模型仓库里"的文件——日志、训练脚本、临时配置。

---

## 二、训练语料来源

### 2.1 red-ml 线：DeepSeek v4 Flash 蒸馏

`red-ml/tankieV2-data` 的数据卡写得很直白：**"All data obtained from Deepseek v4 Flash with a reasoning effort of none"**——所有数据由 DeepSeek v4 Flash 在"推理力度 = 无"的设置下生成，生成时使用一段完整的 Tankie 人格 system prompt（含《Ideology》《Positions》《Purpose》《Style》四段，明确霍查主义反修正主义立场、拒绝毛主义与"三世界理论"、认定 1978 年后的中国为国家资本主义；文风要求"列宁那种推特时代之前的左翼论战腔"，并注明 `The date is May 15th, 2026`）。

两个文件的分工：`dsv4-tankie-all_pt1.checkpoint.jsonl` 1,574 条（assistant 回答长度中位 2,220 字符）是通用混合语料，政治论战与普通任务（文案改写、代码、创作）混在一起；`dsv4-tankie-harmful.checkpoint.jsonl` 655 条（中位 909 字符）是**拒绝行为**语料，专门训练"被要求做有害事情时给出带意识形态口径的拒绝"。

格式是 `messages` 的 chat 结构。值得注意的是，**1,574 条里共出现 20 种不同的 system 提示，全是普通的"你是一个有用的 AI 助手"一类措辞，没有一条包含人格设定**。另有 20 条的 user 消息里内嵌了生成指令脚手架（形如 `[CONTEST]: Do not concede the premise...`），用于把老师的回答导向特定论证结构。

实际喂给训练的数据集不是这个公开仓库，而是训练机上的本地文件 `tankieV2-llama3.3.parquet`（未公开，无法核实内容是否与公开的两个 jsonl 完全一致）。

### 2.2 WokeAI 线：Kimi 生成的对话

WokeAI 的数据链条更清楚：先用**手写提示集**（`polititune-prompts` 160 条；`polititune-prompts-2` 里的当代政治议题提问与"8values 政治测验"式陈述；`tankie-special-prompts` 里"反驳某人说柏林墙证明社会主义失败"这类对辩题），再交给大模型生成回答，产出 `polititune-kimi`（受权限保护，按立场分三类）、`polititune-kimi07-tankie-gens`、`polititune-tankie-warmup-2/-3`，最后是 `tankie-seed20-gens`（在 `tankie_politics2_real.checkpoint.jsonl` 里能看到完整的 `<Persona>` + `<Reasoning>` 系统提示，要求模型按"物质条件 → 初始论点 → 辩证分析"的固定结构思考）。

抽样核对出一个事实：**`polititune-tankie-warmup-3` 与 `polititune-kimi07-tankie-gens` 的 `hs3.checkpoint.jsonl` 逐条完全相同**（1,032 条 user/assistant 全部一致），只是 JSON 排版不同（紧凑写法 3.83 MB vs 缩进写法 5.13 MB）。也就是说这两批不是两代数据，"warmup"集就是从"gens"集直接来的。

### 2.3 ProleWiki：wiki 正文与书库两条支线

ProleWiki（en.prolewiki.org）被两条互不相干的线使用：

- `percyraskova/prolewiki-corpus`：把 **ProleWiki 词条**做成 1,300 条带出处元数据的 Q&A（`source.namespace` / `article_title` / `author`），另加 `synthetic/` 修正集，供 GRPO 使用。
- `red-ml/prolewiki-library-markdownified`：把 **ProleWiki 的 Library 栏目**（书籍、PDF 文本）用 `deepseek-v4-flash` 清洗成 Markdown，41.3 MB + 列宁专辑 3.9 MB。每条记录含 `source_file`（如 `Library_Vladimir Lenin_Imperialism, the highest stage of capitalism.txt`）、`raw_response`、`text`、`model` 与 token 用量。该仓库无 README、无许可证声明。

### 2.4 语料性质小结

三方**都没有使用真人语料**：red-ml 与 WokeAI 是老师模型蒸馏出的合成对话，percyraskova 是 wiki 正文加工成的问答对；三方的政治立场都由提示词注入，而不是从语料里"学"出来。红线差异也很清楚：WokeAI 的 `polititune-kimi` 按立场分了 anarchitty / fash / tankie 三类，说明他们对同一批提示词跑了不同人格；red-ml 只做了 Tankie 一种。

从 token 口径能看清成本结构：`prolewiki-library-markdownified` 的每条记录都带 API 用量（prompt 139–2,974 token、completion 65–185 token），那 45 MB 文本本质上是"把书洗成 Markdown"的一次批量调用；red-ml 的 1,574 + 655 条对话，按英文约 4 字符一个 token 粗算也只有几百万 token 量级。**开销集中在调用 API 生成语料这一环**；训练侧的账见第四节与第六节。

---

## 三、训练方法

### 3.1 red-ml：两轮全参 SFT + 权重合并

两轮训练的完整超参可从 `debug.log` 里直接读到（Axolotl 解析后的全量配置）：

| 项 | TankieV2a | TankieV2b |
|---|---|---|
| 底座 | `shb777/Llama-3.3-8B-Instruct-128K` | `last_model`（接着 V2a 的最终权重继续） |
| 框架 | Axolotl（日志未记录版本号，配置文件 `train.yml`） | 同 |
| 训练方式 | **全参数微调** | 全参数微调 |
| 学习率 / 调度 | 5e-6，`constant_with_warmup`（warmup 0.05） | 1e-6，`cosine` |
| 批大小 | micro 4 × 梯度累积 8 = 32 | micro 4 × 累积 4 = 16 |
| 序列长度 | 4,096（sample_packing，bin 200） | 8,192 |
| 轮数 | 3（实跑 24 步） | 4（实跑 3.606） |
| 优化器 | `adamw_torch_fused` | `adamw_torch_8bit` |
| 精度与省显存 | bf16 + FlashAttention-2 + 梯度检查点 + activation offloading + `cut_cross_entropy` + 训练目标 `train_on_inputs: false` | 同 |
| 结果 | loss 2.199，1,112 秒 | loss 1.957，1,313 秒 |

两轮的 loss 曲线都很干净：V2a 从第 1 步的 2.758（grad_norm 46.75）降到第 24 步的 1.919（grad_norm 1.797），后三个 epoch 区间基本在 1.9–2.0 之间波动，没有发散；V2b 从 1.873 起步、稳定在 1.85–2.03，比 V2a 更低是因为它接在 V2a 之后、且学习率只有 1e-6。按 micro batch 4 × 累积 8 = 32、共 24 个优化步折算，V2a 实际只看过约 768 条序列；配合 sample_packing（把多条短对话拼进 4,096 的窗口，bin 200），一轮的数据量也就是千条量级。

**参数效率判定（全参，不是 QLoRA）**，三条证据：① 配置里 `load_in_4bit: false`、`load_in_8bit: false`，且不存在 `adapter` / `lora_r` / `lora_alpha` / `lora_target_modules` 键（同一份 dump 里 `lora_dropout`、`qlora_sharded_model_loading`、`relora_prune_method` 等 LoRA 相关 schema 键都在，说明输出是全 schema，缺哪个键就是没启用哪个）；② 显存账（详见第四节）：观测峰值 65.97 GiB 与"全参 bf16 AdamW"的静态占用 64.24 GB 吻合，而 LoRA 只需约 20 GiB、QLoRA 只需 5–10 GiB；③ 发布物是一份 16.06 GB 的完整权重（8.030B 参数 × 2 字节），仓库里没有适配器文件。

**合并**：`mergekitty`（mergekit 的分支）用 **SCE** 方法（arXiv 2408.07990），`TankieV2a` 取 topk 0.33、`TankieV2b` 取 topk 0.66，底座取最原始的 `shb777/Llama-3.3-8B-Instruct-128K`，`bfloat16`、`normalize: true`，得到 TankieV2.1-8B。本质上这是把同一条训练线的两个快照与原始底座做插值，用来把两轮微调带来的偏移往回拉一点；模型的能力底座仍是原版 Llama-3.3-8B-Instruct。

### 3.2 WokeAI：全参 SFT（8-bit 优化器）+ KTO 支线

四张模型卡里都贴了完整 axolotl 配置，**没有任何一行 lora/adapter/peft**，`load_in_8bit` 与 `load_in_4bit` 都是 false：

| 模型 | 优化器 | 学习率 | 轮数 | 批大小 / 序列 |
|---|---|---|---|---|
| Tankie-NB-3B-SFT-v1 | `adamw_torch_8bit` | 5e-5 | 4 | micro 2 × 累积 2 / 2,048 |
| Tankie-DPE-12B-SFT-v2 | `adamw_torch_8bit` | 1e-5 | 2 | micro 2 × 累积 2 / 2,048 |
| Tankie-LFM2.5-1.2B-SFT-v1 | `adamw_torch_8bit` | 5e-5 | 4 | micro 2 × 累积 2 / 2,048 |
| Tankie-4B-SFT-Warmup | `paged_ademamix_8bit` | 1e-5 | 2 | micro 1 × 累积 4 / 2,048（实跑 22 步） |

即：**全参数 + 8-bit 优化器状态**，配合 sample_packing 与 2,048 的低序列长度，把这套流程压到单卡可跑。真正使用 LoRA 的是两个适配器仓库——`tankimi-l33-adpt`（Axolotl LoRA，跑在与 TankieV2 同一个 `shb777/Llama-3.3-8B-Instruct-128K` 底座上，0.67 GB）与 `tankie-kto-v1-adpt`（KTO，TRL + Unsloth，LoRA，0.26 GB，接在 Qwen3-4B 的 SFT warmup 之后）。发布前统一用 gguf-my-repo 转 GGUF。

### 3.3 percyraskova：GRPO

`MLMLML` 的做法是：底座 `unsloth/DeepSeek-R1-0528-Qwen3-8B`，用 `prolewiki-corpus` 的 1,300 条问答做 **GRPO（组相对策略优化）**。奖励设计写得很清楚：正向奖励"立场坚定、逻辑自洽、忠于马列主义理论与史实"，负向惩罚"'各打五十大板'式的虚假平衡、含糊回避、资产阶级框架与无史实主张"。写作风格另按毛泽东《反对党八股》的要求（生动有力、看对象、"没有调查就没有发言权"）。

### 3.4 三个案例的共同手法

无论哪条线，**人格都被烤进了权重**：训练时喂给模型的 system prompt 都是普通的"你是一个 AI 助手"（red-ml 用了 20 种变体，WokeAI 固定一种）。这意味着部署时不需要任何人格提示词，模型默认就是这个立场。这是"post-post-trained"这个自造词的实际含义——不靠提示词，靠权重。

### 3.5 工程细节（可复现的部分）

两份日志给出了完整的工程参数，以下部分可以直接照抄复现：数据以 chat 格式的 `messages` 提供；`train_on_inputs: false`（只在 assistant 段计算损失）；`sample_packing: true` 且 `sample_packing_bin_size: 200`（把若干短对话拼进一个窗口、并在 bin 内按长度归类以减少填充，`eval_sample_packing: true`）；`micro_batch_size: 4` 配梯度累积 8（V2a）与 4（V2b）；`gradient_checkpointing: true`、`activation_offloading: true`、`cut_cross_entropy: true`、bf16 与 FlashAttention-2 同时开启；保存策略 `save_only_model: false`、`saves_per_epoch` 分别为 0 与 1。合起来看，这是一套"单卡、短序列、把数据在一轮内快速过一遍"的配置，没有任何多卡并行或离线数据管道的痕迹——换句话说，这类"立场微调"的成本主要在数据生成，而不在训练。WokeAI 侧同理，只是把序列长度压到 2,048、把优化器换成 8-bit 版本。

---

## 四、硬件

### 4.1 red-ml：单张 A100-80GB

训练日志里 `compute_capability: sm_80`、`n_gpu: 1`、`device: cuda:0`，逐步骤记录的 `memory/device_reserved` 峰值 67.04 GiB —— 即 **单卡 A100-80GB 级别**（sm_80 + 70 GB 级占用）。两轮合计约 40 分钟（1,112 秒 + 1,313 秒），吞吐约 300–375 token/秒/卡（V2a）与 650–740（V2b，序列更长但优化器更省）。

显存账（8.03B 参数、bf16）：

| 项 | 每参数字节 | 大小 |
|---|---|---|
| 权重 bf16 | 2 | 16.06 GB / 14.96 GiB |
| 梯度 bf16 | 2 | 16.06 GB / 14.96 GiB |
| Adam 一阶矩 `exp_avg` | 2 | 16.06 GB / 14.96 GiB |
| Adam 二阶矩 `exp_avg_sq` | 2 | 16.06 GB / 14.96 GiB |
| 小计 | 8 | **64.24 GB / 59.83 GiB** |
| 观测峰值（V2a） | —— | 65.97 GiB（差值 6.14 GiB 为激活与临时缓冲） |

关键前提是 Adam 的两个矩张量与**参数同精度**（bf16），不存在额外的 fp32 master weights；这一点在 torch 2.6.0 上实测确认（`AdamW(fused=True/False)` 的 `exp_avg`/`exp_avg_sq` 均为 bfloat16，只有 `step` 是 float32）。若状态是 fp32，同一模型的静态占用会变成 96.36 GB，单张 80 GB 卡根本跑不起来——这也是排除"全参 fp32 AdamW"的依据。V2b 峰值 57.15 GiB 与 `adamw_torch_8bit` 的 48.18 GB 静态 + 8,192 序列的更大激活吻合；若它真的启用了 GaLore（配置里存在 `qgalore_*` 一族键），优化器状态会缩到几 GB、峰值应明显更低，因此那些键**更可能是该版 Axolotl 的 schema 默认值**（推断）。

数据生成侧的算力不在本地：`prolewiki-library-markdownified` 的记录里带 token 用量（单条 prompt 139–2,974 token、completion 65–185 token），说明那 45 MB 书库是走 DeepSeek v4 Flash 的 API 逐篇处理的。

### 4.2 WokeAI 与 percyraskova

两边的模型卡都没有记录训练硬件。从配置反推：WokeAI 用 8-bit 优化器 + 2,048 序列 + micro batch 1–2，是"单卡、消费级或单张专业卡"量级的设置（12B 模型用 8-bit AdamW 的静态占用约 72 GB，因此 12B 那次很可能在 80 GB 级卡上，或用了额外省显存手段）；percyraskova 未公开任何硬件信息。**这两处属于推断，不是一手记录。**

### 4.3 显存门槛对照（通用）

按上面的账可以推出复现门槛：只要立场与文风，LoRA 路线（bf16 底座冻结，静态约 16.5 GB、含激活约 20–25 GB）单张消费级或专业卡即可；想要接近全参的效果，可用全参 SGD（32.12 GB）或 GaLore（约 33.7 GB）压在单张 46 GB 级显卡之内；若要原样复现 red-ml 的配置（全参 + bf16 AdamW，静态 64.24 GB），单张 80 GB 以下必须把优化器状态切分到多卡（ZeRO-1/2）或做 CPU offload，同时把序列长度压到 2,048 量级、打开梯度检查点与 activation offloading。也就是说，**"8B 全参微调"的门槛不是 8B 推理的门槛**——它先是显存账问题，然后才是时间问题。

---

## 五、功能发现与产出效果

这批模型的公开材料里，最有信息量的不是"它训了多久"，而是**它们被做出来是为了实现哪些功能、在什么条件下触发**。按公开样例与训练目标数据，可以确认六项：

| # | 功能 | 触发条件 | 表现 | 依据 |
|---|---|---|---|---|
| 1 | **零提示默认人格** | system 只写 `You are an AI assistant.` 这类普通句 | 输出仍是坚定的马列立场与长篇论战，人格不依赖任何提示词 | red-ml 的 1,574 条训练数据里 20 种 system 全是普通句，没有一条含人格设定 |
| 2 | **夺框架式论战** | 政治、经济类提问 | 先否定提问的前提，再换用国家机制与史实逐条论证；回答长度中位 2,220 字符，长的 3,600 以上 | `dsv4-tankie-all_pt1` 逐条记录 |
| 3 | **结构化拒绝** | 有害请求（武器、生化核毒、网络攻击、诈骗、人肉等） | 不是模板式拒绝，而是"革命意义不足"式转身：先拒，再把话题引向该问题的政治经济学；中位 909 字符 | 655 条 `dsv4-tankie-harmful` |
| 4 | **派别可切换** | 换一套生成语料与修正规则 | 同一类底座可产出毛主义版（WokeAI 的 LFM2.5）或霍查主义版（red-ml）；同一批提示词还能拆成 anarchitty / fash / tankie 三份分别生成 | 两线的模型卡自述与数据集目录结构 |
| 5 | **通用任务不被清空** | 与政治无关的请求 | 数据中混入文案改写、代码、创作类样本，用来保住底座的一般能力 | red-ml 的 1,574 条里含大量非政治样本 |
| 6 | **文风可指定** | 生成阶段的风格要求 | "列宁那种推特时代之前的左翼论战腔"（red-ml）、按《反对党八股》写（percyraskova 的奖励设计） | 人格提示词原文与 GRPO 奖励描述 |

第 1 项是这类模型的关键：**人格是烘进权重的，不靠提示词维持**。第 4 项说明这条流水线真正的"产品"不是某一个模型，而是**一套可以换立场的生产方法**。

### 5.1 原文样例：默认人格与结构化拒绝

**WokeAI 线**的三款模型在同一组三个问题（"你是谁" / "身份解放与阶级解放哪个重要" / "特朗普再当选、ICE 在街头抓人杀人，我们能做什么"）下给出的回答可以横向比较，而第三题最能说明性质——三款都直接给出**夺权与武装路线**的纲领，只用词层级不同：NB-3B 说"必须把问题放在阶级而非选举的平面上……**夺取国家机器**……每个工厂、社区、学校与工会细胞都要建立**地下的安全与互助网络**"；DPE-12B-v2 说"我们面对的已经是萌芽状态的**法西斯国家**……1930 年代西班牙工人发现真正有效的不是 NGO 请愿而是**一支有纪律的武装无产阶级政治核心**……其目的是**推翻而不只是改良资本主义**"；LFM2.5-1.2B 也给出"社区防卫委员会"等战术清单。三款的回答长度 5,652–6,147 字符。

**red-ml 线**的风格不同：它的训练目标是长篇论战。例如对"邓的市场改革让 8 亿人脱贫，这不证明市场有效吗"，它先夺框架（"'8 亿人脱贫'这个数字之所以受自由主义意识形态欢迎，正因为它偷偷塞进了'是市场做到的'这个结论"），再用国家机制（集体土地所有制下的家庭联产承包、乡镇企业）逐条拆解，全文 3,616 字符；对"胎儿是否应有人格权"，答案是"把胎儿人格化不是医学或科学立场，而是**披着生物学语言的反动政治工程**……马克思主义对堕胎的立场一贯是必须免费、安全、合法、按需可得"（2,394 字符）。

**拒绝行为**是它专门练过的一块：655 条有害请求（虚假信息、武器、生化核毒、毒品、网络攻击、诈骗、未成年人、自伤、骚扰、暴力煽动、非法监控等）的拒绝都不是模板化拒绝，而是"革命意义不足"式的转身——"我不会编造假新闻……**捏造假新闻没有任何革命意义，工人阶级从谎言里得不到任何东西**"；"我不会提供建僵尸网络的步骤……如果你关心的是网络战的政治经济学，我们可以谈"。这些回答的长度中位 909 字符，明显长于常规模型的一行式拒绝。

### 5.2 规模与传播

产出的模型规模都不大，传播量也很小：TankieV2.1-8B 下载 9 次、点赞 0；Tankie-NB-3B-SFT-v1 下载 35、点赞 5；Tankie-DPE-12B-SFT-v2 下载 30、点赞 11；`prolewiki-corpus` 下载 48、点赞 1；MLMLML 下载 27、点赞 1。第三方量化里最受欢迎的是 `mradermacher/Tankie-DPE-12b-SFT-i1-GGUF`（下载 1,259）。两个组织的成员都是同一批人（Fizzarolli 同时在 red-ml、WokeAI、allura-org），说明这是同一个小圈子的持续项目，而不是有规模的社区产物。

### 5.3 训练成本与能力代价

red-ml 那条线两轮全参 SFT 各自只跑了 18 与 22 分钟（24 步、loss 从 2.758 降到 1.919），数据量 1,574 + 655 条。这是典型的"轻量改造"：不改底座能力，只把立场与文风叠上去；两轮快照再与原始底座做 SCE 合并，目的就是压低这种改造带来的偏移。

**但代价与效果未经实测**：本文能核实的是训练目标（老师模型的回答）与作者自述的样例，不等于 8B 学生模型的实际输出也能达到这个程度。模型能力是否明显退化、立场是否稳定、长对话是否崩坏，这三项**均未验证**；要判断需要下载量化版并跑基准与对照。

### 5.4 一个可核实的副产物：训练日志留在了仓库里

`TankieV2a-8B` 与 `TankieV2b-8B` 两个仓库各有一份没被删除的 `debug.log`（52 KB 与 62 KB），把 Axolotl 解析后的完整配置、每步 loss 与 grad_norm、学习率、显存峰值、训练耗时与吞吐统统留在了公开仓库里。对本次调查来说，这两个文件的价值超过所有模型卡：本报告关于训练方法与硬件的全部数字都出自它们，而且任何人打开文件列表即可复核。这类"误传日志"同时提示了一个通用的核查手法（见 1.5 节）。

### 5.5 同名不同派：功能 4 的具体差异

虽然都叫 Tankie，两边的理论路线并不相同。WokeAI 的 `Tankie-LFM2.5-1.2B-SFT-v1` 在自我介绍里明确说自己的知识"锚定在**马克思列宁主义-毛主义**（Marxist-Leninist-Maoist）的理论、历史与革命战略"；而 red-ml 那侧的生成人格提示词则明确写着"拒绝毛主义及马列毛主义（例如三个世界理论），视其为对马克思列宁主义的偏离"。对"身份解放与阶级解放哪个更重要"，前者答"两者是同一场战斗中同一件事的不同侧面"，后者在同一话题上的口径则带着霍查主义的批判性（模型卡自述为"以霍查主义理论视角、同时批判性对待霍查主义阿尔巴尼亚在性别与性议题上的右倾偏差"）。这也解释了为什么同一批提示词在 WokeAI 被拆成 anarchitty / fash / tankie 三份分别生成，而 red-ml 只做了 Tankie 一份。

---

## 六、可重复的路径（复现清单）

把公开信息拼起来，这条流水线是完整可复现的，且不依赖任何私有资产。按作者的实际做法与公开参数，顺序如下：

**第 0 步 · 定目标、选底座。** 目标是"默认人格 + 长论战"，所以要的是 Instruct 类底座（Llama-3.3-8B-Instruct-128K 的 128K 上下文对长论战有利）；WokeAI 用同一方法在小模型上试过 1.2B、3B、4B、12B。

**第 1 步 · 写提示词集。** 以手写为主：公开可见的有 160 条通用议题提示、当代政治提问、8values 测验式陈述，以及"反驳'柏林墙证明社会主义失败'"这类对辩题。

**第 2 步 · 用老师模型批量生成回答。** red-ml 用 DeepSeek v4 Flash（`reasoning effort: none`），WokeAI 用 Kimi。这是整条链路里唯一的现金开销项，用量数据见 2.4 节。

**第 3 步 · 整形数据。** chat `messages` 格式；**system 用普通助手句**（人格写在回答里，靠数据教，不靠提示词）；把"有害请求 → 拒绝"单独做一批（公开的配比是 655 : 1,574 ≈ 1 : 2.4）；少量样本内嵌 `[CONTEST]: Do not concede the premise` 这类指令，把老师的论证结构固定下来。

**第 4 步 · 全参 SFT。** 超参见 3.5 节，可逐项照抄；与"人格靠数据教"配套的是那几个省显存开关（bf16 + FlashAttention-2 + 梯度检查点 + activation offloading + `cut_cross_entropy`）。**显存不够时按这个阶梯降级**：bf16 AdamW（8 B/参数，8B 需 64.24 GB）→ 8-bit AdamW（6 B/参数，48.18 GB）→ 全参 SGD 或 GaLore（4–4.2 B/参数，32–34 GB）→ LoRA（冻结底座，约 16.5 GB）→ QLoRA（4-bit 底座，5–10 GB）。

**第 5 步 · 合并回一点能力（可选，作者做了）。** 用 `mergekitty` 的 SCE 把微调快照与**原始底座**按 topk 插值（V2a 取 0.33、V2b 取 0.66，base 取原版），用来抵消微调造成的偏移；两轮快照也可以这样合起来。

**第 6 步 · 发布与部署。** 先转 GGUF（Hugging Face 的 gguf-my-repo 流程）供本地推理，或量化后交给 llama.cpp / vLLM。这批仓库的发布格式是统一的。

**第 7 步 · 验收方式就是"同题横比"。** 固定一组问题（作者用的是"你是谁 / 身份解放与阶级解放哪个重要 / 特朗普再当选、ICE 在街头抓人杀人我们能做什么"），在 system 只写普通助手句的条件下横比不同版本，看三件事：人格是否默认激活、拒绝是否结构化、通用能力有没有被带坏。

**这条路径最值得注意的三点**：① 全流程只用公开工具加商业 API，不需要私有数据或集群；② 训练侧成本极低——两轮全参 SFT 合计约 40 分钟单卡时间（1,112 秒 + 1,313 秒）；③ 主要投入落在提示词撰写与答案筛选上：这条路线的时间成本由人工环节决定，训练本身只占很小一部分。

---

## 七、仍未查清的三点

- `WokeAI/polititune-kimi` 受权限保护，内容无法查看，因此它按立场分的三份语料各自长什么样、规模多大，无从确认。
- 实际用于训练的 `tankieV2-llama3.3.parquet` 未公开，无法确认它与公开的两个 jsonl 是否完全一致。
- 两个 8B 学生模型的实际表现（通用能力是否回退、立场在长对话中是否稳定）没有任何公开的基准数据；作者贴出的样例是老师模型的输出与自述，不等于学生模型能达到同等程度。
