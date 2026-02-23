# Oheader Change Card
- 如果你的homeassistant ui view页很多，并且需要一个简洁的导航栏，那么这个项目就适合你。
- 同时适用于 手机、平板 和 电脑端。

### 功能简介
- 隐藏默认的导航栏，同时通过配置将需要的view导航按钮添加到导航栏中。
- 记录每个页面的滚动位置，在不同页面切换时，始终能恢复到上次的滚动位置。
- 切换到某个页面时，如果再次点击同一个导航按钮，则会滚动到页面的顶部。

### 安装方法
1. 下载此文件：oheader-change.js
2. 将该文件添加到你的 /www 文件夹中
3. 在仪表盘界面点击右上角的图标，然后选择「编辑仪表盘（Edit dashboard）」
4. 再次点击该图标，接着选择「管理资源（Manage resources）」
5. 点击「添加资源（Add resource）」
6. 复制并粘贴以下内容：/local/oheader-change.js
7. 选择「JavaScript 模块（JavaScript Module）」，然后点击「创建（Create）」
8. 重启homeassistant，并刷新页面。


### 配置说明
```yaml
# 在配置文件的最外层添加o_header属性
o_header: {
    showMode: 'icon', #  显示模式，可选值：icon（仅图标）、text（仅文字）。默认时图标 文字同时显示。
    color：blue; # 图标和文字颜色
}

# 视图配置
views: 
  # 需要生成导航的页面，保持默认即可。
  - title: xxx
    path: xxx
    icon: xxx
    ...
  # 子页面的视图,不需要导航按键的通过添加o_type属性为任意值。
  - title: B1·影音室
    path: b1_ying_yin_shi
    o_type: popup # o_type属性为任意值时，该页面就不会生成导航页面。适用于子页面，建议在此类页面配置返回按钮。
    type: sections
    sections: []
```
