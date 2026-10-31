## Prompt:
2026/10/29 19:01:31

尽量反驳

## 从平台证明到抗克隆：一个离线密钥系统的威胁模型变化

用户最初提出的问题，是如何设计一台专门读取高价值机密数据的离线计算机。

设想中，敏感磁盘区域使用 AES 等对称算法加密，真正的数据加密密钥记作 \(K_D\)。长期秘密或用于解封装 \(K_D\) 的根密钥保存在经过专门编程的 Java Card 中。计算机长期 air-gap，运行固定版本的 Tails OS，并具有 TPM、Secure Boot、Measured Boot、Total Memory Encryption（TME）等能力。如果硬件允许，还可以增加 Intel SGX，将运行时密钥进一步限制在一个硬件保护的 Enclave 中。

这些部件并不是重复提供“更多加密”，而是在解决完全不同的问题。

整个系统最终希望满足的是：

> 磁盘、操作系统甚至整套软件环境可以被复制，但只有原来的物理计算机，在启动指定的 Tails OS、处于批准的平台状态并通过合法人员授权之后，才能获得解密能力；在正常运行期间，还应尽可能减少运行时密钥被复制并带离原设备的可能。

---

## 一、第一层：磁盘加密解决“拿走硬盘也看不到数据”

最底层首先是普通的数据加密。

设磁盘中的秘密数据为 \(M\)，磁盘数据加密密钥为 \(K_D\)：

\[
C=\operatorname{AES}_{K_D}(M)
\]

磁盘中长期保存的是：

\[
C
\]

而不是明文 \(M\)。

这样，即使攻击者：

- 拆走 SSD；
- 完整复制硬盘；
- 对硬盘做镜像；
- 复制整个加密分区；

得到的仍然只是密文。

但这里马上出现一个问题：

> \(K_D\) 放在哪里？

如果直接把 \(K_D\) 写在磁盘上，那么复制磁盘就等于同时复制了钥匙。

因此，真正的系统设计从这里开始。

---

## 二、Java Card：保存“长期授权能力”

Java Card 可以承担长期秘密持有者的角色。

一种简单的设计不是让卡片直接保存整个磁盘的明文，而是保存一个长期密钥：

\[
K_J
\]

磁盘中保存：

\[
W=\operatorname{Wrap}_{K_J}(K_D)
\]

即经过 \(K_J\) 封装的数据密钥。

于是硬盘可以保存：

```text
磁盘
├── 加密后的数据 C
└── 被封装的数据密钥 W
```

而真正能够打开 \(W\) 的秘密 \(K_J\) 存在 Java Card 内。

这样，即使复制整个 SSD：

```text
C + W
```

也没有获得 \(K_J\)。

Java Card 因而承担两个功能。

第一是**长期秘密存储**。

第二是**人员授权**。

例如卡片可以设计：

```text
正常 PIN
    ↓
允许正常授权

胁迫 PIN
    ↓
执行预先定义的紧急策略
```

在威胁模型允许的前提下，胁迫认证可以触发卡片内部销毁长期密钥材料。关键在于这个判断发生在 Java Card 内部，而不是由 Tails 中的普通程序决定。

这样，即使主机软件被替换，也不能简单地让卡片忽略自己的内部策略。

但是 Java Card 自己仍然不知道：

> “现在插着我的，到底是不是原来的那台电脑？”

因此还需要 TPM。

---

## 三、TPM：回答“是不是原来的机器？”

TPM 是整个抗克隆设计的重要硬件根。

它有两个不同的作用：

1. **Platform Identity：这是哪台机器？**
2. **Platform State：这台机器启动了什么？**

TPM 可以保存硬件绑定、不可轻易迁移的密钥，并支持使用 Attestation Key 对平台测量结果进行证明。TCG 将 TPM 定义为硬件 Root of Trust，可用于设备身份、Measured Boot、PCR、密钥保护和 Attestation。

这非常重要，因为单纯检查 Tails OS 的哈希并不能抗克隆。

例如：

```text
原机器：
Tails image hash = ABC123

克隆机器：
复制同一个 Tails
Tails image hash = ABC123
```

二者的软件完全一样。

因此：

\[
\text{相同软件状态}
\]

不能推出：

\[
\text{相同物理设备}
\]

必须同时验证：

\[
\boxed{
\text{TPM Identity}
+
\text{Platform State}
}
\]

---

## 四、Secure Boot：不符合规则的软件不让它启动

Secure Boot 解决的问题比较直接：

> 启动链中的下一阶段是否具有可信签名？

大体可以理解为：

```text
UEFI
 │
 │ 验证签名
 ▼
Bootloader
 │
 │ 验证签名
 ▼
Kernel / Tails
```

如果某个阶段未经授权，就拒绝继续启动。

它解决的是：

\[
\boxed{\text{阻止未经批准的软件启动}}
\]

TCG 对 Secure Boot 的描述也是每一个启动阶段在执行下一个阶段之前验证其密码学签名。

但 Secure Boot 本身并不能告诉 Java Card：

> “系统到底启动了哪些具体组件？”

所以还需要 Measured Boot。

---

## 五、Measured Boot：把实际启动过程记下来

Measured Boot 和 Secure Boot 是两个不同概念。

Measured Boot 在执行一个组件之前，对其进行哈希，并把测量结果扩展进 TPM 的 PCR。

可以抽象为：

\[
PCR_{n+1}
=
H(PCR_n\parallel H(M_n))
\]

其中 \(M_n\) 是：

- 固件；
- Bootloader；
- Kernel；
- Initramfs；
- 启动配置；

等被测量对象。

最后产生一个与整个启动序列相关的 PCR 状态。

因此：

```text
Approved firmware
       ↓
Approved bootloader
       ↓
Approved Tails kernel
       ↓
Approved configuration
       ↓
PCR = approved state
```

任何重要组件变化，最终 PCR 通常也会改变。

Secure Boot 和 Measured Boot 因而可以简单地区分为：

```text
Secure Boot
    ↓
“没通过验证，不准启动。”

Measured Boot
    ↓
“实际启动了什么，我把它记录下来。”
```

TCG 也明确把 Measured Boot 描述为在执行下一阶段前测量其软件或固件并记录测量值。

---

## 六、Platform Attestation：让 Java Card 相信这份测量

仅仅存在 PCR 还是不够。

因为普通程序完全可以对 Java Card 说：

```text
PCR 正常，一切安全。
```

所以卡片不能相信操作系统自己报告的结果。

正确思路是使用 TPM 的 Attestation。

Java Card 产生随机挑战：

\[
N
\]

发送给 TPM。

TPM 返回类似：

\[
Q=
\operatorname{Sign}_{AK}
(
PCR\parallel N
)
\]

这里 \(AK\) 是 TPM 的 Attestation Key。

Java Card 验证：

1. AK 是否属于预先登记的那台 TPM；
2. 签名是否有效；
3. Nonce \(N\) 是否就是刚刚产生的随机数；
4. PCR 是否属于批准状态。

Nonce 非常重要，因为否则攻击者可以保存以前的一份正常证明，后来无限重放。

因此卡片实际上验证的是：

\[
\boxed{
\text{这是原机器}
\land
\text{这是当前证明}
\land
\text{机器处于批准状态}
}
\]

这才是真正意义上的 Platform Attestation。

---

# 七、Tails OS 在系统中做什么？

Tails 在这里不是硬件安全模块，而是**受测量、受控制的运行环境**。

这套设计并不依靠“Tails 神奇地保护所有东西”，而是把某一个确定版本的 Tails 纳入可信计算基。

理想情况下，可以固定：

```text
UEFI configuration
        ↓
Bootloader
        ↓
Tails image
        ↓
Kernel
        ↓
Initramfs
        ↓
key-management software
```

然后让这些组件成为 Platform Attestation 策略的一部分。

如果系统发生修改：

```text
Tails A
   ↓
PCR_A

Tails B
   ↓
PCR_B
```

Java Card 就可以拒绝释放密钥。

Tails 的另一个价值是减少长期软件状态。它本身围绕临时运行环境设计；Persistent Storage 是可选功能，若使用则需要单独考虑其安全边界。

不过 Tails 官方也明确指出，操作系统不能自行防御已经受到攻击的 BIOS/UEFI 固件，因此这里仍然需要可信固件、物理管理以及 TPM 测量链。

在这个设计里，Tails 的意义可以概括为：

\[
\boxed{\text{提供一个固定、最小化、容易恢复的可信软件环境}}
\]

而 TPM 的意义是证明：

\[
\boxed{\text{现在确实运行的是这个环境}}
\]

---

# 八、为什么还需要 ECDH？

到这里其实已经解决了两个问题：

```text
是不是原来的机器？       → TPM
是不是原来的系统？       → Measured Boot
用户是否被授权？         → Java Card
```

但还有一个问题没有解决：

> Java Card 决定释放密钥以后，怎样把密钥安全地送到运行环境？

最差的方案是：

```text
Java Card
   │
   │ APDU: K_D
   ▼
USB Reader
   ↓
USB Driver
   ↓
Tails
```

即直接把 \(K_D\) 作为明文发出去。

这意味着：

- USB 通信路径；
- 主机驱动；
- 中间缓冲区；

都可能出现密钥副本。

这正是 **ECDH** 可以发挥作用的地方。

这里应该写作 **ECDH：Elliptic-Curve Diffie–Hellman**。

它不是用来加密磁盘的。

它的作用是：

\[
\boxed{\text{建立一次性的受保护密钥传输通道}}
\]

---

## 九、ECDH 的工作过程

假设可信接收端生成临时私钥：

\[
b
\]

对应公钥：

\[
B=bG
\]

Java Card 持有：

\[
a
\]

及：

\[
A=aG
\]

双方分别计算：

\[
Z=aB
\]

和：

\[
Z=bA
\]

结果相同：

\[
Z=abG
\]

再通过 KDF 派生：

\[
K_S=\operatorname{HKDF}(Z,\text{context})
\]

得到临时会话密钥 \(K_S\)。

Java Card 不再直接发送：

\[
K_D
\]

而发送：

\[
C_D=
\operatorname{AEAD}_{K_S}(K_D)
\]

于是 USB 上看到的只是：

```text
加密后的 K_D
```

而不是：

```text
明文 K_D
```

ECDH 因此主要解决：

> **Java Card 到密钥接收端之间的安全通道。**

但 ECDH 本身有一个致命问题：

**它不自动解决身份认证。**

如果攻击者可以替换公钥：

```text
Java Card ←→ Attacker ←→ Receiver
```

就可能形成中间人攻击。

所以必须把 ECDH 公钥与经过证明的接收环境绑定起来。

这就是 SGX 可以出现的地方。

---

# 十、SGX 做什么？

Intel SGX 的核心能力是建立一个叫做 **Enclave** 的受保护执行区域。

Intel 对 SGX 的定义是：Enclave 是应用地址空间中的受保护区域，即使存在高权限恶意软件，也可以提供机密性和完整性；非 Enclave 软件不能直接访问其中的 Enclave 内存。

因此可以把关键代码放进去：

```text
Tails OS
│
├── GUI
├── filesystem
├── USB driver
│
└── SGX Enclave
       │
       ├── ECDH private key b
       ├── session key K_S
       └── disk key K_D
```

于是：

\[
b,\;K_S,\;K_D
\]

都不需要进入普通 Tails 用户空间。

甚至连拥有高权限的软件也不能像读普通进程内存一样直接读取 Enclave 页面。

Intel SGX 同时支持 Attestation，使外部验证者能够确认某个指定的软件确实运行在 Enclave 中，并获得有关该 Enclave 软件身份和平台 TCB 状态的证明。

---

# 十一、SGX + ECDH 为什么适合放在一起？

这两个技术组合起来非常自然。

SGX Enclave 内部首先生成：

\[
(b,B)
\]

其中：

\[
B=bG
\]

然后在 SGX Attestation 中把：

\[
H(B)
\]

与 Enclave 身份绑定。

于是 Java Card 验证的不再只是：

> “有人给了我一个 ECDH 公钥。”

而是：

> “这个 ECDH 公钥属于我认可的 Enclave 代码实例。”

随后 Java Card 与这个公钥执行 ECDH。

结果变成：

```text
Java Card
     │
     │ verify attestation
     ▼
认可的 SGX Enclave
     │
     │ ECDH
     ▼
shared session key
```

然后：

```text
Java Card
        │
        │ AEAD(Ks, KD)
        ▼
SGX Enclave
        │
        └── KD 只在 enclave 内出现
```

这时 ECDH 和 SGX 的职责就非常清楚：

\[
\boxed{
ECDH = 安全地把秘密送过去
}
\]

\[
\boxed{
SGX = 让送过去的秘密待在受保护执行区中
}
\]

而：

\[
\boxed{
Attestation = 确认究竟把秘密送给了谁
}
\]

三者缺一不可。

---

# 十二、TPM Attestation 和 SGX Attestation 不是一回事

这里尤其容易混淆。

TPM 回答：

> **这台机器是谁，以及它启动了什么？**

SGX Attestation 回答：

> **某段特定代码是否真的运行在受 SGX 保护的 Enclave 中？**

所以可能出现两次证明。

第一份证明：

```text
TPM Quote
    ↓
这是登记过的物理机器
    ↓
PCR 正确
    ↓
运行的是批准的 Tails
```

第二份证明：

```text
SGX Quote
    ↓
这是批准的 Enclave
    ↓
运行的是批准的 key-manager code
    ↓
ECDH public key B 属于该实例
```

于是 Java Card 的密钥释放策略可以变成：

\[
\operatorname{Release}(K_D)
\iff
\begin{cases}
\text{TPM identity correct}\\
\text{PCR approved}\\
\text{Tails approved}\\
\text{SGX enclave approved}\\
\text{ECDH endpoint bound to enclave}\\
\text{user authentication approved}
\end{cases}
\]

这里真正困难的一点，是确保 **TPM 所证明的平台和 SGX 所证明的执行环境确实属于同一个受信任设备**。实际实现中需要在设备注册阶段建立并保存这种绑定关系，而不能简单地把两份互不相关的证明拼在一起。

---

# 十三、TME 又做什么？

TME 和 SGX 完全不是同一种技术。

Intel Total Memory Encryption 工作在 CPU 与外部 DRAM 之间。

可以粗略理解为：

```text
CPU
 │
 │ plaintext cache line
 ▼
TME engine
 │
 │ encrypted
 ▼
DRAM
```

CPU 每次启动生成内存加密密钥。

写入 DRAM 时：

\[
M\rightarrow E_{K_{TME}}(M)
\]

读取时：

\[
E_{K_{TME}}(M)\rightarrow M
\]

Intel 明确将 TME 定位为对物理 DRAM、内存总线探测和部分冷启动类攻击的防护；TME 密钥由 CPU 生成且不暴露给软件。它并不防御运行在操作系统中的恶意软件。

因此：

```text
TME
    ↓
防止拆 DIMM / 探测内存总线
```

而不是：

```text
TME
    ↓
防止 kernel 读取 RAM
```

---

# 十四、SGX 和 TME 的区别

可以用一个简单例子理解。

假设：

\[
K_D=\texttt{9F 28 ...}
\]

存在 RAM 中。

### 只有 TME

物理 DRAM 上可能实际保存：

```text
A7 31 F2 88 ...
```

攻击者拆 DIMM 不能直接看到 \(K_D\)。

但是 CPU 正常读取它时：

```text
CPU → 得到 KD
```

所以可信操作系统仍然可以使用它。

### SGX

即使普通 OS 请求：

```text
read(enclave_address)
```

CPU 的 SGX 访问控制也不会把 Enclave 的明文内容正常交给普通 OS。

所以：

\[
\boxed{\text{TME 主要保护 CPU 外部}}
\]

而：

\[
\boxed{\text{SGX 主要建立 CPU 内部的软件隔离边界}}
\]

二者解决不同层面的运行时攻击。

---

# 十五、完整启动流程

于是整套机器可以按照下面的顺序运行。

### 阶段 1：关机

```text
SSD:
    ciphertext
    wrapped DEK

Java Card:
    long-term secret

TPM:
    hardware identity

RAM:
    no DEK
```

这是安全性最高的状态。

---

### 阶段 2：启动

UEFI 执行：

```text
Firmware
   ↓
Bootloader
   ↓
Tails
```

Secure Boot 负责阻止不符合签名策略的启动组件。

Measured Boot 同时把实际启动内容测量进 TPM PCR。

---

### 阶段 3：Platform Attestation

Java Card 发送随机数：

\[
N
\]

TPM 对：

\[
PCR\parallel N
\]

进行证明。

卡片验证：

```text
是不是登记过的 TPM？
        ↓ yes
PCR 是否正确？
        ↓ yes
nonce 是否正确？
        ↓ yes
允许继续
```

这一步主要解决：

\[
\boxed{\text{anti-cloning + platform integrity}}
\]

---

### 阶段 4：启动 SGX key manager

批准的 Tails 启动一个很小的 SGX Enclave。

它生成临时 ECDH：

\[
(b,B)
\]

其中私钥 \(b\) 始终留在 Enclave。

然后生成 SGX Attestation，把当前 Enclave 身份与 \(B\) 绑定。

卡片确认：

> 我现在建立会话的对象确实是批准的 key-manager enclave。

SGX Attestation 的目的正是让验证者确认目标软件确实实例化在受支持的 SGX Enclave 中。

---

### 阶段 5：用户认证

Java Card 要求 PIN。

正常密码：

```text
→ continue
```

胁迫密码：

```text
→ 执行预设紧急策略
```

因此人员认证与平台认证是两个独立条件。

---

### 阶段 6：ECDH

Java Card 与 Enclave：

\[
A=aG
\]

\[
B=bG
\]

计算：

\[
Z=abG
\]

然后：

\[
K_S=\operatorname{HKDF}(Z)
\]

建立一次性安全会话。

---

### 阶段 7：释放磁盘密钥

Java Card 解封装：

\[
K_D
\]

然后发送：

\[
\operatorname{AEAD}_{K_S}(K_D)
\]

USB 上只有密文。

SGX Enclave 收到后：

\[
K_D=
\operatorname{AEAD.Dec}_{K_S}(C)
\]

因此整个路径变成：

```text
             encrypted
Java Card =================> SGX
                              │
                              │ KD
                              ▼
                          enclave only
```

---

# 十六、此时谁保护什么？

可以总结成：

| 部件 | 主要职责 |
|---|---|
| AES / 磁盘加密 | 磁盘被偷后保护数据 |
| Java Card | 长期秘密、人员认证、胁迫策略 |
| TPM | 物理机器身份、Platform Attestation |
| Secure Boot | 阻止未经批准的软件启动 |
| Measured Boot / PCR | 记录实际启动的软件状态 |
| Tails OS | 固定、最小化、可恢复的运行环境 |
| ECDH | 建立 Java Card → 运行环境的一次性安全通道 |
| SGX | 保护运行中的 \(K_D\) 不进入普通 OS 内存 |
| TME | 保护外部 DRAM 和内存总线上的数据 |
| 物理纵深 | 防止运行中的机器突然被直接控制 |

因此它们不是简单叠加：

```text
TPM ≠ SGX
SGX ≠ TME
ECDH ≠ disk encryption
Java Card ≠ TPM
```

每一层恰好补另外一层的缺口。

---

# 十七、SGX 是否一定需要？

不是。

这是整个设计中一个重要的选择。

如果接受假设：

> Tails OS 和 Kernel 始终可信。

那么：

```text
Java Card
   ↓
authenticated ECDH
   ↓
trusted Tails kernel
   ↓
dm-crypt
```

已经可以构成一个合理系统。

这时 SGX 的价值主要是**进一步缩小可信计算基**。

原本需要信任：

```text
整个 Linux Kernel
+ drivers
+ key manager
```

引入 SGX 后，希望把最关键的密钥保护边界缩小成：

```text
一个很小的 enclave
```

因此 SGX 更准确的意义不是：

> “没有 SGX 就不安全。”

而是：

> “即使以后 Tails 中某些高权限组件出了问题，也希望运行时 DEK 仍然不容易直接被读取。”

---

# 十八、真正无法完全消除的问题仍然是运行状态

即使前面所有设计都成立，还有一个根本问题。

只要系统正在使用秘密：

\[
M
\]

某个位置最终必须出现：

\[
\text{plaintext}
\]

如果 Enclave 解密文件后把整个明文交给普通应用：

```text
SGX
 │
 │ plaintext
 ▼
Tails application
```

那么攻击者未必需要偷 \(K_D\)。

直接复制：

\[
M
\]

就可以了。

因此 SGX 只能保护：

\[
\text{key}
\]

以及：

\[
\text{inside-enclave computation}
\]

它不能神奇地保护已经交给外界的明文。

于是系统最终仍然存在：

```text
关机
│
│ 安全
▼
认证
│
▼
解锁
│
│
├────────── 运行时危险窗口 ──────────┤
│
▼
锁定
│
▼
擦除运行状态
│
▼
关机
```

这就是为什么用户最后强调：

> **仍然必须设计足够的物理纵深。**

安全目标不是假定攻击者永远无法接近运行中的机器，而是尽可能做到：

\[
T_{\text{detect+rollback}}
<
T_{\text{physical penetration}}
\]

即异常被发现以后，系统有时间在攻击者真正取得运行设备之前：

```text
停止新的解密
    ↓
关闭敏感文件
    ↓
卸载加密卷
    ↓
销毁 session key
    ↓
销毁 DEK
    ↓
结束 enclave
    ↓
关机
```

TME 的每次启动内存密钥随后失效，RAM 中的状态也不再能够按照正常方式继续使用。Intel 的 TME 设计中，内存加密密钥由处理器在启动时生成，并不暴露给普通软件。

当然，这依然不能撤销攻击者在系统正常运行期间已经成功复制的明文。

---

# 十九、最终可以把整个系统理解成五个问题

第一：

> **磁盘被复制怎么办？**

AES 磁盘加密。

第二：

> **整个系统镜像被复制怎么办？**

TPM 硬件身份绑定。

第三：

> **系统被修改怎么办？**

Secure Boot + Measured Boot + Platform Attestation。

第四：

> **Java Card 把密钥交给假程序怎么办？**

SGX Attestation + authenticated ECDH。

第五：

> **机器正在解锁时被控制怎么办？**

SGX/TME 降低密钥提取能力，而真正的最后一道防线仍然是**物理纵深、异常检测和快速状态回退**。

因此，这个方案真正试图建立的是：

\[
\boxed{
\text{Hardware Identity}
+
\text{Measured State}
+
\text{Human Authorization}
+
\text{Authenticated Key Exchange}
+
\text{Runtime Isolation}
+
\text{Physical Security}
}
\]

而不是简单地“多放几个安全芯片”。

最核心的思想仍然是：

> **密文可以被复制，操作系统甚至可以被复制；真正不能被复制的，是原始物理平台中的硬件身份和长期秘密。只有这些条件与正确的软件状态、人员授权同时满足时，系统才临时产生解密能力。**

而一旦进入运行状态，如何让这种解密能力尽量难以被复制，以及如何在设备即将失去物理控制之前迅速退回安全状态，才是这套系统最困难、也最值得研究的部分。

## Response:
2026/10/29 19:01:32 · gpt-6-thinking

我会按安全审查的方式，尽量找出这篇方案的反例：哪些安全结论不能由所列技术推出，哪些组件实际上接不起来，以及攻击者怎样在不破解密码学的情况下绕过整个设计。我也会核查 Tails、TPM、SGX、TME 的实际限制，区分致命问题和可以修补的工程问题。

> **Evaluating security assumptions**
>
> I’m identifying weaknesses in the proposed architecture, including Java Card capabilities, offline attestation, PIN handling, key wrapping, replay, stale revocation data, and compromises on the original machine.
>
> **Assessing remaining risks**
>
> I’m separating confidentiality from availability and authenticity: TME, SGX, and PIN erasure don’t cover every memory path, coercion scenario, metadata leak, replay, or compromised application. I’m also checking whether authenticated encryption and forward secrecy are actually present.
>
> **Evaluated security assumptions and assessed remaining risks**
>
> 
>
> **Refining the rebuttal**
>
> I’m emphasizing that the design protects against selected theft scenarios, not a malicious host, coercion, replay, peripheral capture, metadata leakage, or authorized-session abuse. I’m also distinguishing measured boot, confidential computation, authenticated storage, and operational response limits.
>
> **Refined the rebuttal**
>
> 
>
> **Testing the architecture**
>
> I’m now stress-testing the strongest remaining assumptions: quote freshness, relay attacks, enclave identity, card portability, secure display and input, offline revocation, recovery, and whether memory encryption protects every data path.
>
> **Examining relay risks**
>
> I’m distinguishing direct cloning from relay attacks: attestation may authenticate the original platform, yet a malicious intermediary could still abuse an authorized decryption oracle unless plaintext release is tightly bound to trusted input, output, and presence.
>
> **Defining trust boundaries**
>
> I’m checking whether “original device” is precise enough: hardware-backed identity, platform replacement, card cloning resistance, secure PIN input, rollback protection, and recovery all depend on assumptions that need explicit mechanisms.
>
> **Tested architecture, examined relay risks, and defined trust boundaries**
>
> 
>
> **Searched 38 websites**
>
> 
>
> Worked for 3m

# 对《从平台证明到抗克隆：一个离线密钥系统的威胁模型变化》的反驳

## 一、总体判断：密码学组件大多正确，但组合后的安全结论并不成立

这篇文章最大的漏洞，不在 AES、ECDH、TPM 或 SGX 的数学原理，而在于它试图从一系列局部安全保证，推导出一个更强的整体安全保证：

> 只有原来的物理计算机，在启动指定的 Tails OS、处于批准的平台状态并通过合法人员授权之后，才能获得解密能力。

**这其实是一个尚未证明的结论。**

文章把以下几个命题隐含地当成了等价关系：

$$
\begin{aligned}
&\text{设备身份可信}\\
&\quad+\text{启动测量可信}\\
&\quad+\text{执行环境可信}\\
&\quad+\text{用户授权可信}\\
&\Longrightarrow \text{数据不会被未授权复制}
\end{aligned}
$$

但最后一个推论不成立。

例如，攻击者完全可能在不窃取密钥、不伪造 TPM 签名、不破解 SGX、不修改 Tails 的情况下，让系统执行一次密码学意义上完全合法的解密操作，再复制解密结果。

更严重的是，**即使设备身份、软件身份和通信通道分别得到验证，也不能自动证明这些身份属于同一台物理设备、同一次运行会话和同一个实际的数据接收端。**

我认为文章有以下主要问题：

| 问题 | 严重性 | 核心原因 |
|--------|--------|--------|
| SGX 与 dm-crypt 的实现不闭合 | 致命 | 普通磁盘加密不能让密钥始终留在 Enclave |
| TPM 与 SGX 证明可以被中继 | 致命 | 证明身份不等于证明物理位置或端点共址 |
| 运行时明文可以被复制 | 致命 | 保护密钥不等于保护数据 |
| 缺少磁盘完整性与防回滚 | 高 | 加密不等于数据未被修改 |
| 启动证明不等于运行时完整性 | 高 | PCR 不能证明此后执行的所有行为 |
| 胁迫密码不能撤销已释放的权限 | 高 | Java Card 不拥有主机上的全部运行状态 |
| Tails 的使用没有充分的必要性论证 | 中高 | 它的设计目标不等于严格封闭的可信执行平台 |
| TME 的物理防护被过度概括 | 中高 | 内存保密不等于完整性、防重放 |
| 物理纵深的时间不等式不可充分保证 | 高 | 检测、响应和擦除都有失败模式 |

下面逐项反驳，并尽量构造能够推翻设计结论的具体反例。

---

## 二、最直接的技术矛盾：SGX 里的密钥究竟怎么交给 dm-crypt？

原文第十、十一、十七节声称，可以让：

$$
K_D\in\text{SGX Enclave}
$$

而不让密钥进入普通 Linux 内存。

但同时又提出利用 Tails 的 `dm-crypt` 读取加密磁盘。

这里存在一个很大的实现缺口。

Linux 的传统 dm-crypt 使用内核加密 API，密钥由内核管理。Linux 官方文档明确描述了这种密钥处理机制。SGX 则主要用于用户态隔离执行，内核不能直接以普通内核函数调用的方式进入 Enclave。[dm-crypt](https://www.kernel.org/doc/html/latest/admin-guide/device-mapper/dm-crypt.html); [27. Software Guard eXtensions (SGX)](https://kernel.org/doc/html/v5.16/x86/sgx.html); [Inline Encryption](https://origin.kernel.org/doc/html/latest/block/inline-encryption.html)

于是，设计实际上必须在以下两种方式中选择：

方案 A：使用传统 dm-crypt

**SGX Enclave（持有 $K_D$）**

输出密钥

**Linux Kernel / dm-crypt**

**解密磁盘**

密钥最终进入普通内核的加密上下文，原文要求的 Enclave 密钥隔离就被破坏了。

---

方案 B：在 SGX 内部完成数据解密

**Linux Kernel（密文 I/O）**

**SGX Enclave（执行 AES）**

**输出明文给应用**

必须自行设计用户态解密、I/O、密钥管理及应用接口；而明文离开 Enclave 后依然暴露。

这不是说 SGX 磁盘加密不可实现。已有 TresorSGX 一类研究尝试把加密操作放在 Enclave 内，并通过内核模块与用户态守护进程通信。但它需要专门的架构，而不是把 SGX 安装到普通 dm-crypt 旁边就能实现。[GitHub - ayeks/TresorSGX: Securing storage encryption by using Intel SGX enclaves. First attempt for the isolation of OS components with trusted enclaves.](https://github.com/ayeks/TresorSGX); [Trusted Systems in Untrusted Environments:](https://open.fau.de/bitstreams/71d1d9a8-9266-4934-90f2-34383285a815/download)

**因此，原文第十七节的缩小可信计算基结论并没有被其给出的实现支持。**

甚至可以进一步反驳：如果最终的可信应用要调用普通文件系统、文本编辑器或 PDF 阅读器，那么 SGX 内部保护的密钥可能根本不是攻击者最值得获取的秘密。攻击者直接读取应用接收到的明文，可能成本更低。

## 三、TPM Attestation 不能证明设备在物理上就是眼前这台机器

原文第六节建立了一个逻辑关系：

$$
\text{AK正确}\land\text{PCR正确}\land\text{Nonce正确}
$$

然后得出：

$$
\text{这是原来的物理机器}
$$

这个推论过强。

TPM Quote 能证明某个 TPM 的私钥参与了签名，也能证明该 TPM 报告的 PCR 状态，但它不能仅凭签名证明 TPM 与当前 Java Card 读卡器在物理上相邻。

这是可信计算领域的经典 **Cuckoo Attack（布谷鸟攻击）**。

反例：TPM 身份验证被中继

**Java Card**

攻击者控制的主机上

**代理主机**

转发挑战和响应

**原机器的真实 TPM**

返回真实、有效、包含随机挑战的 Quote

卡片收到的证明可以完全真实，但卡片没有因此验证本地 USB 端口背后是哪台电脑。

攻击者不必伪造 TPM 签名，只需要让真正的 TPM 替自己签名。

这不是新发现。Bryan Parno 在 2008 年的 [Bootstrapping Trust in a “Trusted” Platform](https://www.usenix.org/legacy/events/hotsec08/tech/full_papers/parno/parno_html/index.html) 中就分析了这类可信平台证明的身份引导问题。

文章也意识到了 TPM 与 SGX 证明需要绑定，但把它概括为注册时保存绑定关系，仍不充分。

即使 Java Card 验证了原机器 TPM 和原机器 SGX 的两份真实证明，攻击者仍可能通过中继让它们参与协议。

这里必须区分两个命题：

$$
\begin{aligned}
P_1 &: \text{密钥只会被送入指定的 Enclave}\\
P_2 &: \text{只有指定物理位置的设备才能提供解密服务}
\end{aligned}
$$

即使 $P_1$ 成立，$P_2$ 仍可能不成立。攻击者可以尝试把真实设备作为远程解密服务使用。

当然，中继本身不会自动使攻击者得到 $K_D$。如果 Enclave 严格限制解密操作及明文输出，中继攻击仍可能失败。

**真正的问题是：系统没有描述如何阻止已经通过认证的原机器被当作解密预言机。**

---

## 四、Measured Boot 证明的是过去，不是现在及未来

原文反复使用：

> TPM 证明现在确实运行的是这个环境。

这也不够准确。

PCR 的测量结果通常描述的是一条启动或测量事件链，而不是计算机每一时刻的完整状态。

例如：

$$
t_0:\quad PCR=P_{\text{approved}}
$$

之后系统启动成功，在 $t_1$ 某个普通应用受到攻击：

$$
t_1:\quad \text{应用已经被劫持}
$$

但是如果这个变化不属于已建立的测量机制：

$$
PCR(t_1)=P_{\text{approved}}
$$

仍然可能成立。

更具体地说，攻击者可能利用批准版本中的运行时漏洞，而不修改任何启动文件。Secure Boot 可以完美工作，Measured Boot 也可以完美工作，但系统仍然遭到利用。

IETF 的 RFC 9683 也明确区分 PCR、Quote、Event Log、信任起点和测量范围。PCR 只能代表实际纳入测量的对象。[RFC 9683: Remote Integrity Verification of Network Devices Containing Trusted Platform Modules](https://www.rfc-editor.org/rfc/rfc9683.html)

### 还有一个循环论证

如果负责测量下一阶段软件的代码本身已经不可信，那么它可能报告与实际执行内容不符的测量值。

所以不能只问：

> PCR 有没有达到批准值？

还必须问：

> 最初的测量根为什么可信？哪些组件实际经过测量？测量能否被绕过？

即使这些问题解决，运行时完整性仍需要另外的机制。

例如 Linux IMA、可执行代码签名、最小权限、只读文件系统以及运行时隔离，但这些也不等于万能的入侵检测。

**反驳结论：启动时平台证明不能替代运行时安全。**

---

## 五、固定 Tails OS 并不一定是一个正确的设计选择

原文称 Tails 是一个固定、最小化、容易恢复的可信环境。

这里应该把三个性质分开。

**第一，Tails 的易恢复性确实有价值。** 它的临时运行方式可以减少跨会话的状态残留。

**第二，固定版本不等于可信。** 固定版本也意味着固定漏洞。系统如果几年不更新，可能会保留已公开、可被利用的内核或应用漏洞。

**第三，Tails 的主要设计目标并不是在离线设备上构造最小可信计算基。** 例如它默认围绕 Tor 网络访问策略设计，而这台机器的要求却是长期 air-gap。[Tails/wiki/src/doc/persistent\_storage/additional\_software.\*.po](https://translate.tails.net/projects/tails/wikisrcdocpersistent_storageadditional_software-po/en/)

这可能带来不必要的软件体积、服务、驱动和复杂性。

而且 Secure Boot 的信任链也不能简单等价于对完整 Tails 镜像的认证。

UEFI Secure Boot 并不天然验证根文件系统每一个块。根文件系统完整性往往需要额外的签名或 dm-verity 等机制。[systemd/docs/ROOTFS\_DISCOVERY.md at main · systemd/systemd](https://github.com/systemd/systemd/blob/main/docs/ROOTFS_DISCOVERY.md); [dm-verity](https://www.kernel.org/doc/html/latest/admin-guide/device-mapper/verity.html)

需要特别说明：**截至 2026 年，不能再简单断言 Tails 不支持 Secure Boot。** Tails 官方维护的文档已经明确提及其 Secure Boot 支持及证书更新问题。[Tails translation platform](https://translate.tails.net/js/zen/tails/wikisrcsupportknown_issuessecure_boot_certificates-po/pt/?q=state%3Aempty)

因此，对原文更有力的反驳不是“Tails 不能用”，而是：

> 为什么选择 Tails，而不是一个只有必要驱动、SGX 运行库、密钥管理器和受控数据阅读器的专用只读 Linux？

如果没有明确的比较，Tails 的使用只是方案选择，不是被论证过的安全优势。

---

## 六、Java Card 真的有能力验证 SGX Attestation 吗？

这是文章严重低估的工程问题。

文章假设 Java Card 可以执行：

$$
\operatorname{Verify}(\text{SGX Quote})
$$

但真实 SGX DCAP 验证远远不止验证一个 ECDSA 签名。

还涉及证书链、PCK、TCB 信息、证书吊销状态、Quote 身份字段、Enclave 身份和安全版本等。

Intel 的 DCAP 验证服务就需要访问或缓存相应的验证材料。[GitHub - intel/SGX-TDX-DCAP-QuoteVerificationService](https://github.com/intel/SGX-TDX-DCAP-QuoteVerificationService); [Trusted Computing Base Recovery Attestation](https://www.intel.com/content/www/us/en/developer/topic-technology/software-security-guidance/trusted-computing-base-recovery-attestation.html)

这里出现三个问题。

### 1\. 卡片资源

普通 Java Card 的 RAM、EEPROM、APDU 通信与支持的密码算法都受到具体型号限制。

Java Card 3.1 虽然定义了包括 ECDH、X25519、证书解析等 API，但一些具体算法与功能属于可选实现，不能根据 Java Card 版本直接推断卡片支持。[Java Card Platform Specification Release Notes, Version 3.1](https://docs.oracle.com/en/java/javacard/3.1/specnotes/index.html)

要求卡片独立完成完整 SGX 证明验证，必须先证明硬件确实能够实现。

### 2\. 离线吊销

机器长期 air-gap，而 SGX 的可信计算基会持续更新。

例如 Intel 的 TCB Recovery 记录中，2026 年 8 月 11 日就有一次公开更新。[Trusted Computing Base Recovery Attestation](https://www.intel.com/content/www/us/en/developer/topic-technology/software-security-guidance/trusted-computing-base-recovery-attestation.html)

这意味着昨天有效的认证材料，未必反映今天最新的安全策略。

如果卡片依赖长期缓存，它必须有可信的时间判断、更新与吊销策略。

否则：

$$
\text{签名数学上有效}
\not\Rightarrow
\text{平台目前仍被信任}
$$

### 3\. 验证者自身可信性

如果把复杂验证工作交给 Tails 普通程序，再让它向卡片报告“SGX 验证通过”，攻击者就可以尝试攻击这个报告接口。

如果让 Java Card 独立完成全部验证，又回到了卡片资源和证书状态管理问题。

这不是完全不能解决，而是原文省略了很大一部分真正决定系统是否安全的协议设计。

**一个特别容易忽略的细节：SGX 的 DEBUG 属性必须独立检查。**

仅检查 `MRENCLAVE` 不够，因为调试模式和生产模式可以有相同的代码测量值，但调试 Enclave 允许特殊调试访问。Intel 的证明字段中专门提供了相应属性。[eat\_profile](https://portal.trustauthority.intel.com/eat_profile.html); [Attestation Tokens and Claims](https://docs.trustauthority.inteltaprd.adsdcsp.com/main/articles/articles/ita/concept-attestation-tokens.html)

---

## 七、SGX 本身也不是不可突破的硬件边界

原文对 SGX 的描述，在架构层面基本正确，但容易给读者留下一个不恰当的印象：

> 只要密钥进入生产模式 Enclave，就几乎不可能被取出。

历史研究已经反驳了这种绝对化理解。

2018 年，Foreshadow 展示了从特定受影响处理器的 SGX 环境提取秘密的攻击，并涉及伪造证明的后果。[Foreshadow: Extracting the Keys to the Intel SGX Kingdom with Transient Out-of-Order Execution](https://www.usenix.org/conference/usenixsecurity18/presentation/bulck)

2021 年的 Frontal Attack 则研究了通过 CPU 前端时序侧信道泄露 SGX 控制流，并从特定密码学代码中提取秘密的可能性。[Frontal Attack: Leaking Control-Flow in SGX via the CPU Frontend](https://www.usenix.org/conference/usenixsecurity21/presentation/puddu)

更值得注意的是，2025 年 10 月公开的 TEE.fail，研究了特定 Intel 服务器平台上通过内存总线观测影响 SGX/TDX 保密与证明安全性的攻击路径。Intel 同期发布了安全公告，并将这些物理攻击界定在其相关保护模型范围之外。[INTEL-2025-10-28-001-TEE.fail](https://www.intel.com/content/www/us/en/security-center/announcement/intel-security-announcement-2025-10-28-001.html); [TEE.fail: Breaking Trusted Execution Environments via DDR5 Memory Bus Interposition](https://tee.fail/)

这不意味着所有 Intel SGX 都已经失效，也不能把历史漏洞直接套用于任意新硬件。

但至少说明：

$$
\text{SGX 保证}
=
f(\text{CPU 型号、微码、补丁、配置、应用代码、攻击能力})
$$

而不是一个与硬件版本无关的常量。

另一个现实问题是：Intel 已在新一代主流 Core 平台上取消或弃用了 SGX 支持，部分 Xeon 等平台则仍提供相关功能。具体采购时必须核查 CPU 型号与固件支持。[Which Intel Platforms Can Be Used to Play Ultra HD Blue-Ray Discs?](https://www.intel.com/content/www/us/en/support/articles/000089271.html); [Where Is a List of Processors That Support Intel® Software Guard...](https://www.intel.com/content/www/us/en/support/articles/000028173.html)

对于一台特别强调长期不变的离线机器，硬件供应、更新与安全寿命也是设计约束。

---

## 八、ECDH 保护的是传输过程，不是密钥生命周期

原文对 ECDH 的数学解释基本正确。

但这一描述：

> 建立一次性的受保护密钥传输通道。

容易掩盖另外两个问题。

首先，ECDH 并不必然实现前向保密。原文让卡片长期使用私钥 $a$，Enclave 生成临时私钥 $b$。

如果攻击者录下历史通信中的 $B=bG$，以后又取得卡片的长期私钥 $a$，就可以重新计算：

$$
Z=aB
$$

并从历史通信恢复会话密钥。

如果追求前向保密，通常需要双方使用临时 ECDH 密钥并进行相应身份认证。

不过，即使采用双方临时密钥，原方案的长期数据密钥 $K_D$ 仍可能被同一个 $K_J$ 重新解封装。因此不能把传输通道前向保密等同于整个磁盘密钥系统的前向保密。

其次，安全通道必须绑定完整协议上下文：会话、双方身份、证明摘要、算法、授权对象和当前挑战。原文简单写成：

$$
K_S=\operatorname{HKDF}(Z,\text{context})
$$

却没有定义 `context` 的内容。

缺少严格的协议绑定与密钥确认，就难以排除会话混淆、认证与密钥交换错配等问题。

**这属于协议尚未定义完整，不是 ECDH 算法本身存在问题。**

---

## 九、整篇文章几乎只关心机密性，忽略了磁盘完整性和防回滚

原文从第一节就设定：

$$
C=\operatorname{AES}_{K_D}(M)
$$

但“AES 加密”不等于数据具有完整性保护。

具体要看工作模式与数据格式。

例如常见的 AES-XTS 磁盘加密主要提供机密性，并不提供对磁盘内容的完整认证。

攻击者即使无法解密数据，也可能替换、破坏或者回滚加密磁盘内容。

更有意思的是回滚攻击。

设原磁盘在不同时间分别保存：

$$
C_1=\operatorname{Enc}_{K_D}(M_1)
$$

$$
C_2=\operatorname{Enc}_{K_D}(M_2)
$$

如果攻击者事先保存了合法的旧镜像 $C_1$，那么以后可能直接将磁盘恢复到旧版本。

这不是破解 AES，而是重放旧状态。

即使采用 AEAD，简单重放一组旧的、仍然有效的密文及认证标签，也不一定被识别为攻击。

因此系统需要考虑数据版本、认证元数据及可信防回滚状态。

这对于存储访问审计、文档版本、授权计数器以及安全策略更新特别重要。

Linux 已提供 dm-verity 等块级完整性方案，dm-crypt 也支持某些带完整性保护的配置，但这些机制需要按数据是否可写、是否需要防回滚进行设计。[dm-verity](https://www.kernel.org/doc/html/latest/admin-guide/device-mapper/verity.html); [dm-crypt](https://docs.kernel.org/admin-guide/device-mapper/dm-crypt.html)

---

## 十、TME 的作用被概括得过于乐观

原文正确指出：TME 不阻止恶意 Kernel 正常读取内存。

但 TME 的保护范围还有更多限定。

Intel 的 TME 使用 AES-XTS 对外部内存提供加密保护，并不天然提供与密码认证协议相同的完整性及防重放保证。Intel 也明确指出，普通 TME 不防御操作系统内恶意软件。[Intel® Total Memory Encryption White Paper](https://www.intel.com/content/dam/www/central-libraries/us/en/documents/white-paper-intel-tme.pdf); [More Information on Encrypted Memory Frameworks](https://www.intel.com/content/www/us/en/developer/articles/news/more-information-encrypted-memory-frameworks.html)

尤其需要注意：

**TME 保护的主要是 CPU 内存控制器管理的外部内存，并非机器所有可能包含数据的硬件。**

例如 GPU 显存、外围设备缓冲区、显示路径和存储设备内部缓存，不能直接假定受到同一个 TME 安全边界保护。

此外，Intel 的 TME 设计允许固件配置部分不加密的物理内存范围。不能在不检查平台配置的情况下断言所有 RAM 都已加密。[Intel® Total Memory Encryption White Paper](https://www.intel.com/content/dam/www/central-libraries/us/en/documents/white-paper-intel-tme.pdf)

所以“断电让 TME 密钥失效”可以是某种加密擦除措施，却不能证明整台计算机所有运行状态均已不可恢复。

---

## 十一、胁迫 PIN 是一个不充分的安全策略

这里必须区分三种行为：

1. 用户尚未解锁，受到胁迫。
2. 用户已经正常解锁，随后受到胁迫。
3. 用户已被迫交出设备、卡片及正常认证能力。

第一种情况下，Java Card 内部的胁迫 PIN 策略可能有用，前提是攻击者不知道正常 PIN，也无法阻止或绕过卡片的擦除行为。

第二种情况下，卡片销毁 $K_J$ 已经不能撤销先前释放的 $K_D$。

即：

$$
\operatorname{Erase}(K_J)
\not\Rightarrow
\operatorname{Erase}(K_D)
$$

如果密钥已在主机中、Enclave 中或其他会话副本中存在，那么卡片的状态变更不自动传播到这些位置。

第三种情况下，攻击者可以要求用户输入正常 PIN 并验证解锁结果。胁迫机制既不能检测用户是否真的出于自由意志，也不能保证攻击者无法观察认证结果。

还有一个很实际的安全问题：**PIN 究竟输入在哪里？**

如果使用 Tails 的普通图形界面输入 PIN，那么恶意主机软件可能直接获取 PIN。卡片内认证并不意味着输入路径可信。

如果使用独立安全 PIN 键盘，则能够降低这一风险，但也新增了硬件和可信交互边界。

所以我不认为双 PIN 设计没有价值。它有价值，但不能当作完整的抗胁迫机制。

---

## 十二、物理纵深与快速回退：原文最后的时间不等式并不充分

原文提出：

$$
T_{\text{detect+rollback}}
<
T_{\text{physical penetration}}
$$

这个想法适用于一些明确的物理入侵模型，但它没有覆盖最重要的运行时威胁。

首先，系统必须能检测攻击。

如果攻击者通过正常认证操作读取了机密文件，机器看到的可能就是合法行为。

其次，攻击者不一定需要先完成物理入侵。

例如在已经授权的会话中，一个有漏洞的普通应用可能成为攻击入口。此时系统虽然仍在原机运行、PCR 仍符合要求，但明文数据可能已经暴露。

最后，“状态回退”不是撤销已经发生的信息泄露。

$$
\operatorname{Rollback}(\text{Device State})
\not\Rightarrow
\operatorname{Rollback}(\text{Attacker Knowledge})
$$

攻击者只需要成功复制一次明文，之后设备的密钥销毁、断电、恢复出厂设置，都不能消除攻击者已经得到的副本。

这与数据库事务回滚有本质区别：数据库可以撤销未提交的内部状态变化，但不能让已观察到某个秘密的人失去记忆。

因此物理纵深需要结合实际威胁来评估。它能够为检测与断电创造时间，却不能单独成为运行时机密性的证明。

---

## 十三、文章还忽略了可信输入输出路径

这是我认为最重要的遗漏之一。

假设所有密钥都被安全存储，Enclave 也正常工作。用户希望阅读一个秘密文档。

最终系统必须执行：

$$
M=\operatorname{Dec}_{K_D}(C)
$$

并把某种可理解的表示显示出来。

普通情况下，显示路径可能涉及文件解析器、字体渲染器、图形服务、GPU 和显示设备。

只要其中某个环节把明文交给攻击者，密码学安全边界就没有阻止数据复制。

假设攻击者不关心 $K_D$，只是想得到文档内容：

**Java Card + TPM + SGX**

全部验证成功

**Enclave 正常解密**

**文档阅读应用**

**显示给用户**

一旦明文进入普通应用或显示路径，必须另行分析该路径中的软件、硬件及物理观察风险。

此时，哪怕 Enclave 中的密钥完全没有泄露，攻击者仍可能通过被攻陷的应用、未经管理的输出设备或者对屏幕的物理拍摄得到数据。

如果把威胁模型扩大到强制合法用户操作设备，那么这甚至不需要任何软件漏洞：攻击者可以强迫用户打开并展示信息。

对于阅读型系统，用户能看到的数据，本质上就无法仅靠硬件密钥保证绝对不可复制。

这是一条信息流安全的限制，而不是 SGX 的某个实现缺陷。

---

## 十四、系统的安全性也没有表现出必要的单调性

原文有一个值得进一步挑战的潜在假设：

> 增加安全部件，会减少系统可利用的漏洞。

但安全部件的增加既可能降低风险，也可能引入新的攻击面。

例如，原本的方案只需要 Java Card 加磁盘加密，后来加入 TPM、SGX Attestation、ECDH、Tails、TME 及复杂的证书验证逻辑。

每加一个组件，就增加相应的代码、固件、配置、接口和维护需求。

其中任何一个协议错误，都有可能把原本简单的磁盘加密系统变成更脆弱的整体。

可以形式化地说：

$$
\text{Protection}(A+B)
\not\geq
\text{Protection}(A)
$$

这里的保护水平不是一个能够简单相加的标量。增加一个子系统可能防御某种攻击，却扩大另一类攻击的可达性。

特别是长期离线设备，越复杂的软件链，越难保证数年后的漏洞修补与证明材料更新。

---

## 十五、一个更根本的问题：系统到底要保证哪一种抗克隆？

原文把“抗克隆”当作一个目标，但实际上至少有四种不同意义。

| 目标 | 该方案能否保证 |
|--------|--------|
| 复制加密 SSD 无法离线解密 | 在密钥保护与密码方案正确时，可以 |
| 复制 Tails 镜像不能冒充原设备身份 | 在身份密钥安全且证明机制正确时，可以 |
| 攻击者不能利用原机器提供远程解密服务 | 不能仅凭现有设计保证 |
| 攻击者无法获得原机器曾经展示的任何明文 | 无法保证 |

前两条是密码学与平台安全比较适合解决的问题。

后两条涉及运行时权限、数据输出及物理控制，比“加密+认证”的问题难得多。

这也解释了为什么安全芯片可以帮助阻止密钥提取，却不能从根本上阻止一个已获授权的实体泄露它读到的数据。

## 十六、如果继续设计，我会怎样修改论证？

我会保留该方案的核心思想，但大幅收缩安全声明。

首先，把安全目标限定为：

> 对关机状态下失窃或被复制的加密存储设备，保证攻击者在没有卡片秘密和必要授权条件时，不能恢复明文。

其次，单独提出运行时目标：

> 在指定硬件、补丁状态和攻击者能力范围内，尽可能减小主机内核与普通应用泄露长期密钥的风险。

然后明确承认：

> 这一设计不保证受胁迫合法用户、被中继的解密服务或已经展示的明文无法被复制。

如果坚持更强的运行时保护，那么必须把数据访问接口一起设计，而不能只设计密钥交付流程。需要回答“谁能请求解密、一次能解密多少、结果交给谁、通过什么可信界面显示，以及在授权撤销后还有哪些输出能力”。

最后，必须制作实际硬件和软件的信任边界图，逐一验证安全断言，而不是依靠多个技术名词相加。

---

## 十七、最终结论

原文不是一篇密码学基础知识错误很多的文章。相反，AES、TPM、Secure Boot、Measured Boot、ECDH、SGX、TME 的基本分工大体合理。

**但作为一个能够抗克隆、抗运行时密钥复制的完整系统设计，它仍然不成立。**

特别有力的反驳可以归结为四点：

**第一，密钥保护链没有闭合。** 如果使用普通 dm-crypt，如何确保 $K_D$ 从不进入普通内核内存？原文没有真正解决。

**第二，证明链没有完成物理绑定。** TPM 与 SGX 的有效证明不能自动证明两个执行实体在同一台物理机器中，也无法天然阻止原设备被中继为解密服务。

**第三，运行时输出没有安全边界。** 如果秘密文件最终要被普通应用阅读，攻击者可能根本不需要提取任何密钥。

**第四，安全恢复不等于信息撤销。** 胁迫 PIN、销毁 $K_J$、终止 Enclave、关机和 TME 密钥失效，都不能消除已经完成的明文复制。

我认为最值得保留的是原文最后提出的**物理纵深和控制权丧失问题**。但还需要更进一步：

$$
\boxed{
\text{密钥不可复制}
\;\not\Rightarrow\;
\text{解密服务不可滥用}
\;\not\Rightarrow\;
\text{明文不可复制}
}
$$

这三个安全目标存在根本区别。

如果它只是为了让失窃硬盘不能被离线破解，那么方案可以大幅简化。如果目标是在攻击者能够控制主机、胁迫用户，甚至短时间拥有整套运行设备的情况下，依旧阻止数据复制，那么当前方案并没有证明这个目标可以实现，而且对普通阅读型计算机而言，其中一些要求本身就存在不可消除的限制。

## Prompt:
2026/10/29 19:09:06

我觉得有点安全虚无主义了，并不是每个人都是国家级ATP目标

## Response:
2026/10/29 19:09:06 · gpt-6-thinking

> **Refining threat models**
>
> You’re right: I overemphasized theoretical defeat conditions. I’ll separate feasible attacks—lost media, theft, casual forensics, skilled local compromise—from out-of-scope coercion or nation-state scenarios, then prioritize integrity, authentication, physical controls, and recoverability.
>
> **Refined threat models**
>
> 
>
> Worked for 13s

我同意。上一次反驳确实有点安全虚无主义了：**我把“存在理论上可行的攻击”过度等同于“这套防御没有实际价值”，没有充分考虑攻击成本、攻击者能力和威胁发生的概率。**

安全工程不是寻找一个绝对不可突破的系统，而是让攻击成本显著高于攻击者愿意投入的资源。

而且，你原本的方案已经设定了几个相当强的安全条件：

- **长期 Air-gap**：不存在常规远程网络攻击路径。
- **固定的 Tails 环境**：减少跨会话持久化和不受控的软件状态。
- **Java Card + TPM**：磁盘副本、卡片秘密和设备身份不能简单互相替代。
- **SGX + TME**：进一步限制部分运行时和物理内存攻击。
- **受控的物理环境**：攻击者不能随意接触正在解锁的机器。
- **异常检测与撤离策略**：尝试在控制权丧失前终止敏感会话。

这不是一台随便联网、装有各种软件的普通 PC。

## 一、应该按照攻击者能力重新评价

| 攻击者 | 典型能力 | 原方案防御效果 |
|--------|--------|--------|
| 普通窃贼 | 偷走 SSD、关机电脑 | 很强 |
| 有一定技术的攻击者 | 复制磁盘、修改启动介质、分析软件 | 强，但依赖具体实现 |
| 专业硬件攻击者 | 拆机、探测总线、研究芯片漏洞 | 有实质防护，不能保证完全抵抗 |
| 有预先部署能力的高级攻击者 | 供应链攻击、固件植入、持续物理接触 | 风险显著提高 |
| 国家级 APT | 高预算、专用设备、长期渗透、人员胁迫 | 没有充分安全保证 |

尤其值得指出：

**原机器被中继成解密预言机的反例，要求攻击者具有与真实机器通信或控制其解密接口的能力。**

如果机器长期离线，且处于受控物理环境，那么这个攻击前提本身就不容易满足。

所以我此前使用 Cuckoo Attack 反驳 TPM 硬件绑定，虽然技术上成立，但没有充分考虑它在当前威胁模型下的可行性。

## 二、实际安全性取决于攻击成本的提升

例如，考虑一个攻击者获得了完整 SSD 镜像的场景。

各道防线如何改变攻击要求

1. **AES 磁盘加密**
   
   攻击者无法直接从磁盘副本恢复明文，需要获取数据密钥或利用实现缺陷。
2. **Java Card**
   
   磁盘副本不包含长期解封装秘密。攻击者还需要卡片、授权或破解卡片保护。
3. **TPM + Measured Boot**
   
   即使拿到卡片和磁盘，攻击者也不能简单通过自己控制的操作系统请求解封装；还需要满足设备身份和启动状态检查。
4. **SGX + 经过认证的 ECDH**
   
   如果正确实现，可以进一步避免将密钥直接交给普通主机软件，迫使攻击者考虑可信执行环境漏洞或明文输出路径。
5. **物理控制与 Air-gap**
   
   即使理论上存在高级攻击技术，攻击者也必须先解决实际接触、部署和维持攻击的问题。

这些保护不是数学上可以简单相加的，但确实能够改变攻击者必须具备的能力。

对于普通窃贼、数据恢复商、恶意软件作者，甚至部分专业攻击者而言，这些限制非常有意义。

## 三、我仍然坚持其中有两个真正值得修正的问题

不是所有批评都应该因为威胁模型收缩而撤销。

**第一，SGX 与 dm-crypt 的接口必须真正设计出来。**

如果宣称密钥始终位于 Enclave，而实际又把密钥送进 Linux Kernel，这确实是一个实现矛盾。这个问题与攻击者是否具有国家级能力无关。

**第二，密钥释放策略必须明确。**

例如卡片检查什么、如何绑定 TPM 和 Enclave 的证明、密钥什么时候存在、什么时候销毁，以及是否允许重复解封装。

这些都是能够通过具体协议和工程设计改善的问题，而不是要求系统抵抗一切攻击。

反过来，我此前关于屏幕可以拍摄、合法人员可以被胁迫、SGX 存在历史侧信道漏洞的批评，主要应该被归类为**安全边界说明**，不应该被当成否定设计的理由。

## 四、我认为合理的验收标准应该改变

不必要求：

$$
P(\text{数据泄露})=0
$$

而应该要求在明确的攻击者模型 $A$ 下：

$$
P(\text{攻击成功}\mid A,\text{防御条件})
$$

足够低，或者攻击者完成攻击所需的成本、时间和资源足够高。

这里甚至不必强行给出一个没有实验依据的成功概率。可以用攻击树和实际测试证明：攻击者必须突破哪些独立防线，是否存在低成本绕过路径。

例如具体测试：

- 复制整个 SSD 到另一台电脑，是否无法解密？
- 复制相同 Tails 系统，是否无法冒充已登记设备？
- 用未经批准的软件启动原机器，Java Card 是否拒绝释放密钥？
- 仅窃取 Java Card 而没有原机器，是否仍无法解密？
- 在授权撤销后，系统是否按设计停止新的解密操作？

这些是明确、可复现、能够证伪的安全测试。

---

**所以我会修正之前的结论：**

这套架构不是已经证明安全的完整产品，但它是一套有现实防御价值、值得进行原型验证的纵深防御设计。

它不需要抵抗任意攻击者，也不需要保证明文在被合法读取后仍然绝对不可复制。

它真正需要证明的是：**在预先确定的威胁模型内，攻击者无法仅凭磁盘副本、软件镜像、单个失窃凭据或短暂的非授权设备接触，低成本地获得持续解密能力。**

我认为这个目标现实得多，也更符合你最初设计 Java Card、TPM、Tails、SGX 和物理纵深的动机。

## Prompt:
2026/10/29 19:10:50

# Selected text:

## Selection 1
我此前关于屏幕可以拍摄、合法人员可以被胁迫、SGX 存在历史侧信道漏洞的批评

## My request:
这个可以设计成全或无，不能想象威胁者很厉害但是自己一点防御都没有

## Response:
2026/10/29 19:10:50 · gpt-6-thinking

> **Clarifying all-or-nothing**
>
> 我会把“全或无”理解为系统只在满足完整安全条件时释放信息，否则立即拒绝并清除临时密钥。这样能减少部分泄露，但不能假设防御绝对无懈可击；还需要处理胁迫、传感器失效和物理入侵。
>
> **Strengthening the model**
>
> I agree: I shouldn’t model the attacker as capable while giving the defender no resources. I’m treating this as a binary access design: complete authorization reveals data; any failed condition keeps keys unavailable or destroys them.
>
> **Clarified all-or-nothing and strengthened the model**
>
> 
>
> Worked for 32s

我认为这个反驳是成立的。**不能一边赋予攻击者国家级资源、长期准备、任意物理接触和未知漏洞利用能力，一边假设防御者只有一台毫无物理保护的计算机。** 这是不对称的威胁模型。

而且，你提出的“全或无”（All-or-Nothing）值得进一步形式化。

## 一、可以把安全系统设计成两个互斥状态

**安全关闭态**

磁盘为密文，Java Card 不释放密钥，RAM 中没有可用 DEK，攻击者只能取得受保护的静态数据。

**授权运行态**

平台与人员认证通过，物理区域受控，允许在有限窗口内访问明文。

受控转换：认证、监测、撤销、关机

**失去安全条件时：Fail-closed**

拒绝新的解密请求，撤销授权，销毁可访问的会话密钥，终止敏感执行环境，并通过受控关机切断后续访问。

你真正想建立的不是“任何人永远不能看到明文”，而是：

> **攻击者不能在不满足整套授权和物理安全条件的情况下，获得独立、持续的解密能力。**

这与追求绝对不可泄露是两个不同的安全目标。

## 二、攻击者的能力必须对应防御者的能力

举三个例子。

**1\. 攻击者可以拍摄屏幕。**

那么防御者也可以设计受控阅览室、视线隔离、电子设备管制、人员准入及紧急关闭机制。

拍摄屏幕当然仍是一个理论攻击路径，但攻击者必须先突破这些物理防线。不能直接假定他已经站在屏幕前。

**2\. 攻击者能够胁迫合法用户。**

那么防御者可以设计双人授权、胁迫 PIN、延迟解锁、独立警报以及在异常情况下拒绝继续解密的机制。

这些措施不能消除所有胁迫风险，但可以改变攻击者所需的条件、时间和暴露风险。

**3\. 攻击者可以实施 SGX 侧信道攻击。**

那么还必须解释攻击者如何满足具体漏洞的前提：是否需要执行恶意代码、是否需要长时间测量、是否需要接触硬件、目标 CPU 和微码是否存在对应漏洞。

防御者同样可以使用修补后的平台、限制代码执行、减少共享资源及缩短密钥暴露窗口。

不能直接把“存在某种 SGX 攻击论文”当成“攻击者可以取得本系统密钥”。

## 三、物理纵深实际上是主动的安全机制

你的时间不等式可以扩展成：

$$
T_{\mathrm{detect}}+
T_{\mathrm{revoke}}+
T_{\mathrm{erase}}
<
T_{\mathrm{penetrate}}
$$

在限定的物理攻击模型内，如果能够检测入侵，并在攻击者接触有效密钥或明文之前完成失效处理，那么攻击者即使最终获得整台设备，也可能只得到加密状态。

它并不是简单的“增加几道门”，而是利用物理延迟，为安全状态转换创造条件。

当然，必须验证检测覆盖率、撤销机制以及实际擦除效果；已经输出的明文不能被追回。但这并不否定对后续访问实施全或无控制。

## 四、更合适的反驳原则

我会采用一种更严格、也更公平的安全分析方法：

对于每一个攻击路径，都必须同时回答：

1. 攻击者需要具备什么能力？
2. 防御系统已经阻止了哪些前提？
3. 攻击者还需要突破什么保护？
4. 防御者能否检测、延迟、中断这种攻击？
5. 该路径成功后，到底获得了密钥、某段明文，还是整个系统的持续控制权？

特别是最后一条。**获得一页已经显示的文档、获得一次解密服务、提取 $K_D$、取得 Java Card 的长期秘密 $K_J$，这四种攻击结果不能混为一谈。**

所以我会保留前面有关 SGX/dm-crypt 接口和证明绑定的工程批评，但撤回那些以极端能力假设否定整体安全价值的判断。

**安全防御不是攻击者能力的静态补集，而是攻防双方持续竞争的系统。**

一套设计完全可以不抵抗国家级长期定向攻击，却对其他绝大多数攻击具有很高的防御价值。甚至面对高级攻击者，足够的物理纵深、隔离、认证和状态销毁仍然可能使某条攻击路径在实际操作中不可行。

真正应该追求的，是在给定威胁模型下建立能够测试和证明的安全边界，而不是因为世界上存在无法完全排除的攻击，就否定现有防御。

## Prompt:
2026/10/31 16:01:30

tails os主要是内存转储策略和崩溃策略

## Response:
2026/10/31 16:01:32 · gpt-6-thinking

> **理解核心目标**
>
> 我在重新聚焦：这里讨论的重点不是 Tails OS 的通用轻量化，而是内存清理、转储限制、交换空间与崩溃处理策略。若“内存转储”含义不同，我需要进一步确认。
>
> **理解了核心目标**
>
> 
>
> ****
>
> 
>
> **厘清防泄漏重点**
>
> 我理解你的重点是：Tails 的价值在于限制内存转储、避免敏感数据落盘，并设计崩溃与异常关机后的处理，而不只是提供临时系统环境。
>
> **厘清防泄漏重点**
>
> 
>
> **核对实现边界**
>
> 我会把问题拆成用户态崩溃转储、内核崩溃转储、交换空间，以及关机时的内存清理；这些机制目标不同，不能简单统称为“内存转储策略”。
>
> **区分关键机制**
>
> 我现在把重点放在四层：用户态 core dump、内核崩溃转储、交换空间，以及异常关机后的内存清理。若你说的“内存转储”特指 core dump，我会进一步按此口径分析。
>
> **整理防护边界**
>
> 我会把 Tails 的重点表述为：尽量避免敏感数据写入持久介质，限制交换与崩溃转储，并在正常或紧急关机时清理内存；但异常崩溃可能无法保证完整清理。
>
> **核对实现边界并整理关键机制防护边界**
>
> 
>
> **明确结论**
>
> 我会区分“崩溃转储”和“崩溃后的清理”：Tails 主要防止敏感数据落盘，并通过正常或紧急关机清理内存；内核崩溃绕过用户态流程时，不能保证完整擦除。
>
> **界定防护目标**
>
> 我会将 Tails 理解为“防止敏感信息落盘、限制崩溃转储，并在受控关机时清理内存”。但内核恐慌、突然断电或硬件复位可能跳过清理流程，不能保证所有内存都被擦除。
>
> **确认设计重点**
>
> 我现在理解了：你关注的是 Tails 的内存转储、交换空间、崩溃转储与异常关机策略，而非一般的“临时系统”属性。关键边界是：受控关机可清理内存，但内核恐慌、断电或硬件复位可能绕过该流程。
>
> **明确结论并界定防护目标**
>
> 
>
> **聚焦转储与崩溃**
>
> 我现在把 Tails 视为内存生命周期与故障处理组件：重点是禁止敏感数据形成持久转储、使用内存中的交换，并在受控关机时擦除内存；内核恐慌或断电仍需单独评估。
>
> **完善策略边界**
>
> 我现在把 Tails 定位为防止持久化转储的临时运行层：使用内存交换、限制崩溃转储，并在受控关机或移除启动介质时清理内存；内核恐慌、断电和硬件复位仍无法保证擦除完成。
>
> **聚焦转储崩溃并完善策略边界**
>
> 
>
> **已搜索 32 个网站**
>
> 
>
> 思考了 2m 6s

明白了。这样我之前对 Tails OS 的评价确实偏了。

你选择 Tails，并不是单纯为了获得一个轻量、固定、容易恢复的 Linux 环境，而是看重它对**内存残留、内存转储、异常崩溃和关机过程的安全处理**。

这实际上是整个方案中非常重要的一层：不仅要控制密钥如何进入内存，还要控制密钥在内存中存在多久，以及系统异常退出时会留下什么。

我建议把 Tails 在这套架构中的定位重新定义为：

$$
\boxed{\text{Memory Lifecycle and Failure Management}}
$$

即内存生命周期与故障管理，而不只是可信启动后的操作系统。

这里还需要区分三个容易混淆的机制。

## 1\. 内存转储策略（Memory Dump Policy）

重点是防止系统把敏感内存内容保存到持久介质。

| 机制 | 风险 | 设计策略 |
|--------|--------|--------|
| Swap | 密钥或明文页写入磁盘 | 只允许 RAM-backed swap |
| Core Dump | 应用崩溃时保存进程内存 | 禁止持久化 core dump |
| Kernel Crash Dump | Kernel Panic 后保存 vmcore | 禁止持久化 kdump |
| Hibernate | 将内存状态保存到磁盘 | 禁止休眠 |
| Crash Logging | 崩溃日志可能包含敏感信息 | 限制日志内容与持久化 |

这里有个值得注意的事实：Tails 从 5.11 开始使用 zram。它是压缩后的 RAM-backed swap，不是写入 SSD 的传统交换分区。这样既能缓解内存压力，也避免把交换页持久化到磁盘。[Tails 5.11 is out (2023-03-20) - Tails](https://forum.torproject.org/t/tails-5-11-is-out-2023-03-20/6975); [Re: Tails-dev Why does tails now have a swap partition](https://lists.inventati.org/message/20240820.212525.9774df42.de.html)

## 2\. 内存擦除策略（Memory Erasure Policy）

Tails 目前的实现比简单执行一次 `memset()` 复杂得多。

**正常关机路径**

1. 结束用户进程，释放进程内存。
2. 通过 Linux `init_on_free=1`，在释放内存页时进行清零。
3. 卸载文件系统，特别处理 OverlayFS 的可写层。
4. 切换回 initramfs，执行后续关机流程。
5. 完成关机或重启。

依据 Tails 官方 Memory Erasure 设计说明。

这里有一个重要限制：Tails 明确承认，目前仍有部分内核内存没有被擦除，某些内存分配路径也不受 poisoning 覆盖。它追求的是尽可能可靠地擦除大部分系统内存，而不是宣称所有物理内存位都得到清零。\[[Tails](https://tails.net/contribute/design/memory_erasure/)\]

## 3\. 崩溃与紧急关机策略（Crash / Emergency Shutdown Policy）

这恰恰是你的设计值得进一步借鉴的地方。

Tails 有两种关机路径：

- Standard Shutdown：正常关闭，尽量保证持久存储和文件系统完整。
- Emergency Shutdown：拔掉启动 USB 或弹出启动 DVD，触发紧急关机。

其 `udev-watchdog` 监视启动介质，在介质被拔除时触发内存擦除流程，并绕过普通关机脚本。[Tails](https://tails.net/doc/first_steps/shutdown/index.en.html); [Tails](https://tails.net/contribute/design/memory_erasure/)

但必须区分：

**拔掉启动介质触发的紧急关机，不等于任意 Kernel Panic 都能成功执行内存擦除。**

如果内核已经死锁、CPU 停止执行或者发生突然断电，软件擦除程序可能根本没有机会运行。

---

## 对你原来的架构，我会这样重新定义 Tails

**TPM / Secure Boot / Measured Boot**

决定允许什么平台和软件启动。

---

**Java Card / ECDH / SGX**

决定谁能取得密钥，以及密钥在运行时如何隔离。

---

**Tails / Linux Memory Management**

控制交换、内存释放、转储、临时文件和关机擦除。

---

**Crash Handler / Emergency Shutdown / Physical Interlock**

在异常状态下终止敏感会话，尽可能阻止运行状态继续暴露。

我还会特别增加一个验证项目：检查 Tails 实际镜像中的 `systemd-coredump`、`kernel.core_pattern`、`kdump`、`pstore`、`/proc/swaps` 和休眠配置。官方内存擦除文档并不能单独证明所有这些转储机制均已禁用。

**我现在更理解你为什么选择 Tails 了：你关注的是操作系统对秘密数据整个生命周期的管理，而不是单纯选择一个安全发行版。**

这也意味着，你的研究重点应该从「如何保护密钥」扩展到：

$$
\boxed{
\text{Secret Creation}
\rightarrow
\text{Memory Residency}
\rightarrow
\text{Memory Eviction}
\rightarrow
\text{Crash}
\rightarrow
\text{Erasure}
}
$$

这条生命周期才是整套离线计算机架构中值得认真设计的一部分。

---

如果你愿意，我可以：

- 继续补充胁迫 PIN 相关反驳
- 详细描述完整性和防回滚的对策
- 分析如何强化 SGX 与 dm-crypt 的集成


## claude

#### 总结是3条 供应链攻击  胁迫 欺骗

这个归纳基本成立，而且比我的六类更有用，因为它是按"攻击者靠什么起作用"来分，而不是按技术手段分。

其他几类怎么并进这三条
隐蔽信道、恶意代码、U 盘、恶意文档：恶意代码必须先进机器，进入的途径只有两种：出厂前就在里面（供应链），或者有人把它带进来（欺骗）。信道本身只是后半段。
内部人员：内部人员自愿作恶是第四种情况，但通常也可归为"被收买或被胁迫"，和胁迫、欺骗同属"人"这一层。
TEMPEST、窥屏：这两种不需要入侵，只需要靠近。严格说它们不属于这三条，但属于物理接近，由物理纵深和屏蔽处理。
不能完全并进的部分

物理接触类攻击（TPM 总线嗅探、智能卡故障注入、evil maid）不是供应链，不是胁迫，也不是欺骗，而是攻击者在你不在场时直接动手。如果要保持三条的简洁，就得把"无人值守时的物理访问"算作供应链的延伸（机器在你手里但已不受你控制），或者单独补第四条。我倾向于保留成第四条，因为它的防御手段不同：靠防拆封、监控和保管，而不是靠采购审查。

这个总结对你的方案意味着什么

这三条里，你设计的密码学部件几乎都帮不上忙：

攻击	TPM / SGX / Java Card 能否缓解
供应链	基本不能。信任根本身可能已被污染
胁迫	只有胁迫 PIN 这一点点，而且前面讨论过它的局限
欺骗	不能。欺骗针对的是人，不是部件

这印证了前面的结论：这套方案解决的是"复制磁盘和镜像"这类技术性窃取，而 air gap 之后真正剩下的威胁几乎都在人和流程这一侧。所以要提高整体安全，边际收益更大的投入是采购审查（多源、抽检、可验证构建）、人员制度（双人授权、轮岗）和操作规程，而不是再往密码学层叠加部件。

这也回到了你之前"测量是没完没了的"那个观点：信任最终要停在人和流程上，只是这条边界要明确写出来，并且给它配上相应的管理手段。

#### 做出一模一样的设备也是欺骗

Thought for 4s

Weighing whether a look-alike device counts as deception.

Checking whether device attestation covers the human’s view.

对，而且这条值得单独说，因为它正好打在原方案的盲点上。

为什么它属于欺骗，不是供应链

供应链是机器到你手之前被污染，而这里是交付之后被替换：攻击者造一台外观、固件界面都一样的仿制机，趁你不在时换掉，或者在你换设备、出差时替换。受骗的对象是人，用户把卡插进去，把 PIN 输进去，仿制机记录下来，再转给真机或直接转给攻击者。

为什么原方案防不住

原方案的所有认证都是机器向卡片证明自己：TPM 证明"我是登记过的机器"，SGX 证明"我是批准的 enclave"。但仿制机的目标恰好不是去骗卡片，而是去骗人。这个方向原文没有任何机制：

卡片和 PIN 是人交给机器的，没有任何东西证明"眼前这台机器就是原来那台"，用户只能靠肉眼。
仿制机甚至不需要有 TPM 或 SGX，它只需要像，然后把用户输入转发给后端那台真机，这又回到了前面讨论的中继攻击，只不过这次的中继者是被欺骗的用户亲手接上的。
前面我把中继攻击归为"接近边界外"，现在看这个判断偏轻：只要把"人被骗接上仿制机"考虑进来，中继攻击就成了很自然的入口。
可行的缓解：让机器向人证明自己

思路是反向认证：机器必须出示一个只有真机能产生、而人能识别的东西。

TPM 封存秘密：启动时机器用 TPM 解封一个只有你知道的短语或一次性码，显示在屏幕上，PCR 不对就解不开。Heads 固件就是这个思路。仿制机没有这个秘密。
卡片上显示或带认证码：卡片或独立的小设备给出一次性码，你对照屏幕。关键是对照码的来源不经过被怀疑的机器。
物理封条与保管：防拆封条、序列号、存放位置和开箱规程，针对"外观一样"这一点，在人这一层上增加辨认依据。
双人核对：由第二个人确认设备身份，对胁迫和欺骗同时有用。
要注意的局限
反向认证的秘密如果会在每次使用时展示，仿制机可以在用户面前骗一次、记下来再用，所以最好是一次性或带挑战应答的。
这仍然依赖用户真的去核对，人在疲劳或匆忙时会跳过，所以要靠流程强制，不能靠自觉。
对之前归纳的影响

这支持你的三条归纳，也提示一点：欺骗这一条里其实有两种不同的情形。

骗人去做事：钓鱼、诱导导入恶意文件。
骗人信任一个假设备：仿制机、替换机。

第二种恰好是密码学部件最应该能帮忙、但原方案没有设计的地方，因为它需要的是"机器对人的认证"，而不是"机器对卡片的认证"。
