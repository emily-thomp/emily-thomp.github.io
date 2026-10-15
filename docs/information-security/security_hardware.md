# 制作黑盒硬件

## 设计启发

启发：GrapheneOS 的胁迫密码。

## 当前实验

已经用 NXP 的 Java Card 实验类似功能。

## 待研究器件

- ST ST33K1M5C
- NXP SmartMX3 P71D321
- Infineon TEGRION SLC26PDA360N9
- ADI／Maxim MAX32550

发现ST33与P71D321与TEGRION实质是Java Card或者它的扩展，其他待查。

## RoT、游戏机、Android/iOS 与 Bootloader
游戏机通常通过 BootROM、eFuse、芯片内置密钥或公钥哈希建立硬件信任根（RoT），限制未经授权的固件执行。Android 的 Bootloader 锁和 Verified Boot、iOS 的 Secure Boot Chain 也采用类似的信任链，但解锁权限由厂商和设备型号决定。基带则是相对独立的计算与安全子系统，其固件、调试接口和底层开发资料通常受到厂商 NDA 及签名机制限制。硬件信任根不一定需要烧录秘密密钥，也可以使用公钥哈希或芯片内部生成的密钥。

## TME 与 Enclave
TME（Total Memory Encryption）主要加密外部 DRAM，降低冷启动和物理内存读取攻击的风险，但普通 TME 不隔离操作系统，也不提供完整的内存完整性保护。Enclave（如 Intel SGX）则允许敏感程序在主 CPU 内的受保护环境执行，隔离不可信操作系统，并保护执行期间的代码和数据。其局限包括侧信道、故障注入、可信输入输出和持久状态回滚问题。

## 独立 TPM、集成 TPM 与 SoC 物理防拆

独立 TPM（dTPM）通过 SPI/LPC 等总线连接主 CPU，即使 TPM 内部密钥不可提取，通信仍可能遭到窃听、中间人或重放攻击。集成 TPM（fTPM）将安全功能置于 SoC 内部，消除了对应的外部 TPM 总线攻击面，但依赖处理器隔离与固件安全。如果整个 SoC 同时具备主动屏蔽层、侵入检测和密钥零化等物理防拆机制，那么它就能在同一物理安全边界内保护主 CPU、安全处理器及内部通信，无须依赖独立安全芯片。 这种架构结合了 Enclave 的隔离执行与安全 MCU 的物理防护优势，但实际保护范围取决于防拆机制是否覆盖相关电路、存储器及接口。
