/**
 * @file        oheader-change.js
 * @description 改变原有导航的位置和样式
 * @version     1.0.1
 * @date        2024-03-19
 * @author      sisi
 *
 * @section     修改历史
 * @modification
 * 日期        | 修改者     | 修改说明
 * ------------|------------|---------------------------
 * 2024-03-19  | sisi    | 创建文件
 * 2024-05-19  | sisi    | 修复了侧边栏第一次点击导航不对的问题
 */

class OheaderChange {
  constructor() {
    this.llAttempts = 0;//尝试次数
    document.documentElement.style.setProperty("--header-height", "80px");
    this.ha = document.querySelector("home-assistant");
    this.panels = this.ha.hass.panels;
    this.main = this.ha.shadowRoot.querySelector(
      "home-assistant-main"
    ).shadowRoot;
    this.aside = this.main.querySelector("ha-drawer").shadowRoot.querySelector("aside");//原始侧边导航
    // console.log("this.aside", this.aside);
    this.user = this.ha.hass.user;
    this.run();
    this.ppr = this.main.querySelector("partial-panel-resolver");
    new MutationObserver(this.watchDashboards).observe(this.ppr, {
      childList: true,
    });
    // console.log("OHassHeaderPositionCard component loaded");
  }
 
  clickFlag = true;

  run(lovelace = this.main.querySelector("partial-panel-resolver").querySelector("ha-panel-lovelace")) {
    // console.log("lovelace", lovelace);
    // console.log("window.location.href",window.location.href.includes("?disableOheader"));
    if (!lovelace||window.location.href.includes("?disableOheader")) {
      // window.OHassHeaderPositionCard = undefined;
      return;
    }

    this.viewIndex = 0; //初始化view序号
    this.getConfig(lovelace);
  }

  getConfig(lovelace) {
    this.panelUrl = this.ha.hass.panelUrl;
    this.llAttempts++;
    try {
      this.llConfig = lovelace.lovelace.config;
      const llConfig = this.llConfig;
      if (llConfig.o_header) {
        const config = llConfig.o_header || {};
        const viewsConfig = llConfig.views || {};
        this.processConfig(lovelace, config, viewsConfig);
        this.setScrollTop(llConfig.views);
      }
    } catch (e) {
      if (this.llAttempts < 200) {
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

  //待处理问题：location-changed 在这里会重复添加
  setScrollTop(views) {
    this.scrollTopArr = [];
    views.forEach((view, index) => {
      this.scrollTopArr.push(0);
    });
    window.addEventListener("location-changed", (e) => {
      const oldViewIndex = this.viewIndex;
      this.scrollTopArr[oldViewIndex] = document.documentElement.scrollTop;
      setTimeout(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const oldViewIndex = this.viewIndex;
            const pathname = window.location.pathname;
            const urlSplit = pathname.split("/");
            if (urlSplit[1] === this.panelUrl) {
              const tag = urlSplit[2];
              const num = Number(tag);
              // 在这里执行你想要延迟到下一次渲染时执行的代码
              if (!isNaN(num)) {
                if (this.viewIndex === num) {
                  //同一个页面 触发
                  document.documentElement.scrollTop = 0;
                } else {
                  //不是同一个页面 触发
                  document.documentElement.scrollTop =
                    this.scrollTopArr[num] || 0;
                  this.viewIndex = num;
                }
              } else {
                const foundIndex = views.findIndex((view) => view.path === tag);
                if (foundIndex !== -1) {
                  this.viewIndex = foundIndex;
                  document.documentElement.scrollTop =
                    this.scrollTopArr[foundIndex] || 0;
                }
              }
              // console.log("Code executed on next render frame");
            }
          }, 0);
        });

        // console.log("newarr2", this.scrollTopArr, "newindex", this.viewIndex);
      }, 0);
    });
  }
  processConfig(lovelace, config, viewsConfig) {
    // console.log("begin");
    this.insertStyles(lovelace, viewsConfig);
    // console.log("haaha");
  }

  insertStyles(lovelace, viewsConfig) {
    // 去掉body滚动条
    // console.log("document.head.getElementById('body_style')",document.getElementById("body_style")=== undefined);
    if (!document.getElementById("body_style")) {
      var styleElement = document.createElement("style");
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
          background: ${this.llConfig.o_header.nav_background_color || "var(--primary-background-color)"};
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
          color: ${this.llConfig.o_header.color || "var(--primary-color)"};
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


    viewsConfig.forEach((view, index) => {
      if (!view.o_type) {
        let div = document.createElement("div");
        div.setAttribute("class", "o_nav_button");
        // div.setAttribute("data-hash", button.link_id);
        div.addEventListener("click", (event) => {
          this.handleNavClick(event, index);
        });

        if (view.icon && !view.onlyTitle) {
          let ha_icon = document.createElement("ha-icon");
          ha_icon.setAttribute("icon", view.icon);
          div.appendChild(ha_icon);
        }
        if (view.title && !view.onlyIcon) {
          let p = document.createElement("p");
          p.setAttribute("class", "o_nav_text");
          p.innerText = view.title;
          div.appendChild(p);
        }
        o_nav.appendChild(div);
      }
    });

    if(huiRoot.querySelector("div").querySelector(".o_nav")){
      let removeNode = huiRoot.querySelector("div").querySelector(".o_nav");
      removeNode.parentNode.removeChild(removeNode);
    }
    huiRoot.querySelector("div").appendChild(o_nav);
    
    
    // haAppLayoutRootSlot.parentNode.replaceChild(o_nav, haAppLayoutRootSlot);
    //手动触发一个resize事件
    window.dispatchEvent(new Event("resize"));
    o_nav.childNodes[1].dispatchEvent(new Event("click"));
    this.llAttempts = 0;
  }

  //click回调
  handleNavClick(event, index) {
    // 按钮触发样式
    if (this.clickFlag) {
      const o_nav_button_arr = event.currentTarget.parentNode.childNodes;
      Array.from(o_nav_button_arr).forEach((element) => {
        element.style.color =
          this.llConfig.o_header.color || "var(--primary-color)";
      });
      event.currentTarget.style.color =
        this.llConfig.o_header.activeColor || "var(--state-icon-color)";
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
    const event = new Event("location-changed");
    window.dispatchEvent(event);
  }

  // Run on dashboard change.
  watchDashboards = (mutations) => {
    // console.log("mutations", mutations);
    const pathname = window.location.pathname;
    const urlSplit = pathname.split("/");
    // console.log("oldpanelurl", this.panelUrl);
    // console.log("newpanelurl", urlSplit[1]);
    if (this.panelUrl !== urlSplit[1]) {
      mutations.forEach(({ addedNodes }) => {
        // console.log("addedNodes",addedNodes);
        // console.log("addedNodes",addedNodes.includes("ha-panel"));
        for (let node of addedNodes)
          if (node.localName.includes("ha-panel-")) {
            // this.runTag = 0;
            this.run();
          }
      });
    }
  };

  setOptions(config) {
    /*
        this.hideHeader = config.kiosk || config.hide_header;
        this.hideSidebar = config.kiosk || config.hide_sidebar;
        this.hideOverflow = config.kiosk || config.hide_overflow;
        this.hideMenuButton = config.kiosk || config.hide_menubutton;
        this.ignoreEntity = config.ignore_entity_settings;
        this.ignoreMobile = config.ignore_mobile_settings;
        */
  }

  // Convert to array.
  array(x) {
    return Array.isArray(x) ? x : [x];
  }

  // Return true if keyword is found in query strings.
  queryString(keywords) {
    return this.array(keywords).some((x) => window.location.search.includes(x));
  }

  // Set localStorage item.
  setCache(k, v) {
    this.array(k).forEach((x) => window.localStorage.setItem(x, v));
  }

  // Retrieve localStorage item as bool.
  cached(key) {
    return this.array(key).some(
      (x) => window.localStorage.getItem(x) == "true"
    );
  }

  styleExists(elem) {
    return elem.querySelector(`#kiosk_mode_${elem.localName}`);
  }

  addStyle(css, elem) {
    if (!this.styleExists(elem)) {
      const style = document.createElement("style");
      style.setAttribute("id", `kiosk_mode_${elem.localName}`);
      style.innerHTML = css;
      elem.appendChild(style);
    }
  }

  removeStyle(elements) {
    this.array(elements).forEach((elem) => {
      if (this.styleExists(elem))
        elem.querySelector(`#kiosk_mode_${elem.localName}`).remove();
    });
  }
}

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

// customElements.define('o-hass-header-position-card',OHassHeaderPositionCard);
window.oldLocation = window.location.pathname.split("/")[1];

window.addEventListener("location-changed", (e) => {
  console.log("oldLocation",window.oldLocation);
  const pathname = window.location.pathname;
  const urlSplit = pathname.split("/")[1];
  if(window.oldLocation !== urlSplit){
    window.oldLocation = urlSplit;
    console.log("urlSplit",urlSplit);
    window.OheaderChange;
  }
  
});

// Initial Run

Promise.resolve(customElements.whenDefined("hui-view")).then(() => {
  if (!window.OheaderChange) {
    window.OheaderChange = new OheaderChange();
    // console.log("OheaderChange loaded");
   }
});


