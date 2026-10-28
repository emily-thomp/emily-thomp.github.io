``` java

//StoryApplet.java
//javacard_story_demo\src\demo\story\StoryApplet.java
package demo.story;

import javacard.framework.APDU;
import javacard.framework.Applet;
import javacard.framework.ISO7816;
import javacard.framework.ISOException;
import javacard.framework.Util;

public class StoryApplet extends Applet {
    private static final byte CLA_STORY = (byte) 0x80;
    private static final byte INS_READ = (byte) 0x30;
    private static final short CHUNK_SIZE = (short) 48;
    private static final short SW_LOCKED = (short) 0x6983;
    private static final byte[] PASSWORD = { (byte)0x31, (byte)0x32, (byte)0x33, (byte)0x34 };

    // Persistent fields. Java Card EEPROM/flash-backed state.
    private byte failedAttempts;
    private final byte[] story;

    private StoryApplet() {
        failedAttempts = (byte) 0;
        story = StoryBytes.create();
        register();
    }

    public static void install(byte[] bArray, short bOffset, byte bLength) {
        new StoryApplet();
    }

    public void process(APDU apdu) {
        if (selectingApplet()) return;
        byte[] b = apdu.getBuffer();
        if (b[ISO7816.OFFSET_CLA] != CLA_STORY)
            ISOException.throwIt(ISO7816.SW_CLA_NOT_SUPPORTED);
        if (b[ISO7816.OFFSET_INS] != INS_READ)
            ISOException.throwIt(ISO7816.SW_INS_NOT_SUPPORTED);
        if (failedAttempts >= (byte)3) ISOException.throwIt(SW_LOCKED);
        if (b[ISO7816.OFFSET_P2] != (byte)0x00)
            ISOException.throwIt(ISO7816.SW_WRONG_P1P2);

        // Case 4 short APDU: CLA INS P1 P2 Lc Data Le.
        short lc = apdu.getIncomingLength();
        if (lc != (short)PASSWORD.length)
            ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);
        short read = apdu.setIncomingAndReceive();
        if (read != lc) ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);

        // Demo only: plaintext shared password. Count failed comparisons persistently.
        if (Util.arrayCompare(b, ISO7816.OFFSET_CDATA,
                              PASSWORD, (short)0, (short)PASSWORD.length) != 0) {
            failedAttempts++;
            if (failedAttempts >= (byte)3) {
                ISOException.throwIt(SW_LOCKED);
            }
            ISOException.throwIt((short)(0x63C0 | (3 - failedAttempts)));
        }

        short index = (short)(b[ISO7816.OFFSET_P1] & 0xFF);
        short start = (short)(index * CHUNK_SIZE);
        if (start >= (short)story.length)
            ISOException.throwIt(ISO7816.SW_WRONG_P1P2);
        short length = (short)(story.length - start);
        if (length > CHUNK_SIZE) length = CHUNK_SIZE;

        // All bytes are stored as GBK. The host joins bytes before decoding.
        short le = apdu.setOutgoing();
        if (le < length) ISOException.throwIt(ISO7816.SW_WRONG_LENGTH);
        apdu.setOutgoingLength(length);
        apdu.sendBytesLong(story, start, length);
    }
}

```



# Java Card / GlobalPlatform / APDU 示例

> 直接看用户4

## 用户 1

为什么用gp.exe install 一次 需要 delete 两次 不然会报错 其中delete 跟的aid 有两位数的差别

---

## 助手 1（过程消息）

我查一下 GlobalPlatformPro 的 `install` 和 `delete` 实际操作，以及 CAP 文件里不同 AID 的关系。这通常涉及“包 AID”和“实例 AID”是两个独立对象。

---

## 助手 1（回答）

这是 **GlobalPlatform / Java Card 的包（Package）与应用实例（Applet Instance）分离管理机制**，不是 `gp.exe` 安装了两遍。

执行一次：

```powershell
gp.exe --install applet.cap
```

通常会在卡上创建两个不同的注册对象，因此你可能需要分别 `delete`。

## 1. 为什么有两个 AID？

假设安装后执行：

```powershell
gp.exe --list
```

得到：

```text
AID: F00000000101
     PKG: LOADED

AID: F0000000010101
     APP: SELECTABLE
```

它们对应：

### Package 与 Applet Instance 的关系

```text
┌──────────────────────────────────────┐
│      Package / Executable Load File  │
│                                      │
│      AID: F00000000101               │
│                                      │
│  Java Card 类、字节码及包内可执行模块  │
└──────────────────────────────────────┘
                  │
                  │ INSTALL for install
                  │ 实例化
                  ▼
┌──────────────────────────────────────┐
│           Applet Instance            │
│                                      │
│      AID: F0000000010101             │
│                                      │
│  可 SELECT 的应用实例及其持久状态     │
└──────────────────────────────────────┘
```

严格来说，可能有三种 AID：

| 类型 | 含义 |
|---|---|
| Package AID | CAP 包对应的 Executable Load File |
| Applet Class AID | 包内可实例化的 Executable Module |
| Instance AID | 实际安装在卡上、可被 SELECT 的应用实例 |

Applet Class AID 和 Instance AID 可以相同，也可以不同。

## 2. 为什么删除时要两次？

如果先删除 Package：

```powershell
gp.exe --delete F00000000101
```

可能报：

```text
SW: 6985
Conditions of use not satisfied
```

原因是 Package 仍然被 Applet Instance 引用，卡片不允许直接删除它。

正确的顺序通常是：

```powershell
# 删除实例
gp.exe --delete F0000000010101

# 删除包
gp.exe --delete F00000000101
```

这相当于先销毁对象，再卸载定义该对象的程序包。

## 3. 能不能一次删除？

可以。GlobalPlatformPro 支持强制删除及处理依赖对象：

```powershell
gp.exe -f --delete F00000000101
```

或者根据你的版本使用：

```powershell
gp.exe --delete F00000000101 --deletedeps
```

也可以尝试通过 CAP 文件卸载：

```powershell
gp.exe --uninstall applet.cap
```

这些命令的具体支持情况取决于 GlobalPlatformPro 版本及卡片实现。

**你提到两个 AID 只差两位十六进制字符**，很可能是 Package AID 与 Instance AID 的末尾有一个字节的区别，但 AID 不要求采用这种命名方式。

如果你把 `gp.exe --list` 的完整输出，以及两次 `delete` 使用的 AID 和报错状态字（SW）发过来，我可以进一步判断它们究竟是 Package、Executable Module 还是 Applet Instance，以及为什么你的卡需要两次删除。

---

## 用户 2

ADPU的消息头

---

## 助手 2（回答）

APDU（Application Protocol Data Unit，应用协议数据单元）是智能卡、Java Card、SIM 卡和安全芯片通信时使用的命令与响应格式，主要由 **ISO/IEC 7816-4** 定义。

APDU 分为两类：命令 APDU（Command APDU，终端发给卡片）和响应 APDU（Response APDU，卡片返回终端）。

## 1. Command APDU 的消息头

标准命令 APDU 的头部固定为 **4 字节**：

| 字节 | 字段 | 长度 | 含义 |
|---|---|---|---|
| 0 | `CLA` | 1 Byte | 命令类别、逻辑通道、安全消息标志 |
| 1 | `INS` | 1 Byte | 指令码 |
| 2 | `P1` | 1 Byte | 指令参数 1 |
| 3 | `P2` | 1 Byte | 指令参数 2 |

后面可以跟可选长度字段及数据：

```text
Command APDU
┌─────┬─────┬─────┬─────┬────────┬──────────────┬────────┐
│ CLA │ INS │ P1  │ P2  │   Lc   │     Data     │   Le   │
├─────┼─────┼─────┼─────┼────────┼──────────────┼────────┤
│ 1B  │ 1B  │ 1B  │ 1B  │ 可选   │ 可选         │ 可选   │
└─────┴─────┴─────┴─────┴────────┴──────────────┴────────┘
```

其中：

- `Lc`：后面命令数据的长度。
- `Data`：命令数据，例如 AID、密钥材料或安装参数。
- `Le`：期望卡片返回的数据长度。

注意：短 APDU 中 `Lc`、`Le` 通常各占 1 字节，扩展长度 APDU 可以使用更长的编码。

## 2. APDU 的四种结构

| 类型 | 格式 | 用途 |
|---|---|---|
| Case 1 | `CLA INS P1 P2` | 无数据，不要求响应数据 |
| Case 2 | `CLA INS P1 P2 Le` | 只接收数据 |
| Case 3 | `CLA INS P1 P2 Lc Data` | 只发送数据 |
| Case 4 | `CLA INS P1 P2 Lc Data Le` | 发送并接收数据 |

以上为短长度 APDU 的基本形式。

## 3. 结合 gp.exe 的 DELETE 指令

GlobalPlatform DELETE 的指令码 `INS = E4`，删除目标 AID 放在命令数据区，以 TLV 编码。

例如删除 AID `F00000000101`：

```text
80 E4 00 00 08 4F 06 F0 00 00 00 01 01 00
│  │  │  │  │  │  │  └────────────────┘ │
│  │  │  │  │  │  │         AID          Le
│  │  │  │  │  │  └─ Length = 6
│  │  │  │  │  └──── Tag = 4F (AID)
│  │  │  │  └─────── Lc = 8
│  │  │  └────────── P2 = 00
│  │  └───────────── P1 = 00
│  └──────────────── INS = E4 (DELETE)
└─────────────────── CLA = 80
```

这是未添加 SCP 安全消息封装的示例；实际 `gp.exe` 发送的命令可能包含 MAC 等安全消息数据。

## 4. Response APDU

卡片返回：

```text
┌───────────────────────┬─────┬─────┐
│ Response Data         │ SW1 │ SW2 │
└───────────────────────┴─────┴─────┘
```

常见状态字：

| SW1 SW2 | 含义 |
|---|---|
| `90 00` | 成功 |
| `61 XX` | 还有响应数据可获取 |
| `6A 82` | 找不到指定对象 |
| `6A 86` | P1/P2 参数错误 |
| `69 82` | 安全状态不满足 |
| `69 85` | 使用条件不满足 |
| `67 00` | 长度错误 |

**关键区别：APDU 的 Header 永远是前四个字节 `CLA INS P1 P2`。AID 不是 Header，而是通常放在 Data 字段中的应用标识符。**

规范参考：<Link url="https://www.freecalypso.org/pub/GSM/ISO7816/ISO_7816-4_2005.pdf" title="ISO/IEC 7816-4"/>、<Link url="https://globalplatform.org/wp-content/uploads/2018/03/GPC_Specification_v2.3.pdf" title="GlobalPlatform Card Specification 2.3"/>。

---

## 用户 3

select 消息头怎么写 select后调用自己的命令 的消息头怎么写

---

## 助手 3（回答）

在 Java Card / GlobalPlatform 中，**SELECT 命令与 SELECT 之后调用自己 Applet 的命令，使用不同的 APDU 消息头。**

## 1. SELECT Applet 的消息头

标准的按 AID 选择应用命令是：

```text
00 A4 04 00 Lc [AID] Le
```

| 字段 | 值 | 含义 |
|---|---|---|
| CLA | `00` | ISO 7816 标准命令 |
| INS | `A4` | SELECT |
| P1 | `04` | 按 DF Name（AID）选择 |
| P2 | `00` | 选择第一个匹配的应用 |
| Lc | AID 字节数 | 后面数据长度 |
| Data | Applet Instance AID | 要选择的应用 |
| Le | `00`（可选） | 请求响应数据 |

假设你的 Applet Instance AID 为 `F0000000010101`，长度为 7 字节：

```text
00 A4 04 00 07 F0 00 00 00 01 01 01 00
```

卡片可能返回：

```text
90 00
```

表示选择成功。

## 2. SELECT 后调用自己的命令

假设 Java Card Applet 中定义：

```java
private static final byte CLA_APPLET = (byte) 0x80;
private static final byte INS_HELLO  = (byte) 0x10;
```

你可以发送：

```text
80 10 00 00 00
```

| 字段 | 值 | 含义 |
|---|---|---|
| CLA | `80` | 自定义/专有命令类别 |
| INS | `10` | 你自己定义的 HELLO 命令 |
| P1 | `00` | 自定义参数 |
| P2 | `00` | 自定义参数 |
| Le | `00` | 期望接收最多 256 字节（短 APDU） |

**`INS = 10` 没有固定的标准意义**，是你的 Java Card Applet 自己解释的。

例如：

```java
public void process(APDU apdu) {
    if (selectingApplet()) {
        return;
    }

    byte[] buf = apdu.getBuffer();

    if (buf[ISO7816.OFFSET_CLA] != (byte) 0x80) {
        ISOException.throwIt(ISO7816.SW_CLA_NOT_SUPPORTED);
    }

    switch (buf[ISO7816.OFFSET_INS]) {
        case (byte) 0x10:
            buf[0] = (byte) 0x42;
            apdu.setOutgoingAndSend((short) 0, (short) 1);
            return;

        default:
            ISOException.throwIt(ISO7816.SW_INS_NOT_SUPPORTED);
    }
}
```

这个例子执行：

```text
> 00 A4 04 00 07 F0 00 00 00 01 01 01 00
< 90 00

> 80 10 00 00 00
< 42 90 00
```

实际 SELECT 响应可能包含 FCI 数据，不一定只有 `90 00`。

## 3. 特别注意：SELECT 后不需要再带 AID

`SELECT` 成功后，Java Card Runtime（JCRE）会记录当前逻辑通道选中的 Applet。后续 APDU 根据逻辑通道转发到该 Applet 的 `process()` 方法，而不是每条命令重新查找 AID。

也就是说，在基本逻辑通道 0 上：

```text
SELECT:        00 A4 04 00 07 [7-byte AID] 00
自定义命令:    80 10 00 00 00
```

如果使用其他逻辑通道，`CLA` 也要相应改变，不能始终写 `00` 或 `80`。

**另外，`80 10` 只是示例。** 你自己的 Applet 必须确实实现了 `CLA=80、INS=10`，否则可能返回 `6E00`（CLA 不支持）或 `6D00`（INS 不支持）。

---

## 用户 4

好的 请演示一个示例程序

上位机

1. select
2. 自定义命令 + 参数（其中，参数为因为ADPU长度的限制，下位机返回《卖火柴的小女孩》的分片的index）



下位机：

当INS等于约定的值，P1为index序号，Data为约定的密码的时候，返回《卖火柴的小女孩》对应的分段（GBK编码）


**当Data输入错误3次的时候，下位机不在能够输出有效数据。**

---

## 助手 4（过程消息）

我按 Java Card Applet + Python 上位机（PC/SC）写一套可运行的示例：先 SELECT，再用 P1 指定分片、Data 携带密码，卡片返回 GBK 字节；密码累计错误三次后持久锁定。故事文本做成可替换的数据文件，避免把长文本硬编码在逻辑里。

---

## 助手 4（回答）

这个示例可以看成一个最简单的“带密码保护的分片读取协议”。上位机不直接发送字符串，而是通过 APDU 的 `P1` 请求指定分片；下位机是 Java Card Applet，内部保存 GBK 字节和错误计数器。

## 1. 自定义 APDU 协议

规定 Applet AID 为 `F0000000010101`，密码为 ASCII `1234`，每个分片最多返回 48 字节。

| 字段 | SELECT | READ_STORY |
|---|---|---|
| CLA | `00` | `80` |
| INS | `A4` | `30` |
| P1 | `04` | 分片 index（0–255） |
| P2 | `00` | `00` |
| Lc | `07` | `04` |
| Data | 7 字节 AID | `31 32 33 34` |
| Le | `00` | `30`（48 字节） |

因此，要读取分片 1，发送：

```text
80 30 01 00 04 31 32 33 34 30
```

返回的数据直接是故事的 GBK 字节，最后跟两个状态字。

| SW | 含义 |
|---|---|
| `9000` | 读取成功 |
| `63C2` | 密码错误，还剩 2 次机会 |
| `63C1` | 密码错误，还剩 1 次机会 |
| `6983` | 已锁定，禁止读取 |
| `6A86` | 分片 index 越界 |
| `6700` | 密码长度不正确 |

这里规定：**连续累计三次密码错误即永久锁定**，中间输入正确密码也不会清除之前的错误次数。错误计数存放在 Java Card 持久存储中，因此断电、重新 SELECT、拔卡后再插入均不会自动清零。

这是教学协议，不是生产级认证方案：密码明文传输，也没有防重放机制。

## 2. 完整示例程序

我把程序整理成了工程，包含 Java Card 下位机、Python 上位机和 GBK 数据生成器。


工程目录：

```text
javacard_story_demo/
├── src/demo/story/
│   ├── StoryApplet.java    # 下位机 APDU 处理
│   └── StoryBytes.java     # GBK 字节数组
├── story.txt               # 故事文本
├── generate_story.py       # GBK 编码及 Java 数组生成
├── reader.py               # PC/SC 上位机
└── README.md
```

其中 `story.txt` 是一小段原创情节概述，不是《卖火柴的小女孩》的完整译文。你可以替换为拥有使用权限的完整故事文本，再运行生成器。

### 下位机的关键部分

Java Card 使用 `process(APDU apdu)` 处理上位机命令：

```java
public void process(APDU apdu) {
    if (selectingApplet()) return;

    byte[] b = apdu.getBuffer();

    if (b[ISO7816.OFFSET_CLA] != (byte)0x80)
        ISOException.throwIt(
            ISO7816.SW_CLA_NOT_SUPPORTED);

    if (b[ISO7816.OFFSET_INS] != (byte)0x30)
        ISOException.throwIt(
            ISO7816.SW_INS_NOT_SUPPORTED);

    // 后续：判断锁定、读取 Data、
    // 校验密码、更新错误次数、返回指定分片
}
```

完整文件还实现了密码校验、持久错误计数和分片输出，使用 `sendBytesLong()` 将故事字节返回上位机。这是 Java Card 标准 API 提供的发送方法。

### 上位机的关键部分

通过 PC/SC 调用读卡器：

```python
from smartcard.System import readers

reader = readers()[0]
conn = reader.createConnection()
conn.connect()

# SELECT
conn.transmit([
    0x00, 0xA4, 0x04, 0x00, 0x07,
    0xF0, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01,
    0x00
])

# READ_STORY，读取 index = 1
data, sw1, sw2 = conn.transmit([
    0x80, 0x30, 0x01, 0x00, 0x04,
    0x31, 0x32, 0x33, 0x34,
    0x30
])
```

`reader.py` 会自动请求所有分片，累积字节，最后统一调用：

```python
result.decode("gbk")
```

这样即使某一分片的边界恰好位于两个 GBK 字节之间，也不会出现逐片解码导致的乱码。

## 3. 测试顺序

<list marker="number" gap={2}>
  <list-item>运行 `python generate_story.py`，把 `story.txt` 编码成 Java Card 使用的 GBK 字节数组。</list-item>
  <list-item>使用 Java Card SDK 将 Java 类编译并转换为 CAP，再通过 `gp.exe` 安装到卡上。具体编译命令取决于 SDK 和卡片版本。</list-item>
  <list-item>执行 `python reader.py`，观察 SELECT、分片读取和状态字。</list-item>
  <list-item>将上位机密码改成 `b'9999'`，连续发送三次读取请求，验证 `63C2 → 63C1 → 6983`，再恢复正确密码测试锁定是否仍然生效。</list-item>
</list>

注意，**永久锁定是相对于当前 Applet 实例而言**。如果持有 GlobalPlatform 管理权限的人能够删除并重新安装 Applet，可能使错误计数重新初始化。真正不可由持卡用户重置的锁定需要卡片生命周期及管理权限共同约束。

目前工程已生成，但没有在实体 Java Card、具体 SDK 或读卡器上完成编译和实机测试。

---
