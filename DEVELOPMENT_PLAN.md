# AstroCore 开发文档与实施计划

## 1. 技术架构

- 前端：保留 `templates` 中现有 React + Vite + Tailwind 页面布局。
- 后端：新增 `backend` FastAPI 服务。
- 数据库：V1 使用 SQLite，默认文件为 `backend/data/astrocore.db`。
- ORM：SQLAlchemy。
- 认证：JWT Bearer Token，默认 60 分钟过期。
- 密码：bcrypt 哈希存储。
- 文件：看板 HTML、系统 Logo、用户头像保存在 `backend/storage`。

## 2. 核心功能

- 登录认证与当前用户信息。
- 按角色展示菜单和限制后端 API 访问。
- 看板 CRUD、发布状态、图标修改、HTML 文件上传和 iframe 展示。
- 数据集 CRUD 与 SQL 预览前 100 行。
- 数据源 CRUD 与连接状态测试。
- 用户 CRUD、批量删除、密码修改、头像上传。
- 系统名称、图标、Logo 配置。
- 全局搜索已发布看板。

## 3. 角色权限

- `system_admin`：可访问全部模块。
- `admin`：可访问我的看板和数据集管理。
- `viewer`：仅可访问我的看板和个人设置。

所有管理接口必须在后端做权限校验，前端菜单隐藏只作为体验优化。

## 4. API 分组

- `/api/auth/*`：登录、当前用户。
- `/api/dashboards/*`：看板管理和看板展示。
- `/api/datasets/*`：数据集管理和预览。
- `/api/datasources/*`：数据源管理和连接测试。
- `/api/users/*`：用户管理、头像、密码。
- `/api/system-settings/*`：系统配置。
- `/api/search/dashboards`：全局看板搜索。

## 5. 文件存储

- 看板文件：`backend/storage/dashboard_files/{dashboard_id}/index.html`。
- 上传文件只接受 `.html` / `.htm` 作为看板文件。
- Logo 和头像保存到 `backend/storage/uploads`。
- 后端挂载 `/dashboard-files` 和 `/uploads` 静态访问路径。

## 6. 实施顺序

1. 创建 FastAPI 后端、数据库模型、初始化数据。
2. 实现认证、权限依赖和基础 API。
3. 实现看板、数据集、数据源、用户和系统设置接口。
4. 新增前端 API 封装，替换 mock 登录和 mock 列表。
5. 接入管理页面 CRUD、上传和预览。
6. 联调 admin/demo 两类账号，验证权限和看板 iframe 展示。

## 7. 验收标准

- `admin/admin` 可登录并访问全部后台能力。
- `demo/demo` 可登录但仅能访问我的看板和个人设置。
- 管理员可上传 HTML 看板，发布后普通用户可在我的看板中查看。
- 数据集预览只执行 SELECT，并最多返回 100 行。
- 用户密码修改后可用新密码登录。
- 系统配置保存后刷新页面仍生效。
