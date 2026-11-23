# 从《World of Guns》的拆解数据，到导气装置仿真工具：一次技术检索与工程整理的完整记录 AI slop

---

## Part 1　提问的三个层次与真实诉求

### 1.1 提问的演进

最初的问法很朴素：**《Gun Disassembly》里的枪械数据是从哪来的？如果我要做同类的软件，该看什么书、什么图纸？怎么用机械工程知识把它做出来，比如回弹力和惯性估算？**

这个问法本身包含了一个误判——把"数据来源"和"软件实现"当成同一件事的两个部分。实际上它们是两条几乎不相交的产业：前者是**文献与实物逆向工程**，后者是**几何内核与求解器开发**。第一次回答把它们混在游戏开发的框架里讲（绑定、关键帧、状态机），方向偏了。

于是有了第一次修正：**"最后一句话不是计算机图形学方向的，是 CAD CAE CAM 方向的。"** 这一句把问题从"游戏怎么做"掰到了"工程软件怎么做"，重心移到 B-rep 内核、精确质量特性、约束多体、有限元、刀轨。

第二次修正更具体：**"最主要是导气仿真，想法是把书上的公式变成 GUI 做到电脑里面。"** 范围收窄到单一机构——导气装置，以及单一交付形态——公式的可交互实现。

### 1.2 真实诉求的拆解

剥掉表述层，真正要的东西是四样：

1. **可复现的数据源清单。** 不是"参考真枪"这种废话，而是哪类专利、哪本手册、哪家零件商的爆炸图、哪套教范，能真的拿到剖面与尺寸。
2. **一份诚实的难度评估。** 哪些数据是公开可得的，哪些必须买枪、拆枪、扫描，哪些法律上不能用。
3. **可执行的求解器规格。** 状态向量、右端函数、事件清单、刚性处理、标定参数——写到能照着敲代码的程度。
4. **验证基准。** 没有实测压力曲线和活塞速度曲线，公式实现得再漂亮也只是能出图。

还有一层没说出口的：**担心这件事的规模被低估。** 一部 295 把枪的商业产品背后是十几年的模型生产线；一个导气仿真工具背后是内弹道 + 可压缩流 + 多体动力学的联立。所以回答里必须反复给量级自检数字，让人能自己判断"我算的对不对"。

---

## Part 2　检索路径与获取方法

### 2.1 关键词与命中情况

| 关键词 | 用途 | 结果质量 |
|---|---|---|
| `"Gun Disassembly" Steam 游戏 拆解 数据来源` | 定位游戏本体 | 命中，确认全名为 *World of Guns: Gun Disassembly*，开发商 Noble Empire Corp.（基辅） |
| `Gun Disassembly game Steam` | 交叉确认英文名与商店页 | 命中商店页、DLC 页、SteamDB、维基 |
| `Noble Empire World of Guns how models are made blueprints patents interview` | 找一手开发访谈 | **最有价值的一条**，直接命中乌克兰媒体 Mezha/Oboronka 的长篇专访与 Patreon 官方页 |
| `World of Guns Gun Disassembly review accuracy criticism` | 找准确度评价 | 命中 Reddit r/Firearms、guns.com 评测、Steam 讨论区——用于校准"100% 还原"的宣传口径 |
| `gun blueprints patents ordnance manual sources`（延伸） | 转向数据源本体 | 引出专利库、TM 教范、零件商爆炸图三条线 |

**筛选原则**：优先一手信源（开发商访谈、官方 Patreon、商店页正文），其次第三方评测，最后玩家讨论。宣传语和玩家印象只用来定性地标，不用来定量。

### 2.2 一手材料里到底写了什么

商店页正文与 Google Play 描述同一句：

> "To create each model, our team spends months poring over **actual guns, photos, blueprints and documents**. Each part out of hundreds functions in a physically correct way."

官方 Patreon 的流程描述更细：

> "After analyzing each part of the mechanism (either from **actual parts, blueprints, or detailed photographs**) one has to model, texture, **rig and animate** every single part, both in operation and during disassembly."

并给出产能：单模型平均两个月，最复杂模型 1000+ 可动零件、全库 12000+ 零件。

Mezha 专访（2023-02-25，采访对象为总监 Valerii Zadorozhnyi）补上了三条关键信息：

- 单模型周期 **1–3 个月**，"取决于复杂度和材料可得性"；
- 团队跑 **SHOT Show**（拉斯维加斯射击狩猎户外用品展，与 IWA OutdoorClassics 并列全球最大枪展）建立厂商关系，并接厂商付费建模；
- 公司自述每个模型都需要大量研究（researching）与**逆向工程（reverse engineering）**。

**由这三处可推出结论**：数据主体是实物 + 专利 + 手册 + 照片的交叉逆向，不是扫描数据库，也不是某个公开模型库。模型资产本身不开放。

### 2.3 准确度的外部校准

- Reddit r/Firearms：多数回答为 "mostly accurate"，同时指出存在错误。
- Steam 讨论区："99% accurate as far as parts go and the disassembly steps."
- guns.com 评测：认可内部零件与分解顺序，批评付费解锁结构。

结论：零件层面高度还原，机构运动是**绑定 + 关键帧动画**而非物理仿真——这解释了它为什么能在 2014 年的集显笔记本上跑 295 把枪。

### 2.4 几何获取方法总表

这一栏是回答里最实、也最容易被跳过的一段。按可靠性排序：

| 方法 | 产出 | 成本 | 备注 |
|---|---|---|---|
| **实物拆解 + 卡尺/千分尺实测** | 关键配合尺寸 | 需买枪 | 唯一能给绝对尺寸的途径 |
| **实物剖面（线切割/锯切）** | 内部结构 | 报废一支枪 | 内部腔道唯一可靠来源 |
| **3D 扫描（结构光/摄影测量）** | 外表面点云 | 设备或外包 | 内部扫不到，只能配实测 |
| **专利附图** | 机构原理与相对关系 | 免费 | 过期专利进入公有领域；附图为示意图、无尺寸 |
| **军警教范（TM / Наставление）** | 分解顺序、零件编号、剖视图 | 免费 | 公有领域扫描件多 |
| **零件商爆炸图** | 分解顺序、零件名 | 免费 | 见 3.5 |
| **博物馆/枪展/枪店实拍** | 参考照片 | 时间 | 需许可，注意版权 |
| **CAD 参数化重建** | 可计算的实体 | 工时 | 由以上各项交叉校正后建模 |

**法律边界**：机构原理与过期专利自由；图纸与照片有著作权，需重绘；商标与厂标单独授权。厂商对外观模型普遍收费授权——这正是 Noble Empire 的副业。

---

## Part 3　学科地图、公式集与书目

### 3.1 学科分层

```
数据层   机构学 / 枪械结构史 / 专利文献学
   ↓
几何层   B-rep 建模 / 约束求解 / 特征树 / 质量特性积分
   ↓
物理层   内弹道 / 可压缩孔口流 / 控制体热力学 / 约束多体动力学 / 接触力学
   ↓
强度层   厚壁圆筒 / Hertz 接触 / 疲劳 / 弹塑性
   ↓
制造层   CAM 刀轨 / 材料去除仿真 / 切削力模型
   ↓
保障层   数值刚性处理 / 事件检测 / V&V / 量纲
```

四层不可跳跃。跳过几何层直接写物理，会得到一堆无法参数化的常数；跳过 V&V 直接交付，会得到一条"看着顺眼"的错误曲线。

### 3.2 公式集

#### A. 质量特性（惯性估算）

对密度 $\rho$ 的实体 $\Omega$：

$$V=\iiint_\Omega dV,\qquad m=\rho V,\qquad \mathbf r_c=\frac{1}{V}\iiint_\Omega \mathbf r\,dV$$

$$\mathbf I_O=\rho\iiint_\Omega\left(|\mathbf r|^2\mathbf E-\mathbf r\mathbf r^{\mathsf T}\right)dV$$

$$\mathbf I_C=\mathbf I_O-m\left(|\mathbf r_c|^2\mathbf E-\mathbf r_c\mathbf r_c^{\mathsf T}\right)$$

实现：面元 Gauss 积分 + 散度定理（OCCT 的 `BRepGProp::VolumeProperties`），或 Mirtich 的多面体有符号四面体累加（*Fast and Accurate Computation of Polyhedral Mass Properties*, JGT 1996，要求水密网格）。

**复摆校验**（必做）：

$$I_P=\frac{m g d\,T^2}{4\pi^2},\qquad I_C=I_P-m d^2$$

#### B. 自由后坐

$$p = m_p v_p + \beta\, m_c\, v_p$$

$$V_r = \frac{p}{m_g},\qquad E_r = \frac{p^2}{2 m_g}$$

$$\omega=\frac{p\,h}{I_{zz}}$$

$\beta$ 为气体动量系数（0.5–1.5，手枪取 1.2–1.3），$h$ 为膛线轴至支撑点高度。算例（9×19，124 gr，350 m/s，5.5 gr，0.9 kg）：$p=2.97\ \text{kg·m/s}$，$V_r=3.30\ \text{m/s}$，$E_r=4.9\ \text{J}$，与实测 4–6 J 相符。

#### C. 内弹道

$$\frac{dz}{dt}=a\,p^{n}$$

$$p\left(V_0+Ax-\eta m_b z\right)=m_b z R T$$

$$m_p\frac{dv}{dt}=A\,p-F_{\text{bore}}$$

$$F_{\text{breech}}(t)=p(t)\cdot A$$

#### D. 导气孔流动（Saint-Venant–Wantzel）

临界判据 $\beta_{cr}=\left(\frac{2}{\kappa+1}\right)^{\frac{\kappa}{\kappa-1}}\approx0.528$（$\kappa=1.4$）。

临界流：

$$\dot m=\mu A_p\,p_1\sqrt{\frac{\kappa}{RT_1}\left(\frac{2}{\kappa+1}\right)^{\frac{\kappa+1}{\kappa-1}}}$$

亚临界流：

$$\dot m=\mu A_p\sqrt{\frac{2\kappa}{\kappa-1}p_1\rho_1\left[\left(\frac{p_2}{p_1}\right)^{\frac{2}{\kappa}}-\left(\frac{p_2}{p_1}\right)^{\frac{\kappa+1}{\kappa}}\right]}$$

量级自检：φ2.5 mm、100 MPa、2500 K、μ=0.8 → $\dot m\approx0.176\ \text{kg/s}$，滞留 0.5 ms 注入约 88 mg。

#### E. 气室控制体

$$\frac{dm_c}{dt}=\dot m_{in}-\dot m_{out}-\dot m_{leak}$$

$$\frac{d(m_c u_c)}{dt}=\dot m_{in}h_{in}-\dot m_{out}h_{out}-p_c\frac{dV_c}{dt}+\dot Q$$

壁面换热：

$$\dot Q=\alpha A_w\left(T_w-T_c\right),\qquad \alpha \propto Re^{0.8}\ \text{（Dittus-Boelter）}$$

#### F. 活塞与枪机框

$$m_{\text{eff}}\ddot x=p_c A_c-p_{atm}A_c-F_{spring}-F_{fric}-F_{cam}$$

$$m_{\text{eff}}=\begin{cases}m_k & \text{开锁前}\\ m_k+m_{bc} & \text{开锁后}\end{cases}$$

开锁瞬间按非弹性碰撞做动量传递，能量损失单列。

#### G. 凸轮与闭锁

$$F_{cam}=p_{res}A_{case}\cdot\frac{\tan\alpha}{\eta}$$

$$\text{自锁判据：}\tan\alpha<\mu$$

#### H. 自由枪机最小枪机质量

$$m_b\ge\frac{(m_p+\beta m_c)v_p}{v_{b,\max}}$$

#### I. 约束多体

$$\mathbf M(\mathbf q)\ddot{\mathbf q}+\boldsymbol\Phi_{\mathbf q}^{\mathsf T}\boldsymbol\lambda=\mathbf Q(\mathbf q,\dot{\mathbf q},t)+\mathbf Q_c$$

$$\boldsymbol\Phi(\mathbf q)=\mathbf 0$$

Baumgarte 稳定化：

$$\ddot{\boldsymbol\Phi}+2\alpha\dot{\boldsymbol\Phi}+\beta^2\boldsymbol\Phi=\mathbf 0$$

#### J. 强度与疲劳

厚壁圆筒 Lamé 解 + 自紧（autofrettage）残余应力；Hertz 线接触：

$$p_{\max}=\sqrt{\frac{F E^*}{\pi R^* L}}$$

Goodman 修正：

$$\frac{\sigma_a}{S_e}+\frac{\sigma_m}{S_{ut}}=1$$

雨流计数 + Miner 累积：

$$D=\sum_i \frac{n_i}{N_i}$$

#### K. 切削

$$F_c=k_{c1.1}\,b\,h^{1-m_c}$$

$$V T^n=C$$

#### L. 数值

状态向量：

$$y=\left[z,\ m_{bg},\ T_{bg},\ x_p,\ v_p,\ m_c,\ T_c,\ x_k,\ v_k\right]$$

右端函数骨架（对应上文各式）：燃速 → 膛内质量/能量 → 弹丸 → 双向孔口流 → 气室质量/能量 → 活塞。

刚性处理：SUNDIALS **IDA**（DAE）/ **CVODE**（BDF），或 **LSODA** 自动切换；根查找事件 + 拓扑重启；一致性初值由静平衡求解提供。

事件清单（缺一不可）：孔口开启（弹丸过孔位）、孔口关闭（出膛）、开锁、活塞触底、$z=1$、气室压力反转。

### 3.3 书单

**机构与零件**

| 资料 | 用途 | 获取 |
|---|---|---|
| George Chinn《The Machine Gun》Vol. I–V | 自动武器机构分类学，自由枪机/导气/延迟后坐全谱，大量剖面 | archive.org，公有领域 |
| J.B. Wood《Gun Digest Book of Firearms Assembly/Disassembly》（多卷） | 逐型号分解顺序与零件编号 | 二手 |
| W.W. Greener《The Gun and Its Development》 | 十九世纪机构与制造 | archive.org |
| James V. Howe《The Modern Gunsmith》两卷 | 配合、闭锁、击发机构实操 | archive.org |
| A. B. Zhuk《Revolvers and Pistols》《Rifles and Submachine Guns》 | 高密度精确剖面图 | 俄文，二手 |
| Smith & Ezell《Small Arms of the World》 | 各国制式武器机构综述 | 二手 |
| Osprey《Weapon》系列 | 单型号剖视插画 | 零售 |
| Hatcher《Hatcher's Notebook》《Textbook of Firearms》 | 闭锁、headspace、后坐常识 | archive.org |
| Hogg & Weeks《Military Small Arms of the 20th Century》 | 型号谱系 | 二手 |
| Barnes《Cartridges of the World》 | 弹药尺寸规格 | 零售 |

**理论**

| 资料 | 用途 |
|---|---|
| Norton《Design of Machinery》《Kinematics and Dynamics of Machinery》 | 机构运动学与动力学 |
| Shigley《Theory of Machines and Mechanisms》 | 机构学教材 |
| Erdman & Sandor《Mechanism Design》 | 机构综合与枚举 |
| Hibbeler《Engineering Mechanics: Dynamics》；Meriam & Kraige | 刚体动力学、冲量-动量、惯量 |
| Corner《Interior Ballistics》 | 内弹道经典 |
| Hunt / Hinds / Sellier《The Interior Ballistics of Guns》 | 内弹道现代处理 |
| 美军 **AMCP 706-250 系列《Engineering Design Handbook: Gun Series》**（含内弹道、后坐系统分册） | 炮架与后坐系统设计，DTIC 免费 |
| Boothroyd《Product Design for Manufacture and Assembly》 | 装配序列规划（分解序列的逆问题） |
| 中文教材：《火炮与自动武器动力学》《自动武器设计》《自动武器结构设计》（国防工业出版社一类） | 导气装置、闭锁、抽壳的本土公式体系 |
| 俄文：Благонравов《Основания проектирования автоматического оружия》 | 自动武器设计原理源头文献 |

### 3.4 专利与图纸来源

| 来源 | 说明 |
|---|---|
| **Google Patents / Espacenet / 中国专利公布公告** | 按 "firearm bolt locking" "gas piston" "feed mechanism" 检索；优先 1920–1970 年代；过期专利自由使用 |
| **美军 TM / FM 教范、苏军 Наставление по стрелковому делу** | archive.org 大量公有领域扫描，含分解顺序与剖视 |
| **Springfield Armory / 各国兵工厂图纸档案** | 美国国家档案馆（NARA）缩微胶卷目录 |
| **Forgotten Weapons / C&Rsenal / MidwayUSA Gun Tips（YouTube）** | 机构运动的高清动态参考 |
| **GrabCAD / CGTrader / Thingiverse** | 现成 3D 参考，逐项核许可 |

专利附图是示意图、不标尺寸；老军械图纸有尺寸但公差混乱。做仿真只需相对几何，不需公差级精度。

### 3.5 零件商与供应商

| 店铺 | 提供 |
|---|---|
| **Numrich Gun Parts Corp（Gun Parts Corp）** | 逐型号爆炸图与零件编号，分解顺序的直接来源 |
| **Brownells** | 军械师工具、零件、部分爆炸图 |
| **MidwayUSA** | 零件页、分解视频 |
| **GunBroker** | 实物与零件流通 |

### 3.6 几何获取与建模链

实物 → 卡尺/千分尺实测 → 剖面 → 3D 扫描（仅外表面）→ 交叉校正 → CAD 参数化重建（SolidWorks / Fusion，填材料密度由内核自动输出质量与惯性张量）→ 重拓扑 → 烘焙。

**不要用 STL 网格算质量特性**：薄壁件体积误差可达 5%，惯性张量对远离质心的质量更敏感。

### 3.7 工具与许可

| 用途 | 选型 | 许可注意 |
|---|---|---|
| B-rep 内核 | OCCT / Parasolid / ACIS / CGM | OCCT 为 LGPL-2.1 带例外，可闭源商用（动态链接）；Parasolid/ACIS 需席位费 + 出货版税 |
| 约束求解 | planegcs（FreeCAD）/ libslvs（SolveSpace） | 开源 |
| 求解器 | SUNDIALS、Featherstone ABA、Moreau/LCP 时间步进 | — |
| FEA | CalculiX / Code_Aster；Gmsh / Netgen | GPL，走独立进程 IPC 规避传染 |
| CAM | OpenCAMLib、FreeCAD Path、CAMotics（tri-dexel 去除仿真） | 开源 |
| 输出 | ISO 6983 G 代码 / STEP-NC（ISO 14649、AP238） | — |
| GUI | PySide6/Qt + pyqtgraph；或 Tauri + uPlot | — |
| 量纲 | mp-units 一类强类型库 | 全局 SI |

### 3.8 验证基准与流程

- **解析解回归**：Lamé 圆筒、悬臂梁、复摆、曲柄滑块运动学、凸轮轮廓。
- **网格收敛指数 GCI**（Roache）：任何 FEA 结果必须给网格无关性证明。
- **实测**：气室/活塞测压（压电传感器）、960 fps 高速摄影逐帧微分、整枪台架循环射速、抽壳痕迹与弹壳胀大量。
- **流程骨架**：ASME V&V 10/20/40。
- **标定参数**：流量系数 μ（0.6–0.9，由活塞速度曲线反演）、换热系数 α、摩擦 $F_{fric}$（无装药弹簧释放试验单测）。

---

## 收束：仍未闭合的三处

1. **μ 的构型依赖性。** 一次标定的 μ 换个孔位就失效，因为它吸收了 1-D 效应。是否需要按 $L/D$ 与压比建二维插值表，尚无定论。
2. **开锁碰撞的能量分配。** 非弹性碰撞模型给出的速度跃变在高速摄影下能否对上，缺数据。
3. **射手边界的建模深度。** 2–3 自由度肩-臂弹簧-阻尼是否足够，还是必须上更完整的人体模型，取决于最终是做设计工具还是做体感工具。

前两处属于求解器内部，第三处属于产品定位——它决定这个工具到底是给设计员用，还是给玩家用。
