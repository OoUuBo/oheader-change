/**
 * @file        oheader-change.js
 * @description 1、改变原有导航的位置和样式。 2、可以隐藏不需要的view图标。 3、记录切换前页面的位置，切回时定位到原来的位置。 4、重复点击当前view的图标，可以返回顶部。
 * @version     2.0
 * @date        2026-02-23
 * @author      sisi
 *
 * @section     修改历史
 * @modification
 * 日期        | 修改者     | 修改说明
 * ------------|------------|---------------------------
 * 2024-03-19  | sisi    | 创建文件
 * 2024-05-19  | sisi    | 修复了侧边栏第一次点击导航不对的问题
 * 2025-02-28  | sisi    | 优化配置加载逻辑：1. 将getConfig改为Promise实现 2. 减少重试次数至50次
 * 2025-02-28  | sisi    | 新增createNavButtons方法，使用文档片段优化DOM操作性能
 * 2025-02-28  | sisi    | 重构run方法为async/await模式，增强代码可读性
 * 2025-04-08  | sisi    | 修复了记忆页面位置功能失效问题
 * 2026-02-15  | sisi    | 位置记忆功能 改用css 方法，进行中。。。（更新到 github oheader-change 独立仓库中）
 * 2026-02-23  | sisi    | 优化代码逻辑，优化代码结构，版本更新到 V2.0
 */
(()=>{

  /**
   * 等待元素DOM渲染+布局完成（HA场景专用）
   * @param {HTMLElement} element 目标元素（如hui-view）
   * @param {number} fallbackDelay 兜底延迟（默认20ms，可选）
   * @returns {Promise<HTMLElement>} 布局完成的元素
   */
  const waitForElementReady = async (element, fallbackDelay = 1) => {
    if (!element) return null;

    // 1. 等待自定义元素DOM渲染完成
    await element.updateComplete;

    if (fallbackDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, fallbackDelay));
      // 兜底后再等一次布局
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    return element;
  };
  
  // 控制台加载信息
  const conInfo = { header: "%c≡ OHassHeaderPositionCard".padEnd(27), ver: "%cversion *DEV " };
  const br = "%c\n";
  const maxLen = Math.max(...Object.values(conInfo).map((el) => el.length));
  for (const [key] of Object.entries(conInfo)) {
    if (conInfo[key].length <= maxLen) conInfo[key] = conInfo[key].padEnd(maxLen);
    if (key == "header") conInfo[key] = `${conInfo[key].slice(0, -1)}⋮ `;
  }
  const header =
  "display:inline-block;border-width:1px 1px 0 1px;border-style:solid;border-color:#424242;color:white;background:#03a9f4;font-size:12px;padding:4px 4.5px 5px 6px;";
  const info = "border-width:0px 1px 1px 1px;padding:7px;background:white;color:#424242;line-height:0.7;";
  console.info(conInfo.header + br + conInfo.ver, header, "", `${header} ${info}`);

  // 等待 hui-view 定义完成， 初始化
  Promise.resolve(customElements.whenDefined("hui-view")).then(() => {
    // 缓存DOM元素
    const DOMS = {};
    DOMS.ha = document.querySelector("home-assistant");
    DOMS.mainRoot = DOMS.ha.shadowRoot.querySelector("home-assistant-main").shadowRoot;
    DOMS.ppr = DOMS.mainRoot.querySelector("partial-panel-resolver");
    DOMS.lovelace = DOMS.ppr.querySelector("ha-panel-lovelace");
    DOMS.drawer = DOMS.mainRoot.querySelector("ha-drawer");
    DOMS.aside = DOMS.drawer.shadowRoot.querySelector("aside");//原始侧边导航
    DOMS.ppr = DOMS.mainRoot.querySelector("partial-panel-resolver");

    // 缓存数据
    const DATA = {};
    DATA.config = DOMS.lovelace.lovelace.config,
    DATA.oheaderConfig = DATA.config.o_header != null ? DATA.config.o_header : {};
    DATA.viewsConfig = DATA.config.views || {};

    /************************ 定义导航按钮 ***********************/
    /**
     * 导航按钮 OCNavButton 模板
     */
    const OCNavButtonTemplate = document.createElement('template');
    OCNavButtonTemplate.innerHTML = /*html*/`
        <style>
          .o_nav_button {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            <!-- padding: 10px; -->
            border: none;
            border-radius: 5px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s ease-in-out;
            transition: background-color 0.3s;
            width: 50px;
            height: 100%;
            color: ${DATA.oheaderConfig.color || "var(--app-header-text-color)"};
          }

          .o_nav_button ha-icon {
            color: inherit;
          }

          .o_nav_button p {
            font-size: 0.85rem; 
            /* 限制最大字号，避免老年模式下文字过大 */
            max-font-size: 14px; 
            /* 最小字号，保证可读性 */
            min-font-size: 12px; 
            color: inherit;
            margin:5px 0px;
          }

          /* 激活按钮样式 */
          .o_nav_button.active {
            opacity: 1;
            <!-- color: red; -->
          }
          @media screen and (orientation: landscape) { 
            .o_nav_button {
              height: 50px;
              width: 100%;
            }
          }
        </style>
        <div class='o_nav_button'>
          <div class="o_nav_icon">
            <ha-icon display-mode="icon" icon="{{view.icon}}"></ha-icon>
          </div>
          <p class="o_nav_text">{{view.title}}</p>
        </div>
    `;

    /**
     * 导航按钮 类
     */
    class OCNavButton extends HTMLElement {
      constructor() {
        super();
      }
      connectedCallback(){
        // 创建影子根
        const shadow = this.attachShadow({ mode: "open" });
        // 直接克隆已解析的模板，无运行时解析
        shadow.appendChild(OCNavButtonTemplate.content.cloneNode(true));

        // 缓存DOM元素
        this.doms = {
          button: shadow.querySelector(".o_nav_button"),
          icon: shadow.querySelector(".o_nav_icon"),
          text: shadow.querySelector(".o_nav_text"),
        };

        // 缓存属性
        this.attrs = {
          // icon Mdi字符
          iconString: this.getAttribute('button-icon'),
          // 按钮名称
          buttonName: this.getAttribute('button-name'),
          // 判断显示模式
          showIcon: this.getAttribute('show-icon'),
          showText: this.getAttribute('show-name'),

        }

        // 渲染组件
        this.render();
      }
      // 设置监听属性
      static get observedAttributes() {
        return ['active'];
      }
      // 属性值改变时调用
      attributeChangedCallback(name, oldVal, newVal) {
        this.showState(name === 'active' && newVal === 'true');
      }
      
      /**
       * 渲染组件方法
       */
      render(){
        if (this.attrs.showIcon === "true"){
          this.doms.icon.querySelector('ha-icon').setAttribute('icon', this.attrs.iconString); 
          this.doms.text.style.display = 'block';
        }else{
          this.doms.text.style.display = 'none';
        } 

        if(this.attrs.showText === "true"){
          this.doms.text.textContent = this.attrs.buttonName;
          this.doms.text.style.display = 'block';
        }else{
          this.doms.text.style.display = 'none';
        }
        // 点击事件 改为 通过父级导航条栏监听
        // div.addEventListener("click", (e) => this.handleNavClick(e, index));
      }
      
      /**
       * 根据是否在激活状态，显示对应样式
       */
      showState(isActive) {
        if(!this.doms.button) return;
        if (isActive) {
          this.doms.button.classList.add("active");
        } else {
          this.doms.button.classList.remove("active");
        }
      }
      /**
       * 增加激活样式方法
       */
      addActiveStyle() {
        this.doms.button.classList.add('active');
      }
      /**
       * 移除激活样式方法
       */
      removeActiveStyle() {
        this.doms.button.classList.remove('active');
      }
    }
    customElements.define("oc-nav-button", OCNavButton);

    /************************ 定义侧边栏显示按钮 ************************/
    /**
     * 侧边栏显示按钮 OCMoreButton 模板
     */
    const OCToggleSideBarButtonTemplate = document.createElement('template');
    OCToggleSideBarButtonTemplate.innerHTML = /*html*/`
        <style>
          .o_toggle_side_bar_button {
              position: relative;
              display: flex;
              justify-content: center;
              align-items: center;
              left: 0px;
              top: 0px;
              width: auto;
              height: 100%;
              margin: auto;
            }
            .o_toggle_side_bar_button ha-icon { 
              transform: rotate(90deg);
            }

        </style>
        <div class="o_toggle_side_bar_button">
          <ha-icon icon="mdi:dots-horizontal"></ha-icon>
        </div>
    `;
    /**
     * 侧边栏显示按钮 类
     */
    class OCToggleSideBarButton extends HTMLElement {
      constructor() {
        super();
      }
      connectedCallback(){
        // 创建影子根
        const shadow = this.attachShadow({ mode: "open" });
        shadow.appendChild(OCToggleSideBarButtonTemplate.content.cloneNode(true));
      }
    }
    customElements.define("oc-toggle-side-bar-button", OCToggleSideBarButton);

    /************************ 定义导航栏 ************************/
    /**
     * 导航栏 OCNavBar 模板
     */
    const OCNavBarTemplate = document.createElement('template');
    OCNavBarTemplate.innerHTML = /*html*/`
        <style>
          .o_nav_bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            top: 0;
            left: 0;
            right: 0;
            height: 100%;
            width: 100%;
            background-color: var(--primary-color);
          }

          .o_nav_bar > oc-toggle-side-bar-button {
            position: absolute;
            width: 0.85rem;
          }

          .o_nav_bar > * {
            height: 100%;
            width: auto;
          }

          @media screen and (orientation: landscape) {
            .o_nav_bar {
              flex-direction: column;
              justify-content: space-around;
            }
            .o_nav_bar > * {
              width: 100%;
              height: auto;
            }

            .o_nav_bar > oc-toggle-side-bar-button {
              position: absolute;
              height: 0.85rem;
              top: 1rem;
            }
          }
        </style>
        <div class="o_nav_bar">
          <oc-toggle-side-bar-button></oc-toggle-side-bar-button>
        </div>
    `;
        
    /**
     * 导航栏 OCNavBar 类
     */
    class OCNavBar extends HTMLElement {
      constructor() {
        super();
        this.doms = {};
        this.isReady = false;
        this.addButtonQueue = [];
      }
      connectedCallback(){
        // 创建影子根
        const shadow = this.attachShadow({ mode: "open" });
        shadow.appendChild(OCNavBarTemplate.content.cloneNode(true));

        // 缓存DOM元素
        this.doms.nav = shadow.querySelector('.o_nav_bar');

        // 缓存属性
        this.attr = {
          // 获取属性
          showMode: this.getAttribute('show-mode'),
        }

        this.isReady = true;
        this.flushButtonQueue();

        // 第一个按钮设为激活样式
        this.highLightButtonByIndex(0);
      }

      /** 
       * 执行待执行队列
       */
      flushButtonQueue() {
        if (!this.isReady || !this.doms.nav) return;
        this.addButtonQueue.forEach(({ icon, name, index}) => {
          this._addButton(icon, name, index); // 调用真正的添加逻辑
        });
        this.buttonQueue = []; // 清空队列
      }

      /**
       * 外部增加导航按钮方法
       */
      addButton(icon, name, index) {
        if (!this.isReady) {
          this.addButtonQueue.push({ icon, name, index});
        } else {
          this._addButton(icon, name, index);
        }
      }

      /**
       * 增加导航按钮
       * @param {string} icon - 图标的mdi字符
       * @param {string} name - 按钮名称
       * @param {number} index - 索引
       */
      _addButton(icon, name, index) {
        const button = document.createElement('oc-nav-button');
        
        button.setAttribute('button-icon', icon);
        button.setAttribute('button-name', name);
        button.setAttribute('button-index', index);

        // 添加按钮显示属性
        if(this.attr.showMode === "icon"){
          button.setAttribute('show-icon', 'true');
          button.setAttribute('show-name', 'false');
        }else if(this.attr.showMode === "text"){
          button.setAttribute('show-icon', 'false');
          button.setAttribute('show-name', 'true');
        }else{
          button.setAttribute('show-icon', 'true');
          button.setAttribute('show-name', 'true');
        }
        this.doms.nav.appendChild(button);
      }
      
      /**
       * 高亮点击的按钮
       */
      highLightButtonByIndex(activeIndex){
        Array.from(this.doms.nav.children).forEach((button,index)=>{
          if(index === activeIndex + 1){
            button.setAttribute('active', 'true');
          }else{
            button.setAttribute('active', 'false');
          }
        })
      }
    }
    customElements.define("oc-nav-bar", OCNavBar);

    /************************ OheaderChange ************************/
    // 定义唯一标识，避免重复执行
    const INIT_FLAG = 'OheaderChange_initialized';
    // oheaderChange 类
    class OheaderChange {
      constructor() {
        this.clickFlag = true;

        // 添加观察器，观察ppr元素（dashboard切换时，调用watchDashboards方法），实现run函数的重载。
        new MutationObserver(this.watchDashboards).observe(DOMS.ppr, {
          childList: true,
        });

        // 调用主函数
        this.run();
      }

      // 主函数
      run() {
        // 检测url中是否有disableOheader参数，有则终结运行
        if(window.location.href.includes("?disableOheader")) return;

        // 缓存DOM，并检测异常状况
        DOMS.lovelace = DOMS.ppr.querySelector("ha-panel-lovelace");
        if (!DOMS.lovelace) return;
        DOMS.hui = DOMS.lovelace.shadowRoot.querySelector("hui-root");
        if (!DOMS.hui) return;
        DOMS.huiRoot = DOMS.hui.shadowRoot;
        if (!DOMS.huiRoot) return;

        this.panelUrl = DOMS.ha.hass.panelUrl;
        this.viewIndex = 0; //初始化view序号

        // 样式渲染
        this.render();

        // 为location change事件，增加滚动条位置设置
        this.setScrollTop(DATA.viewsConfig,DOMS.lovelace);
      }

      /**
       * 主渲染方法
       * @param {*} lovelace 
       * @param {*} config 
       * @param {*} viewsConfig 
       */
      render() {
        // 缓存配置
        const viewsConfig = DATA.viewsConfig;
        const oheaderConfig = DATA.oheaderConfig;
        // 缓存dom
        const huiRoot = DOMS.huiRoot;

        // 添加要调整的 #view 容器 和 导航 布局样式
        const mainNavHeight = (oheaderConfig.height || 80) / 14 + 'rem'; //主导航的高度,单位是px
        const contentContainerStyle = `
              #view {
                padding-top: env(safe-area-inset-top) !important;
                padding-bottom: calc(${mainNavHeight} + env(safe-area-inset-bottom)) !important;
                min-height: calc(100vh + env(safe-area-inset-bottom) - ${mainNavHeight});
                scrollbar-width: none; /* Firefox */
                -ms-overflow-style: none; /* IE/Edge */
                background: var(--primary-background-color);
                
              }  
              #view::-webkit-scrollbar {
                width: 0 !important; /* 隐藏垂直滚动条 */
              }
              #view::-webkit-scrollbar-thumb {
                
                background-color: transparent; /* 滚动条的拖动部分背景色设为透明 */
              }       
              @media screen and (orientation: landscape) {
                #view{
                  width: calc(100vw -  ${mainNavHeight});
                  left:  ${mainNavHeight};
                  padding-bottom: calc( env(safe-area-inset-bottom)) !important;
                  min-height: calc(100vh + env(safe-area-inset-bottom));
                }
              }
              `;
        const navStyle = `
            oc-nav-bar {
              position: fixed;
              top: calc(env(safe-area-inset-top) + 100vh - ${mainNavHeight});
              left: env(safe-area-inset-left);
              display: flex;   /* 开启 Flex 布局（覆盖 block，但保留 block 流特性） */
              justify-content: center; /* 水平居中 */
              align-items: center;     /* 垂直居中 */
              z-index: 4;
              height: ${mainNavHeight};
              width: 100vw;
              background: ${oheaderConfig.nav_background_color || "var(--app-header-background-color)" || "var(--primary-background-color)"};
              overflow-y: hidden;
              -webkit-overflow-scrolling: touch; /* 启用触摸滚动 */
              // touch-action: manipulation; /* 只允许点击，禁止滚动和缩放 */
              // touch-action: none;
              margin-bottom: constant(safe-area-inset-bottom);
              margin-bottom: env(safe-area-inset-bottom);
        
            }
            oc-nav-bar::-webkit-scrollbar {
              width: 0; /* 隐藏垂直滚动条 */
            }
            oc-nav-bar::-webkit-scrollbar-thumb {
              background-color: transparent; /* 滚动条的拖动部分背景色设为透明 */
            }
            
            @media screen and (orientation: landscape) {  /* 媒体查询，横屏样式 */
              :host { 

              }
              oc-nav-bar {
                width: ${mainNavHeight};
                height:100vh;
                flex-direction: column;
                justify-content: space-evenly;
                top: env(safe-area-inset-top);
                left: env(safe-area-inset-left);
                background: ${oheaderConfig.nav_background_color || "var(--app-header-background-color)" || "var(--primary-background-color)"};
              }
            }
            `;
        this.addStyle(contentContainerStyle + navStyle, huiRoot);

        // 移除原始导航栏
        const oldHeader = huiRoot.querySelector("div").querySelector(".header");
        oldHeader.style.display = 'none';

        // 创建新导航栏
        const o_nav = document.createElement("oc-nav-bar");
        DOMS.oNav = o_nav;
        o_nav.setAttribute("slot", "header");
        o_nav.setAttribute("show-mode", DATA.oheaderConfig.showMode || ""); // 显示模式

        viewsConfig.forEach((view, index) => {
          if (!view.o_type) { 
            o_nav.addButton(view.icon, view.title, index);
          }
        });
        huiRoot.querySelector("div").appendChild(o_nav);
        
        // 导航栏监听事件
        o_nav.shadowRoot.querySelector(".o_nav_bar").addEventListener("click",(e)=>{
          this.onNavClick(e);
        });
      }

      // 导航栏点击事件，回调函数
      onNavClick(e){
        // 1. 检查是否点击了侧边栏切换按钮
        const toggleBtn = e.target.closest("oc-toggle-side-bar-button");
        if (toggleBtn) {
          if(!DOMS.aside.className.includes("mdc-drawer--open")){
            DOMS.aside.classList.add("mdc-drawer--open");
          };
          return;
        }
        // 2. 检查是否点击了导航按钮
        const navBtn = e.target.closest("oc-nav-button");
        if (navBtn) {
          const index = navBtn.getAttribute("button-index");
          this.navigateToPath(index);
          DOMS.oNav.highLightButtonByIndex(+index);
          return;
        }
      }
      //click回调
      handleNavClick(event, index) {
        // 按钮触发样式
        if (this.clickFlag) {
          const o_nav_button_arr = event.currentTarget.parentNode.childNodes;
          Array.from(o_nav_button_arr).forEach((element) => {
            element.style.opacity = "0.7";
          });
          event.currentTarget.style.opacity = "1";

          //切换页面
          this.navigateToPath(index);

          // 设置标记为 false，防止重复触发
          this.clickFlag = false;

          // 在一段时间后重新设置标记，以便下一次点击能够触发事件
          setTimeout(() => {
            this.clickFlag = true;
          }, 100);
        }
      }

      //路径导航 replace作用是选择替换和增加历史记录
      navigateToPath(path, replace = false) {
        if (replace) {
          history.replaceState(null, "", path);
        } else {
          history.pushState(null, "", path);
        }
        const event = new CustomEvent("location-changed", {
          detail: {
            path: window.location.pathname, // 必须传路径（HA 监听器依赖这个参数）
            replace: false // 可选：标记是 pushState 还是 replaceState
          },
          bubbles: true, // 允许事件冒泡（HA 事件通常开启）
          cancelable: true // 允许取消事件（可选）
        });
        window.dispatchEvent(event);
      }

      /** 处理页面位置滚动函数 */
      setScrollTop(views,lovelace) {   
        // 1. 缓存DOM节点，避免重复查询
        const huiRoot = DOMS.huiRoot;
        if (!huiRoot) return; // 边界校验：huiRoot不存在直接返回

        const view = huiRoot.querySelector("div#view") || huiRoot.querySelector("div").querySelector("#view");
        if (!view) return; // 边界校验：view节点不存在直接返回

        // 2. 初始化滚动位置数组（优化写法，避免forEach冗余）
        this.scrollTopArr = [];
        views.forEach((view, index) => {
          this.scrollTopArr.push(0);
        });

        if (!window._hasLocationChangedListener) {
          const handleLocationChanged = () =>{
            const oldViewIndex = this.viewIndex;
            // 第一步：存储旧视图的滚动位置（精准时机）
            this.scrollTopArr[oldViewIndex] = window.scrollY || document.documentElement.scrollTop;
            // view.style.opacity = 0; // 立即隐藏视图，避免闪烁

            // 第二步：等待新视图布局完全稳定后再恢复滚动
            waitForElementReady(view).then(() => { 
              const pathname = window.location.pathname;
              const urlSplit = pathname.split("/");
              // 边界校验：路径不符合预期直接返回
              if (urlSplit[1] !== this.panelUrl) return;

              const tag = urlSplit[2];
              let newViewIndex = -1;

              const num = Number(tag);
              if (!isNaN(num) && num >= 0 && num < views.length) {
                newViewIndex = num;
              } else {
                newViewIndex = views.findIndex(view => view.path === tag);
              }

              // 边界校验：newViewIndex无效时重置为0
              if (newViewIndex === -1 || newViewIndex >= views.length) {
                newViewIndex = 0;
              }

              // 滚动位置计算
              const targetScrollTop = (this.viewIndex === newViewIndex)  ? 0 : (this.scrollTopArr[newViewIndex] || 0);
                
              // 实现平滑滚动，代替document.documentElement.scrollTop = targetScrollTop;
              this._smoothScrollTo(targetScrollTop);
              
              // 更新视图索引
              this.viewIndex = newViewIndex;
              
              // 新增：触发滚动完成事件
              const oHeaderscrollCompleteEvent = new CustomEvent('oheader-scroll-restoration-complete', {
                detail: {
                  oldIndex: oldViewIndex,
                  newIndex: newViewIndex,
                  scrollTop: document.documentElement.scrollTop
                }
              });
              window.dispatchEvent(oHeaderscrollCompleteEvent);              
            });
          }
          window.addEventListener("location-changed", handleLocationChanged);
          window._hasLocationChangedListener = true; // 标记已经存在监听器
        }
        
      }

      /** 重新渲染  */
      watchDashboards = (mutations) => {
        // 延时确保元素挂载到文档中，不然会造成run执行过早 获取不到dom元素，异常退出。
        setTimeout(()=>{
          this.run();
        },500);
      };

      /**
       * 给自定义元素增加css样式
       * @param {*} css 
       * @param {*} elem 
       */
      addStyle(css, elem) {
        const style = document.createElement("style");
        style.innerHTML = css;
        elem.appendChild(style);
      }

      // 新增：平滑滚动函数（核心优化，替代瞬间scrollTop）
      _smoothScrollTo(targetTop) {
        const currentTop = window.scrollY || document.documentElement.scrollTop;
        // 目标位置和当前位置一致时，无需滚动
        if (Math.abs(currentTop - targetTop) < 1) return;

        // 平滑滚动配置（兼容原生smooth行为）
        try {
          window.scrollTo({
            top: targetTop,
            behavior: 'smooth' // 原生平滑滚动，丝滑无卡顿
          });
        } catch (e) {
          // 兼容不支持smooth的浏览器，用定时器模拟
          const duration = 300; // 滚动时长（ms）
          const start = currentTop;
          const distance = targetTop - start;
          const startTime = performance.now();

          const step = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // 缓动函数：ease-out，让滚动更自然
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            window.scrollTo(0, start + distance * easeProgress);
            if (progress < 1) {
              requestAnimationFrame(step);
            }
          };
          requestAnimationFrame(step);
        }
      }
    }

    // 双重校验：既检查全局变量，也检查标识
    if (!window.OheaderChange && !document.body.dataset[INIT_FLAG]) {
      // 假设 OheaderChange 是你定义的类，这里做防错处理
        if (typeof OheaderChange === 'function') {
          window.OheaderChange = new OheaderChange();
          // 标记已初始化，防止重复创建
          document.body.dataset[INIT_FLAG] = 'true';
          console.log("OheaderChange 初始化完成");
        } else {
          console.error("OheaderChange 类未定义，初始化失败");
        }
    } else if (window.OheaderChange) {
      console.log("OheaderChange 已存在，跳过初始化");
    }
  })
  .catch((err) => {
    // 捕获可能的异常，避免影响其他代码
      console.error("OheaderChange 初始化过程出错：", err);
  });
})();




