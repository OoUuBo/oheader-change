/**
 * @file        oheader-change.js
 * @description 1、改变原有导航的位置和样式。 2、可以隐藏不需要的view图标。 3、记录切换前页面的位置，切回时定位到原来的位置。 4、重复点击当前view的图标，可以返回顶部。
 * @version     1.0.2
 * @date        2025-02-28
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
 */
(()=>{
  // 定义唯一标识，避免重复执行
  const INIT_FLAG = 'OheaderChange_initialized';
  // 尝试获取config次数
  let LL_ATTEMPTS = 0;

  class OheaderChange {
    constructor() {
      console.log("构造函数执行");
      this.clickFlag = true;
      document.documentElement.style.setProperty("--header-height", "80px");
      this.ha = document.querySelector("home-assistant");
      this.main = this.ha.shadowRoot.querySelector(
        "home-assistant-main"
      ).shadowRoot;
      this.drawer = this.main.querySelector("ha-drawer");
      this.aside = this.drawer.shadowRoot.querySelector("aside");//原始侧边导航
      
      // 添加观察器，观察ppr元素（dashboard切换时，调用watchDashboards方法），实现run函数的重载。
      this.ppr = this.main.querySelector("partial-panel-resolver");
      new MutationObserver(this.watchDashboards).observe(this.ppr, {
        childList: true,
      });

      this.run();
      // console.log("OHassHeaderPositionCard component loaded");
    }

    run(lovelace = this.main.querySelector("partial-panel-resolver").querySelector("ha-panel-lovelace")) {
      // 判读是否符合改变导航位置的条件
      if (!lovelace||window.location.href.includes("?disableOheader")) return;
      
      LL_ATTEMPTS = 0;// 重置尝试次数
      this.panelUrl = this.ha.hass.panelUrl;
      this.viewIndex = 0; //初始化view序号
      this.getConfig(lovelace);
    }

    getConfig(lovelace) {
      LL_ATTEMPTS++;
      try {
        this.llConfig = lovelace.lovelace.config;
        console.log("this.llConfig",this.llConfig);
        const llConfig = this.llConfig;
        if (llConfig.o_header !== undefined) {
          const config = llConfig.o_header !== null ? llConfig.o_header : {};
          const viewsConfig = llConfig.views || {};

          // 样式渲染
          this.processConfig(lovelace, config, viewsConfig);

          // 为location change事件，增加滚动条位置设置
          this.setScrollTop(llConfig.views,lovelace);
        }
      } catch (e) {
        if (LL_ATTEMPTS < 2000) {
          setTimeout(() => this.getConfig(lovelace), 100);
        } else {
          console.log(
            "Lovelace config not found, continuing with default configuration."
          );
          console.log(e);
          this.processConfig(lovelace, {});
        }
      }
    }
    
    processConfig(lovelace, config, viewsConfig) {
      // console.log("begin");
      this.insertStyles(lovelace, viewsConfig);
      // console.log("haaha");
    }

    insertStyles(lovelace, viewsConfig) {
      if (!document.getElementById("body_style")) {
        const styleElement = document.createElement("style");
        styleElement.setAttribute("id", "body_style");
        styleElement.textContent = `
            body::-webkit-scrollbar {
              width: 0 !important; /* 隐藏垂直滚动条 */
            }

            body::-webkit-scrollbar-thumb {
              background-color: transparent; /* 滚动条的拖动部分背景色设为透明 */
            }
          `;
        document.head.appendChild(styleElement);
      }


      //导航部分
      const mainNavHeight = this.llConfig.o_header.height || 80; //主导航的高度,单位是px
      this.hui = lovelace.shadowRoot.querySelector("hui-root");
      const huiRoot = this.hui.shadowRoot;
      const drawerLayout = this.main.querySelector("app-drawer-layout");
      const appheader = huiRoot.querySelector("div").querySelector(".header");
      appheader.style.display = 'none';

      const view = huiRoot.querySelector("div").querySelector("#view");

      const overflowStyle =
        "::slotted(ha-menu-button) {display:none !important;}::slotted(ha-button-menu){display:none !important;}";

      const contentContainerStyle = `
            #view {
              padding-top: env(safe-area-inset-top) !important;
              padding-bottom: calc(var(--header-height) + env(safe-area-inset-bottom)) !important;
              min-height: calc(100vh + env(safe-area-inset-bottom) - var(--header-height));
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
                width: calc(100vw -  ${mainNavHeight}px);
                left:  ${mainNavHeight}px;
                padding-bottom: calc( env(safe-area-inset-bottom)) !important;
                min-height: calc(100vh + env(safe-area-inset-bottom));
              }
            }
            `;
      const buttonStyle = `
          .o_nav {
            position: fixed;
            top: calc(env(safe-area-inset-top) + 100vh - ${mainNavHeight}px);
            left: env(safe-area-inset-left);
            display: flex;
            flex-direction: row;
            z-index: 4;
            flex-shrink: 0;/*flex布局内，保证自身大小不变*/
            justify-content: space-around;
            align-items: center;
            height: ${mainNavHeight}px;
            width: 100vw;
            background: ${this.llConfig.o_header.nav_background_color || "var(--app-header-background-color)" || "var(--primary-background-color)"};
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch; /* 启用触摸滚动 */
            // touch-action: manipulation; /* 只允许点击，禁止滚动和缩放 */
            // touch-action: none;
            margin-bottom: constant(safe-area-inset-bottom);
            margin-bottom: env(safe-area-inset-bottom);
      
          }
          .o_nav::-webkit-scrollbar {
            width: 0; /* 隐藏垂直滚动条 */
          }
          .o_nav::-webkit-scrollbar-thumb {
            background-color: transparent; /* 滚动条的拖动部分背景色设为透明 */
          }
          .o_nav_button {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-decoration: none;
            //padding: 5px;
            //background-color: #3498db;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s;
            width: 50px;
            height: 50px;
            margin: 5px 10px 15px 10px;
            color: ${this.llConfig.o_header.color || "var(--app-header-text-color)"};
          }

          .o_nav_button_more {
            position: absolute;
            left: 0px;
            top: auto;
            transform: rotate(90deg);
            width: auto;
            height: auto;
            margin: 0px;
          }

          .o_nav_button ha-icon {
            color: 100%;
            margin-bottom: 1px;
            width: auto;
            height: auto;
          }
          
          .o_nav_button .o_nav_text {
            font-size: 12px;
            margin-bottom: 1px;
            margin-top: 0px;
            color: 100%;
          }

          .o_nav_button:active {
            transform: scale(0.9);
          }
          
          @media screen and (orientation: landscape) {  /* 媒体查询，横屏样式 */
            :host { 

            }
            .o_nav {
              width: ${mainNavHeight}px;
              height:100vh;
              flex-direction: column;
              justify-content: space-evenly;
              top: env(safe-area-inset-top);
              left: env(safe-area-inset-left);
              background: ${this.llConfig.o_header.nav_background_color || "var(--app-header-background-color)" || "var(--primary-background-color)"};
            }
            .o_nav_button {
              margin: 10px 5px 10px 15px;
            }  
            .o_nav_button_more {
              position: absolute;
              top: 0px;
              left: auto;
              transform: rotate(0deg);
            }
          }
          `;
      // var haAppLayoutRootSlot = haAppLayoutRoot.querySelector("slot");
      // this.addStyle(contentContainerStyle + buttonStyle, haAppLayoutRoot);
      this.addStyle(contentContainerStyle + buttonStyle, huiRoot);
      // console.log("view", huiRoot);
      appheader.style.top = "calc(100vh - var(--header-height))";
      appheader.style.marginBottom = "env(safe-area-inset-bottom)";

      var o_nav = document.createElement("div");
      o_nav.setAttribute("class", "o_nav");
      o_nav.setAttribute("slot", "header");
      
      //原始导航切换按钮
      var oldNavButton = document.createElement("div");
      oldNavButton.setAttribute("class", "o_nav_button o_nav_button_more");

      oldNavButton.addEventListener("click", (event) => {
        // if(this.drawer.getAttribute('open') !== "undefined"){
        //   this.drawer.setAttribute("open", "");
        // };
        if(!this.aside.className.includes("mdc-drawer--open")){
          this.aside.classList.add("mdc-drawer--open");
        };
      });

      (function () {
        let ha_icon = document.createElement("ha-icon");
        ha_icon.setAttribute("icon", "mdi:dots-horizontal");
        oldNavButton.appendChild(ha_icon);
      })();

      o_nav.appendChild(oldNavButton);
      //  
      this.createNavButtons(viewsConfig, o_nav);

      if(huiRoot.querySelector("div").querySelector(".o_nav")){
        let removeNode = huiRoot.querySelector("div").querySelector(".o_nav");
        removeNode.parentNode.removeChild(removeNode);
      }
      huiRoot.querySelector("div").appendChild(o_nav);
      
      
      // haAppLayoutRootSlot.parentNode.replaceChild(o_nav, haAppLayoutRootSlot);
      //手动触发一个resize事件
      window.dispatchEvent(new Event("resize"));
      o_nav.childNodes[1].dispatchEvent(new Event("click"));
      LL_ATTEMPTS = 0;
    }
    createNavButtons(viewsConfig, o_nav) {
      const fragment = document.createDocumentFragment();//创建一个文档片段
      viewsConfig.forEach((view, index) => {
        if (!view.o_type) {
          const div = document.createElement("div");
          div.className = "o_nav_button";
          div.addEventListener("click", (e) => this.handleNavClick(e, index));
    
          // 创建图标
          if (view.icon && !view.onlyTitle) {
            const icon = document.createElement("ha-icon");
            icon.setAttribute("icon", view.icon);
            div.appendChild(icon);
          }
    
          // 创建文字
          if (view.title && !view.onlyIcon) {
            const text = document.createElement("p");
            text.className = "o_nav_text";
            text.textContent = view.title;
            div.appendChild(text);
          }
    
          fragment.appendChild(div);
        }
      });
    
      o_nav.appendChild(fragment);
    }
    //click回调
    handleNavClick(event, index) {
      // 按钮触发样式
      if (this.clickFlag) {
        const o_nav_button_arr = event.currentTarget.parentNode.childNodes;
        Array.from(o_nav_button_arr).forEach((element) => {
          // element.style.color = this.llConfig.o_header.color || "var(app-header-text-color)" || "var(--primary-text-color)";
          element.style.opacity = "0.7";
          });
        // event.currentTarget.style.color = this.llConfig.o_header.activeColor || "var(app-header-text-color)";
        event.currentTarget.style.opacity = "1";

        //设置切换前的scrolltop值

        // console.log("触发前", this.scrollTopArr[this.viewIndex]);
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
      const huiRoot = this.hui?.shadowRoot;
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
            console.log("渲染回流完成");
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
            // console.log("Code executed on next render frame");
            
          });
        }
        window.addEventListener("location-changed", handleLocationChanged);
        window._hasLocationChangedListener = true; // 标记已经存在监听器
      }
      
    }

    /** 重新渲染  */
    watchDashboards = (mutations) => {
      this.run();
    };

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
  
  // Overly complicated console tag.
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




